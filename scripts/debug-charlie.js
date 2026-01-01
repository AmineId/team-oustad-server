const prisma = require('../utils/prismaClient');

async function debugCharlie() {
  console.log('🔍 Inspection des données de Charlie...\n');

  try {
    // Trouver Charlie
    const charlie = await prisma.user.findFirst({
      where: {
        OR: [
          { firstName: { contains: 'Charlie', mode: 'insensitive' } },
          { email: { contains: 'charlie', mode: 'insensitive' } }
        ]
      },
      include: {
        Member: {
          include: {
            Subscription: {
              include: {
                SubscriptionType: true,
                Payment: {
                  orderBy: { createdAt: 'desc' }
                }
              }
            }
          }
        },
        Gym: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!charlie) {
      console.log('❌ Charlie non trouvé');
      return;
    }

    console.log('👤 UTILISATEUR');
    console.log('═'.repeat(80));
    console.log(`   Nom: ${charlie.firstName} ${charlie.lastName}`);
    console.log(`   Email: ${charlie.email}`);
    console.log(`   ID: ${charlie.id}`);
    console.log(`   DisplayID: ${charlie.displayId}`);
    console.log(`   Rôle: ${charlie.role}`);
    console.log(`   Gym: ${charlie.Gym?.name || 'N/A'} (ID: ${charlie.gymId})`);

    if (!charlie.Member) {
      console.log('\n❌ Pas de profil Member trouvé');
      return;
    }

    console.log('\n👥 PROFIL MEMBER');
    console.log('═'.repeat(80));
    console.log(`   Member ID: ${charlie.Member.userId}`);
    console.log(`   Unique Code: ${charlie.Member.uniqueCode}`);
    console.log(`   Abonnements: ${charlie.Member.Subscription?.length || 0}`);

    if (charlie.Member.Subscription && charlie.Member.Subscription.length > 0) {
      console.log('\n💳 ABONNEMENTS');
      console.log('═'.repeat(80));

      charlie.Member.Subscription.forEach((sub, index) => {
        const emoji = {
          'active': '✅',
          'pending': '⏳',
          'expired': '❌',
          'paused': '⏸️',
          'cancelled': '🚫'
        }[sub.status] || '❓';

        console.log(`\n${index + 1}. ${emoji} ${sub.displayId} - ${sub.status.toUpperCase()}`);
        console.log(`   Type: ${sub.SubscriptionType?.name || 'N/A'}`);
        console.log(`   Prix mensuel: ${sub.SubscriptionType?.monthlyPrice || 0} MAD`);
        console.log(`   Quota: ${sub.SubscriptionType?.sessionQuota || '∞'} séances`);
        console.log(`   Utilisé: ${sub.sessionsUsed} séances`);
        console.log(`   Date début: ${sub.startDate?.toISOString().split('T')[0] || 'N/A'}`);
        console.log(`   Date fin: ${sub.endDate?.toISOString().split('T')[0] || 'N/A'}`);
        console.log(`   Auto-renew: ${sub.autoRenew ? 'Oui' : 'Non'}`);
        console.log(`   Créé: ${sub.createdAt.toISOString().split('T')[0]}`);

        if (sub.Payment && sub.Payment.length > 0) {
          console.log(`\n   💰 Paiements (${sub.Payment.length}):`);
          sub.Payment.forEach((payment, pIndex) => {
            const pStatusEmoji = {
              'completed': '✅',
              'pending': '⏳',
              'overdue': '❌',
              'refunded': '↩️',
              'failed': '💥'
            }[payment.status] || '❓';

            console.log(`      ${pIndex + 1}. ${pStatusEmoji} ${payment.displayId}`);
            console.log(`         Montant: ${payment.amount} ${payment.currency}`);
            console.log(`         Statut: ${payment.status}`);
            console.log(`         Méthode: ${payment.paymentMethod || 'N/A'}`);
            console.log(`         Due: ${payment.dueDate?.toISOString().split('T')[0] || 'N/A'}`);
            console.log(`         Payé: ${payment.paidAt?.toISOString().split('T')[0] || 'Non payé'}`);
            console.log(`         Créé: ${payment.createdAt.toISOString().split('T')[0]}`);
          });
        } else {
          console.log(`\n   ⚠️  Aucun paiement trouvé pour cet abonnement`);
        }
      });
    } else {
      console.log('\n❌ Aucun abonnement trouvé');
    }

    // Analyse
    console.log('\n\n🔍 ANALYSE');
    console.log('═'.repeat(80));

    const activeSub = charlie.Member.Subscription?.find(s => s.status === 'active');
    if (activeSub) {
      console.log('✅ Abonnement actif trouvé');
      
      if (!activeSub.SubscriptionType) {
        console.log('❌ PROBLÈME: Type d\'abonnement manquant');
      } else if (activeSub.SubscriptionType.monthlyPrice === 0) {
        console.log('⚠️  ATTENTION: Prix mensuel = 0 MAD');
      }

      if (!activeSub.endDate) {
        console.log('⚠️  ATTENTION: Date de fin manquante (endDate = null)');
      }

      const completedPayments = activeSub.Payment?.filter(p => p.status === 'completed') || [];
      if (completedPayments.length === 0) {
        console.log('❌ PROBLÈME: Aucun paiement completed pour un abonnement actif');
      } else {
        console.log(`✅ ${completedPayments.length} paiement(s) completed`);
      }
    } else {
      console.log('❌ Aucun abonnement actif');
    }

    console.log('');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

debugCharlie();
