const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateProductImages() {
  console.log('🔄 Migration des images de produits: imageUrl → imagesBase64[]...\n');

  try {
    // Étape 1: Ajouter la colonne imagesBase64 comme array
    console.log('📝 Étape 1: Ajout de la colonne imagesBase64[]');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'StoreProduct' AND column_name = 'imagesBase64'
        ) THEN
          ALTER TABLE "StoreProduct" ADD COLUMN "imagesBase64" TEXT[] DEFAULT '{}';
          RAISE NOTICE 'Colonne imagesBase64 ajoutée à StoreProduct';
        END IF;
      END $$;
    `);
    console.log('✅ Colonne imagesBase64 ajoutée\n');

    console.log('⚠️  Note: Les anciennes images (imageUrl/images) ne peuvent pas être converties automatiquement en base64');
    console.log('   Les nouvelles images seront automatiquement stockées en base64\n');

    // Étape 2: Supprimer l'ancienne colonne imageUrl (optionnel - commenté pour sécurité)
    console.log('📝 Étape 2: Suppression de imageUrl/images (optionnel)');
    console.log('⚠️  Pour supprimer après vérification, décommentez cette section\n');
    /*
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "StoreProduct" DROP COLUMN IF EXISTS "imageUrl";
      ALTER TABLE "StoreProduct" DROP COLUMN IF EXISTS "images";
    `);
    console.log('✅ Colonnes imageUrl et images supprimées\n');
    */

    console.log('✅ Migration terminée avec succès!');
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. npx prisma generate');
    console.log('   2. pm2 restart teamfitness-preprod');
    console.log('   3. Les nouvelles images seront stockées en base64');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateProductImages()
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
