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
ALTER TABLE "GymCheckIn" ADD CONSTRAINT "GymCheckIn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

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
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "titleAr" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "imageUrl" TEXT,
    "imageBase64" TEXT,
    "videoUrl" TEXT,
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "type" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "actionType" TEXT NOT NULL DEFAULT 'none',
    "actionData" TEXT,
    "actionParams" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "gymId" INTEGER,
    "backgroundColor" TEXT,
    "textColor" TEXT,
    "subscriptionTypes" INTEGER[],
    "maxViewsPerUser" INTEGER,
    "isScheduled" BOOLEAN NOT NULL DEFAULT true,
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
CREATE INDEX IF NOT EXISTS "Banner_priority_idx" ON "Banner"("priority");

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
    "displayId" TEXT NOT NULL,
    "bannerId" INTEGER NOT NULL,
    "variantName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "titleAr" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "imageUrl" TEXT,
    "imageBase64" TEXT,
    "videoUrl" TEXT,
    "backgroundColor" TEXT,
    "textColor" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BannerVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BannerVariant_displayId_key" ON "BannerVariant"("displayId");
CREATE UNIQUE INDEX IF NOT EXISTS "BannerVariant_bannerId_variantName_key" ON "BannerVariant"("bannerId", "variantName");
CREATE INDEX IF NOT EXISTS "BannerVariant_bannerId_isActive_idx" ON "BannerVariant"("bannerId", "isActive");

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
    "userId" INTEGER,
    "eventType" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BannerStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BannerStats_bannerId_eventType_idx" ON "BannerStats"("bannerId", "eventType");
CREATE INDEX IF NOT EXISTS "BannerStats_bannerId_userId_idx" ON "BannerStats"("bannerId", "userId");
CREATE INDEX IF NOT EXISTS "BannerStats_variantId_eventType_idx" ON "BannerStats"("variantId", "eventType");
CREATE INDEX IF NOT EXISTS "BannerStats_createdAt_idx" ON "BannerStats"("createdAt");

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

-- CreateTable: StoreProduct
CREATE TABLE IF NOT EXISTS "StoreProduct" (
    "id" SERIAL NOT NULL,
    "displayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imagesBase64" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "availableStock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "gymId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex StoreProduct
CREATE UNIQUE INDEX IF NOT EXISTS "StoreProduct_displayId_key" ON "StoreProduct"("displayId");
CREATE INDEX IF NOT EXISTS "StoreProduct_gymId_idx" ON "StoreProduct"("gymId");
CREATE INDEX IF NOT EXISTS "StoreProduct_isActive_idx" ON "StoreProduct"("isActive");
CREATE INDEX IF NOT EXISTS "StoreProduct_category_idx" ON "StoreProduct"("category");
CREATE INDEX IF NOT EXISTS "StoreProduct_createdBy_idx" ON "StoreProduct"("createdBy");

-- AddForeignKey StoreProduct
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StoreProduct_gymId_fkey'
    ) THEN
        ALTER TABLE "StoreProduct" ADD CONSTRAINT "StoreProduct_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StoreProduct_createdBy_fkey'
    ) THEN
        ALTER TABLE "StoreProduct" ADD CONSTRAINT "StoreProduct_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: StoreReservation
CREATE TABLE IF NOT EXISTS "StoreReservation" (
    "id" SERIAL NOT NULL,
    "displayId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex StoreReservation
CREATE UNIQUE INDEX IF NOT EXISTS "StoreReservation_displayId_key" ON "StoreReservation"("displayId");
CREATE INDEX IF NOT EXISTS "StoreReservation_productId_idx" ON "StoreReservation"("productId");
CREATE INDEX IF NOT EXISTS "StoreReservation_memberId_idx" ON "StoreReservation"("memberId");
CREATE INDEX IF NOT EXISTS "StoreReservation_status_idx" ON "StoreReservation"("status");
CREATE INDEX IF NOT EXISTS "StoreReservation_reservedAt_idx" ON "StoreReservation"("reservedAt");

-- AddForeignKey StoreReservation
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StoreReservation_productId_fkey'
    ) THEN
        ALTER TABLE "StoreReservation" ADD CONSTRAINT "StoreReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StoreReservation_memberId_fkey'
    ) THEN
        ALTER TABLE "StoreReservation" ADD CONSTRAINT "StoreReservation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
