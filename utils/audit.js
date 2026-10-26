const { Prisma } = require('@prisma/client');
const logger = require('./logger');
const { getAuditContext } = require('./auditContext');

/**
 * Historique des écritures (AuditLog) : extension Prisma qui intercepte les
 * create / update / upsert / delete (et leurs variantes *Many) faites dans un
 * contexte d'audit (requête HTTP ou tâche planifiée, cf. utils/auditContext.js).
 *
 * Les lectures annexes (état « avant », libellés) passent par le client de
 * base, hors transaction. Les entrées sont écrites après coup, sans bloquer
 * l'opération : une écriture d'audit qui attendrait un verrou tenu par la
 * transaction en cours la bloquerait. Limites connues : une transaction
 * annulée laisse ses entrées, et les écritures imbriquées (`Member: { create }`)
 * ni le SQL brut ($executeRaw) ne sont journalisés.
 */

const NOT_AUDITED = new Set(['AuditLog', 'IncidentRead']);
const WRITE_OPS = new Set([
  'create', 'createMany', 'createManyAndReturn',
  'update', 'updateMany', 'updateManyAndReturn',
  'upsert', 'delete', 'deleteMany',
]);
/** Au-delà, une opération *Many produit une seule entrée de synthèse. */
const MAX_ROWS_PER_OPERATION = 200;

/** Champs dont la valeur n'est jamais stockée. Les champs Bytes aussi. */
const REDACTED_FIELDS = new Set([
  'password', 'token', 'uniqueCode', 'currentSessionId', 'kioskSessionId', 'fcmToken',
]);
const REDACTED = '[masqué]';
/** Champs techniques : ignorés dans les diffs (une mise à jour qui ne touche qu'eux n'est pas journalisée). */
const IGNORED_FIELDS = new Set(['updatedAt', 'lastLoginAt', 'currentSessionId', 'kioskSessionId', 'fcmToken']);

const PRIMARY_KEYS = {
  Coach: ['userId'],
  Manager: ['userId'],
  Member: ['userId'],
  Owner: ['userId'],
  ShowcasePage: ['key'],
  CoachGym: ['coachId', 'gymId'],
  TrainingSessionMember: ['sessionId', 'memberId'],
  IncidentRead: ['incidentId', 'userId'],
};

/** Clés étrangères dont on fige un libellé lisible (fromLabel / toLabel). */
const FOREIGN_KEY_TARGETS = {
  userId: 'User', memberId: 'User', coachId: 'User', authorId: 'User',
  createdBy: 'User', assignedBy: 'User', closedBy: 'User', actorId: 'User',
  gymId: 'Gym',
  subscriptionTypeId: 'SubscriptionType',
  subscriptionId: 'Subscription',
  programId: 'Program',
  exerciseId: 'Exercise',
  sessionId: 'TrainingSession',
  productId: 'StoreProduct',
  incidentId: 'Incident',
  bannerId: 'Banner',
};

const MODELS = Object.fromEntries(Prisma.dmmf.datamodel.models.map((model) => {
  const scalars = model.fields.filter((f) => f.kind !== 'object');
  return [model.name, {
    scalars: new Set(scalars.map((f) => f.name)),
    types: Object.fromEntries(scalars.map((f) => [f.name, f.type])),
  }];
}));

const ENTITIES = Object.keys(MODELS).filter((name) => !NOT_AUDITED.has(name)).sort();

const delegateOf = (client, model) => client[model[0].toLowerCase() + model.slice(1)];
const primaryKeyOf = (model) => PRIMARY_KEYS[model] || ['id'];

function uniqueWhere(model, row) {
  const keys = primaryKeyOf(model);
  if (keys.some((k) => row[k] == null)) return null;
  if (keys.length === 1) return { [keys[0]]: row[keys[0]] };
  return { [keys.join('_')]: Object.fromEntries(keys.map((k) => [k, row[k]])) };
}

function entityIdOf(model, row) {
  const keys = primaryKeyOf(model);
  if (keys.some((k) => row[k] == null)) return null;
  return keys.map((k) => String(row[k])).join(':');
}

/** Ne garde que les colonnes du modèle (retire les relations incluses). */
function scalarsOf(model, row) {
  if (!row || typeof row !== 'object') return {};
  const { scalars } = MODELS[model];
  return Object.fromEntries(Object.entries(row).filter(([k]) => scalars.has(k)));
}

const isPlainObject = (v) => v != null && typeof v === 'object' && !(v instanceof Date)
  && !Buffer.isBuffer(v) && !(v instanceof Uint8Array) && !Array.isArray(v) && !Prisma.Decimal.isDecimal(v);

/** Valeurs écrites par `data` (set, increment… appliqués à l'état avant). */
function applyData(model, before, data) {
  const { scalars, types } = MODELS[model];
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (!scalars.has(key) || value === undefined) continue;
    if (types[key] === 'Json' || !isPlainObject(value)) {
      out[key] = value;
      continue;
    }
    const current = Number(before?.[key] ?? 0);
    if ('set' in value) out[key] = value.set;
    else if ('increment' in value) out[key] = current + Number(value.increment);
    else if ('decrement' in value) out[key] = current - Number(value.decrement);
    else if ('multiply' in value) out[key] = current * Number(value.multiply);
    else if ('divide' in value) out[key] = current / Number(value.divide);
  }
  return out;
}

function serialize(model, field, value) {
  if (value == null) return null;
  if (REDACTED_FIELDS.has(field) || MODELS[model].types[field] === 'Bytes') return REDACTED;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint' || Prisma.Decimal.isDecimal(value)) return value.toString();
  return value;
}

function sameValue(a, b) {
  if (a == null || b == null) return a == null && b == null;
  if (a instanceof Uint8Array && b instanceof Uint8Array) return Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return String(a) === String(b);
}

/** { champ: { from, to } } entre deux états (null = absent). */
function diff(model, before, after) {
  const changes = {};
  const fields = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const field of fields) {
    if (IGNORED_FIELDS.has(field)) continue;
    const from = before ? before[field] : null;
    const to = after ? after[field] : null;
    if (before && after && !(field in after)) continue;
    if (sameValue(from, to)) continue;
    changes[field] = { from: serialize(model, field, from), to: serialize(model, field, to) };
  }
  return changes;
}

function labelOf(model, row) {
  if (!row) return null;
  if (row.firstName || row.lastName) return [row.firstName, row.lastName].filter(Boolean).join(' ');
  return row.title || row.name || row.displayId || null;
}

const userLabel = (u) => [u.firstName, u.lastName].filter(Boolean).join(' ');

/**
 * Résout en une passe les libellés des clés étrangères, le libellé des lignes
 * de profil (Member, Coach…, nommées d'après leur User) et la salle de chaque
 * entrée (gymId direct, sinon celle de l'utilisateur concerné).
 */
async function enrich(base, entries) {
  const wanted = {};
  const want = (target, id) => {
    if (id == null || !Number.isInteger(Number(id))) return;
    (wanted[target] ||= new Set()).add(Number(id));
  };
  for (const entry of entries) {
    for (const [field, change] of Object.entries(entry.changes)) {
      const target = FOREIGN_KEY_TARGETS[field];
      if (target) { want(target, change.from); want(target, change.to); }
    }
    want('User', entry.ownerUserId);
  }

  const labels = {};
  const userGyms = {};
  await Promise.all(Object.entries(wanted).map(async ([target, ids]) => {
    const rows = await delegateOf(base, target).findMany({ where: { id: { in: [...ids] } } });
    labels[target] = {};
    for (const row of rows) {
      labels[target][row.id] = target === 'User' ? userLabel(row) : labelOf(target, row);
      if (target === 'User') userGyms[row.id] = row.gymId;
    }
  }));

  for (const entry of entries) {
    for (const [field, change] of Object.entries(entry.changes)) {
      const target = FOREIGN_KEY_TARGETS[field];
      if (!target) continue;
      const fromLabel = labels[target]?.[change.from];
      const toLabel = labels[target]?.[change.to];
      if (fromLabel) change.fromLabel = fromLabel;
      if (toLabel) change.toLabel = toLabel;
    }
    if (entry.ownerUserId != null) {
      entry.label ||= labels.User?.[entry.ownerUserId] || null;
      if (entry.gymId == null) entry.gymId = userGyms[entry.ownerUserId] ?? null;
    }
    entry.label ||= entry.entityDisplayId;
    delete entry.ownerUserId;
  }
}

async function actorOf(base, context) {
  if (context.actorLabel === undefined) {
    context.actorLabel = 'Anonyme';
    if (context.actorId != null) {
      const user = await base.user.findUnique({
        where: { id: context.actorId },
        select: { firstName: true, lastName: true, role: true },
      });
      context.actorLabel = user ? userLabel(user) : `Utilisateur #${context.actorId}`;
      context.actorRole = context.actorRole || user?.role || null;
    }
  }
  return { actorId: context.actorId ?? null, actorRole: context.actorRole ?? null, actorLabel: context.actorLabel };
}

function entryFor(model, action, row, changes) {
  const scalars = row || {};
  return {
    action,
    entity: model,
    entityId: row ? entityIdOf(model, row) : null,
    entityDisplayId: scalars.displayId || null,
    label: model === 'User' ? labelOf(model, scalars) : (scalars.title || scalars.name || null),
    gymId: model === 'Gym' ? (action === 'delete' ? null : scalars.id ?? null) : scalars.gymId ?? null,
    ownerUserId: model === 'User' ? null : (scalars.userId ?? scalars.memberId ?? scalars.coachId ?? null),
    changes,
  };
}

function summaryEntry(model, action, count, data) {
  const changes = { _count: { from: null, to: count } };
  for (const [field, value] of Object.entries(applyData(model, {}, data))) {
    if (!IGNORED_FIELDS.has(field)) changes[field] = { from: null, to: serialize(model, field, value) };
  }
  return { action, entity: model, entityId: null, entityDisplayId: null, label: `${count} lignes`, gymId: null, ownerUserId: null, changes };
}

const pending = new Set();

async function persist(base, context, entries) {
  if (entries.length === 0) return;
  const actor = await actorOf(base, context);
  await enrich(base, entries);
  const rows = entries.map((e) => ({ ...e, ...actor, source: context.source || null }));
  try {
    await base.auditLog.createMany({ data: rows });
  } catch (error) {
    // Salle ou auteur supprimés entre-temps : garder l'entrée sans le lien
    if (error.code !== 'P2003') throw error;
    await base.auditLog.createMany({ data: rows.map((r) => ({ ...r, gymId: null, actorId: null })) });
  }
}

function schedule(base, context, build) {
  const task = Promise.resolve()
    .then(build)
    .then((entries) => persist(base, context, entries))
    .catch((error) => logger.error(`Audit : écriture impossible (${error.message})`))
    .finally(() => pending.delete(task));
  pending.add(task);
}

/** Attend la fin des écritures d'audit en cours (tests, arrêt du serveur). */
async function flushAudit() {
  while (pending.size) await Promise.all([...pending]);
}

async function audited(base, { model, operation, args, query }) {
  const context = getAuditContext();
  if (!context || NOT_AUDITED.has(model) || !WRITE_OPS.has(operation)) return query(args);
  const delegate = delegateOf(base, model);

  switch (operation) {
    case 'create': {
      const result = await query(args);
      const row = { ...applyData(model, {}, args.data), ...scalarsOf(model, result) };
      schedule(base, context, () => [entryFor(model, 'create', row, diff(model, null, row))]);
      return result;
    }
    case 'update':
    case 'upsert': {
      const before = await delegate.findUnique({ where: args.where });
      const result = await query(args);
      if (!before) {
        const row = { ...applyData(model, {}, args.create), ...scalarsOf(model, result) };
        schedule(base, context, () => [entryFor(model, 'create', row, diff(model, null, row))]);
      } else {
        const data = operation === 'upsert' ? args.update : args.data;
        const after = { ...before, ...applyData(model, before, data), ...scalarsOf(model, result) };
        schedule(base, context, () => {
          const changes = diff(model, before, after);
          return Object.keys(changes).length ? [entryFor(model, 'update', after, changes)] : [];
        });
      }
      return result;
    }
    case 'delete': {
      const before = await delegate.findUnique({ where: args.where });
      const result = await query(args);
      const row = before || scalarsOf(model, result);
      schedule(base, context, () => [entryFor(model, 'delete', row, diff(model, row, null))]);
      return result;
    }
    case 'createMany':
    case 'createManyAndReturn': {
      const result = await query(args);
      const items = Array.isArray(args.data) ? args.data : [args.data];
      const rows = operation === 'createManyAndReturn'
        ? result.map((r, i) => ({ ...applyData(model, {}, items[i]), ...scalarsOf(model, r) }))
        : items.map((item) => applyData(model, {}, item));
      schedule(base, context, () => (rows.length > MAX_ROWS_PER_OPERATION
        ? [summaryEntry(model, 'create', rows.length, {})]
        : rows.map((row) => entryFor(model, 'create', row, diff(model, null, row)))));
      return result;
    }
    case 'updateMany':
    case 'updateManyAndReturn':
    case 'deleteMany': {
      const befores = await delegate.findMany({ where: args.where, take: MAX_ROWS_PER_OPERATION + 1 });
      const result = await query(args);
      const action = operation === 'deleteMany' ? 'delete' : 'update';
      schedule(base, context, () => {
        if (befores.length > MAX_ROWS_PER_OPERATION) {
          const count = typeof result?.count === 'number' ? result.count : result.length;
          return [summaryEntry(model, action, count, action === 'update' ? args.data : {})];
        }
        return befores.flatMap((before) => {
          const after = action === 'delete' ? null : { ...before, ...applyData(model, before, args.data) };
          const changes = diff(model, before, after);
          return Object.keys(changes).length ? [entryFor(model, action, after || before, changes)] : [];
        });
      });
      return result;
    }
    default:
      return query(args);
  }
}

/** Client Prisma qui journalise ses écritures dans AuditLog. */
function withAudit(base) {
  return base.$extends({
    name: 'audit',
    query: {
      $allModels: {
        $allOperations: (params) => audited(base, params),
      },
    },
  });
}

module.exports = {
  withAudit,
  flushAudit,
  ENTITIES,
  REDACTED,
  FOREIGN_KEY_TARGETS,
};
