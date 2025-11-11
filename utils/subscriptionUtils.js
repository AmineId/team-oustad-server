/**
 * Utilitaires pour la gestion des abonnements
 */

/**
 * Détermine si un abonnement est actif basé sur les critères suivants :
 * - Statut de l'abonnement doit être 'active'
 * - L'abonnement ne doit pas être expiré (endDate > maintenant)
 * - Il doit y avoir au moins un paiement complété
 * - Le dernier paiement ne doit pas être en retard (basé sur le cycle de facturation)
 *
 * @param {Object} subscription - L'objet abonnement avec ses paiements
 * @returns {Object} - { isActive: boolean, reason?: string, details?: Object }
 */
function isSubscriptionActive(subscription) {
  const now = new Date();

  // 1. Vérifier le statut de l'abonnement
  if (subscription.status !== 'active') {
    return {
      isActive: false,
      reason: 'subscription_inactive',
      details: { status: subscription.status }
    };
  }

  // 2. Vérifier si l'abonnement est expiré
  if (subscription.endDate && subscription.endDate < now) {
    return {
      isActive: false,
      reason: 'subscription_expired',
      details: {
        endDate: subscription.endDate,
        daysExpired: Math.floor((now - subscription.endDate) / (1000 * 60 * 60 * 24))
      }
    };
  }

  // 3. Vérifier qu'il y a des paiements
  if (!subscription.payments || subscription.payments.length === 0) {
    return {
      isActive: false,
      reason: 'no_payments',
      details: { paymentCount: 0 }
    };
  }

  // 4. Vérifier le dernier paiement
  const lastPayment = subscription.payments[0]; // Les paiements sont triés par date décroissante

  if (lastPayment.status !== 'completed') {
    return {
      isActive: false,
      reason: 'last_payment_not_completed',
      details: {
        lastPaymentStatus: lastPayment.status,
        lastPaymentDate: lastPayment.createdAt
      }
    };
  }

  // 5. Vérifier si le paiement est en retard
  const lastPaymentDate = new Date(lastPayment.createdAt);
  const billingCycleDays = subscription.billingCycle === 'monthly' ? 30 : 365;
  const nextPaymentDue = new Date(lastPaymentDate);
  nextPaymentDue.setDate(nextPaymentDue.getDate() + billingCycleDays);

  // Ajouter une tolérance de 7 jours pour les retards
  const gracePeriod = new Date(nextPaymentDue);
  gracePeriod.setDate(gracePeriod.getDate() + 7);

  if (now > gracePeriod) {
    return {
      isActive: false,
      reason: 'payment_overdue',
      details: {
        lastPaymentDate: lastPaymentDate,
        nextPaymentDue: nextPaymentDue,
        gracePeriodEnd: gracePeriod,
        daysOverdue: Math.floor((now - gracePeriod) / (1000 * 60 * 60 * 24))
      }
    };
  }

  // L'abonnement est actif
  return {
    isActive: true,
    details: {
      lastPaymentDate: lastPaymentDate,
      nextPaymentDue: nextPaymentDue,
      daysUntilDue: Math.floor((nextPaymentDue - now) / (1000 * 60 * 60 * 24))
    }
  };
}

/**
 * Obtient l'abonnement actif d'un membre avec vérification complète
 * @param {Object} member - L'objet membre avec ses abonnements
 * @returns {Object|null} - L'abonnement actif ou null si aucun abonnement actif
 */
function getActiveSubscription(member) {
  if (!member || !member.subscriptions) {
    return null;
  }

  // Chercher tous les abonnements actifs
  const activeSubscriptions = member.subscriptions.filter(sub => sub.status === 'active');

  if (activeSubscriptions.length === 0) {
    return null;
  }

  // Pour chaque abonnement actif, vérifier s'il est vraiment actif
  for (const subscription of activeSubscriptions) {
    const check = isSubscriptionActive(subscription);
    if (check.isActive) {
      return {
        ...subscription,
        activeCheck: check
      };
    }
  }

  return null;
}

/**
 * Obtient tous les abonnements d'un membre avec leur statut détaillé
 * @param {Object} member - L'objet membre avec ses abonnements
 * @returns {Array} - Liste des abonnements avec leur statut
 */
function getSubscriptionsWithStatus(member) {
  if (!member || !member.subscriptions) {
    return [];
  }

  return member.subscriptions.map(subscription => ({
    ...subscription,
    activeCheck: isSubscriptionActive(subscription)
  }));
}

module.exports = {
  isSubscriptionActive,
  getActiveSubscription,
  getSubscriptionsWithStatus
};