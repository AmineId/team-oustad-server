const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupOldSubscriptions() {
  console.log('🧹 Nettoyage des anciens types d\'abonnement (EUR)...');

  try {
    // Récupérer tous les types d'abonnement (on va tous les lister et demander confirmation)
    const allSubscriptionTypes = await prisma.subscriptionType.findMany({
      include: {
        subscriptions: true,
        _count: {
          select: {
            subscriptions: true
          }
        }
      }
    });

    if (allSubscriptionTypes.length === 0) {
      console.log('✅ Aucun type d\'abonnement trouvé');
      return;
    }

    console.log(`\n📋 ${allSubscriptionTypes.length} type(s) d'abonnement trouvé(s) dans la base:\n`);
    
    allSubscriptionTypes.forEach((subType, index) => {
      console.log(`${index + 1}. ${subType.name}`);
      console.log(`   ID: ${subType.displayId}`);
      console.log(`   Prix: ${subType.monthlyPrice} (description: ${subType.description})`);
      console.log(`   Abonnements actifs: ${subType._count.subscriptions}`);
      console.log('');
    });

    console.log('\n⚠️  Ce script va supprimer TOUS les types d\'abonnement sans abonnements actifs');
    console.log('⚠️  Les nouveaux types MAD avec quotas seront créés par le script seed\n');

    // Pour la sécurité, on ne supprime que ceux sans abonnements actifs
    const eurSubscriptionTypes = allSubscriptionTypes.filter(st => st._count.subscriptions === 0);

    // Pour la sécurité, on ne supprime que ceux sans abonnements actifs
    const eurSubscriptionTypes = allSubscriptionTypes.filter(st => st._count.subscriptions === 0);

    if (eurSubscriptionTypes.length === 0) {
      console.log('✅ Aucun type d\'abonnement à supprimer (tous ont des abonnements actifs)');
      return;
    }

    console.log(`\n🗑️  ${eurSubscriptionTypes.length} type(s) d'abonnement seront supprimés:\n`);
    
    for (const subType of eurSubscriptionTypes) {
      console.log(`   - ${subType.name} (${subType.displayId})`);
      
      // Supprimer le type d'abonnement
      await prisma.subscriptionType.delete({
        where: { id: subType.id }
      });
      
      console.log(`     ✅ Supprimé`);
    }

    // Afficher ceux qui ont été gardés
    const keptTypes = allSubscriptionTypes.filter(st => st._count.subscriptions > 0);
    if (keptTypes.length > 0) {
      console.log(`\n⚠️  ${keptTypes.length} type(s) conservé(s) car ils ont des abonnements actifs:\n`);
      keptTypes.forEach(st => {
        console.log(`   - ${st.name} (${st.displayId}) - ${st._count.subscriptions} abonnement(s)`);
      });
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
