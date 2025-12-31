const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addBannerBase64Columns() {
  console.log('🔧 Ajout des colonnes manquantes aux tables Banner et BannerVariant...\n');

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

        -- Banner: Ajouter titleEn
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Banner' AND column_name = 'titleEn'
        ) THEN
          ALTER TABLE "Banner" ADD COLUMN "titleEn" TEXT;
          RAISE NOTICE 'Colonne titleEn ajoutée à Banner';
        END IF;

        -- Banner: Ajouter titleAr
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Banner' AND column_name = 'titleAr'
        ) THEN
          ALTER TABLE "Banner" ADD COLUMN "titleAr" TEXT;
          RAISE NOTICE 'Colonne titleAr ajoutée à Banner';
        END IF;

        -- Banner: Ajouter descriptionEn
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Banner' AND column_name = 'descriptionEn'
        ) THEN
          ALTER TABLE "Banner" ADD COLUMN "descriptionEn" TEXT;
          RAISE NOTICE 'Colonne descriptionEn ajoutée à Banner';
        END IF;

        -- Banner: Ajouter descriptionAr
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Banner' AND column_name = 'descriptionAr'
        ) THEN
          ALTER TABLE "Banner" ADD COLUMN "descriptionAr" TEXT;
          RAISE NOTICE 'Colonne descriptionAr ajoutée à Banner';
        END IF;

        -- Banner: Ajouter actionParams
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Banner' AND column_name = 'actionParams'
        ) THEN
          ALTER TABLE "Banner" ADD COLUMN "actionParams" JSONB;
          RAISE NOTICE 'Colonne actionParams ajoutée à Banner';
        END IF;

        -- Banner: Ajouter backgroundColor
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Banner' AND column_name = 'backgroundColor'
        ) THEN
          ALTER TABLE "Banner" ADD COLUMN "backgroundColor" TEXT;
          RAISE NOTICE 'Colonne backgroundColor ajoutée à Banner';
        END IF;

        -- Banner: Ajouter textColor
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Banner' AND column_name = 'textColor'
        ) THEN
          ALTER TABLE "Banner" ADD COLUMN "textColor" TEXT;
          RAISE NOTICE 'Colonne textColor ajoutée à Banner';
        END IF;

        -- Banner: Renommer actionValue en actionData si nécessaire
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Banner' AND column_name = 'actionValue'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Banner' AND column_name = 'actionData'
        ) THEN
          ALTER TABLE "Banner" RENAME COLUMN "actionValue" TO "actionData";
          RAISE NOTICE 'Colonne actionValue renommée en actionData';
        END IF;

        -- Banner: Modifier title de JSONB à TEXT si nécessaire
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Banner' AND column_name = 'title' AND data_type = 'jsonb'
        ) THEN
          ALTER TABLE "Banner" ALTER COLUMN "title" TYPE TEXT USING "title"::text;
          RAISE NOTICE 'Colonne title convertie de JSONB à TEXT';
        END IF;

        -- Banner: Modifier description de JSONB à TEXT si nécessaire
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Banner' AND column_name = 'description' AND data_type = 'jsonb'
        ) THEN
          ALTER TABLE "Banner" ALTER COLUMN "description" TYPE TEXT USING "description"::text;
          RAISE NOTICE 'Colonne description convertie de JSONB à TEXT';
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

        -- BannerVariant: Ajouter titleEn
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'BannerVariant' AND column_name = 'titleEn'
        ) THEN
          ALTER TABLE "BannerVariant" ADD COLUMN "titleEn" TEXT;
          RAISE NOTICE 'Colonne titleEn ajoutée à BannerVariant';
        END IF;

        -- BannerVariant: Ajouter titleAr
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'BannerVariant' AND column_name = 'titleAr'
        ) THEN
          ALTER TABLE "BannerVariant" ADD COLUMN "titleAr" TEXT;
          RAISE NOTICE 'Colonne titleAr ajoutée à BannerVariant';
        END IF;

        -- BannerVariant: Ajouter descriptionEn
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'BannerVariant' AND column_name = 'descriptionEn'
        ) THEN
          ALTER TABLE "BannerVariant" ADD COLUMN "descriptionEn" TEXT;
          RAISE NOTICE 'Colonne descriptionEn ajoutée à BannerVariant';
        END IF;

        -- BannerVariant: Ajouter descriptionAr
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'BannerVariant' AND column_name = 'descriptionAr'
        ) THEN
          ALTER TABLE "BannerVariant" ADD COLUMN "descriptionAr" TEXT;
          RAISE NOTICE 'Colonne descriptionAr ajoutée à BannerVariant';
        END IF;

        -- BannerVariant: Ajouter backgroundColor
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'BannerVariant' AND column_name = 'backgroundColor'
        ) THEN
          ALTER TABLE "BannerVariant" ADD COLUMN "backgroundColor" TEXT;
          RAISE NOTICE 'Colonne backgroundColor ajoutée à BannerVariant';
        END IF;

        -- BannerVariant: Ajouter textColor
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'BannerVariant' AND column_name = 'textColor'
        ) THEN
          ALTER TABLE "BannerVariant" ADD COLUMN "textColor" TEXT;
          RAISE NOTICE 'Colonne textColor ajoutée à BannerVariant';
        END IF;

        -- BannerVariant: Modifier title de JSONB à TEXT si nécessaire
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'BannerVariant' AND column_name = 'title' AND data_type = 'jsonb'
        ) THEN
          ALTER TABLE "BannerVariant" ALTER COLUMN "title" TYPE TEXT USING "title"::text;
          RAISE NOTICE 'Colonne title convertie de JSONB à TEXT';
        END IF;

        -- BannerVariant: Modifier description de JSONB à TEXT si nécessaire
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'BannerVariant' AND column_name = 'description' AND data_type = 'jsonb'
        ) THEN
          ALTER TABLE "BannerVariant" ALTER COLUMN "description" TYPE TEXT USING "description"::text;
          RAISE NOTICE 'Colonne description convertie de JSONB à TEXT';
        END IF;
      END $$;
    `);
    console.log('✅ Colonnes ajoutées/modifiées\n');

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
