const jwt = require('jsonwebtoken');
const prisma = require('../utils/prismaClient');
const { CLIENTS, normalizeRole } = require('../utils/roles');

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

  req.user = payload;
  next();
};
