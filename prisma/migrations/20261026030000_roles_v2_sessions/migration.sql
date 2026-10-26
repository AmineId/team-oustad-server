-- Rôles V2 : séances de coach (TrainingSession) et membres inscrits

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" SERIAL NOT NULL,
    "displayId" TEXT NOT NULL,
    "gymId" INTEGER NOT NULL,
    "coachId" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT,
    "type" TEXT,
    "notes" TEXT,
    "seriesId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdBy" INTEGER,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSessionMember" (
    "sessionId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInAt" TIMESTAMP(3),
    "checkedInBy" INTEGER,
    "gymCheckInId" INTEGER,

    CONSTRAINT "TrainingSessionMember_pkey" PRIMARY KEY ("sessionId","memberId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingSession_displayId_key" ON "TrainingSession"("displayId");

-- CreateIndex
CREATE INDEX "TrainingSession_gymId_startAt_idx" ON "TrainingSession"("gymId", "startAt");

-- CreateIndex
CREATE INDEX "TrainingSession_coachId_startAt_idx" ON "TrainingSession"("coachId", "startAt");

-- CreateIndex
CREATE INDEX "TrainingSession_seriesId_idx" ON "TrainingSession"("seriesId");

-- CreateIndex
CREATE INDEX "TrainingSession_status_startAt_idx" ON "TrainingSession"("status", "startAt");

-- CreateIndex
CREATE INDEX "TrainingSessionMember_memberId_idx" ON "TrainingSessionMember"("memberId");

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSessionMember" ADD CONSTRAINT "TrainingSessionMember_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSessionMember" ADD CONSTRAINT "TrainingSessionMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

