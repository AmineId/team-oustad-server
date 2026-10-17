const prisma = require('../utils/prismaClient');
const { notifyPaymentStatusChange } = require('./pushNotificationService');
const { generateSubscriptionId, generatePaymentId } = require('../utils/idGenerator');
const { getFullName } = require('../utils/nameUtils');

/**
 * Crée un abonnement annuel avec paiements automatiques
 * @param {number} memberId - ID du membre
 * @param {number} subscriptionTypeId - ID du type d'abonnement
 * @param {Date} startDate - Date de début de l'abonnement
 * @param {number} paymentFrequency - Nombre de paiements (1: oneshot, 3: trimestriel, 6: semestriel, 12: mensuel)
 * @returns {Promise<Object>} L'abonnement créé avec ses paiements
 */
async function createYearlySubscriptionWithPayments(memberId, subscriptionTypeId, startDate = new Date(), paymentFrequency = 12) {
  console.log(`\n🔄 SERVICE: Création abonnement`);
  console.log(`   Membre ID: ${memberId}, Type ID: ${subscriptionTypeId}`);
  console.log(`   Date début: ${startDate.toISOString().split('T')[0]}`);
  console.log(`   Fréquence paiement: ${paymentFrequency} paiement(s)`);
  
  // Récupérer le type d'abonnement
  console.log(`🔍 Recherche type abonnement ${subscriptionTypeId}...`);
  const subscriptionType = await prisma.subscriptionType.findUnique({
    where: { id: subscriptionTypeId }
  });
  
  if (!subscriptionType) {
    console.log(`❌ Type abonnement non trouvé: ${subscriptionTypeId}`);
    throw new Error(`Type d'abonnement avec ID ${subscriptionTypeId} non trouvé`);
  }
  
  console.log(`✅ Type trouvé: ${subscriptionType.name} (${subscriptionType.monthlyPrice}€/mois)`);
  
  if (!subscriptionType.isActive) {
    console.log(`❌ Type abonnement inactif: ${subscriptionType.name}`);
    throw new Error(`Le type d'abonnement "${subscriptionType.name}" n'est plus disponible`);
  }
  
  // Déterminer le type de fréquence
  const frequencyTypes = {
    1: 'paiement unique',
    3: 'trimestriel (4 paiements/an)',
    6: 'semestriel (2 paiements/an)',
    12: 'mensuel (12 paiements/an)'
  };
  const frequencyLabel = frequencyTypes[paymentFrequency] || `${paymentFrequency} paiements`;
  console.log(`📅 Création abonnement ${frequencyLabel} pour le membre ${memberId}`);
  console.log(`   Type: ${subscriptionType.name}, Prix mensuel: ${subscriptionType.monthlyPrice}€`);
  
  // Calculer la date de fin (1 an après)
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  console.log(`📅 Période calculée: ${startDate.toLocaleDateString()} → ${endDate.toLocaleDateString()}`);
  
  // Calculer le montant par paiement en fonction de la fréquence
  const monthsPerPayment = 12 / paymentFrequency;
  const amountPerPayment = subscriptionType.monthlyPrice * monthsPerPayment;
  console.log(`💰 Montant par paiement: ${amountPerPayment}€ (${monthsPerPayment} mois)`);
  
  // Créer l'abonnement
  console.log(`🔄 Création abonnement en base...`);
  const subscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId,
      subscriptionTypeId,
      status: 'active',
      startDate,
      endDate,
      autoRenew: true,
      paymentFrequency
    },
    include: {
      SubscriptionType: true
    }
  });
  
  console.log(`✅ Abonnement créé avec ID: ${subscription.id}`);
  console.log(`   Période: ${startDate.toLocaleDateString()} → ${endDate.toLocaleDateString()}`);
  console.log(`   Fréquence: ${frequencyLabel}`);
  
  // Générer les paiements selon la fréquence
  console.log(`💳 Génération des ${paymentFrequency} paiement(s)...`);
  const payments = [];
  
  for (let i = 0; i < paymentFrequency; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + (i * monthsPerPayment));
    
    console.log(`   🔄 Création paiement ${i + 1}/${paymentFrequency}...`);
    const payment = await prisma.payment.create({
      data: {
        displayId: generatePaymentId(),
        memberId,
        subscriptionId: subscription.id,
        amount: amountPerPayment,
        currency: 'EUR',
        status: 'pending',
        type: 'subscription',
        paymentMethod: null, // Sera rempli lors du paiement effectif
        description: `Paiement ${i + 1}/${paymentFrequency} - ${subscriptionType.name}`,
        dueDate,
        monthNumber: (i * monthsPerPayment) + 1, // Premier mois couvert par ce paiement
      }
    });
    
    payments.push(payment);
    console.log(`   ✅ Paiement ${i + 1}/${paymentFrequency} créé (ID: ${payment.id})`);
    console.log(`      Montant: ${amountPerPayment}€, Dû le: ${dueDate.toLocaleDateString()}`);
  }
  
  console.log(`✅ ${payments.length} paiement(s) généré(s)`);
  console.log(`💰 Total annuel: ${(amountPerPayment * paymentFrequency).toFixed(2)}€`);
  console.log(`📤 Retour service: abonnement ${subscription.id} avec ${payments.length} paiements\n`);
  
  return {
    subscription,
    subscriptionType,
    payments
  };
}

/**
 * Vérifie les paiements en retard et met à jour les statuts
 * Ce job doit être exécuté quotidiennement
 */
async function checkOverduePayments() {
  console.log('\n🔍 Vérification des paiements en retard...');
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  // Trouver les paiements en attente dont la date due est passée de plus de 7 jours
  const overduePayments = await prisma.payment.findMany({
    where: {
      status: 'pending',
      dueDate: {
        lt: sevenDaysAgo
      }
    },
    include: {
      Subscription: true,
      Member: {
        include: {
          User: true
        }
      }
    }
  });
  
  console.log(`📊 ${overduePayments.length} paiement(s) en retard détecté(s)`);
  
  const updatedSubscriptions = new Set();
  
  for (const payment of overduePayments) {
    // Mettre le paiement en retard
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'overdue' }
    });
    
    console.log(`⚠️  Paiement ${payment.id} marqué en retard`);
    console.log(`   Membre: ${getFullName(payment.Member.User)}`);
    console.log(`   Montant: ${payment.amount}€`);
    console.log(`   Date due: ${payment.dueDate.toLocaleDateString()}`);
    
    // Envoyer notification de changement de statut
    if (payment.Member.User.fcmToken) {
      console.log(`🔔 Envoi notification changement statut à ${getFullName(payment.Member.User)}`);
      await notifyPaymentStatusChange(
        payment.Member.User.fcmToken,
        updatedPayment,
        'pending',
        'overdue'
      ).catch(err => console.error('⚠️ Erreur notification FCM:', err));
    }
    
    // Si l'abonnement n'est pas déjà en pause, le mettre en pause
    if (payment.Subscription && payment.Subscription.status === 'active') {
      if (!updatedSubscriptions.has(payment.Subscription.id)) {
        await prisma.subscription.update({
          where: { id: payment.Subscription.id },
          data: { status: 'paused' }
        });
        
        updatedSubscriptions.add(payment.Subscription.id);
        console.log(`⏸️  Abonnement ${payment.Subscription.id} mis en pause`);
      }
    }
  }
  
  console.log(`\n✅ Vérification terminée: ${updatedSubscriptions.size} abonnement(s) mis en pause`);
  
  return {
    overduePayments: overduePayments.length,
    pausedSubscriptions: updatedSubscriptions.size,
    overduePaymentsList: overduePayments
  };
}

/**
 * Vérifie les paiements qui arrivent bientôt à échéance (dans les 7 prochains jours)
 * Pour envoyer des rappels
 */
async function checkUpcomingPayments() {
  console.log('\n🔔 Vérification des paiements à venir...');
  const now = new Date();
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  
  const upcomingPayments = await prisma.payment.findMany({
    where: {
      status: 'pending',
      dueDate: {
        gte: now,
        lte: sevenDaysLater
      }
    },
    include: {
      Subscription: true,
      Member: {
        include: {
          User: true
        }
      }
    }
  });
  
  console.log(`📋 ${upcomingPayments.length} paiement(s) à venir dans les 7 prochains jours`);
  
  for (const payment of upcomingPayments) {
    const daysUntilDue = Math.ceil((payment.dueDate - now) / (1000 * 60 * 60 * 24));
    console.log(`   💰 Paiement ${payment.id} dû dans ${daysUntilDue} jour(s)`);
    console.log(`      Membre: ${getFullName(payment.Member.User)}`);
    console.log(`      Montant: ${payment.amount}€`);
  }
  
  return upcomingPayments;
}

/**
 * Marque un paiement comme complété
 * @param {number} paymentId - ID du paiement
 * @param {string} paymentMethod - Méthode de paiement utilisée
 * @param {string} transactionId - ID de transaction (optionnel)
 */
async function markPaymentAsCompleted(paymentId, paymentMethod, transactionId = null) {
  console.log(`\n🔄 SERVICE: Marquage paiement complété`);
  console.log(`   Paiement ID: ${paymentId}, Méthode: ${paymentMethod}, Transaction: ${transactionId}`);
  
  // Récupérer l'ancien statut avant mise à jour
  const oldPayment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      Member: { include: { User: true } }
    }
  });
  const oldStatus = oldPayment?.status;
  
  console.log(`🔄 Mise à jour paiement en base...`);
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'completed',
      paymentMethod,
      transactionId,
      paidAt: new Date()
    },
    include: {
      Subscription: true
    }
  });
  
  console.log(`✅ Paiement ${paymentId} marqué comme complété`);
  console.log(`   Montant: ${payment.amount}€, Méthode: ${payment.paymentMethod}`);
  
  // Envoyer notification de changement de statut
  if (oldPayment?.Member.User.fcmToken && oldStatus !== 'completed') {
    console.log(`🔔 Envoi notification changement statut à ${getFullName(oldPayment.Member.User)}`);
    await notifyPaymentStatusChange(
      oldPayment.Member.User.fcmToken,
      payment,
      oldStatus,
      'completed'
    ).catch(err => console.error('⚠️ Erreur notification FCM:', err));
  }
  
  // Si c'était le dernier paiement en retard, réactiver l'abonnement
  if (payment.Subscription && payment.Subscription.status === 'paused') {
    console.log(`🔍 Abonnement en pause détecté - Vérification paiements en retard...`);
    const remainingOverdue = await prisma.payment.count({
      where: {
        subscriptionId: payment.subscriptionId,
        status: 'overdue'
      }
    });
    
    console.log(`📊 ${remainingOverdue} paiement(s) en retard restant(s)`);
    
    if (remainingOverdue === 0) {
      console.log(`🔄 Tous les retards réglés - Réactivation abonnement...`);
      await prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 'active' }
      });
      console.log(`▶️  Abonnement ${payment.subscriptionId} réactivé`);
    } else {
      console.log(`⏸️  Abonnement reste en pause (${remainingOverdue} retards)`);
    }
  }
  
  console.log(`📤 Retour service: paiement ${paymentId} complété\n`);
  return payment;
}

/**
 * Acquitte un paiement et active l'abonnement si celui-ci est en attente
 * @param {number} paymentId - ID du paiement
 * @param {string} paymentMethod - Méthode de paiement utilisée
 * @param {string} transactionId - ID de transaction (optionnel)
 */
async function acknowledgePayment(paymentId, paymentMethod, transactionId = null) {
  console.log(`\n🔄 SERVICE: Acquittement paiement`);
  console.log(`   Paiement ID: ${paymentId}, Méthode: ${paymentMethod}, Transaction: ${transactionId}`);
  
  // Récupérer le paiement avec son abonnement
  console.log(`🔍 Recherche paiement ${paymentId}...`);
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      Subscription: {
        include: {
          SubscriptionType: true
        }
      },
      Member: {
        include: {
          User: true
        }
      }
    }
  });

  if (!payment) {
    console.log(`❌ Paiement non trouvé: ${paymentId}`);
    throw new Error('Paiement non trouvé');
  }

  console.log(`✅ Paiement trouvé - Membre: ${getFullName(payment.Member.User)}, Montant: ${payment.amount}€`);
  console.log(`   Statut actuel: ${payment.status}`);

  if (payment.status === 'completed') {
    console.log(`❌ Paiement déjà acquitté`);
    throw new Error('Ce paiement a déjà été acquitté');
  }

  console.log(`💳 Acquittement du paiement ${paymentId}`);
  console.log(`   Membre: ${getFullName(payment.Member.User)}`);
  console.log(`   Montant: ${payment.amount}€`);

  // Mettre à jour le paiement
  console.log(`🔄 Mise à jour statut paiement en base...`);
  const updatedPayment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'completed',
      paymentMethod,
      transactionId,
      paidAt: new Date()
    },
    include: {
      Subscription: true
    }
  });

  console.log(`✅ Paiement ${paymentId} acquitté avec succès`);

  // Si le paiement est lié à un abonnement
  if (payment.Subscription) {
    const subscription = payment.Subscription;
    console.log(`🔍 Paiement lié à abonnement ${subscription.id} (statut: ${subscription.status})`);
    
    // Si l'abonnement est en attente, l'activer
    if (subscription.status === 'pending') {
      console.log(`🔄 Activation abonnement en attente...`);
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'active' }
      });
      
      console.log(`✨ Abonnement ${subscription.id} activé (était en attente)`);
      console.log(`   Type: ${subscription.SubscriptionType.name}`);
      console.log(`   Période: ${subscription.startDate.toLocaleDateString()} → ${subscription.endDate.toLocaleDateString()}`);
    }
    // Si l'abonnement était en pause et qu'il n'y a plus de paiements en retard, le réactiver
    else if (subscription.status === 'paused') {
      console.log(`🔍 Abonnement en pause - Vérification paiements en retard...`);
      const remainingOverdue = await prisma.payment.count({
        where: {
          subscriptionId: subscription.id,
          status: 'overdue'
        }
      });
      
      console.log(`📊 ${remainingOverdue} paiement(s) en retard restant(s)`);
      
      if (remainingOverdue === 0) {
        console.log(`🔄 Tous les retards réglés - Réactivation abonnement...`);
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'active' }
        });
        console.log(`▶️  Abonnement ${subscription.id} réactivé (tous les paiements en retard sont réglés)`);
      } else {
        console.log(`⏸️  Abonnement reste en pause (${remainingOverdue} retards)`);
      }
    } else {
      console.log(`ℹ️  Statut abonnement inchangé: ${subscription.status}`);
    }
  } else {
    console.log(`ℹ️  Paiement non lié à un abonnement`);
  }

  console.log(`📤 Retour service: paiement ${paymentId} acquitté\n`);
  return updatedPayment;
}

/**
 * Obtient le statut détaillé d'un abonnement avec les paiements
 * @param {number} subscriptionId - ID de l'abonnement
 */
async function getSubscriptionStatus(subscriptionId) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      SubscriptionType: true,
      Payment: {
        orderBy: { monthNumber: 'asc' }
      },
      Member: {
        include: {
          User: true
        }
      }
    }
  });
  
  if (!subscription) {
    throw new Error('Abonnement non trouvé');
  }
  
  const totalPayments = subscription.Payment.length;
  const completedPayments = subscription.Payment.filter(p => p.status === 'completed').length;
  const overduePayments = subscription.Payment.filter(p => p.status === 'overdue').length;
  const pendingPayments = subscription.Payment.filter(p => p.status === 'pending').length;
  
  const nextPayment = subscription.Payment.find(p => p.status === 'pending');
  
  return {
    subscription,
    stats: {
      totalPayments,
      completedPayments,
      overduePayments,
      pendingPayments,
      percentComplete: Math.round((completedPayments / totalPayments) * 100)
    },
    nextPayment: nextPayment ? {
      id: nextPayment.id,
      amount: nextPayment.amount,
      dueDate: nextPayment.dueDate,
      monthNumber: nextPayment.monthNumber
    } : null
  };
}

module.exports = {
  createYearlySubscriptionWithPayments,
  checkOverduePayments,
  checkUpcomingPayments,
  markPaymentAsCompleted,
  acknowledgePayment,
  getSubscriptionStatus
};
