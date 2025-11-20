const { PrismaClient } = require('@prisma/client');
const { getFullName } = require('../../utils/nameUtils');

const prisma = new PrismaClient();

async function checkUniqueCodes() {
  try {
    console.log('🔍 Vérification des codes uniques des membres...\n');

    const members = await prisma.member.findMany({
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (members.length === 0) {
      console.log('❌ Aucun membre trouvé');
      return;
    }

    console.log(`📋 ${members.length} membres trouvés:\n`);

    members.forEach((member, index) => {
      const status = member.uniqueCode ? '✅' : '❌';
      const code = member.uniqueCode || 'MANQUANT';
      console.log(`${index + 1}. ${status} ${getFullName(member.user)} (${member.user.email}): ${code}`);
    });

    // Vérifier l'unicité
    const codes = members.map(m => m.uniqueCode).filter(Boolean);
    const uniqueCodes = new Set(codes);

    if (codes.length === uniqueCodes.size) {
      console.log('\n🎉 Tous les codes sont uniques !');
    } else {
      console.log('\n⚠️ Certains codes ne sont pas uniques !');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUniqueCodes();