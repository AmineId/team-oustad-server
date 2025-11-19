-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "profession" TEXT;

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
    "fitnessLevel" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "MemberGoal_displayId_key" ON "MemberGoal"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberMeasurement_displayId_key" ON "MemberMeasurement"("displayId");

-- CreateIndex
CREATE INDEX "MemberMeasurement_memberId_measuredAt_idx" ON "MemberMeasurement"("memberId", "measuredAt");

-- AddForeignKey
ALTER TABLE "MemberGoal" ADD CONSTRAINT "MemberGoal_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberMeasurement" ADD CONSTRAINT "MemberMeasurement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
