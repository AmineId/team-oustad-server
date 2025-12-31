-- CreateTable: GymCheckIn
CREATE TABLE "GymCheckIn" (
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

-- CreateIndex
CREATE UNIQUE INDEX "GymCheckIn_displayId_key" ON "GymCheckIn"("displayId");

-- CreateIndex
CREATE INDEX "GymCheckIn_memberId_idx" ON "GymCheckIn"("memberId");

-- CreateIndex
CREATE INDEX "GymCheckIn_subscriptionId_idx" ON "GymCheckIn"("subscriptionId");

-- CreateIndex
CREATE INDEX "GymCheckIn_gymId_idx" ON "GymCheckIn"("gymId");

-- CreateIndex
CREATE INDEX "GymCheckIn_checkInTime_idx" ON "GymCheckIn"("checkInTime");

-- CreateIndex
CREATE INDEX "GymCheckIn_memberId_checkInTime_idx" ON "GymCheckIn"("memberId", "checkInTime");

-- AddForeignKey
ALTER TABLE "GymCheckIn" ADD CONSTRAINT "GymCheckIn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymCheckIn" ADD CONSTRAINT "GymCheckIn_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymCheckIn" ADD CONSTRAINT "GymCheckIn_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymCheckIn" ADD CONSTRAINT "GymCheckIn_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: SubscriptionType - Add session quota fields
ALTER TABLE "SubscriptionType" ADD COLUMN IF NOT EXISTS "sessionQuota" INTEGER;
ALTER TABLE "SubscriptionType" ADD COLUMN IF NOT EXISTS "sessionType" TEXT NOT NULL DEFAULT 'unlimited';
ALTER TABLE "SubscriptionType" ADD COLUMN IF NOT EXISTS "durationMonths" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SubscriptionType_sessionType_idx" ON "SubscriptionType"("sessionType");

-- AlterTable: Subscription - Add session tracking
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "sessionsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "sessionQuota" INTEGER;

-- AlterTable: Payment - Change currency default to MAD
ALTER TABLE "Payment" ALTER COLUMN "currency" SET DEFAULT 'MAD';

-- CreateTable: Banner
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Banner_displayId_key" ON "Banner"("displayId");
CREATE INDEX IF NOT EXISTS "Banner_type_idx" ON "Banner"("type");
CREATE INDEX IF NOT EXISTS "Banner_isActive_idx" ON "Banner"("isActive");
CREATE INDEX IF NOT EXISTS "Banner_startDate_endDate_idx" ON "Banner"("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "Banner_gymId_idx" ON "Banner"("gymId");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Banner_gymId_fkey'
    ) THEN
        ALTER TABLE "Banner" ADD CONSTRAINT "Banner_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: BannerVariant
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BannerVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BannerVariant_displayId_key" ON "BannerVariant"("displayId");
CREATE INDEX IF NOT EXISTS "BannerVariant_bannerId_idx" ON "BannerVariant"("bannerId");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BannerVariant_bannerId_fkey'
    ) THEN
        ALTER TABLE "BannerVariant" ADD CONSTRAINT "BannerVariant_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "Banner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: BannerStats
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BannerStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BannerStats_bannerId_idx" ON "BannerStats"("bannerId");
CREATE INDEX IF NOT EXISTS "BannerStats_userId_idx" ON "BannerStats"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "BannerStats_bannerId_userId_key" ON "BannerStats"("bannerId", "userId");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BannerStats_bannerId_fkey'
    ) THEN
        ALTER TABLE "BannerStats" ADD CONSTRAINT "BannerStats_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "Banner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BannerStats_variantId_fkey'
    ) THEN
        ALTER TABLE "BannerStats" ADD CONSTRAINT "BannerStats_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "BannerVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BannerStats_userId_fkey'
    ) THEN
        ALTER TABLE "BannerStats" ADD CONSTRAINT "BannerStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
