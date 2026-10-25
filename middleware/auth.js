const jwt = require('jsonwebtoken');
const prisma = require('../utils/prismaClient');
const { CLIENTS, ROLES, normalizeRole } = require('../utils/roles');
const { isCoachAllowed } = require('./coachGuard');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

module.exports = async function (req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Les tokens émis avant Rôles V2 portent `type: "admin"`
  payload.type = normalizeRole(payload.type);
  payload.client = payload.client === CLIENTS.KIOSK ? CLIENTS.KIOSK : CLIENTS.APP;

  // Single-device enforcement: verify the session ID matches the one stored in DB.
  // Le kiosk a son propre emplacement de session, distinct de celui de l'app.
  if (payload.sessionId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { currentSessionId: true, kioskSessionId: true }
      });
      const storedSessionId = payload.client === CLIENTS.KIOSK
        ? user?.kioskSessionId
        : user?.currentSessionId;
      if (!user || storedSessionId !== payload.sessionId) {
        return res.status(401).json({ error: 'Session expired — please log in again' });
      }
    } catch (e) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Rôles V2 : le coach n'accède qu'aux routes explicitement ouvertes
  if (payload.type === ROLES.COACH) {
    const path = (req.originalUrl || req.url).split('?')[0];
    if (!isCoachAllowed(req.method, path, payload.sub)) {
      return res.status(403).json({ error: 'coach_forbidden', message: 'Action non autorisée pour un coach' });
    }
  }

  req.user = payload;
  next();
};
