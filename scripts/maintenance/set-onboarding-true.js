const prisma = require('../../utils/prismaClient');

async function setOnboardingTrue() {
  console.log('🔄 Mise à jour du champ onboarding pour tous les membres...');
  
  try {
    const result = await prisma.member.updateMany({
      data: {
        onboarding: true
      }
    });
    
    console.log(`✅ ${result.count} membres ont été mis à jour avec onboarding = true`);
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setOnboardingTrue();
