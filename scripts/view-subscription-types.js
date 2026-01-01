const prisma = require('../utils/prismaClient');

async function viewSubscriptionTypes() {
  console.log('🔍 Types d\'abonnement dans la DB\n');

  try {
    const subscriptionTypes = await prisma.subscriptionType.findMany({
      orderBy: { createdAt: 'asc' }
    });

    console.log('📤 DONNÉES BRUTES (JSON):');
    console.log('═'.repeat(80));
    console.log(JSON.stringify(subscriptionTypes, null, 2));
    console.log('═'.repeat(80));

    console.log('\n📊 RÉSUMÉ:');
    console.log('═'.repeat(80));
    subscriptionTypes.forEach(type => {
      console.log(`\n${type.name}`);
      console.log(`   ID: ${type.id}`);
      console.log(`   Prix mensuel: ${type.monthlyPrice} MAD`);
      console.log(`   Quota: ${type.sessionQuota || '∞'} séances`);
      console.log(`   Actif: ${type.isActive ? 'Oui' : 'Non'}`);
      console.log(`   Créé: ${type.createdAt.toISOString().split('T')[0]}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

viewSubscriptionTypes();
