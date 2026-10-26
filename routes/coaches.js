const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../utils/prismaClient');
const coachService = require('../services/coachService');
const sessionService = require('../services/sessionService');

/**
 * Rôles V2 : coachs.
 * - GET /coaches?gymId=      owner (toutes salles) / manager (sa salle)
 * - GET /coaches/me/members  coach : ses membres affectés
 * - GET /coaches/me/sessions coach : ses séances (toutes salles)
 */

router.get('/', auth, async (req, res) => {
  try {
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester || !['owner', 'manager'].includes(requester.role)) {
      return res.status(403).json({ error: 'Accès réservé aux owners et managers' });
    }

    let gymId;
    if (req.query.gymId !== undefined) {
      gymId = Number(req.query.gymId);
      if (!Number.isInteger(gymId)) return res.status(400).json({ error: 'gymId invalide' });
    }

    if (requester.role === 'manager') {
      if (gymId !== undefined && gymId !== requester.gymId) {
        return res.status(403).json({ error: 'Un manager ne voit que les coachs de sa salle' });
      }
      gymId = requester.gymId;
    }

    res.json(await coachService.listCoaches({ gymId }));
  } catch (error) {
    console.error('Erreur liste coachs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des coachs' });
  }
});

router.get('/me/members', auth, async (req, res) => {
  try {
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester || requester.role !== 'coach') {
      return res.status(403).json({ error: 'Accès réservé aux coachs' });
    }
    res.json(await coachService.getCoachMembers(requester.id));
  } catch (error) {
    console.error('Erreur membres du coach:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des membres' });
  }
});

router.get('/me/sessions', auth, async (req, res) => {
  try {
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester || requester.role !== 'coach') {
      return res.status(403).json({ error: 'Accès réservé aux coachs' });
    }
    res.json(await sessionService.listCoachSessions(requester.id, req.query));
  } catch (error) {
    if (error instanceof sessionService.SessionError) {
      return res.status(error.status).json({ error: error.code, message: error.message });
    }
    console.error('Erreur séances du coach:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des séances' });
  }
});

module.exports = router;
