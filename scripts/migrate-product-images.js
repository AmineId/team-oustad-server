const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateProductImages() {
  console.log('🔄 Migration des images de produits: imageUrl → images[]...\n');

  try {
    // Étape 1: Ajouter la colonne images comme array
    console.log('📝 Étape 1: Ajout de la colonne images[]');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'StoreProduct' AND column_name = 'images'
        ) THEN
          ALTER TABLE "StoreProduct" ADD COLUMN "images" TEXT[] DEFAULT '{}';
          RAISE NOTICE 'Colonne images ajoutée à StoreProduct';
        END IF;
      END $$;
    `);
    console.log('✅ Colonne images ajoutée\n');

    // Étape 2: Migrer les données existantes de imageUrl vers images
    console.log('📝 Étape 2: Migration des données imageUrl → images');
    await prisma.$executeRawUnsafe(`
      UPDATE "StoreProduct"
      SET "images" = ARRAY["imageUrl"]
      WHERE "imageUrl" IS NOT NULL AND "imageUrl" != ''
      AND (images IS NULL OR array_length(images, 1) IS NULL);
    `);
    console.log('✅ Données migrées\n');

    // Étape 3: Supprimer la colonne imageUrl (optionnel - commenté pour sécurité)
    console.log('📝 Étape 3: Suppression de imageUrl (optionnel)');
    console.log('⚠️  Pour supprimer imageUrl après vérification, décommentez cette section\n');
    /*
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "StoreProduct" DROP COLUMN IF EXISTS "imageUrl";
    `);
    console.log('✅ Colonne imageUrl supprimée\n');
    */

    console.log('✅ Migration terminée avec succès!');
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Vérifier que les produits ont bien leurs images');
    console.log('   2. Décommenter la suppression de imageUrl dans ce script');
    console.log('   3. Relancer le script pour nettoyer imageUrl');
    console.log('   4. npx prisma generate');
    console.log('   5. pm2 restart teamfitness-preprod');

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
