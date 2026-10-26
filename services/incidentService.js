const crypto = require('crypto');
const prisma = require('../utils/prismaClient');
const { GYM_REF_SELECT, COACH_REF_SELECT, toCoachRef, canAccessGym } = require('../utils/staffScope');
const { CLIENTS } = require('../utils/roles');

/**
 * Rôles V2 : incidents.
 * - Création : manager (sa salle, app ou kiosk), coach (une de ses salles, app uniquement)
 * - Lecture : owner (tout), manager (sa salle), coach (les siens)
 * - Chat : l'owner et le créateur écrivent ; tout lecteur suit ses non-lus (IncidentRead)
 * - Statut : owner uniquement
 */
class IncidentError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

const CATEGORIES = ['equipment', 'safety', 'hygiene', 'member', 'other'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const PHOTO_MIME = /^image\/(jpeg|png|webp)$/;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const DEFAULT_MESSAGE_PAGE = 50;
const MAX_MESSAGE_PAGE = 100;

const generateIncidentId = () => `INCIDENT-${crypto.randomBytes(8).toString('hex')}`;

const AUTHOR_SELECT = { ...COACH_REF_SELECT, role: true };

const INCIDENT_INCLUDE = {
  Gym: { select: GYM_REF_SELECT },
  Creator: { select: AUTHOR_SELECT },
  Closer: { select: COACH_REF_SELECT },
  _count: { select: { Messages: true } },
  Messages: { orderBy: { id: 'desc' }, take: 1, include: { Author: { select: AUTHOR_SELECT } } }
};

function toAuthor(user) {
  return user ? { ...toCoachRef(user), role: user.role } : null;
}

function toIncident(incident, { messages, unreadCount = 0 } = {}) {
  return {
    id: incident.id,
    displayId: incident.displayId,
    gymId: incident.gymId,
    gym: incident.Gym,
    createdBy: toAuthor(incident.Creator),
    creatorRole: incident.creatorRole,
    source: incident.source,
    title: incident.title,
    description: incident.description,
    category: incident.category,
    severity: incident.severity,
    hasPhoto: incident.hasPhoto ?? incident.photo != null,
    status: incident.status,
    closedAt: incident.closedAt,
    closedBy: toCoachRef(incident.Closer),
    messagesCount: incident._count?.Messages ?? 0,
    lastMessage: incident.Messages?.[0] ? toMessage(incident.Messages[0]) : null,
    unreadCount,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
    ...(messages && { messages: messages.map(toMessage) })
  };
}

function toMessage(message) {
  return {
    id: message.id,
    incidentId: message.incidentId,
    authorId: message.authorId,
    author: toAuthor(message.Author),
    body: message.body,
    createdAt: message.createdAt
  };
}

// Ne charge pas la photo (Bytes) dans les listes : seulement sa présence
const INCIDENT_SELECT = {
  id: true, displayId: true, gymId: true, createdBy: true, creatorRole: true, source: true,
  title: true, description: true, category: true, severity: true, photoMime: true, status: true,
  closedAt: true, closedBy: true, createdAt: true, updatedAt: true,
  ...INCIDENT_INCLUDE
};

function withHasPhoto(incident) {
  return { ...incident, hasPhoto: incident.photoMime != null };
}

// ==================== Validation ====================

function requiredText(value, field, max) {
  if (typeof value !== 'string' || !value.trim()) throw new IncidentError(400, 'missing_fields', `${field} requis`);
  if (value.length > max) throw new IncidentError(400, 'invalid_field', `${field} trop long (${max} caractères max)`);
  return value.trim();
}

function oneOf(value, allowed, field) {
  if (!allowed.includes(value)) throw new IncidentError(400, 'invalid_field', `${field} doit valoir ${allowed.join(', ')}`);
  return value;
}

/** Photo : fichier multipart ({ buffer, mimetype }) ou data URI base64 ("data:image/png;base64,..."). */
function parsePhoto(file, photoData) {
  if (file) {
    if (!PHOTO_MIME.test(file.mimetype)) throw new IncidentError(400, 'invalid_photo', 'Photo JPEG, PNG ou WebP attendue');
    return { photo: file.buffer, photoMime: file.mimetype };
  }
  if (!photoData) return {};
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(photoData);
  if (!match) throw new IncidentError(400, 'invalid_photo', 'photoData doit être une data URI image/jpeg|png|webp en base64');
  const photo = Buffer.from(match[2], 'base64');
  if (photo.length > MAX_PHOTO_BYTES) throw new IncidentError(400, 'invalid_photo', 'Photo trop lourde (5 Mo max)');
  return { photo, photoMime: match[1] };
}

// ==================== Portée ====================

function canRead(requester, incident) {
  switch (requester.role) {
    case 'owner':
      return true;
    case 'manager':
      return incident.gymId === requester.gymId;
    case 'coach':
      return incident.createdBy === requester.id;
    default:
      return false;
  }
}

async function getReadableIncident(id, requester) {
  const incident = await prisma.incident.findUnique({ where: { id }, select: INCIDENT_SELECT });
  if (!incident) throw new IncidentError(404, 'incident_not_found', 'Incident introuvable');
  if (!canRead(requester, incident)) throw new IncidentError(403, 'forbidden', 'Incident hors de votre portée');
  return withHasPhoto(incident);
}

// ==================== Non-lus ====================

/** Messages des autres postérieurs au dernier lu par `userId`, par incident. */
async function unreadCounts(userId, incidentIds) {
  if (incidentIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw`
    SELECT m."incidentId" AS "incidentId", COUNT(*)::int AS "count"
    FROM "IncidentMessage" m
    LEFT JOIN "IncidentRead" r ON r."incidentId" = m."incidentId" AND r."userId" = ${userId}
    WHERE m."incidentId" = ANY(${incidentIds}::int[])
      AND m."authorId" <> ${userId}
      AND m."id" > COALESCE(r."lastReadMessageId", 0)
    GROUP BY m."incidentId"`;
  return new Map(rows.map(r => [r.incidentId, r.count]));
}

/** Avance le curseur de lecture, sans jamais reculer. */
async function advanceRead(incidentId, userId, messageId) {
  await prisma.$executeRaw`
    INSERT INTO "IncidentRead" ("incidentId", "userId", "lastReadMessageId", "readAt")
    VALUES (${incidentId}, ${userId}, ${messageId}, NOW())
    ON CONFLICT ("incidentId", "userId") DO UPDATE
    SET "lastReadMessageId" = GREATEST("IncidentRead"."lastReadMessageId", EXCLUDED."lastReadMessageId"),
        "readAt" = NOW()`;
}

// ==================== Opérations ====================

async function createIncident(input, file, requester, client) {
  if (!['manager', 'coach'].includes(requester.role)) {
    throw new IncidentError(403, 'forbidden', 'Seuls les managers et les coachs signalent des incidents');
  }
  // Le kiosk est réservé au staff de salle : un coach ne signale que depuis l'app
  if (client === CLIENTS.KIOSK && requester.role !== 'manager') {
    throw new IncidentError(403, 'kiosk_forbidden_role', 'Signalement depuis le kiosk réservé aux managers');
  }

  let gymId = input.gymId !== undefined && input.gymId !== '' ? Number(input.gymId) : undefined;
  if (requester.role === 'manager') {
    if (gymId !== undefined && gymId !== requester.gymId) {
      throw new IncidentError(403, 'forbidden', 'Un manager signale uniquement pour sa salle');
    }
    gymId = requester.gymId;
  } else {
    if (!Number.isInteger(gymId)) throw new IncidentError(400, 'gym_id_required', 'gymId requis');
    if (!(await canAccessGym(requester, gymId))) throw new IncidentError(403, 'forbidden', 'Salle hors de vos salles');
  }

  const incident = await prisma.incident.create({
    data: {
      displayId: generateIncidentId(),
      gymId,
      createdBy: requester.id,
      creatorRole: requester.role,
      source: client === CLIENTS.KIOSK ? 'kiosk' : 'app',
      title: requiredText(input.title, 'title', 200),
      description: requiredText(input.description, 'description', 5000),
      category: oneOf(input.category, CATEGORIES, 'category'),
      severity: oneOf(input.severity, SEVERITIES, 'severity'),
      ...parsePhoto(file, input.photoData)
    },
    select: INCIDENT_SELECT
  });
  return toIncident(withHasPhoto(incident));
}

async function listIncidents(query, requester) {
  const where = {};
  switch (requester.role) {
    case 'owner':
      if (query.gymId !== undefined) where.gymId = Number(query.gymId);
      break;
    case 'manager':
      if (query.gymId !== undefined && Number(query.gymId) !== requester.gymId) {
        throw new IncidentError(403, 'forbidden', 'Un manager ne voit que les incidents de sa salle');
      }
      where.gymId = requester.gymId;
      break;
    case 'coach':
      where.createdBy = requester.id;
      if (query.gymId !== undefined) where.gymId = Number(query.gymId);
      break;
    default:
      throw new IncidentError(403, 'forbidden', 'Accès refusé');
  }
  if (query.status) where.status = oneOf(query.status, STATUSES, 'status');

  const incidents = await prisma.incident.findMany({ where, select: INCIDENT_SELECT, orderBy: { createdAt: 'desc' } });
  const unread = await unreadCounts(requester.id, incidents.map(i => i.id));
  return incidents.map(i => toIncident(withHasPhoto(i), { unreadCount: unread.get(i.id) || 0 }));
}

async function getIncident(id, requester) {
  const incident = await getReadableIncident(id, requester);
  const messages = await prisma.incidentMessage.findMany({
    where: { incidentId: id },
    include: { Author: { select: AUTHOR_SELECT } },
    orderBy: { id: 'asc' }
  });
  const unread = await unreadCounts(requester.id, [id]);
  return toIncident(incident, { messages, unreadCount: unread.get(id) || 0 });
}

function parseCursor(value, field) {
  if (value === undefined || value === '') return undefined;
  const id = Number(value);
  if (!Number.isInteger(id) || id < 0) throw new IncidentError(400, 'invalid_cursor', `${field} doit être un id de message`);
  return id;
}

/**
 * Page de messages, toujours en ordre chronologique (id croissant).
 * - after=<id> (exclusif) : les suivants, pour le polling ; hasMore = d'autres plus récents
 * - before=<id> (exclusif) : les précédents ; hasMore = d'autres plus anciens
 * - sans curseur : les plus récents ; hasMore = d'autres plus anciens
 */
async function listMessages(id, query, requester) {
  await getReadableIncident(id, requester);
  const after = parseCursor(query.after, 'after');
  const before = parseCursor(query.before, 'before');
  if (after !== undefined && before !== undefined) {
    throw new IncidentError(400, 'invalid_cursor', 'after et before sont exclusifs');
  }
  const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_MESSAGE_PAGE, 1), MAX_MESSAGE_PAGE);

  const forward = after !== undefined;
  const rows = await prisma.incidentMessage.findMany({
    where: {
      incidentId: id,
      ...(forward && { id: { gt: after } }),
      ...(before !== undefined && { id: { lt: before } })
    },
    include: { Author: { select: AUTHOR_SELECT } },
    orderBy: { id: forward ? 'asc' : 'desc' },
    take: limit + 1
  });
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  if (!forward) page.reverse();
  return { messages: page.map(toMessage), hasMore };
}

/** Marque le fil lu jusqu'à `lastMessageId` (défaut : le dernier message). */
async function markRead(id, input, requester) {
  await getReadableIncident(id, requester);
  const latest = await prisma.incidentMessage.findFirst({
    where: { incidentId: id }, orderBy: { id: 'desc' }, select: { id: true }
  });
  let upTo = latest?.id ?? 0;
  const requested = parseCursor(input?.lastMessageId, 'lastMessageId');
  if (requested !== undefined) upTo = Math.min(requested, upTo);
  await advanceRead(id, requester.id, upTo);

  const read = await prisma.incidentRead.findUnique({ where: { incidentId_userId: { incidentId: id, userId: requester.id } } });
  const unread = await unreadCounts(requester.id, [id]);
  return { incidentId: id, lastReadMessageId: read.lastReadMessageId, unreadCount: unread.get(id) || 0 };
}

async function getPhoto(id, requester) {
  await getReadableIncident(id, requester);
  const { photo, photoMime } = await prisma.incident.findUnique({ where: { id }, select: { photo: true, photoMime: true } });
  if (!photo) throw new IncidentError(404, 'photo_not_found', 'Aucune photo pour cet incident');
  return { photo: Buffer.from(photo), photoMime };
}

/** Message dans le chat : owner, ou créateur de l'incident. */
async function addMessage(id, body, requester) {
  const incident = await getReadableIncident(id, requester);
  if (requester.role !== 'owner' && incident.createdBy !== requester.id) {
    throw new IncidentError(403, 'forbidden', 'Seuls l\'owner et le créateur répondent dans le fil');
  }
  if (incident.status === 'closed') throw new IncidentError(409, 'incident_closed', 'Incident clôturé');

  const message = await prisma.incidentMessage.create({
    data: { incidentId: id, authorId: requester.id, body: requiredText(body, 'body', 5000) },
    include: { Author: { select: AUTHOR_SELECT } }
  });
  await prisma.incident.update({ where: { id }, data: { updatedAt: new Date() } });
  // Son propre message est lu
  await advanceRead(id, requester.id, message.id);
  return { message: toMessage(message), incident };
}

async function updateStatus(id, status, requester) {
  if (requester.role !== 'owner') throw new IncidentError(403, 'forbidden', 'Seul l\'owner change le statut');
  const incident = await getReadableIncident(id, requester);
  oneOf(status, STATUSES, 'status');

  const closing = status === 'closed' || status === 'resolved';
  const updated = await prisma.incident.update({
    where: { id },
    data: {
      status,
      closedAt: closing ? (incident.closedAt || new Date()) : null,
      closedBy: closing ? (incident.closedBy || requester.id) : null
    },
    select: INCIDENT_SELECT
  });
  return { incident: toIncident(withHasPhoto(updated)), previousStatus: incident.status };
}

module.exports = {
  IncidentError,
  CATEGORIES,
  SEVERITIES,
  STATUSES,
  MAX_PHOTO_BYTES,
  createIncident,
  listIncidents,
  getIncident,
  getPhoto,
  listMessages,
  markRead,
  addMessage,
  updateStatus
};
