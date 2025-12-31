const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addBannerBase64Columns() {
  console.log('🔧 Ajout des colonnes base64 aux tables Banner et BannerVariant...\n');

  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        -- Banner: Ajouter imageBase64
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Banner' AND column_name = 'imageBase64'
        ) THEN
          ALTER TABLE "Banner" ADD COLUMN "imageBase64" TEXT;
          RAISE NOTICE 'Colonne imageBase64 ajoutée à Banner';
        END IF;

        -- Banner: Ajouter videoBase64
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Banner' AND column_name = 'videoBase64'
        ) THEN
          ALTER TABLE "Banner" ADD COLUMN "videoBase64" TEXT;
          RAISE NOTICE 'Colonne videoBase64 ajoutée à Banner';
        END IF;

        -- BannerVariant: Ajouter imageBase64
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'BannerVariant' AND column_name = 'imageBase64'
        ) THEN
          ALTER TABLE "BannerVariant" ADD COLUMN "imageBase64" TEXT;
          RAISE NOTICE 'Colonne imageBase64 ajoutée à BannerVariant';
        END IF;

        -- BannerVariant: Ajouter videoBase64
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'BannerVariant' AND column_name = 'videoBase64'
        ) THEN
          ALTER TABLE "BannerVariant" ADD COLUMN "videoBase64" TEXT;
          RAISE NOTICE 'Colonne videoBase64 ajoutée à BannerVariant';
        END IF;
      END $$;
    `);
    console.log('✅ Colonnes base64 ajoutées\n');

    console.log('✅ Migration terminée avec succès!');
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. npx prisma generate');
    console.log('   2. pm2 restart teamfitness-preprod');

  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout des colonnes:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addBannerBase64Columns()
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
