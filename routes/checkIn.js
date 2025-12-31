const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const checkInService = require('../services/checkInService');

/**
 * POST /check-in
 * Enregistrer une entrée en salle (membre via QR ou staff manuel)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { memberId, subscriptionId, gymId, isManual, notes } = req.body;
    const createdBy = req.user.sub; // ID de l'utilisateur qui fait le check-in

    const checkIn = await checkInService.createCheckIn({
      memberId,
      subscriptionId,
      gymId,
      isManual: isManual || false,
      createdBy: isManual ? createdBy : null,
      notes
    });

    res.status(201).json(checkIn);
  } catch (error) {
    console.error('Error creating check-in:', error);
    res.status(400).json({
      error: 'Failed to create check-in',
      message: error.message
    });
  }
});

/**
 * POST /check-in/scan
 * Check-in via scan QR code du membre
 */
router.post('/scan', authenticateToken, async (req, res) => {
  try {
    const { qrCode, gymId } = req.body;

    const checkIn = await checkInService.checkInByQR(qrCode, gymId);

    res.status(201).json(checkIn);
  } catch (error) {
    console.error('Error scanning QR code:', error);
    res.status(400).json({
      error: 'Failed to check-in',
      message: error.message
    });
  }
});

/**
 * GET /check-in/member/:memberId
 * Historique des check-ins d'un membre
 */
router.get('/member/:memberId', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { startDate, endDate, limit = 50 } = req.query;

    const checkIns = await checkInService.getMemberCheckIns(parseInt(memberId), {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: parseInt(limit)
    });

    res.json({ checkIns });
  } catch (error) {
    console.error('Error fetching check-ins:', error);
    res.status(500).json({
      error: 'Failed to fetch check-ins',
      message: error.message
    });
  }
});

/**
 * GET /check-in/subscription/:subscriptionId/quota
 * Récupérer les informations de quota d'un abonnement
 */
router.get('/subscription/:subscriptionId/quota', authenticateToken, async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    const quota = await checkInService.getSubscriptionQuota(parseInt(subscriptionId));

    res.json(quota);
  } catch (error) {
    console.error('Error fetching quota:', error);
    res.status(500).json({
      error: 'Failed to fetch quota',
      message: error.message
    });
  }
});

/**
 * GET /check-in/gym/:gymId/today
 * Liste des membres qui ont scanné aujourd'hui
 */
router.get('/gym/:gymId/today', authenticateToken, async (req, res) => {
  try {
    const { gymId } = req.params;

    const present = await checkInService.getPresentMembers(parseInt(gymId));

    res.json({ present, count: present.length });
  } catch (error) {
    console.error('Error fetching present members:', error);
    res.status(500).json({
      error: 'Failed to fetch present members',
      message: error.message
    });
  }
});

/**
 * GET /check-in/stats/gym/:gymId
 * Statistiques de fréquentation d'une salle
 */
router.get('/stats/gym/:gymId', authenticateToken, async (req, res) => {
  try {
    const { gymId } = req.params;
    const { startDate, endDate } = req.query;

    const stats = await checkInService.getGymStats(parseInt(gymId), {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });

    res.json(stats);
  } catch (error) {
    console.error('Error fetching gym stats:', error);
    res.status(500).json({
      error: 'Failed to fetch stats',
      message: error.message
    });
  }
});

module.exports = router;
