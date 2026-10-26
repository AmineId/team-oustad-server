const prisma = require('../utils/prismaClient');
const { ENTITIES } = require('../utils/audit');

/**
 * Lecture de l'historique (AuditLog), réservée au super-owner (contrôle fait
 * par la route). Les entrées sont écrites par utils/audit.js.
 */

class AuditError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

const ACTIONS = ['create', 'update', 'delete'];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const AUDIT_INCLUDE = {
  Actor: { select: { displayId: true, firstName: true, lastName: true, role: true } },
  Gym: { select: { displayId: true, name: true } },
};

function toEntry(row) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    entityDisplayId: row.entityDisplayId,
    label: row.label,
    gym: row.Gym,
    actor: row.Actor,
    actorLabel: row.actorLabel,
    actorRole: row.actorRole,
    source: row.source,
    changes: row.changes,
  };
}

function parseDate(value, field) {
  if (value === undefined || value === '') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AuditError(400, 'invalid_date', `${field} doit être une date ISO 8601`);
  return date;
}

function parseLimit(value) {
  if (value === undefined || value === '') return DEFAULT_LIMIT;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) throw new AuditError(400, 'invalid_limit', 'limit doit être un entier positif');
  return Math.min(limit, MAX_LIMIT);
}

/** id interne d'un User ou d'une Gym à partir de son displayId (ou de son id). */
async function resolveId(model, value) {
  if (value === undefined || value === '') return undefined;
  const raw = String(value);
  const where = /^\d+$/.test(raw) ? { id: Number(raw) } : { displayId: raw };
  const row = await prisma[model].findUnique({ where, select: { id: true } });
  return row ? row.id : null;
}

async function buildWhere(query) {
  const { entity, action, entityId, q } = query;
  const where = {};

  if (entity !== undefined && entity !== '') {
    if (!ENTITIES.includes(entity)) throw new AuditError(400, 'invalid_entity', `entity inconnue : ${entity}`);
    where.entity = entity;
  }
  if (action !== undefined && action !== '') {
    if (!ACTIONS.includes(action)) throw new AuditError(400, 'invalid_action', `action doit valoir ${ACTIONS.join(', ')}`);
    where.action = action;
  }
  if (entityId !== undefined && entityId !== '') {
    where.OR = [{ entityId: String(entityId) }, { entityDisplayId: String(entityId) }];
  }

  const actorId = await resolveId('user', query.actorId);
  if (actorId !== undefined) where.actorId = actorId ?? -1;
  const gymId = await resolveId('gym', query.gymId);
  if (gymId !== undefined) where.gymId = gymId ?? -1;

  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');
  if (from || to) where.createdAt = { ...(from && { gte: from }), ...(to && { lte: to }) };

  if (q !== undefined && String(q).trim() !== '') {
    const text = String(q).trim();
    where.AND = [{
      OR: [
        { label: { contains: text, mode: 'insensitive' } },
        { actorLabel: { contains: text, mode: 'insensitive' } },
        { entityDisplayId: { contains: text, mode: 'insensitive' } },
      ],
    }];
  }

  if (query.before !== undefined && query.before !== '') {
    const before = Number(query.before);
    if (!Number.isInteger(before) || before < 1) throw new AuditError(400, 'invalid_cursor', 'before doit être un id d\'entrée');
    where.id = { lt: before };
  }
  return where;
}

/** Page d'entrées, de la plus récente à la plus ancienne. */
async function listAuditLogs(query = {}) {
  const limit = parseLimit(query.limit);
  const rows = await prisma.auditLog.findMany({
    where: await buildWhere(query),
    include: AUDIT_INCLUDE,
    orderBy: { id: 'desc' },
    take: limit + 1,
  });
  return { entries: rows.slice(0, limit).map(toEntry), hasMore: rows.length > limit };
}

async function getAuditLog(id) {
  const auditId = Number(id);
  if (!Number.isInteger(auditId) || auditId < 1) throw new AuditError(400, 'invalid_id', 'id invalide');
  const row = await prisma.auditLog.findUnique({ where: { id: auditId }, include: AUDIT_INCLUDE });
  if (!row) throw new AuditError(404, 'not_found', 'Entrée introuvable');
  return toEntry(row);
}

function getMeta() {
  return { entities: ENTITIES, actions: ACTIONS };
}

module.exports = {
  AuditError,
  ACTIONS,
  listAuditLogs,
  getAuditLog,
  getMeta,
};
