const prisma = require('../utils/prismaClient');

async function viewPayments() {
  console.log('💰 Récupération des paiements...\n');

  try {
    const payments = await prisma.payment.findMany({
      include: {
        Member: {
          include: {
            User: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        Subscription: {
          include: {
            SubscriptionType: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20 // Limiter à 20 résultats
    });

    console.log(`📊 ${payments.length} paiements trouvés\n`);
    console.log('═'.repeat(120));

    payments.forEach((payment, index) => {
      const member = payment.Member?.User;
      const memberName = member ? `${member.firstName} ${member.lastName}` : 'N/A';
      const subType = payment.Subscription?.SubscriptionType?.name || 'One-time';
      
      const statusEmoji = {
        'completed': '✅',
        'pending': '⏳',
        'overdue': '❌',
        'refunded': '↩️',
        'failed': '💥'
      }[payment.status] || '❓';

      console.log(`\n${index + 1}. ${statusEmoji} ${payment.displayId}`);
      console.log(`   Membre: ${memberName} (${member?.email || 'N/A'})`);
      console.log(`   Type: ${payment.type} - ${subType}`);
      console.log(`   Montant: ${payment.amount} ${payment.currency}`);
      console.log(`   Statut: ${payment.status}`);
      console.log(`   Méthode: ${payment.paymentMethod || 'N/A'}`);
      console.log(`   Due: ${payment.dueDate?.toISOString().split('T')[0] || 'N/A'}`);
      console.log(`   Payé: ${payment.paidAt?.toISOString().split('T')[0] || 'Non payé'}`);
      console.log(`   Créé: ${payment.createdAt.toISOString().split('T')[0]}`);
    });

    console.log('\n' + '═'.repeat(120));

    // Statistiques
    const stats = {
      total: payments.length,
      completed: payments.filter(p => p.status === 'completed').length,
      pending: payments.filter(p => p.status === 'pending').length,
      overdue: payments.filter(p => p.status === 'overdue').length,
      totalAmount: payments
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0)
    };

    console.log('\n📊 Statistiques:');
    console.log(`   Total paiements: ${stats.total}`);
    console.log(`   ✅ Completed: ${stats.completed}`);
    console.log(`   ⏳ Pending: ${stats.pending}`);
    console.log(`   ❌ Overdue: ${stats.overdue}`);
    console.log(`   💰 Montant total (completed): ${stats.totalAmount} MAD`);
    console.log('');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

viewPayments();
