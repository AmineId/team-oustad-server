const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function migrateUsers() {
  console.log('Migration des données User/Admin/Member...');

  try {
    // Migrer les admins existants
    const admins = await prisma.admin.findMany({
      include: { gym: true }
    });

    for (const admin of admins) {
      // Créer l'utilisateur commun
      const user = await prisma.user.create({
        data: {
          email: admin.email,
          password: admin.password,
          fullName: admin.fullName,
          role: 'admin',
          gymId: admin.gymId,
        }
      });

      // Mettre à jour l'admin avec la référence user
      await prisma.admin.update({
        where: { id: admin.userId },
        data: { userId: user.id }
      });

      console.log(`Migré admin: ${admin.email}`);
    }

    // Migrer les membres existants
    const members = await prisma.member.findMany({
      include: { gym: true }
    });

    for (const member of members) {
      // Créer l'utilisateur commun (mot de passe par défaut si null)
      const defaultPassword = member.password || await bcrypt.hash('member123', 10);

      const user = await prisma.user.create({
        data: {
          email: member.email,
          password: defaultPassword,
          fullName: member.fullName,
          role: 'member',
          gymId: member.gymId,
        }
      });

      // Mettre à jour le membre avec la référence user
      await prisma.member.update({
        where: { id: member.userId },
        data: { userId: user.id }
      });

      console.log(`Migré member: ${member.email}`);
    }

    // Migrer les tokens de réinitialisation
    const tokens = await prisma.passwordResetToken.findMany();

    for (const token of tokens) {
      if (token.adminId) {
        const admin = await prisma.admin.findUnique({ where: { userId: token.adminId } });
        if (admin) {
          await prisma.passwordResetToken.update({
            where: { id: token.id },
            data: { userId: admin.userId }
          });
        }
      }
    }

    console.log('Migration terminée avec succès !');

  } catch (error) {
    console.error('Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateUsers();