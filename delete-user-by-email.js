const prisma = require('./utils/prismaClient');

async function deleteUserByEmail(email) {
  try {
    console.log(`🔍 Recherche de l'utilisateur: ${email}`);
    
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { Member: true, Admin: true, Owner: true }
    });
    
    if (!user) {
      console.log(`❌ Utilisateur non trouvé: ${email}`);
      return;
    }
    
    console.log(`✅ Utilisateur trouvé:`, {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      displayId: user.displayId
    });
    
    // Supprimer les tokens de réinitialisation de mot de passe
    const tokens = await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id }
    });
    if (tokens.count > 0) {
      console.log(`🗑️  ${tokens.count} token(s) de réinitialisation supprimé(s)`);
    }
    
    // Supprimer le profil spécifique selon le rôle
    if (user.role === 'member' && user.Member) {
      await prisma.member.delete({ where: { userId: user.id } });
      console.log(`🗑️  Profil member supprimé`);
    } else if (user.role === 'admin' && user.Admin) {
      await prisma.admin.delete({ where: { userId: user.id } });
      console.log(`🗑️  Profil admin supprimé`);
    } else if (user.role === 'owner' && user.Owner) {
      await prisma.owner.delete({ where: { userId: user.id } });
      console.log(`🗑️  Profil owner supprimé`);
    }
    
    // Supprimer l'utilisateur
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`✅ Utilisateur ${email} supprimé avec succès`);
    
  } catch (error) {
    console.error(`💥 Erreur:`, error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.log(`❌ Usage: node delete-user-by-email.js <email>`);
  process.exit(1);
}

deleteUserByEmail(email);
