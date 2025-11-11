const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Crée un abonnement annuel avec 12 paiements mensuels automatiques
 * @param {number} memberId - ID du membre
 * @param {number} subscriptionTypeId - ID du type d'abonnement
 * @param {Date} startDate - Date de début de l'abonnement
 * @returns {Promise<Object>} L'abonnement créé avec ses paiements
 */
async function createYearlySubscriptionWithPayments(memberId, subscriptionTypeId, startDate = new Date()) {
  // Récupérer le type d'abonnement
  const subscriptionType = await prisma.subscriptionType.findUnique({
    where: { id: subscriptionTypeId }
  });
  
  if (!subscriptionType) {
    throw new Error(`Type d'abonnement avec ID ${subscriptionTypeId} non trouvé`);
  }
  
  if (!subscriptionType.isActive) {
    throw new Error(`Le type d'abonnement "${subscriptionType.name}" n'est plus disponible`);
  }
  
  console.log(`📅 Création d'un abonnement annuel pour le membre ${memberId}`);
  console.log(`   Type: ${subscriptionType.name}, Prix mensuel: ${subscriptionType.monthlyPrice}€`);
  
  // Calculer la date de fin (1 an après)
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  
  // Créer l'abonnement
  const subscription = await prisma.subscription.create({
    data: {
      memberId,
      subscriptionTypeId,
      status: 'active',
      startDate,
      endDate,
      autoRenew: true,
    },
    include: {
      subscriptionType: true
    }
  });
  
  console.log(`✅ Abonnement créé avec ID: ${subscription.id}`);
  console.log(`   Période: ${startDate.toLocaleDateString()} → ${endDate.toLocaleDateString()}`);
  
  // Générer les 12 paiements mensuels
  const payments = [];
  for (let month = 0; month < 12; month++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + month);
    
    const payment = await prisma.payment.create({
      data: {
        memberId,
        subscriptionId: subscription.id,
        amount: subscriptionType.monthlyPrice,
        currency: 'EUR',
        status: 'pending',
        type: 'subscription',
        paymentMethod: null, // Sera rempli lors du paiement effectif
        description: `Paiement mensuel ${month + 1}/12 - ${subscriptionType.name}`,
        dueDate,
        monthNumber: month + 1,
      }
    });
    
    payments.push(payment);
    console.log(`   💳 Paiement ${month + 1}/12 créé - Dû le: ${dueDate.toLocaleDateString()}`);
  }
  
  console.log(`✅ ${payments.length} paiements mensuels générés`);
  
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
      subscription: true,
      member: {
        include: {
          user: true
        }
      }
    }
  });
  
  console.log(`📊 ${overduePayments.length} paiement(s) en retard détecté(s)`);
  
  const updatedSubscriptions = new Set();
  
  for (const payment of overduePayments) {
    // Mettre le paiement en retard
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'overdue' }
    });
    
    console.log(`⚠️  Paiement ${payment.id} marqué en retard`);
    console.log(`   Membre: ${payment.member.user.fullName}`);
    console.log(`   Montant: ${payment.amount}€`);
    console.log(`   Date due: ${payment.dueDate.toLocaleDateString()}`);
    
    // Si l'abonnement n'est pas déjà en pause, le mettre en pause
    if (payment.subscription && payment.subscription.status === 'active') {
      if (!updatedSubscriptions.has(payment.subscription.id)) {
        await prisma.subscription.update({
          where: { id: payment.subscription.id },
          data: { status: 'paused' }
        });
        
        updatedSubscriptions.add(payment.subscription.id);
        console.log(`⏸️  Abonnement ${payment.subscription.id} mis en pause`);
      }
    }
  }
  
  console.log(`\n✅ Vérification terminée: ${updatedSubscriptions.size} abonnement(s) mis en pause`);
  
  return {
    overduePayments: overduePayments.length,
    pausedSubscriptions: updatedSubscriptions.size
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
      subscription: true,
      member: {
        include: {
          user: true
        }
      }
    }
  });
  
  console.log(`📋 ${upcomingPayments.length} paiement(s) à venir dans les 7 prochains jours`);
  
  for (const payment of upcomingPayments) {
    const daysUntilDue = Math.ceil((payment.dueDate - now) / (1000 * 60 * 60 * 24));
    console.log(`   💰 Paiement ${payment.id} dû dans ${daysUntilDue} jour(s)`);
    console.log(`      Membre: ${payment.member.user.fullName}`);
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
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'completed',
      paymentMethod,
      transactionId,
      paidAt: new Date()
    },
    include: {
      subscription: true
    }
  });
  
  console.log(`✅ Paiement ${paymentId} marqué comme complété`);
  
  // Si c'était le dernier paiement en retard, réactiver l'abonnement
  if (payment.subscription && payment.subscription.status === 'paused') {
    const remainingOverdue = await prisma.payment.count({
      where: {
        subscriptionId: payment.subscriptionId,
        status: 'overdue'
      }
    });
    
    if (remainingOverdue === 0) {
      await prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 'active' }
      });
      console.log(`▶️  Abonnement ${payment.subscriptionId} réactivé`);
    }
  }
  
  return payment;
}

/**
 * Acquitte un paiement et active l'abonnement si celui-ci est en attente
 * @param {number} paymentId - ID du paiement
 * @param {string} paymentMethod - Méthode de paiement utilisée
 * @param {string} transactionId - ID de transaction (optionnel)
 */
async function acknowledgePayment(paymentId, paymentMethod, transactionId = null) {
  // Récupérer le paiement avec son abonnement
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      subscription: {
        include: {
          subscriptionType: true
        }
      },
      member: {
        include: {
          user: true
        }
      }
    }
  });

  if (!payment) {
    throw new Error('Paiement non trouvé');
  }

  if (payment.status === 'completed') {
    throw new Error('Ce paiement a déjà été acquitté');
  }

  console.log(`💳 Acquittement du paiement ${paymentId}`);
  console.log(`   Membre: ${payment.member.user.fullName}`);
  console.log(`   Montant: ${payment.amount}€`);

  // Mettre à jour le paiement
  const updatedPayment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'completed',
      paymentMethod,
      transactionId,
      paidAt: new Date()
    },
    include: {
      subscription: true
    }
  });

  console.log(`✅ Paiement ${paymentId} acquitté`);

  // Si le paiement est lié à un abonnement
  if (payment.subscription) {
    const subscription = payment.subscription;
    
    // Si l'abonnement est en attente, l'activer
    if (subscription.status === 'pending') {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'active' }
      });
      
      console.log(`✨ Abonnement ${subscription.id} activé (était en attente)`);
      console.log(`   Type: ${subscription.subscriptionType.name}`);
      console.log(`   Période: ${subscription.startDate.toLocaleDateString()} → ${subscription.endDate.toLocaleDateString()}`);
    }
    // Si l'abonnement était en pause et qu'il n'y a plus de paiements en retard, le réactiver
    else if (subscription.status === 'paused') {
      const remainingOverdue = await prisma.payment.count({
        where: {
          subscriptionId: subscription.id,
          status: 'overdue'
        }
      });
      
      if (remainingOverdue === 0) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'active' }
        });
        console.log(`▶️  Abonnement ${subscription.id} réactivé (tous les paiements en retard sont réglés)`);
      }
    }
  }

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
      payments: {
        orderBy: { monthNumber: 'asc' }
      },
      member: {
        include: {
          user: true
        }
      }
    }
  });
  
  if (!subscription) {
    throw new Error('Abonnement non trouvé');
  }
  
  const totalPayments = subscription.payments.length;
  const completedPayments = subscription.payments.filter(p => p.status === 'completed').length;
  const overduePayments = subscription.payments.filter(p => p.status === 'overdue').length;
  const pendingPayments = subscription.payments.filter(p => p.status === 'pending').length;
  
  const nextPayment = subscription.payments.find(p => p.status === 'pending');
  
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
