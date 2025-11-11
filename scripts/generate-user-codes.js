const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function generateUniqueCodesForAllUsers() {
  try {
    console.log('🔄 Recherche des utilisateurs sans code unique...\n');

    // Trouver tous les utilisateurs sans uniqueCode
    const usersWithoutCode = await prisma.user.findMany({
      where: { uniqueCode: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true
      }
    });

    console.log(`📋 ${usersWithoutCode.length} utilisateurs trouvés sans code unique\n`);

    // Générer et assigner des codes uniques
    for (const user of usersWithoutCode) {
      // Générer un code unique de 8 caractères en majuscules
      const uniqueCode = crypto.randomUUID().substring(0, 8).toUpperCase();

      await prisma.user.update({
        where: { id: user.id },
        data: { uniqueCode }
      });

      console.log(`✅ ${user.role.toUpperCase()}: ${user.fullName} (${user.email}): ${uniqueCode}`);
    }

    console.log('\n🎉 Tous les codes uniques ont été générés !');

    // Afficher un résumé
    const allUsers = await prisma.user.findMany({
      select: {
        role: true,
        uniqueCode: true,
        fullName: true
      }
    });

    console.log('\n📊 RÉSUMÉ PAR RÔLE:');
    const roleStats = {};
    allUsers.forEach(user => {
      if (!roleStats[user.role]) roleStats[user.role] = 0;
      roleStats[user.role]++;
    });

    Object.entries(roleStats).forEach(([role, count]) => {
      console.log(`- ${role.toUpperCase()}: ${count} utilisateurs`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de la génération des codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateUniqueCodesForAllUsers();