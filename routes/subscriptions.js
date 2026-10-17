const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../utils/prismaClient');
const { 
  createYearlySubscriptionWithPayments,
  markPaymentAsCompleted,
  acknowledgePayment,
  getSubscriptionStatus
} = require('../services/subscriptionService');

/**
 * POST /subscriptions
 * Créer un nouvel abonnement annuel avec 12 paiements mensuels
 */
router.post('/', auth, async (req, res) => {
  try {
    const { memberId, subscriptionTypeId, startDate } = req.body;
    
    // Validation
    if (!memberId || !subscriptionTypeId) {
      return res.status(400).json({ 
        error: 'memberId et subscriptionTypeId sont requis' 
      });
    }
    
    // Récupérer l'utilisateur qui fait la requête
    
    const requester = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, role: true, gymId: true }
    });

    if (!requester) {
      return res.status(403).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier les permissions
    if (requester.role === 'member' && requester.id !== memberId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    if (requester.role === 'admin') {
      // Vérifier que le membre est dans la même salle
      const member = await prisma.user.findUnique({
        where: { id: memberId }
      });
      
      if (!member || member.gymId !== requester.gymId) {
        return res.status(403).json({ 
          error: 'Vous ne pouvez créer des abonnements que pour les membres de votre salle' 
        });
      }
    }
    
    // Créer l'abonnement avec les 12 paiements
    const result = await createYearlySubscriptionWithPayments(
      memberId,
      parseInt(subscriptionTypeId),
      startDate ? new Date(startDate) : new Date()
    );
    
    res.status(201).json({
      message: 'Abonnement annuel créé avec succès',
      subscription: result.subscription,
      SubscriptionType: result.subscriptionType,
      paymentsGenerated: result.payments.length,
      Payment: result.payments.map(p => ({
        id: p.id,
        monthNumber: p.monthNumber,
        amount: p.amount,
        dueDate: p.dueDate,
        status: p.status
      }))
    });
    
  } catch (error) {
    console.error('Erreur création abonnement:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subscriptions/:id/renew
 * Renew a subscription
 */
router.post('/:id/renew', auth, async (req, res) => {
  try {
    const subscriptionId = parseInt(req.params.id);
    
    
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { Member: true, SubscriptionType: true }
    });
    
    if (!subscription) {
      return res.status(404).json({ error: 'Abonnement non trouvé' });
    }
    
    const requester = await prisma.user.findUnique({
      where: { id: req.user.sub }
    });
    
    if (!requester) {
      return res.status(403).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Check permissions
    if (requester.role === 'member' && subscription.memberId !== requester.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    // Create new subscription
    const newSubscription = await createYearlySubscriptionWithPayments(
      subscription.memberId,
      subscription.subscriptionTypeId,
      new Date()
    );
    
    res.status(201).json({
      message: 'Abonnement renouvelé avec succès',
      newSubscription: newSubscription.subscription
    });
    
  } catch (error) {
    console.error('Erreur renouvellement:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /subscriptions/:id
 * Obtenir le statut détaillé d'un abonnement
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const subscriptionId = parseInt(req.params.id);
    
    const status = await getSubscriptionStatus(subscriptionId);
    
    // Récupérer l'utilisateur qui fait la requête
    
    const requester = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, role: true, gymId: true }
    });

    if (!requester) {
      return res.status(403).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Vérifier les permissions
    if (requester.role === 'member' && status.subscription.memberId !== requester.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    if (requester.role === 'admin' && status.subscription.member.user.gymId !== requester.gymId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    res.json(status);
    
  } catch (error) {
    console.error('Erreur récupération statut:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /subscriptions/member/:memberId
 * Obtenir tous les abonnements d'un membre
 */
router.get('/member/:memberId', auth, async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    
    // Récupérer l'utilisateur qui fait la requête
    
    const requester = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, role: true, gymId: true }
    });

    if (!requester) {
      return res.status(403).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier les permissions
    if (requester.role === 'member' && requester.id !== memberId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    if (requester.role === 'admin') {
      const member = await prisma.user.findUnique({
        where: { id: memberId }
      });
      
      if (!member || member.gymId !== requester.gymId) {
        return res.status(403).json({ error: 'Accès refusé' });
      }
    }
    
    const subscriptions = await prisma.subscription.findMany({
      where: { memberId },
      include: {
        SubscriptionType: true,
        Payment: {
          orderBy: { monthNumber: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ subscriptions });
    
  } catch (error) {
    console.error('Erreur récupération abonnements:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subscriptions/payments/:paymentId/acknowledge
 * Acquitter un paiement et activer l'abonnement si celui-ci est en attente
 */
router.post('/payments/:paymentId/acknowledge', auth, async (req, res) => {
  try {
    const paymentId = parseInt(req.params.paymentId);
    const { paymentMethod, transactionId } = req.body;
    
    if (!paymentMethod) {
      return res.status(400).json({ error: 'paymentMethod est requis' });
    }
    
    // Vérifier les permissions
    
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        subscription: true,
        member: {
          include: { User: true }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    const requester = req.user;
    if (requester.role === 'member' && payment.memberId !== requester.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    if (requester.role === 'admin' && payment.member.User.gymId !== requester.gymId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const updatedPayment = await acknowledgePayment(
      paymentId,
      paymentMethod,
      transactionId
    );
    
    // Récupérer l'abonnement mis à jour
    const subscription = await prisma.subscription.findUnique({
      where: { id: payment.subscriptionId },
      include: {
        SubscriptionType: true
      }
    });
    
    res.json({
      message: 'Paiement acquitté avec succès',
      payment: updatedPayment,
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        type: subscription.SubscriptionType.name,
        startDate: subscription.startDate,
        endDate: subscription.endDate
      } : null
    });
    
  } catch (error) {
    console.error('Erreur acquittement paiement:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subscriptions/payments/:paymentId/complete
 * Marquer un paiement comme complété
 */
router.post('/payments/:paymentId/complete', auth, async (req, res) => {
  try {
    const paymentId = parseInt(req.params.paymentId);
    const { paymentMethod, transactionId } = req.body;
    
    if (!paymentMethod) {
      return res.status(400).json({ error: 'paymentMethod est requis' });
    }
    
    // Vérifier les permissions
    
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        member: {
          include: { User: true }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    const requester = req.user;
    if (requester.role === 'member' && payment.memberId !== requester.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    if (requester.role === 'admin' && payment.member.User.gymId !== requester.gymId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    const updatedPayment = await markPaymentAsCompleted(
      paymentId,
      paymentMethod,
      transactionId
    );
    
    res.json({
      message: 'Paiement marqué comme complété',
      payment: updatedPayment
    });
    
  } catch (error) {
    console.error('Erreur complétion paiement:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /subscriptions/payments/upcoming
 * Obtenir les paiements à venir (pour les rappels)
 */
router.get('/payments/upcoming', auth, async (req, res) => {
  try {
    // Récupérer l'utilisateur qui fait la requête
    
    const requester = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, role: true, gymId: true }
    });

    if (!requester) {
      return res.status(403).json({ error: 'Utilisateur non trouvé' });
    }

    // Seuls les admins et owners peuvent voir tous les paiements à venir
    if (requester.role === 'member') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    
    const now = new Date();
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    
    let whereClause = {
      status: 'pending',
      dueDate: {
        gte: now,
        lte: sevenDaysLater
      }
    };
    
    // Si admin, filtrer par salle
    if (requester.role === 'admin') {
      whereClause.member = {
        User: {
          gymId: requester.gymId
        }
      };
    }

    const upcomingPayments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        subscription: true,
        member: {
          include: {
            User: true
          }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    res.json({
      count: upcomingPayments.length,
      Payment: upcomingPayments.map(p => ({
        id: p.id,
        memberId: p.memberId,
        memberName: `${p.member.User.firstName} ${p.member.User.lastName}`,
        memberEmail: p.member.User.email,
        amount: p.amount,
        dueDate: p.dueDate,
        monthNumber: p.monthNumber,
        daysUntilDue: Math.ceil((new Date(p.dueDate) - now) / (1000 * 60 * 60 * 24))
      }))
    });
    
  } catch (error) {
    console.error('Erreur récupération paiements à venir:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
