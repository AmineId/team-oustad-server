const prisma = require('../../utils/prismaClient');

/**
 * Script de correction des abonnements et paiements
 * Mode UPDATE uniquement - ne supprime rien
 */
async function fixSubscriptionsAndPayments() {
  console.log('🔧 Début de la correction des abonnements et paiements...\n');

  try {
    // 1. Récupérer tous les abonnements actifs avec leurs infos
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
        await prisma.payment.create({
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
        console.log(`   ✅ Paiement créé`);
      } else {
        // Vérifier le statut du paiement
        const lastPayment = payments[payments.length - 1];
        if (lastPayment.status !== 'completed') {
          console.log(`   ⚠️  Dernier paiement: ${lastPayment.status}`);
          
          // Si l'abonnement est actif mais le paiement non complété, corriger
          if (sub.status === 'active' && lastPayment.status === 'pending') {
            console.log(`   🔄 Correction du statut de paiement en 'completed'`);
            await prisma.payment.update({
              where: { id: lastPayment.id },
              data: {
                status: 'completed',
                paidAt: lastPayment.dueDate || sub.startDate,
                transactionId: lastPayment.transactionId || `txn_fix_${sub.id}`
              }
            });
            console.log(`   ✅ Paiement mis à jour`);
          }
        } else {
          console.log(`   ✅ Paiement OK`);
        }
      }

      console.log(`   ✅ Traitement terminé`);
    }

    // 2. Traiter les abonnements pending qui ont des paiements completed
    console.log('\n\n📋 Vérification des abonnements pending...');
    const pendingSubs = await prisma.subscription.findMany({
      where: { status: 'pending' },
      include: {
        SubscriptionType: true,
        Member: { include: { User: true } },
        Payment: true
      }
    });

    for (const sub of pendingSubs) {
      const member = sub.Member.User;
      const completedPayments = sub.Payment.filter(p => p.status === 'completed');
      
      if (completedPayments.length > 0) {
        console.log(`\n👤 ${member.firstName} ${member.lastName}`);
        console.log(`   ⚠️  Abonnement pending mais paiement completed trouvé`);
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'active' }
        });
        console.log(`   ✅ Activé automatiquement`);
      }
    }

    // 3. Statistiques finales
    console.log('\n\n📊 Statistiques après correction:');
    const stats = await prisma.subscription.groupBy({
      by: ['status'],
      _count: true
    });
    
    for (const stat of stats) {
      console.log(`   ${stat.status}: ${stat._count}`);
    }

    console.log('\n✅ Correction terminée avec succès!\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
fixSubscriptionsAndPayments()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
