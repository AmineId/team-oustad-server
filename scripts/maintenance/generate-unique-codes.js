const { PrismaClient } = require('@prisma/client');
const { getFullName } = require('../../utils/nameUtils');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function generateUniqueCodes() {
  try {
    console.log('🔄 Recherche des membres sans code unique...');

    // Trouver tous les membres sans uniqueCode
    const membersWithoutCode = await prisma.member.findMany({
      where: { uniqueCode: null },
      include: { User: { select: { firstName: true, lastName: true, email: true } } }
    });

    console.log(`📋 ${membersWithoutCode.length} membres trouvés sans code unique`);

    // Générer et assigner des codes uniques
    for (const member of membersWithoutCode) {
      // Générer un code unique de 8 caractères en majuscules
      const uniqueCode = crypto.randomUUID().substring(0, 8).toUpperCase();

      await prisma.member.update({
        where: { id: member.userId },
        data: { uniqueCode }
      });

      console.log(`✅ ${getFullName(member.User)} (${member.User.email}): ${uniqueCode}`);
    }

    console.log('🎉 Tous les codes uniques ont été générés !');

  } catch (error) {
    console.error('❌ Erreur lors de la génération des codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateUniqueCodes();