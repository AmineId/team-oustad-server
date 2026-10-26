const crypto = require('crypto');
const prisma = require('../utils/prismaClient');
const checkInService = require('./checkInService');
const { GYM_REF_SELECT, COACH_REF_SELECT, toCoachRef } = require('../utils/staffScope');
const { addWeeksLocal, openingHoursViolation } = require('../utils/gymTime');

/**
 * Rôles V2 : séances (plages de travail d'un coach avec un ou plusieurs membres).
 * Les fonctions lèvent une SessionError portant le statut HTTP et un code stable.
 */
class SessionError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const MAX_OCCURRENCES = 26;
const MAX_RANGE_DAYS = 62;
const DAY_MS = 24 * 60 * 60 * 1000;
// Statuts d'inscription qui occupent une place
const ACTIVE_MEMBER_STATUSES = ['booked', 'checked_in', 'absent'];
const SCOPES = ['this', 'following', 'series'];

const generateSessionId = () => `SESSION-${crypto.randomBytes(8).toString('hex')}`;

const SESSION_INCLUDE = {
  Gym: { select: GYM_REF_SELECT },
  Coach: { select: COACH_REF_SELECT },
  Creator: { select: COACH_REF_SELECT },
  Members: {
    orderBy: { bookedAt: 'asc' },
    include: {
      Member: {
        include: { User: { select: { id: true, displayId: true, firstName: true, lastName: true, phoneNumber: true } } }
      }
    }
  }
};

// ==================== Sérialisation ====================

function toSessionMember(sm) {
  return {
    memberId: sm.memberId,
    member: sm.Member?.User || null,
    status: sm.status,
    checkedInAt: sm.checkedInAt,
    bookedAt: sm.bookedAt
  };
}

function toSession(session) {
  const bookedCount = session.Members.filter(m => ACTIVE_MEMBER_STATUSES.includes(m.status)).length;
  return {
    id: session.id,
    displayId: session.displayId,
    gymId: session.gymId,
    gym: session.Gym,
    coachId: session.coachId,
    coach: toCoachRef(session.Coach),
    startAt: session.startAt,
    endAt: session.endAt,
    capacity: session.capacity,
    title: session.title,
    type: session.type,
    notes: session.notes,
    seriesId: session.seriesId,
    status: session.status,
    members: session.Members.map(toSessionMember),
    bookedCount,
    remaining: Math.max(0, session.capacity - bookedCount),
    createdBy: toCoachRef(session.Creator),
    createdAt: session.createdAt
  };
}

// ==================== Validation ====================

function parseDate(value, field) {
  const date = new Date(value);
  if (value === undefined || value === null || value === '' || Number.isNaN(date.getTime())) {
    throw new SessionError(400, 'invalid_date', `${field} invalide`);
  }
  return date;
}

function parseCapacity(value) {
  const capacity = Number(value);
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new SessionError(400, 'invalid_capacity', 'capacity doit être un entier ≥ 1');
  }
  return capacity;
}

function assertTimeRange(startAt, endAt) {
  if (endAt <= startAt) throw new SessionError(400, 'invalid_time_range', 'endAt doit être après startAt');
  if (endAt - startAt > DAY_MS) throw new SessionError(400, 'invalid_time_range', 'Une séance dure au plus 24 h');
}

function parseScope(value) {
  const scope = value || 'this';
  if (!SCOPES.includes(scope)) throw new SessionError(400, 'invalid_scope', `scope doit valoir ${SCOPES.join(', ')}`);
  return scope;
}

/** Plage de lecture : par défaut aujourd'hui → +7 jours, au plus 62 jours. */
function parseRange(from, to) {
  const start = from ? parseDate(from, 'from') : new Date(new Date().setHours(0, 0, 0, 0));
  const end = to ? parseDate(to, 'to') : new Date(start.getTime() + 7 * DAY_MS);
  if (end <= start) throw new SessionError(400, 'invalid_time_range', 'to doit être après from');
  if (end - start > MAX_RANGE_DAYS * DAY_MS) {
    throw new SessionError(400, 'range_too_large', `Plage limitée à ${MAX_RANGE_DAYS} jours`);
  }
  return { start, end };
}

async function assertCoachInGym(coachId, gymId) {
  const coach = await prisma.user.findUnique({ where: { id: coachId }, select: { role: true } });
  if (!coach || coach.role !== 'coach') throw new SessionError(404, 'coach_not_found', 'Coach introuvable');
  const linked = await prisma.coachGym.count({ where: { coachId, gymId } });
  if (!linked) throw new SessionError(400, 'coach_not_in_gym', 'Le coach n\'est pas rattaché à cette salle');
}

async function assertOpeningHours(gymId, ranges) {
  const openingHours = await prisma.openingHour.findMany({ where: { gymId } });
  for (const { startAt, endAt } of ranges) {
    const violation = openingHoursViolation(startAt, endAt, openingHours);
    if (violation) {
      throw new SessionError(400, violation, 'La séance doit respecter les horaires d\'ouverture de la salle', { startAt, endAt });
    }
  }
}

/**
 * Séances non annulées du coach qui chevauchent une des plages (hors `excludeIds`).
 * À appeler dans une transaction après pg_advisory_xact_lock(coachId).
 */
async function findCoachConflicts(tx, coachId, ranges, excludeIds = []) {
  if (ranges.length === 0) return [];
  return tx.trainingSession.findMany({
    where: {
      coachId,
      status: { not: 'cancelled' },
      id: { notIn: excludeIds },
      OR: ranges.map(({ startAt, endAt }) => ({ startAt: { lt: endAt }, endAt: { gt: startAt } }))
    },
    include: SESSION_INCLUDE,
    orderBy: { startAt: 'asc' }
  });
}

// Sérialise les écritures concurrentes sur le planning d'un coach
const lockCoach = (tx, coachId) => tx.$executeRaw`SELECT pg_advisory_xact_lock(${coachId})`;

// ==================== Portée ====================

/** Owner : toutes les salles ; manager : sa salle. */
function canManageGym(requester, gymId) {
  return requester.role === 'owner' || (requester.role === 'manager' && requester.gymId === gymId);
}

function canReadSession(requester, session) {
  return canManageGym(requester, session.gymId) ||
    (requester.role === 'coach' && session.coachId === requester.id);
}

async function getSessionOrThrow(id, client = prisma) {
  const session = await client.trainingSession.findUnique({ where: { id }, include: SESSION_INCLUDE });
  if (!session) throw new SessionError(404, 'session_not_found', 'Séance introuvable');
  return session;
}

async function getManagedSession(id, requester) {
  const session = await getSessionOrThrow(id);
  if (!canManageGym(requester, session.gymId)) {
    throw new SessionError(403, 'forbidden', 'Séance hors de votre salle');
  }
  return session;
}

// ==================== Création ====================

async function createSessions(input, requester) {
  const gymId = Number(input.gymId);
  const coachId = Number(input.coachId);
  if (!Number.isInteger(gymId) || !Number.isInteger(coachId)) {
    throw new SessionError(400, 'missing_fields', 'gymId et coachId requis');
  }
  if (!canManageGym(requester, gymId)) throw new SessionError(403, 'forbidden', 'Salle hors de votre portée');

  const startAt = parseDate(input.startAt, 'startAt');
  const endAt = parseDate(input.endAt, 'endAt');
  assertTimeRange(startAt, endAt);
  const capacity = parseCapacity(input.capacity ?? 1);
  await assertCoachInGym(coachId, gymId);

  // Occurrences : une seule, ou une par semaine jusqu'à `until` inclus
  const ranges = [{ startAt, endAt }];
  let seriesId = null;
  if (input.repeat) {
    if (input.repeat.weekly !== true) throw new SessionError(400, 'invalid_repeat', 'Seule la récurrence { weekly: true } est supportée');
    const until = parseDate(input.repeat.until, 'repeat.until');
    for (let week = 1; ; week++) {
      const next = { startAt: addWeeksLocal(startAt, week), endAt: addWeeksLocal(endAt, week) };
      if (next.startAt > until) break;
      if (ranges.length >= MAX_OCCURRENCES) {
        throw new SessionError(400, 'too_many_occurrences', `Une série compte au plus ${MAX_OCCURRENCES} séances`);
      }
      ranges.push(next);
    }
    seriesId = `SERIES-${crypto.randomBytes(8).toString('hex')}`;
  }
  await assertOpeningHours(gymId, ranges);

  const ids = await prisma.$transaction(async (tx) => {
    await lockCoach(tx, coachId);
    const conflicts = await findCoachConflicts(tx, coachId, ranges);
    if (conflicts.length > 0) {
      throw new SessionError(409, 'session_overlap', 'Le coach a déjà une séance sur ce créneau', {
        conflicts: conflicts.map(toSession)
      });
    }
    const created = [];
    for (const range of ranges) {
      const session = await tx.trainingSession.create({
        data: {
          displayId: generateSessionId(),
          gymId,
          coachId,
          ...range,
          capacity,
          title: input.title || null,
          type: input.type || null,
          notes: input.notes || null,
          seriesId,
          createdBy: requester.id
        },
        select: { id: true }
      });
      created.push(session.id);
    }
    return created;
  });

  return listByIds(ids);
}

async function listByIds(ids) {
  const sessions = await prisma.trainingSession.findMany({
    where: { id: { in: ids } },
    include: SESSION_INCLUDE,
    orderBy: { startAt: 'asc' }
  });
  return sessions.map(toSession);
}

// ==================== Modification / annulation ====================

/** Séances visées par `scope` à partir de `session`. */
async function sessionsInScope(session, scope, client = prisma) {
  if (scope === 'this' || !session.seriesId) return [session];
  return client.trainingSession.findMany({
    where: {
      seriesId: session.seriesId,
      status: { not: 'cancelled' },
      ...(scope === 'following' && { startAt: { gte: session.startAt } })
    },
    include: SESSION_INCLUDE,
    orderBy: { startAt: 'asc' }
  });
}

async function updateSessions(id, input, scopeRaw, requester) {
  const scope = parseScope(scopeRaw);
  const session = await getManagedSession(id, requester);
  if (session.status === 'cancelled') throw new SessionError(409, 'session_not_open', 'Séance annulée');

  // Décalage horaire appliqué à chaque occurrence visée
  const newStart = input.startAt !== undefined ? parseDate(input.startAt, 'startAt') : session.startAt;
  const newEnd = input.endAt !== undefined ? parseDate(input.endAt, 'endAt') : session.endAt;
  assertTimeRange(newStart, newEnd);
  const startShift = newStart - session.startAt;
  const endShift = newEnd - session.endAt;

  const coachId = input.coachId !== undefined ? Number(input.coachId) : session.coachId;
  if (coachId !== session.coachId) await assertCoachInGym(coachId, session.gymId);
  const capacity = input.capacity !== undefined ? parseCapacity(input.capacity) : null;

  const targets = await sessionsInScope(session, scope);
  const ranges = targets.map(t => ({
    id: t.id,
    startAt: new Date(t.startAt.getTime() + startShift),
    endAt: new Date(t.endAt.getTime() + endShift)
  }));
  if (startShift || endShift) await assertOpeningHours(session.gymId, ranges);

  if (capacity !== null) {
    const tooSmall = targets.map(toSession).find(t => t.bookedCount > capacity);
    if (tooSmall) {
      throw new SessionError(409, 'capacity_below_booked', 'Plus d\'inscrits que la nouvelle capacité', {
        sessionId: tooSmall.id, bookedCount: tooSmall.bookedCount
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await lockCoach(tx, coachId);
    const conflicts = await findCoachConflicts(tx, coachId, ranges, targets.map(t => t.id));
    if (conflicts.length > 0) {
      throw new SessionError(409, 'session_overlap', 'Le coach a déjà une séance sur ce créneau', {
        conflicts: conflicts.map(toSession)
      });
    }
    for (const range of ranges) {
      await tx.trainingSession.update({
        where: { id: range.id },
        data: {
          startAt: range.startAt,
          endAt: range.endAt,
          coachId,
          ...(capacity !== null && { capacity }),
          ...(input.title !== undefined && { title: input.title || null }),
          ...(input.type !== undefined && { type: input.type || null }),
          ...(input.notes !== undefined && { notes: input.notes || null }),
          // Nouvel horaire : le rappel doit repartir
          ...((startShift || endShift) && { reminderSentAt: null })
        }
      });
    }
  });

  return { sessions: await listByIds(targets.map(t => t.id)), previousCoachId: session.coachId };
}

async function cancelSessions(id, scopeRaw, requester) {
  const scope = parseScope(scopeRaw);
  const session = await getManagedSession(id, requester);
  const targets = await sessionsInScope(session, scope);
  const ids = targets.filter(t => t.status !== 'cancelled').map(t => t.id);
  await prisma.trainingSession.updateMany({ where: { id: { in: ids } }, data: { status: 'cancelled' } });
  return listByIds(targets.map(t => t.id));
}

// ==================== Lecture ====================

async function listSessions(query, requester) {
  const { start, end } = parseRange(query.from, query.to);
  const where = { startAt: { lt: end }, endAt: { gt: start } };

  if (requester.role === 'manager') {
    if (query.gymId !== undefined && Number(query.gymId) !== requester.gymId) {
      throw new SessionError(403, 'forbidden', 'Un manager ne voit que les séances de sa salle');
    }
    where.gymId = requester.gymId;
  } else if (query.gymId !== undefined) {
    where.gymId = Number(query.gymId);
  }
  if (query.coachId !== undefined) where.coachId = Number(query.coachId);
  if (query.status) where.status = query.status;

  const sessions = await prisma.trainingSession.findMany({ where, include: SESSION_INCLUDE, orderBy: { startAt: 'asc' } });
  return sessions.map(toSession);
}

async function listCoachSessions(coachId, query) {
  const { start, end } = parseRange(query.from, query.to);
  const sessions = await prisma.trainingSession.findMany({
    where: { coachId, startAt: { lt: end }, endAt: { gt: start }, ...(query.status && { status: query.status }) },
    include: SESSION_INCLUDE,
    orderBy: { startAt: 'asc' }
  });
  return sessions.map(toSession);
}

async function getSession(id, requester) {
  const session = await getSessionOrThrow(id);
  if (!canReadSession(requester, session)) throw new SessionError(403, 'forbidden', 'Séance hors de votre portée');
  return toSession(session);
}

/** Séances du membre (non annulées) qui chevauchent [startAt, endAt[. */
function memberOverlapWhere(memberId, startAt, endAt, excludeSessionId) {
  return {
    memberId,
    status: { in: ACTIVE_MEMBER_STATUSES },
    Session: {
      status: { not: 'cancelled' },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(excludeSessionId && { id: { not: excludeSessionId } })
    }
  };
}

/**
 * Séances à venir avec des places. Avec `memberId` : exclut celles où il est
 * déjà inscrit ou qui chevauchent ses séances, et met son coach en premier.
 */
async function findAvailable(query, requester) {
  let gymId = query.gymId !== undefined ? Number(query.gymId) : undefined;
  if (requester.role === 'manager') {
    if (gymId !== undefined && gymId !== requester.gymId) {
      throw new SessionError(403, 'forbidden', 'Un manager ne voit que les séances de sa salle');
    }
    gymId = requester.gymId;
  }
  if (!Number.isInteger(gymId)) throw new SessionError(400, 'gym_id_required', 'gymId requis');

  const { start, end } = parseRange(query.from, query.to);
  const now = new Date();
  const sessions = await prisma.trainingSession.findMany({
    where: {
      gymId,
      status: 'scheduled',
      startAt: { gte: start > now ? start : now, lt: end },
      ...(query.coachId !== undefined && { coachId: Number(query.coachId) })
    },
    include: SESSION_INCLUDE,
    orderBy: { startAt: 'asc' }
  });

  let memberCoachId = null;
  let memberSessions = [];
  if (query.memberId !== undefined) {
    const memberId = Number(query.memberId);
    const member = await prisma.member.findUnique({ where: { userId: memberId }, include: { User: true } });
    if (!member) throw new SessionError(404, 'member_not_found', 'Membre introuvable');
    if (!canManageGym(requester, member.User.gymId)) throw new SessionError(403, 'forbidden', 'Membre hors de votre salle');
    memberCoachId = member.coachId;
    memberSessions = await prisma.trainingSessionMember.findMany({
      where: { memberId, status: { in: ACTIVE_MEMBER_STATUSES }, Session: { status: { not: 'cancelled' } } },
      include: { Session: { select: { id: true, startAt: true, endAt: true } } }
    });
  }

  const overlapsMember = (s) => memberSessions.some(ms =>
    ms.Session.id === s.id || (ms.Session.startAt < s.endAt && ms.Session.endAt > s.startAt));

  return sessions
    .map(toSession)
    .filter(s => s.remaining > 0 && !overlapsMember(s))
    .map(s => ({ ...s, isMemberCoach: memberCoachId !== null && s.coachId === memberCoachId }))
    // Tri stable : coach du membre d'abord, puis par date
    .sort((a, b) => Number(b.isMemberCoach) - Number(a.isMemberCoach) || a.startAt - b.startAt);
}

// ==================== Inscriptions ====================

function assertOpenForBooking(session) {
  if (session.status !== 'scheduled' || session.endAt <= new Date()) {
    throw new SessionError(409, 'session_not_open', 'Séance annulée, terminée ou passée');
  }
}

async function addMembers(id, memberIdsRaw, requester) {
  const memberIds = Array.isArray(memberIdsRaw) ? [...new Set(memberIdsRaw.map(Number))] : [];
  if (memberIds.length === 0 || memberIds.some(m => !Number.isInteger(m))) {
    throw new SessionError(400, 'member_ids_required', 'memberIds doit être un tableau d\'entiers non vide');
  }

  const session = await getManagedSession(id, requester);
  assertOpenForBooking(session);

  return prisma.$transaction(async (tx) => {
    // Verrou sur la séance : deux inscriptions simultanées ne dépassent pas la capacité
    await tx.$executeRaw`SELECT id FROM "TrainingSession" WHERE id = ${id} FOR UPDATE`;
    const current = await getSessionOrThrow(id, tx);
    const existing = new Map(current.Members.map(m => [m.memberId, m]));

    const users = await tx.user.findMany({
      where: { id: { in: memberIds } },
      include: { Member: { include: { Subscription: { where: { status: 'active' }, take: 1 } } } }
    });
    const byId = new Map(users.map(u => [u.id, u]));

    const rejected = [];
    for (const memberId of memberIds) {
      const user = byId.get(memberId);
      let reason = null;
      if (!user || user.role !== 'member' || !user.Member) reason = 'member_not_found';
      else if (user.gymId !== current.gymId) reason = 'member_other_gym';
      else if (ACTIVE_MEMBER_STATUSES.includes(existing.get(memberId)?.status)) reason = 'already_booked';
      else if (user.Member.Subscription.length === 0) reason = 'no_active_subscription';
      else if (await tx.trainingSessionMember.count({ where: memberOverlapWhere(memberId, current.startAt, current.endAt, id) })) {
        reason = 'member_overlap';
      }
      if (reason) rejected.push({ memberId, reason });
    }
    if (rejected.length > 0) {
      throw new SessionError(422, 'booking_rejected', 'Certains membres ne peuvent pas être inscrits', { rejected });
    }

    const remaining = toSession(current).remaining;
    if (memberIds.length > remaining) {
      throw new SessionError(409, 'session_full', 'Plus assez de places dans cette séance', { remaining });
    }

    for (const memberId of memberIds) {
      await tx.trainingSessionMember.upsert({
        where: { sessionId_memberId: { sessionId: id, memberId } },
        update: { status: 'booked', bookedAt: new Date(), checkedInAt: null, checkedInBy: null, gymCheckInId: null },
        create: { sessionId: id, memberId }
      });
    }
    return toSession(await getSessionOrThrow(id, tx));
  });
}

async function removeMember(id, memberId, requester) {
  const session = await getManagedSession(id, requester);
  const entry = session.Members.find(m => m.memberId === memberId);
  if (!entry || entry.status === 'cancelled') {
    throw new SessionError(404, 'member_not_in_session', 'Ce membre n\'est pas inscrit à la séance');
  }
  await prisma.trainingSessionMember.update({
    where: { sessionId_memberId: { sessionId: id, memberId } },
    data: { status: 'cancelled' }
  });
  return toSession(await getSessionOrThrow(id));
}

// ==================== Check-in séance ====================

const CHECK_IN_ERRORS = [
  [/quota exhausted/i, 'quota_exhausted'],
  [/expired/i, 'subscription_expired'],
  [/Subscription is /i, 'no_active_subscription']
];

/**
 * Pointe un membre à la séance (coach de la séance, manager de la salle, owner).
 * Choix provisoire n°3 : crée aussi l'entrée salle (décompte du quota), au plus
 * une par jour ; si le membre est déjà entré aujourd'hui, rien n'est décompté.
 */
async function checkInMember(id, memberIdRaw, requester) {
  const memberId = Number(memberIdRaw);
  if (!Number.isInteger(memberId)) throw new SessionError(400, 'member_id_required', 'memberId requis');

  const session = await getSessionOrThrow(id);
  const allowed = canManageGym(requester, session.gymId) ||
    (requester.role === 'coach' && session.coachId === requester.id);
  if (!allowed) throw new SessionError(403, 'forbidden', 'Seul le coach de la séance ou le staff de la salle peut pointer');
  if (session.status === 'cancelled') throw new SessionError(409, 'session_not_open', 'Séance annulée');

  const entry = session.Members.find(m => m.memberId === memberId);
  if (!entry || entry.status === 'cancelled') {
    throw new SessionError(404, 'member_not_in_session', 'Ce membre n\'est pas inscrit à la séance');
  }

  if (entry.status === 'checked_in') {
    return { member: toSessionMember(entry), gymCheckIn: { id: entry.gymCheckInId, created: false, sessionsRemaining: null } };
  }

  // Entrée salle du jour (heure serveur, comme checkInService)
  const dayStart = new Date(new Date().setHours(0, 0, 0, 0));
  let gymCheckIn = await prisma.gymCheckIn.findFirst({
    where: { memberId, checkInTime: { gte: dayStart } },
    orderBy: { checkInTime: 'desc' }
  });
  let created = false;
  let sessionsRemaining = null;

  if (!gymCheckIn) {
    const subscription = await prisma.subscription.findFirst({
      where: { memberId, status: 'active' },
      orderBy: { startDate: 'desc' }
    });
    if (!subscription) throw new SessionError(409, 'no_active_subscription', 'Le membre n\'a pas d\'abonnement actif');
    try {
      gymCheckIn = await checkInService.createCheckIn({
        memberId,
        subscriptionId: subscription.id,
        gymId: session.gymId,
        isManual: true,
        createdBy: requester.id,
        notes: `Check-in séance ${session.displayId}`
      });
    } catch (error) {
      const match = CHECK_IN_ERRORS.find(([re]) => re.test(error.message));
      if (match) throw new SessionError(409, match[1], error.message);
      throw error;
    }
    created = true;
    sessionsRemaining = gymCheckIn.sessionsRemaining ?? null;
  }

  const updated = await prisma.trainingSessionMember.update({
    where: { sessionId_memberId: { sessionId: id, memberId } },
    data: { status: 'checked_in', checkedInAt: new Date(), checkedInBy: requester.id, gymCheckInId: gymCheckIn.id },
    include: SESSION_INCLUDE.Members.include
  });

  return { member: toSessionMember(updated), gymCheckIn: { id: gymCheckIn.id, created, sessionsRemaining } };
}

// ==================== Rappels ====================

/** Séances qui commencent dans [now + fromMin, now + toMin[ et dont le rappel n'est pas parti. */
async function sessionsNeedingReminder(fromMinutes = 45, toMinutes = 75) {
  const now = Date.now();
  return prisma.trainingSession.findMany({
    where: {
      status: 'scheduled',
      reminderSentAt: null,
      startAt: { gte: new Date(now + fromMinutes * 60000), lt: new Date(now + toMinutes * 60000) }
    },
    include: {
      Gym: { select: GYM_REF_SELECT },
      Members: {
        where: { status: 'booked' },
        include: { Member: { include: { User: { select: { id: true, fcmToken: true, notificationsEnabled: true } } } } }
      }
    }
  });
}

module.exports = {
  SessionError,
  MAX_OCCURRENCES,
  createSessions,
  updateSessions,
  cancelSessions,
  listSessions,
  listCoachSessions,
  getSession,
  findAvailable,
  addMembers,
  removeMember,
  checkInMember,
  sessionsNeedingReminder,
  toSession
};
