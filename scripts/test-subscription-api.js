const prisma = require('../utils/prismaClient');

async function testSubscriptionAPI() {
  console.log('🔍 Test réponse API abonnements\n');

  try {
    // Récupérer Charlie
    const charlie = await prisma.user.findFirst({
      where: {
        OR: [
          { firstName: { contains: 'Charlie', mode: 'insensitive' } },
          { email: { contains: 'charlie', mode: 'insensitive' } }
        ]
      }
    });

    if (!charlie) {
      console.log('❌ Charlie non trouvé');
      return;
    }

    console.log(`✅ Charlie trouvé - ID: ${charlie.id}\n`);

    // Simuler la réponse de l'endpoint GET /subscriptions/member/:memberId
    const subscriptions = await prisma.subscription.findMany({
      where: { memberId: charlie.id },
      include: {
        SubscriptionType: true,
        Payment: {
          orderBy: { monthNumber: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('📤 RÉPONSE API: GET /subscriptions/member/' + charlie.id);
    console.log('═'.repeat(80));
    console.log(JSON.stringify({ subscriptions }, null, 2));
    console.log('═'.repeat(80));

    console.log('\n\n🔍 Test réponse API abonnement unique (GET /subscriptions/:id)\n');

    if (subscriptions.length > 0) {
      const subId = subscriptions[0].id;
      
      // Simuler getSubscriptionStatus (AVEC SubscriptionType maintenant)
      const subscription = await prisma.subscription.findUnique({
        where: { id: subId },
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

      const totalPayments = subscription.Payment.length;
      const completedPayments = subscription.Payment.filter(p => p.status === 'completed').length;
      const overduePayments = subscription.Payment.filter(p => p.status === 'overdue').length;
      const pendingPayments = subscription.Payment.filter(p => p.status === 'pending').length;
      
      const nextPayment = subscription.Payment.find(p => p.status === 'pending');

      const response = {
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

      console.log('📤 RÉPONSE API: GET /subscriptions/' + subId);
      console.log('═'.repeat(80));
      console.log(JSON.stringify(response, null, 2));
      console.log('═'.repeat(80));

      // Vérifications
      console.log('\n\n✅ VÉRIFICATIONS:');
      console.log('═'.repeat(80));
      console.log(`SubscriptionType présent: ${subscription.SubscriptionType ? '✅ OUI' : '❌ NON'}`);
      if (subscription.SubscriptionType) {
        console.log(`   - ID: ${subscription.SubscriptionType.id}`);
        console.log(`   - Nom: ${subscription.SubscriptionType.name}`);
        console.log(`   - Prix mensuel: ${subscription.SubscriptionType.monthlyPrice} MAD`);
        console.log(`   - Quota: ${subscription.SubscriptionType.sessionQuota || '∞'} séances`);
      }
      console.log(`Start Date présent: ${subscription.startDate ? '✅ OUI' : '❌ NON'}`);
      console.log(`End Date présent: ${subscription.endDate ? '✅ OUI' : '❌ NON'}`);
      if (subscription.endDate) {
        console.log(`   - Date: ${subscription.endDate.toISOString().split('T')[0]}`);
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testSubscriptionAPI();
