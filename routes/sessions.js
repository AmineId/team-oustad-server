const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { apiLimiter } = require('../middleware/rateLimiter');
const { sendPushNotification } = require('../services/pushNotificationService');
const sessionService = require('../services/sessionService');
const { SessionError } = sessionService;
const { loadRequester } = require('./programs');

/**
 * Rôles V2 : séances de coach.
 * - Gestion (création, modification, inscriptions) : owner, manager de la salle
 * - Lecture : owner, manager de la salle, coach de la séance
 * - Check-in séance : coach de la séance, manager de la salle, owner
 */

const requireStaff = loadRequester(['owner', 'manager']);
const requireStaffOrCoach = loadRequester(['owner', 'manager', 'coach']);

function sendError(res, error, fallback) {
  if (error instanceof SessionError) {
    return res.status(error.status).json({ error: error.code, message: error.message, ...error.extra });
  }
  logger.error(`💥 ${fallback}:`, error);
  return res.status(500).json({ error: fallback });
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id)) throw new SessionError(400, 'invalid_id', 'Identifiant invalide');
  return id;
}

const SESSION_TITLES = {
  added: '📅 Nouvelle séance',
  removed: '❌ Séance retirée',
  updated: '✏️ Séance modifiée',
  cancelled: '🚫 Séance annulée',
  assigned: '📋 Nouvelle séance à encadrer'
};

function formatSlot(session) {
  return new Date(session.startAt).toLocaleString('fr-FR', {
    timeZone: process.env.GYM_TIMEZONE || 'Africa/Casablanca',
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
  });
}

/** Notifie des utilisateurs (ids) d'un changement de séance, sans bloquer la réponse. */
async function notifyUsers(userIds, session, action) {
  if (userIds.length === 0) return;
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(userIds)] }, fcmToken: { not: null }, notificationsEnabled: true },
      select: { id: true, fcmToken: true }
    });
    for (const user of users) {
      sendPushNotification(user.fcmToken, {
        title: SESSION_TITLES[action],
        body: `${session.title || 'Séance'} — ${formatSlot(session)} (${session.gym?.name || ''})`,
        data: { type: 'session', sessionId: String(session.id), action }
      }, user.id).catch(err => logger.warn(`⚠️ Notification séance non envoyée: ${err.message}`));
    }
  } catch (error) {
    logger.warn(`⚠️ Notifications séance: ${error.message}`);
  }
}

const bookedMemberIds = (session) => session.members
  .filter(m => m.status === 'booked' || m.status === 'checked_in')
  .map(m => m.memberId);

router.get('/', auth, requireStaff, async (req, res) => {
  try {
    res.json(await sessionService.listSessions(req.query, req.requester));
  } catch (error) {
    sendError(res, error, 'Erreur lors de la récupération des séances');
  }
});

router.get('/available', auth, requireStaff, async (req, res) => {
  try {
    res.json(await sessionService.findAvailable(req.query, req.requester));
  } catch (error) {
    sendError(res, error, 'Erreur lors de la recherche de créneaux');
  }
});

router.get('/:id', auth, requireStaffOrCoach, async (req, res) => {
  try {
    res.json(await sessionService.getSession(parseId(req.params.id), req.requester));
  } catch (error) {
    sendError(res, error, 'Erreur lors de la récupération de la séance');
  }
});

router.post('/', auth, requireStaff, apiLimiter, async (req, res) => {
  try {
    const sessions = await sessionService.createSessions(req.body, req.requester);
    notifyUsers([sessions[0].coachId], sessions[0], 'assigned');
    res.status(201).json({ sessions });
  } catch (error) {
    sendError(res, error, 'Erreur lors de la création de la séance');
  }
});

router.patch('/:id', auth, requireStaff, apiLimiter, async (req, res) => {
  try {
    const { sessions, previousCoachId } = await sessionService.updateSessions(
      parseId(req.params.id), req.body, req.query.scope, req.requester
    );
    const first = sessions[0];
    if (first.coachId !== previousCoachId) {
      notifyUsers([first.coachId], first, 'assigned');
      notifyUsers([previousCoachId], first, 'cancelled');
    } else {
      notifyUsers([first.coachId], first, 'updated');
    }
    notifyUsers(sessions.flatMap(bookedMemberIds), first, 'updated');
    res.json({ sessions });
  } catch (error) {
    sendError(res, error, 'Erreur lors de la modification de la séance');
  }
});

router.delete('/:id', auth, requireStaff, apiLimiter, async (req, res) => {
  try {
    const sessions = await sessionService.cancelSessions(parseId(req.params.id), req.query.scope, req.requester);
    const first = sessions[0];
    notifyUsers([first.coachId, ...sessions.flatMap(bookedMemberIds)], first, 'cancelled');
    res.json({ sessions });
  } catch (error) {
    sendError(res, error, 'Erreur lors de l\'annulation de la séance');
  }
});

router.post('/:id/members', auth, requireStaff, apiLimiter, async (req, res) => {
  try {
    const session = await sessionService.addMembers(parseId(req.params.id), req.body.memberIds, req.requester);
    notifyUsers(req.body.memberIds.map(Number), session, 'added');
    res.json(session);
  } catch (error) {
    sendError(res, error, 'Erreur lors de l\'inscription');
  }
});

router.delete('/:id/members/:memberId', auth, requireStaff, apiLimiter, async (req, res) => {
  try {
    const memberId = parseId(req.params.memberId);
    const session = await sessionService.removeMember(parseId(req.params.id), memberId, req.requester);
    notifyUsers([memberId], session, 'removed');
    res.json(session);
  } catch (error) {
    sendError(res, error, 'Erreur lors de la désinscription');
  }
});

router.post('/:id/check-in', auth, requireStaffOrCoach, apiLimiter, async (req, res) => {
  try {
    res.json(await sessionService.checkInMember(parseId(req.params.id), req.body.memberId, req.requester));
  } catch (error) {
    sendError(res, error, 'Erreur lors du check-in séance');
  }
});

module.exports = router;
module.exports.sendSessionError = sendError;
