const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupOldSubscriptions() {
  console.log('🧹 Nettoyage des anciens types d\'abonnement (EUR)...');

  try {
    // Récupérer tous les types d'abonnement en EUR
    const eurSubscriptionTypes = await prisma.subscriptionType.findMany({
      where: {
        OR: [
          { name: { contains: 'EUR' } },
          { name: { contains: '€' } },
          { description: { contains: 'EUR' } },
          { description: { contains: '€' } },
          // Anciens types d'abonnement sans quotas de sessions
          {
            AND: [
              { sessionQuota: null },
              { sessionType: null }
            ]
          }
        ]
      },
      include: {
        subscriptions: true,
        _count: {
          select: {
            subscriptions: true
          }
        }
      }
    });

    if (eurSubscriptionTypes.length === 0) {
      console.log('✅ Aucun ancien type d\'abonnement à supprimer');
      return;
    }

    console.log(`📋 ${eurSubscriptionTypes.length} type(s) d'abonnement trouvé(s):`);
    
    for (const subType of eurSubscriptionTypes) {
      console.log(`\n   - ${subType.name} (${subType.displayId})`);
      console.log(`     Abonnements actifs: ${subType._count.subscriptions}`);
      
      if (subType._count.subscriptions > 0) {
        console.log(`     ⚠️  ATTENTION: Ce type a des abonnements actifs!`);
        console.log(`     Veuillez d'abord migrer ou annuler ces abonnements.`);
        console.log(`     Abonnement(s) concerné(s):`);
        
        for (const sub of subType.subscriptions) {
          console.log(`       * ${sub.displayId} - Membre: ${sub.memberId} - Statut: ${sub.status}`);
        }
        
        continue; // Ne pas supprimer si des abonnements existent
      }

      // Supprimer le type d'abonnement si aucun abonnement actif
      await prisma.subscriptionType.delete({
        where: { id: subType.id }
      });
      
      console.log(`     ✅ Supprimé`);
    }

    console.log('\n✅ Nettoyage terminé');

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  cleanupOldSubscriptions()
    .then(() => {
      console.log('\n✨ Script terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erreur:', error);
      process.exit(1);
    });
}

module.exports = { cleanupOldSubscriptions };
