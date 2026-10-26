const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const checkInService = require('../services/checkInService');
const prisma = require('../utils/prismaClient');
const { canAccessGym, getCoachGymIds } = require('../utils/staffScope');

/**
 * Rôles V2 : portée des check-ins.
 * - Staff d'une salle : owner (toutes) ou manager (la sienne)
 * - Lecture d'un membre : lui-même, le staff de sa salle, son coach
 */
const loadRequester = (req) => prisma.user.findUnique({ where: { id: req.user.sub } });

function isGymStaff(requester, gymId) {
  return Boolean(requester) &&
    (requester.role === 'owner' || (requester.role === 'manager' && requester.gymId === gymId));
}

async function canReadMember(requester, memberId) {
  if (!requester) return false;
  if (requester.role === 'member') return requester.id === memberId;
  const member = await prisma.member.findUnique({ where: { userId: memberId }, include: { User: { select: { gymId: true } } } });
  if (!member) return requester.role === 'owner';
  if (requester.role === 'coach') return member.coachId === requester.id;
  return isGymStaff(requester, member.User.gymId);
}

const forbidden = (res) => res.status(403).json({ error: 'Forbidden' });

/**
 * POST /check-in
 * Enregistrer une entrée en salle (membre via QR ou staff manuel)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { memberId, subscriptionId, gymId, isManual, notes } = req.body;
    const createdBy = req.user.sub; // ID de l'utilisateur qui fait le check-in

    // Check-in manuel : staff de la salle uniquement
    if (!isGymStaff(await loadRequester(req), Number(gymId))) return forbidden(res);

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
 * POST /check-in/:id/checkout
 * Checkout a member from the gym
 */
router.post('/:id/checkout', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const checkIn = await prisma.gymCheckIn.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!checkIn) {
      return res.status(404).json({ error: 'Check-in not found' });
    }

    // Staff de la salle, ou le membre pour son propre check-in
    const requester = await loadRequester(req);
    if (!isGymStaff(requester, checkIn.gymId) && requester?.id !== checkIn.memberId) return forbidden(res);
    
    if (checkIn.checkOutTime) {
      return res.status(400).json({ error: 'Already checked out' });
    }
    
    const updatedCheckIn = await prisma.gymCheckIn.update({
      where: { id: parseInt(id) },
      data: { checkOutTime: new Date() }
    });
    
    res.json(updatedCheckIn);
  } catch (error) {
    console.error('Error checking out:', error);
    res.status(400).json({
      error: 'Failed to checkout',
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

    // Scan QR (app staff ou kiosk) : staff de la salle uniquement
    if (!isGymStaff(await loadRequester(req), Number(gymId))) return forbidden(res);

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
/**
 * Rôles V2 : check-ins du jour. Coach : ses salles (toutes si pas de gymId) ;
 * manager : sa salle ; owner : ?gymId= ou toutes. Chaque entrée indique si le
 * membre est suivi par le demandeur et sa prochaine séance du jour.
 */
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const requester = await loadRequester(req);
    if (!requester || requester.role === 'member') return forbidden(res);

    let gymIds;
    if (req.query.gymId !== undefined) {
      const gymId = parseInt(req.query.gymId);
      if (!(await canAccessGym(requester, gymId))) return forbidden(res);
      gymIds = [gymId];
    } else if (requester.role === 'coach') {
      gymIds = await getCoachGymIds(requester.id);
    } else if (requester.role === 'manager') {
      gymIds = [requester.gymId];
    }

    const entries = await checkInService.getTodayCheckIns({ gymIds, viewerId: requester.id });
    res.json(entries);
  } catch (error) {
    console.error('Error fetching today check-ins:', error);
    res.status(500).json({ error: 'Failed to fetch today check-ins', message: error.message });
  }
});

router.get('/member/:memberId', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { startDate, endDate, limit = 50 } = req.query;

    if (!(await canReadMember(await loadRequester(req), parseInt(memberId)))) return forbidden(res);

    const checkIns = await checkInService.getMemberCheckIns(parseInt(memberId), {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: parseInt(limit)
    });

    res.json(checkIns);
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

    const subscription = await prisma.subscription.findUnique({
      where: { id: parseInt(subscriptionId) },
      select: { memberId: true }
    });
    if (subscription && !(await canReadMember(await loadRequester(req), subscription.memberId))) {
      return forbidden(res);
    }

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
    
    // Owner, ou manager de la salle (le coach passe par GET /check-in/today)
    if (!isGymStaff(await loadRequester(req), parseInt(gymId))) return forbidden(res);

    const present = await checkInService.getPresentMembers(parseInt(gymId));

    res.json(present);
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

    if (!isGymStaff(await loadRequester(req), parseInt(gymId))) return forbidden(res);

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
