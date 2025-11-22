const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { apiLimiter } = require('../middleware/rateLimiter');
const { generateSubscriptionId, generatePaymentId } = require('../utils/idGenerator');
const { getFullName } = require('../utils/nameUtils');
const { 
  createYearlySubscriptionWithPayments,
  markPaymentAsCompleted,
  acknowledgePayment,
  getSubscriptionStatus
} = require('../services/subscriptionService');
const { 
  notifyPaymentDue,
  notifyPaymentConfirmed,
  notifyNewSubscription,
  notifyNewPayment
} = require('../services/pushNotificationService');

/**
 * POST /subscriptions
 * Créer un nouvel abonnement annuel avec 12 paiements mensuels
 */
router.post('/', auth, apiLimiter, async (req, res) => {
  logger.info(`📝 Création abonnement - User: ${req.user?.email} (${req.user?.type}), Données:`, req.body);

  try {
    const { memberId, subscriptionTypeId, startDate, paymentFrequency } = req.body;
    logger.debug(`🔍 Validation données - memberId: ${memberId}, subscriptionTypeId: ${subscriptionTypeId}, startDate: ${startDate}, paymentFrequency: ${paymentFrequency}`);
    
    // Validation
    if (!memberId || !subscriptionTypeId) {
      logger.warn(`❌ Données manquantes`);
      return res.status(400).json({ 
        error: 'memberId et subscriptionTypeId sont requis' 
      });
    }
    
    // Valider paymentFrequency si fourni
    const frequency = paymentFrequency ? parseInt(paymentFrequency) : 12;
    const validFrequencies = [1, 3, 6, 12];
    if (!validFrequencies.includes(frequency)) {
      logger.warn(`❌ Fréquence invalide: ${frequency}`);
      return res.status(400).json({ 
        error: 'paymentFrequency doit être 1 (oneshot), 3 (trimestriel), 6 (semestriel) ou 12 (mensuel)' 
      });
    }
    
    logger.debug(`✅ Données validées - Fréquence: ${frequency} paiement(s)`);
    logger.debug(`🔍 Vérification permissions - Rôle: ${req.user.role}`);
    
    // Vérifier les permissions
    const requester = req.user;
    if (requester.role === 'member' && requester.id !== memberId) {
      logger.warn(`🚫 Membre ${requester.email} tente de créer abonnement pour un autre membre`);
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    if (requester.role === 'admin') {
      logger.debug(`👨‍💼 Admin - Vérification appartenance salle membre ${memberId}`);
      // Vérifier que le membre est dans la même salle
      const member = await prisma.user.findUnique({
        where: { id: memberId },
        select: { id: true, firstName: true, lastName: true, gymId: true }
      });
      
      logger.debug(`🔍 Membre trouvé: ${member ? getFullName(member) : 'NON TROUVÉ'}`);
      if (member) {
        logger.debug(`🏢 Comparaison salles - Admin: ${requester.gymId}, Membre: ${member.gymId}`);
      }
      
      if (!member || member.gymId !== requester.gymId) {
        logger.warn(`🚫 Admin ne peut pas créer abonnement pour membre d'autre salle`);
        return res.status(403).json({ 
          error: 'Vous ne pouvez créer des abonnements que pour les membres de votre salle' 
        });
      }
      logger.debug(`✅ Appartenance salle validée`);
    }
    
    logger.debug(`✅ Permissions validées`);
    logger.info(`🔄 Appel service création abonnement avec fréquence: ${frequency}...`);
    
    // Créer l'abonnement avec les paiements selon la fréquence
    const result = await createYearlySubscriptionWithPayments(
      memberId,
      parseInt(subscriptionTypeId),
      startDate ? new Date(startDate) : new Date(),
      frequency
    );
    
    logger.info(`✅ Abonnement créé: ID ${result.subscription.id}`);
    logger.info(`📊 Statistiques - ${result.payments.length} paiements générés (fréquence: ${frequency})`);
    
    const frequencyLabels = {
      1: 'paiement unique',
      3: 'trimestriel',
      6: 'semestriel',
      12: 'mensuel'
    };
    
    const responseData = {
      message: `Abonnement ${frequencyLabels[frequency]} créé avec succès`,
      subscription: result.subscription,
      subscriptionType: result.subscriptionType,
      paymentFrequency: frequency,
      paymentsGenerated: result.payments.length,
      payments: result.payments.map(p => ({
        id: p.id,
        monthNumber: p.monthNumber,
        amount: p.amount,
        dueDate: p.dueDate,
        status: p.status
      }))
    };
    
    logger.debug(`📤 Réponse création abonnement:`, {
      ...responseData,
      payments: `${responseData.payments.length} paiements`
    });
    
    // Envoyer notifications au membre
    const memberUser = await prisma.user.findUnique({
      where: { id: memberId }
    });
    
    if (memberUser?.fcmToken) {
      logger.info(`🔔 Envoi notifications à ${getFullName(memberUser)}`);
      
      // Notification pour le nouvel abonnement
      const subscriptionData = {
        id: result.subscription.id,
        subscriptionType: result.subscriptionType,
        paymentFrequency: frequency
      };
      await notifyNewSubscription(memberUser.fcmToken, subscriptionData).catch(err => 
        logger.error('⚠️ Erreur notification abonnement FCM:', err)
      );
      
      // Notification pour le premier paiement
      if (result.payments.length > 0) {
        const firstPayment = result.payments[0];
        await notifyNewPayment(memberUser.fcmToken, firstPayment).catch(err => 
          logger.error('⚠️ Erreur notification paiement FCM:', err)
        );
      }
    }
    
    res.status(201).json(responseData);
    
  } catch (error) {
    logger.error('💥 Erreur création abonnement:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /subscriptions/:id
 * Obtenir le statut détaillé d'un abonnement
 */
router.get('/:id', auth, async (req, res) => {
  logger.debug(`🔍 Récupération statut abonnement - User: ${req.user?.email}, ID: ${req.params.id}`);

  try {
    const subscriptionId = parseInt(req.params.id);
    logger.debug(`🔄 Appel service statut abonnement ${subscriptionId}...`);
    
    const status = await getSubscriptionStatus(subscriptionId);
    
    logger.debug(`✅ Statut récupéré - Abonnement ${subscriptionId}`);
    logger.debug(`📊 Stats: ${status.stats.completedPayments}/${status.stats.totalPayments} paiements complétés (${status.stats.percentComplete}%)`);
    
    // Vérifier les permissions
    const requester = req.user;
    logger.debug(`🔍 Vérification permissions - Rôle: ${requester.role}`);
    
    if (requester.role === 'member' && status.subscription.memberId !== requester.id) {
      logger.warn(`🚫 Membre ${requester.email} tente d'accéder à abonnement d'un autre membre`);
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    if (requester.role === 'admin' && status.subscription.Member.User.gymId !== requester.gymId) {
      logger.warn(`🚫 Admin ${requester.email} tente d'accéder à abonnement d'autre salle`);
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    logger.debug(`✅ Permissions validées`);
    logger.debug(`📤 Réponse statut abonnement ${subscriptionId}`);
    
    res.json(status);
    
  } catch (error) {
    logger.error('💥 Erreur récupération statut:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /subscriptions/member/:memberId
 * Obtenir tous les abonnements d'un membre
 */
router.get('/member/:memberId', auth, async (req, res) => {
  logger.debug(`📋 Récupération abonnements membre - User: ${req.user?.email}, Member ID: ${req.params.memberId}`);

  try {
    const memberId = parseInt(req.params.memberId);
    logger.debug(`🔍 Vérification permissions - Rôle: ${req.user.role}`);
    
    // Vérifier les permissions
    const requester = req.user;
    if (requester.role === 'member' && requester.id !== memberId) {
      logger.warn(`🚫 Membre ${requester.email} tente d'accéder aux abonnements d'un autre membre`);
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    if (requester.role === 'admin') {
      logger.debug(`👨‍💼 Admin - Vérification appartenance salle membre ${memberId}`);
      const member = await prisma.user.findUnique({
        where: { id: memberId },
        select: { id: true, firstName: true, lastName: true, gymId: true }
      });
      
      logger.debug(`🔍 Membre: ${member ? getFullName(member) : 'NON TROUVÉ'}`);
      if (member) {
        logger.debug(`🏢 Comparaison salles - Admin: ${requester.gymId}, Membre: ${member.gymId}`);
      }
      
      if (!member || member.gymId !== requester.gymId) {
        logger.warn(`🚫 Admin ne peut pas accéder aux abonnements d'autre salle`);
        return res.status(403).json({ error: 'Accès refusé' });
      }
      logger.debug(`✅ Appartenance salle validée`);
    }
    
    logger.debug(`✅ Permissions validées`);
    logger.debug(`🔍 Recherche abonnements membre ${memberId}...`);
    
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
    
    logger.info(`✅ ${subscriptions.length} abonnement(s) trouvé(s) pour membre ${memberId}`);
    if (subscriptions.length > 0) {
      logger.debug(`📊 Résumé:`, subscriptions.map(s => ({
        id: s.id,
        type: s.SubscriptionType.name,
        status: s.status,
        payments: s.Payment.length
      })));
    }
    
    logger.debug(`📤 Réponse abonnements membre ${memberId}`);
    res.json({ subscriptions });
    
  } catch (error) {
    logger.error('💥 Erreur récupération abonnements:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subscriptions/payments/:paymentId/acknowledge
 * Acquitter un paiement et activer l'abonnement si celui-ci est en attente
 */
router.post('/payments/:paymentId/acknowledge', auth, apiLimiter, async (req, res) => {
  logger.info(`💳 Acquittement paiement - User: ${req.user?.email}, Payment ID: ${req.params.paymentId}, Données:`, req.body);

  try {
    const paymentId = parseInt(req.params.paymentId);
    const { paymentMethod, transactionId } = req.body;
    
    logger.debug(`🔍 Validation - paymentId: ${paymentId}, paymentMethod: ${paymentMethod}, transactionId: ${transactionId}`);
    
    if (!paymentMethod) {
      logger.warn(`❌ paymentMethod manquant`);
      return res.status(400).json({ error: 'paymentMethod est requis' });
    }
    
    logger.debug(`✅ Données validées`);
    logger.debug(`🔍 Recherche paiement ${paymentId}...`);
    
    // Vérifier les permissions
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        Subscription: true,
        Member: {
          include: { User: true }
        }
      }
    });
    
    if (!payment) {
      logger.warn(`❌ Paiement non trouvé: ID ${paymentId}`);
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }
    
    logger.debug(`✅ Paiement trouvé: ${payment.amount}€ pour ${getFullName(payment.Member.User)}`);
    logger.debug(`📊 Statut actuel: ${payment.status}, Abonnement: ${payment.subscriptionId}`);
    
    const requester = req.user;
    logger.debug(`🔍 Vérification permissions - Rôle: ${requester.role}`);
    
    if (requester.role === 'member' && payment.memberId !== requester.id) {
      logger.warn(`🚫 Membre ${requester.email} tente d'acquitter paiement d'un autre membre`);
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    if (requester.role === 'admin' && payment.Member.User.gymId !== requester.gymId) {
      logger.warn(`🚫 Admin ${requester.email} tente d'acquitter paiement d'autre salle`);
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    logger.debug(`✅ Permissions validées`);
    logger.info(`🔄 Appel service acquittement...`);
    
    const updatedPayment = await acknowledgePayment(
      paymentId,
      paymentMethod,
      transactionId
    );
    
    logger.info(`✅ Paiement acquitté: ${updatedPayment.id}`);
    logger.debug(`🔍 Récupération abonnement mis à jour...`);
    
    // Récupérer l'abonnement mis à jour
    const subscription = await prisma.subscription.findUnique({
      where: { id: payment.subscriptionId },
      include: {
        SubscriptionType: true
      }
    });
    
    logger.debug(`✅ Abonnement: ${subscription ? subscription.SubscriptionType.name : 'NON TROUVÉ'}`);
    if (subscription) {
      logger.debug(`📊 Statut abonnement: ${subscription.status}`);
    }
    
    const responseData = {
      message: 'Paiement acquitté avec succès',
      payment: updatedPayment,
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        type: subscription.SubscriptionType.name,
        startDate: subscription.startDate,
        endDate: subscription.endDate
      } : null
    };
    
    // Envoyer notification au membre
    const memberUser = await prisma.user.findUnique({
      where: { id: payment.memberId }
    });
    
    if (memberUser?.fcmToken) {
      logger.info(`🔔 Envoi notification paiement confirmé à ${getFullName(memberUser)}`);
      await notifyPaymentConfirmed(memberUser.fcmToken, updatedPayment).catch(err =>
        logger.error('⚠️ Erreur notification FCM:', err)
      );
    }
    
    logger.debug(`📤 Réponse acquittement paiement ${paymentId}`);
    res.json(responseData);
    
  } catch (error) {
    logger.error('💥 Erreur acquittement paiement:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subscriptions/payments/:paymentId/complete
 * Marquer un paiement comme complété
 */
router.post('/payments/:paymentId/complete', auth, apiLimiter, async (req, res) => {
  logger.info(`💰 Complétion paiement - User: ${req.user?.email}, Payment ID: ${req.params.paymentId}, Données:`, req.body);

  try {
    const paymentId = parseInt(req.params.paymentId);
    const { paymentMethod, transactionId } = req.body;
    
    logger.debug(`🔍 Validation - paymentId: ${paymentId}, paymentMethod: ${paymentMethod}, transactionId: ${transactionId}`);

    if (!paymentMethod) {
      logger.warn(`❌ paymentMethod manquant`);
      return res.status(400).json({ error: 'paymentMethod est requis' });
    }
    
    logger.debug(`✅ Données validées`);
    logger.debug(`🔍 Recherche paiement ${paymentId}...`);

    // Vérifier les permissions
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        Member: {
          include: { User: true }
        }
      }
    });
    
    if (!payment) {
      logger.warn(`❌ Paiement non trouvé: ID ${paymentId}`);
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }
    
    logger.debug(`✅ Paiement trouvé: ${payment.amount}€ pour ${getFullName(payment.Member.User)}`);
    
    const requester = req.user;
    logger.debug(`🔍 Vérification permissions - Rôle: ${requester.role}`);

    if (requester.role === 'member' && payment.memberId !== requester.id) {
      logger.warn(`🚫 Membre ${requester.email} tente de compléter paiement d'un autre membre`);
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    if (requester.role === 'admin' && payment.Member.User.gymId !== requester.gymId) {
      logger.warn(`🚫 Admin ${requester.email} tente de compléter paiement d'autre salle`);
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    logger.debug(`✅ Permissions validées`);
    logger.info(`🔄 Appel service complétion paiement...`);

    const updatedPayment = await markPaymentAsCompleted(
      paymentId,
      paymentMethod,
      transactionId
    );
    
    logger.info(`✅ Paiement complété: ${updatedPayment.id}`);
    logger.debug(`📤 Réponse complétion paiement ${paymentId}`);

    res.json({
      message: 'Paiement marqué comme complété',
      payment: updatedPayment
    });
    
  } catch (error) {
    logger.error('💥 Erreur complétion paiement:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /subscriptions/payments/upcoming
 * Obtenir les paiements à venir (pour les rappels)
 */
router.get('/payments/upcoming', auth, async (req, res) => {
  logger.debug(`📅 Récupération paiements à venir - User: ${req.user?.email} (${req.user?.type})`);

  try {
    // Seuls les admins et owners peuvent voir tous les paiements à venir
    const requester = req.user;
    if (requester.role === 'member') {
      logger.warn(`🚫 Accès refusé pour membre ${requester.email}`);
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    
    const now = new Date();
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    
    logger.debug(`🔍 Période: ${now.toISOString().split('T')[0]} au ${sevenDaysLater.toISOString().split('T')[0]}`);

    let whereClause = {
      status: 'pending',
      dueDate: {
        gte: now,
        lte: sevenDaysLater
      }
    };
    
    // Si admin, filtrer par salle
    if (requester.role === 'admin') {
      whereClause.Member = {
        User: {
          gymId: requester.gymId
        }
      };
      logger.debug(`👨‍💼 Admin - Filtrage par salle: ${requester.gymId}`);
    } else {
      logger.debug(`👑 Owner - Tous les paiements`);
    }
    
    const upcomingPayments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        Subscription: true,
        Member: {
          include: {
            User: true
          }
        }
      },
      orderBy: { dueDate: 'asc' }
    });
    
    logger.info(`✅ ${upcomingPayments.length} paiement(s) à venir trouvé(s)`);

    const responseData = {
      count: upcomingPayments.length,
      payments: upcomingPayments.map(p => ({
        id: p.id,
        memberId: p.memberId,
        memberName: getFullName(p.Member.User),
        memberEmail: p.Member.User.email,
        amount: p.amount,
        dueDate: p.dueDate,
        monthNumber: p.monthNumber,
        daysUntilDue: Math.ceil((new Date(p.dueDate) - now) / (1000 * 60 * 60 * 24))
      }))
    };

    logger.debug(`📤 Réponse paiements à venir: ${upcomingPayments.length} résultat(s)`);
    res.json(responseData);
    
  } catch (error) {
    logger.error('💥 Erreur récupération paiements à venir:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
