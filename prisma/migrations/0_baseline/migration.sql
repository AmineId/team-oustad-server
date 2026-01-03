-- CreateTable
CREATE TABLE "Admin" (
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "muscleGroup" TEXT[],
    "equipment" TEXT[],
    "difficulty" TEXT NOT NULL,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayId" TEXT NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gym" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "image" BYTEA,
    "displayId" TEXT NOT NULL,

    CONSTRAINT "Gym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "birthDate" TIMESTAMP(3),
    "phone" TEXT,
    "profession" TEXT,
    "fitnessLevel" TEXT,
    "onboarding" BOOLEAN NOT NULL DEFAULT true,
    "preferredTrainingDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "workoutNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "MemberGoal" (
    "id" SERIAL NOT NULL,
    "displayId" TEXT NOT NULL,
    "memberId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetDate" TIMESTAMP(3),
    "startWeight" DOUBLE PRECISION,
    "targetWeight" DOUBLE PRECISION,
    "startWaist" DOUBLE PRECISION,
    "targetWaist" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberMeasurement" (
    "id" SERIAL NOT NULL,
    "displayId" TEXT NOT NULL,
    "memberId" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "waist" DOUBLE PRECISION,
    "chest" DOUBLE PRECISION,
    "hips" DOUBLE PRECISION,
    "thigh" DOUBLE PRECISION,
    "arm" DOUBLE PRECISION,
    "bodyFat" DOUBLE PRECISION,
    "muscleMass" DOUBLE PRECISION,
    "notes" TEXT,
    "measuredBy" INTEGER,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningHour" (
    "id" SERIAL NOT NULL,
    "gymId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Owner" (
    "userId" INTEGER NOT NULL,
    "canManageAdmins" BOOLEAN NOT NULL DEFAULT true,
    "canManageGyms" BOOLEAN NOT NULL DEFAULT true,
    "canViewReports" BOOLEAN NOT NULL DEFAULT true,
    "maxGymsAllowed" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "transactionId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subscriptionId" INTEGER,
    "dueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monthNumber" INTEGER,
    "paidAt" TIMESTAMP(3),
    "displayId" TEXT NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planning" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "coachId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayId" TEXT NOT NULL,

    CONSTRAINT "Planning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningDay" (
    "id" SERIAL NOT NULL,
    "planningId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,

    CONSTRAINT "PlanningDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningExercise" (
    "id" SERIAL NOT NULL,
    "exerciseId" INTEGER NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,
    "duration" INTEGER,
    "weight" DOUBLE PRECISION,
    "restTime" INTEGER,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "planningDayId" INTEGER NOT NULL,

    CONSTRAINT "PlanningExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subscriptionTypeId" INTEGER NOT NULL,
    "paymentFrequency" INTEGER NOT NULL DEFAULT 12,
    "displayId" TEXT NOT NULL,
    "sessionsUsed" INTEGER NOT NULL DEFAULT 0,
    "sessionQuota" INTEGER,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" DOUBLE PRECISION NOT NULL,
    "features" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayId" TEXT NOT NULL,
    "sessionQuota" INTEGER,
    "sessionType" TEXT NOT NULL DEFAULT 'unlimited',
    "durationMonths" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SubscriptionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "gymId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uniqueCode" TEXT NOT NULL,
    "qrCode" BYTEA,
    "profileImage" BYTEA,
    "fcmToken" TEXT,
    "displayId" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "phoneNumber" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
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
    "maxViewsPerUser" INTEGER,
    "isScheduled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subscriptionTypes" INTEGER[],

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BannerVariant" (
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

-- CreateTable
CREATE TABLE "BannerStats" (
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

-- CreateTable
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GymCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaNotification" (
    "id" SERIAL NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotaNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreProduct" (
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

-- CreateTable
CREATE TABLE "StoreReservation" (
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

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_displayId_key" ON "Exercise"("displayId");

-- CreateIndex
CREATE INDEX "Exercise_category_idx" ON "Exercise"("category");

-- CreateIndex
CREATE INDEX "Exercise_difficulty_idx" ON "Exercise"("difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "Gym_displayId_key" ON "Gym"("displayId");

-- CreateIndex
CREATE INDEX "Gym_name_idx" ON "Gym"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MemberGoal_displayId_key" ON "MemberGoal"("displayId");

-- CreateIndex
CREATE INDEX "MemberGoal_memberId_idx" ON "MemberGoal"("memberId");

-- CreateIndex
CREATE INDEX "MemberGoal_status_idx" ON "MemberGoal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MemberMeasurement_displayId_key" ON "MemberMeasurement"("displayId");

-- CreateIndex
CREATE INDEX "MemberMeasurement_memberId_measuredAt_idx" ON "MemberMeasurement"("memberId", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningHour_gymId_dayOfWeek_key" ON "OpeningHour"("gymId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_displayId_key" ON "Payment"("displayId");

-- CreateIndex
CREATE INDEX "Payment_memberId_idx" ON "Payment"("memberId");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_dueDate_idx" ON "Payment"("dueDate");

-- CreateIndex
CREATE INDEX "Payment_memberId_status_idx" ON "Payment"("memberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Planning_displayId_key" ON "Planning"("displayId");

-- CreateIndex
CREATE INDEX "Planning_memberId_idx" ON "Planning"("memberId");

-- CreateIndex
CREATE INDEX "Planning_coachId_idx" ON "Planning"("coachId");

-- CreateIndex
CREATE INDEX "Planning_status_idx" ON "Planning"("status");

-- CreateIndex
CREATE INDEX "Planning_startDate_endDate_idx" ON "Planning"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningDay_planningId_dayOfWeek_key" ON "PlanningDay"("planningId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningExercise_planningDayId_exerciseId_order_key" ON "PlanningExercise"("planningDayId", "exerciseId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_displayId_key" ON "Subscription"("displayId");

-- CreateIndex
CREATE INDEX "Subscription_memberId_idx" ON "Subscription"("memberId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_subscriptionTypeId_idx" ON "Subscription"("subscriptionTypeId");

-- CreateIndex
CREATE INDEX "Subscription_startDate_endDate_idx" ON "Subscription"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Subscription_memberId_status_idx" ON "Subscription"("memberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionType_name_key" ON "SubscriptionType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionType_displayId_key" ON "SubscriptionType"("displayId");

-- CreateIndex
CREATE INDEX "SubscriptionType_isActive_idx" ON "SubscriptionType"("isActive");

-- CreateIndex
CREATE INDEX "SubscriptionType_name_idx" ON "SubscriptionType"("name");

-- CreateIndex
CREATE INDEX "SubscriptionType_sessionType_idx" ON "SubscriptionType"("sessionType");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_uniqueCode_key" ON "User"("uniqueCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_displayId_key" ON "User"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE INDEX "User_gymId_idx" ON "User"("gymId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_gymId_role_idx" ON "User"("gymId", "role");

-- CreateIndex
CREATE INDEX "User_lastLoginAt_idx" ON "User"("lastLoginAt");

-- CreateIndex
CREATE UNIQUE INDEX "Banner_displayId_key" ON "Banner"("displayId");

-- CreateIndex
CREATE INDEX "Banner_isActive_startDate_endDate_idx" ON "Banner"("isActive", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Banner_gymId_idx" ON "Banner"("gymId");

-- CreateIndex
CREATE INDEX "Banner_type_idx" ON "Banner"("type");

-- CreateIndex
CREATE INDEX "Banner_priority_idx" ON "Banner"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "BannerVariant_displayId_key" ON "BannerVariant"("displayId");

-- CreateIndex
CREATE INDEX "BannerVariant_bannerId_isActive_idx" ON "BannerVariant"("bannerId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BannerVariant_bannerId_variantName_key" ON "BannerVariant"("bannerId", "variantName");

-- CreateIndex
CREATE INDEX "BannerStats_bannerId_eventType_idx" ON "BannerStats"("bannerId", "eventType");

-- CreateIndex
CREATE INDEX "BannerStats_bannerId_userId_idx" ON "BannerStats"("bannerId", "userId");

-- CreateIndex
CREATE INDEX "BannerStats_variantId_eventType_idx" ON "BannerStats"("variantId", "eventType");

-- CreateIndex
CREATE INDEX "BannerStats_createdAt_idx" ON "BannerStats"("createdAt");

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

-- CreateIndex
CREATE UNIQUE INDEX "QuotaNotification_subscriptionId_key" ON "QuotaNotification"("subscriptionId");

-- CreateIndex
CREATE INDEX "QuotaNotification_subscriptionId_idx" ON "QuotaNotification"("subscriptionId");

-- CreateIndex
CREATE INDEX "QuotaNotification_sentAt_idx" ON "QuotaNotification"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoreProduct_displayId_key" ON "StoreProduct"("displayId");

-- CreateIndex
CREATE INDEX "StoreProduct_gymId_idx" ON "StoreProduct"("gymId");

-- CreateIndex
CREATE INDEX "StoreProduct_isActive_idx" ON "StoreProduct"("isActive");

-- CreateIndex
CREATE INDEX "StoreProduct_category_idx" ON "StoreProduct"("category");

-- CreateIndex
CREATE INDEX "StoreProduct_createdBy_idx" ON "StoreProduct"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "StoreReservation_displayId_key" ON "StoreReservation"("displayId");

-- CreateIndex
CREATE INDEX "StoreReservation_productId_idx" ON "StoreReservation"("productId");

-- CreateIndex
CREATE INDEX "StoreReservation_memberId_idx" ON "StoreReservation"("memberId");

-- CreateIndex
CREATE INDEX "StoreReservation_status_idx" ON "StoreReservation"("status");

-- CreateIndex
CREATE INDEX "StoreReservation_reservedAt_idx" ON "StoreReservation"("reservedAt");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberGoal" ADD CONSTRAINT "MemberGoal_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberMeasurement" ADD CONSTRAINT "MemberMeasurement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningHour" ADD CONSTRAINT "OpeningHour_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Owner" ADD CONSTRAINT "Owner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningDay" ADD CONSTRAINT "PlanningDay_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningExercise" ADD CONSTRAINT "PlanningExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningExercise" ADD CONSTRAINT "PlanningExercise_planningDayId_fkey" FOREIGN KEY ("planningDayId") REFERENCES "PlanningDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscriptionTypeId_fkey" FOREIGN KEY ("subscriptionTypeId") REFERENCES "SubscriptionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BannerVariant" ADD CONSTRAINT "BannerVariant_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "Banner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BannerStats" ADD CONSTRAINT "BannerStats_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "Banner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BannerStats" ADD CONSTRAINT "BannerStats_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "BannerVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymCheckIn" ADD CONSTRAINT "GymCheckIn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymCheckIn" ADD CONSTRAINT "GymCheckIn_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymCheckIn" ADD CONSTRAINT "GymCheckIn_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaNotification" ADD CONSTRAINT "QuotaNotification_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreProduct" ADD CONSTRAINT "StoreProduct_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreProduct" ADD CONSTRAINT "StoreProduct_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreReservation" ADD CONSTRAINT "StoreReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreReservation" ADD CONSTRAINT "StoreReservation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

