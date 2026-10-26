/**
 * Désigne le super-owner (seul à voir l'historique, protégé des autres owners).
 * Il n'y a volontairement pas d'API pour ça.
 *
 *   npm run owner:super -- <email>            (base de .env)
 *   dotenv run -f .env.preprod -- npm run owner:super -- <email>
 *   npm run owner:super -- <email> --revoke   (retire le droit)
 */
require('dotenv').config();
const prisma = require('../utils/prismaClient');

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email) {
    console.error('Usage : npm run owner:super -- <email> [--revoke]');
    process.exitCode = 1;
    return;
  }
  const isSuperOwner = flag !== '--revoke';
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, firstName: true, lastName: true } });
  if (!user || user.role !== 'owner') {
    console.error(`❌ Aucun owner avec l'e-mail ${email}`);
    process.exitCode = 1;
    return;
  }
  await prisma.owner.upsert({
    where: { userId: user.id },
    update: { isSuperOwner },
    create: { userId: user.id, isSuperOwner },
  });
  console.log(`✅ ${user.firstName} ${user.lastName} : super-owner = ${isSuperOwner}`);
}

main()
  .catch((error) => {
    console.error('❌', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
