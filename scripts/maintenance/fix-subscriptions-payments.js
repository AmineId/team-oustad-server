const prisma = require('../../utils/prismaClient');

/**
 * Script de correction des abonnements et paiements
 * Mode UPDATE uniquement - ne supprime rien
 */
async function fixSubscriptionsAndPayments() {
  console.log('🔧 Début de la correction des abonnements et paiements...\n');

  try {
    // 1. Récupérer tous les abonnements actifs avec leurs infos
    console.log('📥 Récupération des abonnements actifs...');
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active'
      },
      include: {
        SubscriptionType: true,
        Member: {
          include: {
            User: true
          }
        },
        Payment: true
      }
    });

    console.log(`📊 ${subscriptions.length} abonnements actifs trouvés\n`);

    for (const sub of subscriptions) {
      const member = sub.Member.User;
      console.log(`\n👤 Traitement: ${member.firstName} ${member.lastName}`);
      console.log(`   Abonnement: ${sub.SubscriptionType.name}`);
      console.log(`   Statut actuel: ${sub.status}`);
      console.log(`   Sessions: ${sub.sessionsUsed}/${sub.SubscriptionType.sessionQuota || '∞'}`);

      // Vérifier si l'abonnement a expiré
      const now = new Date();
      if (sub.endDate && new Date(sub.endDate) < now) {
        console.log(`   ⚠️  Abonnement expiré le ${sub.endDate.toISOString().split('T')[0]}`);
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'expired' }
        });
        console.log(`   ✅ Marqué comme expiré`);
        continue;
      }

      // Vérifier si le quota est épuisé (pour les abonnements avec quota)
      if (sub.SubscriptionType.sessionQuota !== null && 
          sub.sessionsUsed >= sub.SubscriptionType.sessionQuota) {
        console.log(`   ⚠️  Quota épuisé (${sub.sessionsUsed}/${sub.SubscriptionType.sessionQuota})`);
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'expired' }
        });
        console.log(`   ✅ Marqué comme expiré`);
        continue;
      }

      // Vérifier les paiements
      const payments = sub.Payment;
      console.log(`   💰 ${payments.length} paiement(s) trouvé(s)`);

      if (payments.length === 0) {
        console.log(`   ❌ AUCUN paiement trouvé - création d'un paiement`);
        
        // Créer un paiement pour cet abonnement
        console.log(`   🔄 Création du paiement...`);
        const newPayment = await prisma.payment.create({
          data: {
            displayId: `PAY-${sub.displayId.split('-')[1]}`,
            memberId: sub.memberId,
            subscriptionId: sub.id,
            amount: sub.SubscriptionType.monthlyPrice,
            currency: 'MAD',
            status: 'completed',
            type: 'subscription',
            paymentMethod: 'card',
            transactionId: `txn_fix_${sub.id}`,
            description: `Paiement - ${sub.SubscriptionType.name}`,
            dueDate: sub.startDate,
            paidAt: sub.startDate,
            monthNumber: 1
          }
        });
        console.log(`   ✅ Paiement créé (ID: ${newPayment.displayId}, Montant: ${newPayment.amount} ${newPayment.currency})`);
      } else {
        // Vérifier le statut du paiement
        const lastPayment = payments[payments.length - 1];
        console.log(`   📄 Dernier paiement: ${lastPayment.displayId} - Statut: ${lastPayment.status} - Montant: ${lastPayment.amount} ${lastPayment.currency}`);
        
        if (lastPayment.status !== 'completed') {
          console.log(`   ⚠️  Paiement non complété détecté`);
          
          // Si l'abonnement est actif mais le paiement non complété, corriger
          if (sub.status === 'active' && lastPayment.status === 'pending') {
            console.log(`   🔄 Correction du statut de paiement en 'completed'`);
            const updatedPayment = await prisma.payment.update({
              where: { id: lastPayment.id },
              data: {
                status: 'completed',
                paidAt: lastPayment.dueDate || sub.startDate,
                transactionId: lastPayment.transactionId || `txn_fix_${sub.id}`
              }
            });
            console.log(`   ✅ Paiement mis à jour (paidAt: ${updatedPayment.paidAt.toISOString().split('T')[0]})`);
          }
        } else {
          console.log(`   ✅ Paiement OK (paidAt: ${lastPayment.paidAt?.toISOString().split('T')[0] || 'N/A'})`);
        }
      }

      console.log(`   ✅ Traitement terminé`);
    }

    // 2. Traiter les abonnements pending qui ont des paiements completed
    console.log('\n\n📋 Vérification des abonnements pending...');
    console.log('📥 Récupération des abonnements pending...');
    const pendingSubs = await prisma.subscription.findMany({
      where: { status: 'pending' },
      include: {
        SubscriptionType: true,
        Member: { include: { User: true } },
        Payment: true
      }
    });

    console.log(`📊 ${pendingSubs.length} abonnements pending trouvés`);

    for (const sub of pendingSubs) {
      const member = sub.Member.User;
      const completedPayments = sub.Payment.filter(p => p.status === 'completed');
      
      console.log(`\n👤 ${member.firstName} ${member.lastName} (${sub.SubscriptionType.name})`);
      console.log(`   Paiements: ${sub.Payment.length} total, ${completedPayments.length} completed`);
      
      if (completedPayments.length > 0) {
        console.log(`   ⚠️  Abonnement pending mais paiement completed trouvé`);
        console.log(`   🔄 Activation de l'abonnement...`);
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'active' }
        });
        console.log(`   ✅ Activé automatiquement`);
      } else {
        console.log(`   ℹ️  Reste en pending (aucun paiement completed)`);
      }
    }

    // 3. Statistiques finales
    console.log('\n\n📊 Statistiques après correction:');
    console.log('📥 Récupération des statistiques...');
    const stats = await prisma.subscription.groupBy({
      by: ['status'],
      _count: true
    });
    
    console.log('\n   Répartition des abonnements:');
    for (const stat of stats) {
      const emoji = {
        'active': '✅',
        'pending': '⏳',
        'expired': '❌',
        'paused': '⏸️',
        'cancelled': '🚫'
      }[stat.status] || '📄';
      console.log(`   ${emoji} ${stat.status}: ${stat._count}`);
    }

    const totalSubs = stats.reduce((sum, stat) => sum + stat._count, 0);
    console.log(`   📈 Total: ${totalSubs} abonnements`);

    console.log('\n✅ Correction terminée avec succès!\n');
    
  } catch (error) {
    console.error('\n❌ Erreur lors de la correction:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    console.log('🔌 Fermeture de la connexion Prisma...');
    await prisma.$disconnect();
    console.log('👋 Script terminé\n');
  }
}

// Exécuter le script
fixSubscriptionsAndPayments()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
