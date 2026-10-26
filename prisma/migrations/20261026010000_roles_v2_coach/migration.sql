-- Rôles V2 : rôle coach, salles du coach (N-N) et coach principal du membre

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "coachId" INTEGER;

-- CreateTable
CREATE TABLE "Coach" (
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CoachGym" (
    "coachId" INTEGER NOT NULL,
    "gymId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachGym_pkey" PRIMARY KEY ("coachId","gymId")
);

-- CreateIndex
CREATE INDEX "CoachGym_gymId_idx" ON "CoachGym"("gymId");

-- CreateIndex
CREATE INDEX "Member_coachId_idx" ON "Member"("coachId");

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachGym" ADD CONSTRAINT "CoachGym_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachGym" ADD CONSTRAINT "CoachGym_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

