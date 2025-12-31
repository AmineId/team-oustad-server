const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applySchemaChanges() {
  console.log('🔧 Application manuelle des changements de schéma...\n');

  try {
    await prisma.$executeRawUnsafe(`
      -- Étape 1: Ajouter les colonnes aux tables existantes
      DO $$
      BEGIN
        -- SubscriptionType: Ajouter sessionQuota
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'SubscriptionType' AND column_name = 'sessionQuota'
        ) THEN
          ALTER TABLE "SubscriptionType" ADD COLUMN "sessionQuota" INTEGER;
          RAISE NOTICE 'Colonne sessionQuota ajoutée à SubscriptionType';
        END IF;

        -- SubscriptionType: Ajouter sessionType
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'SubscriptionType' AND column_name = 'sessionType'
        ) THEN
          ALTER TABLE "SubscriptionType" ADD COLUMN "sessionType" TEXT NOT NULL DEFAULT 'unlimited';
          RAISE NOTICE 'Colonne sessionType ajoutée à SubscriptionType';
        END IF;

        -- SubscriptionType: Ajouter durationMonths
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'SubscriptionType' AND column_name = 'durationMonths'
        ) THEN
          ALTER TABLE "SubscriptionType" ADD COLUMN "durationMonths" INTEGER NOT NULL DEFAULT 1;
          RAISE NOTICE 'Colonne durationMonths ajoutée à SubscriptionType';
        END IF;

        -- Subscription: Ajouter sessionsUsed
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Subscription' AND column_name = 'sessionsUsed'
        ) THEN
          ALTER TABLE "Subscription" ADD COLUMN "sessionsUsed" INTEGER NOT NULL DEFAULT 0;
          RAISE NOTICE 'Colonne sessionsUsed ajoutée à Subscription';
        END IF;

        -- Subscription: Ajouter sessionQuota
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Subscription' AND column_name = 'sessionQuota'
        ) THEN
          ALTER TABLE "Subscription" ADD COLUMN "sessionQuota" INTEGER;
          RAISE NOTICE 'Colonne sessionQuota ajoutée à Subscription';
        END IF;
      END $$;
    `);
    console.log('✅ Colonnes quotas ajoutées aux tables existantes\n');

    // Étape 2: Créer les index
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SubscriptionType_sessionType_idx" ON "SubscriptionType"("sessionType");
    `);
    console.log('✅ Index créés\n');

    // Étape 3: Créer la table GymCheckIn
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GymCheckIn" (
          "id" SERIAL NOT NULL,
          "displayId" TEXT NOT NULL,
          "memberId" INTEGER NOT NULL,
          "subscriptionId" INTEGER NOT NULL,
          "gymId" INTEGER NOT NULL,
          "checkInTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "checkOutTime" TIMESTAMP(3),
          "duration" INTEGER,
          "isManual" BOOLEAN NOT NULL DEFAULT false,
          "createdBy" INTEGER,
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "GymCheckIn_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('✅ Table GymCheckIn créée\n');

    // Étape 4: Créer les index pour GymCheckIn
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "GymCheckIn_displayId_key" ON "GymCheckIn"("displayId");
      CREATE INDEX IF NOT EXISTS "GymCheckIn_memberId_idx" ON "GymCheckIn"("memberId");
      CREATE INDEX IF NOT EXISTS "GymCheckIn_subscriptionId_idx" ON "GymCheckIn"("subscriptionId");
      CREATE INDEX IF NOT EXISTS "GymCheckIn_gymId_idx" ON "GymCheckIn"("gymId");
      CREATE INDEX IF NOT EXISTS "GymCheckIn_checkInTime_idx" ON "GymCheckIn"("checkInTime");
      CREATE INDEX IF NOT EXISTS "GymCheckIn_memberId_checkInTime_idx" ON "GymCheckIn"("memberId", "checkInTime");
    `);
    console.log('✅ Index GymCheckIn créés\n');

    // Étape 5: Ajouter les foreign keys pour GymCheckIn
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'GymCheckIn_memberId_fkey'
        ) THEN
          ALTER TABLE "GymCheckIn" ADD CONSTRAINT "GymCheckIn_memberId_fkey" 
            FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          RAISE NOTICE 'Foreign key GymCheckIn_memberId_fkey ajoutée';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'GymCheckIn_subscriptionId_fkey'
        ) THEN
          ALTER TABLE "GymCheckIn" ADD CONSTRAINT "GymCheckIn_subscriptionId_fkey" 
            FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
          RAISE NOTICE 'Foreign key GymCheckIn_subscriptionId_fkey ajoutée';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'GymCheckIn_gymId_fkey'
        ) THEN
          ALTER TABLE "GymCheckIn" ADD CONSTRAINT "GymCheckIn_gymId_fkey" 
            FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
          RAISE NOTICE 'Foreign key GymCheckIn_gymId_fkey ajoutée';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'GymCheckIn_createdBy_fkey'
        ) THEN
          ALTER TABLE "GymCheckIn" ADD CONSTRAINT "GymCheckIn_createdBy_fkey" 
            FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          RAISE NOTICE 'Foreign key GymCheckIn_createdBy_fkey ajoutée';
        END IF;
      END $$;
    `);
    console.log('✅ Foreign keys GymCheckIn ajoutées\n');

    // Étape 6: Créer les tables Banner
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Banner" (
          "id" SERIAL NOT NULL,
          "displayId" TEXT NOT NULL,
          "title" JSONB NOT NULL,
          "description" JSONB,
          "imageUrl" TEXT,
          "videoUrl" TEXT,
          "mediaType" TEXT NOT NULL DEFAULT 'image',
          "type" TEXT NOT NULL,
          "startDate" TIMESTAMP(3) NOT NULL,
          "endDate" TIMESTAMP(3),
          "actionType" TEXT NOT NULL,
          "actionValue" TEXT,
          "priority" INTEGER NOT NULL DEFAULT 0,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "gymId" INTEGER,
          "subscriptionTypes" TEXT[],
          "maxViewsPerUser" INTEGER,
          "isScheduled" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "Banner_displayId_key" ON "Banner"("displayId");
      CREATE INDEX IF NOT EXISTS "Banner_type_idx" ON "Banner"("type");
      CREATE INDEX IF NOT EXISTS "Banner_isActive_idx" ON "Banner"("isActive");
      CREATE INDEX IF NOT EXISTS "Banner_startDate_endDate_idx" ON "Banner"("startDate", "endDate");
      CREATE INDEX IF NOT EXISTS "Banner_gymId_idx" ON "Banner"("gymId");
    `);
    console.log('✅ Table Banner créée\n');

    // Étape 7: Foreign key pour Banner
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Banner_gymId_fkey'
        ) THEN
          ALTER TABLE "Banner" ADD CONSTRAINT "Banner_gymId_fkey" 
            FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          RAISE NOTICE 'Foreign key Banner_gymId_fkey ajoutée';
        END IF;
      END $$;
    `);

    // Étape 8: Créer BannerVariant
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BannerVariant" (
          "id" SERIAL NOT NULL,
          "bannerId" INTEGER NOT NULL,
          "displayId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "title" JSONB NOT NULL,
          "description" JSONB,
          "imageUrl" TEXT,
          "videoUrl" TEXT,
          "weight" INTEGER NOT NULL DEFAULT 50,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "BannerVariant_pkey" PRIMARY KEY ("id")
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "BannerVariant_displayId_key" ON "BannerVariant"("displayId");
      CREATE INDEX IF NOT EXISTS "BannerVariant_bannerId_idx" ON "BannerVariant"("bannerId");
    `);
    console.log('✅ Table BannerVariant créée\n');

    // Étape 9: Foreign key pour BannerVariant
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'BannerVariant_bannerId_fkey'
        ) THEN
          ALTER TABLE "BannerVariant" ADD CONSTRAINT "BannerVariant_bannerId_fkey" 
            FOREIGN KEY ("bannerId") REFERENCES "Banner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          RAISE NOTICE 'Foreign key BannerVariant_bannerId_fkey ajoutée';
        END IF;
      END $$;
    `);

    // Étape 10: Créer BannerStats
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BannerStats" (
          "id" SERIAL NOT NULL,
          "bannerId" INTEGER NOT NULL,
          "variantId" INTEGER,
          "userId" INTEGER NOT NULL,
          "views" INTEGER NOT NULL DEFAULT 0,
          "clicks" INTEGER NOT NULL DEFAULT 0,
          "lastViewedAt" TIMESTAMP(3),
          "lastClickedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "BannerStats_pkey" PRIMARY KEY ("id")
      );

      CREATE INDEX IF NOT EXISTS "BannerStats_bannerId_idx" ON "BannerStats"("bannerId");
      CREATE INDEX IF NOT EXISTS "BannerStats_userId_idx" ON "BannerStats"("userId");
      CREATE UNIQUE INDEX IF NOT EXISTS "BannerStats_bannerId_userId_key" ON "BannerStats"("bannerId", "userId");
    `);
    console.log('✅ Table BannerStats créée\n');

    // Étape 11: Foreign keys pour BannerStats
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'BannerStats_bannerId_fkey'
        ) THEN
          ALTER TABLE "BannerStats" ADD CONSTRAINT "BannerStats_bannerId_fkey" 
            FOREIGN KEY ("bannerId") REFERENCES "Banner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          RAISE NOTICE 'Foreign key BannerStats_bannerId_fkey ajoutée';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'BannerStats_variantId_fkey'
        ) THEN
          ALTER TABLE "BannerStats" ADD CONSTRAINT "BannerStats_variantId_fkey" 
            FOREIGN KEY ("variantId") REFERENCES "BannerVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          RAISE NOTICE 'Foreign key BannerStats_variantId_fkey ajoutée';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'BannerStats_userId_fkey'
        ) THEN
          ALTER TABLE "BannerStats" ADD CONSTRAINT "BannerStats_userId_fkey" 
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          RAISE NOTICE 'Foreign key BannerStats_userId_fkey ajoutée';
        END IF;
      END $$;
    `);
    console.log('✅ Foreign keys BannerStats ajoutées\n');

    console.log('✅ Tous les changements de schéma ont été appliqués avec succès!');
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. npx prisma generate');
    console.log('   2. node scripts/cleanup-old-subscriptions.js');
    console.log('   3. node scripts/seed-subscription-quotas.js');
    console.log('   4. pm2 restart teamfitness-preprod');

  } catch (error) {
    console.error('❌ Erreur lors de l\'application des changements:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  applySchemaChanges()
    .then(() => {
      console.log('\n✨ Script terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erreur:', error);
      process.exit(1);
    });
}

module.exports = { applySchemaChanges };
