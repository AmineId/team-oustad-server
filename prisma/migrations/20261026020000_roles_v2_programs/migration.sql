-- Rôles V2 : programmes réutilisables (owner) et affectations aux membres.
-- Les plannings existants sont convertis : 1 Planning -> 1 Program + 1 ProgramAssignment.
-- Les tables Planning* sont conservées (lecture seule) pour une release.

-- CreateTable
CREATE TABLE "Program" (
    "id" SERIAL NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT,
    "durationWeeks" INTEGER,
    "createdBy" INTEGER,
    "sourcePlanningId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramDay" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,

    CONSTRAINT "ProgramDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramExercise" (
    "id" SERIAL NOT NULL,
    "programDayId" INTEGER NOT NULL,
    "exerciseId" INTEGER NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,
    "duration" INTEGER,
    "weight" DOUBLE PRECISION,
    "restTime" INTEGER,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProgramExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramAssignment" (
    "id" SERIAL NOT NULL,
    "displayId" TEXT NOT NULL,
    "programId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "assignedBy" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "sourcePlanningId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Program_displayId_key" ON "Program"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "Program_sourcePlanningId_key" ON "Program"("sourcePlanningId");

-- CreateIndex
CREATE INDEX "Program_title_idx" ON "Program"("title");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramDay_programId_dayOfWeek_key" ON "ProgramDay"("programId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "ProgramExercise_programDayId_order_idx" ON "ProgramExercise"("programDayId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramAssignment_displayId_key" ON "ProgramAssignment"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramAssignment_sourcePlanningId_key" ON "ProgramAssignment"("sourcePlanningId");

-- CreateIndex
CREATE INDEX "ProgramAssignment_memberId_status_idx" ON "ProgramAssignment"("memberId", "status");

-- CreateIndex
CREATE INDEX "ProgramAssignment_programId_status_idx" ON "ProgramAssignment"("programId", "status");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramDay" ADD CONSTRAINT "ProgramDay_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramExercise" ADD CONSTRAINT "ProgramExercise_programDayId_fkey" FOREIGN KEY ("programDayId") REFERENCES "ProgramDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramExercise" ADD CONSTRAINT "ProgramExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssignment" ADD CONSTRAINT "ProgramAssignment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssignment" ADD CONSTRAINT "ProgramAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssignment" ADD CONSTRAINT "ProgramAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ==================== Migration des plannings ====================

INSERT INTO "Program" ("displayId", "title", "description", "createdBy", "sourcePlanningId", "createdAt", "updatedAt")
SELECT 'PROGRAM-' || substr(md5(random()::text || clock_timestamp()::text || p."id"::text), 1, 16),
       p."title", p."description", p."coachId", p."id", p."createdAt", p."updatedAt"
FROM "Planning" p;

INSERT INTO "ProgramDay" ("programId", "dayOfWeek")
SELECT pr."id", pd."dayOfWeek"
FROM "PlanningDay" pd
JOIN "Program" pr ON pr."sourcePlanningId" = pd."planningId";

INSERT INTO "ProgramExercise" ("programDayId", "exerciseId", "sets", "reps", "duration", "weight", "restTime", "notes", "order")
SELECT prd."id", pe."exerciseId", pe."sets", pe."reps", pe."duration", pe."weight", pe."restTime", pe."notes", pe."order"
FROM "PlanningExercise" pe
JOIN "PlanningDay" pd ON pd."id" = pe."planningDayId"
JOIN "Program" pr ON pr."sourcePlanningId" = pd."planningId"
JOIN "ProgramDay" prd ON prd."programId" = pr."id" AND prd."dayOfWeek" = pd."dayOfWeek";

INSERT INTO "ProgramAssignment" ("displayId", "programId", "memberId", "assignedBy", "startDate", "endDate", "status", "sourcePlanningId", "createdAt", "updatedAt")
SELECT 'ASSIGN-' || substr(md5(random()::text || clock_timestamp()::text || p."id"::text), 1, 16),
       pr."id", p."memberId", p."coachId", p."startDate", p."endDate", p."status", p."id", p."createdAt", p."updatedAt"
FROM "Planning" p
JOIN "Program" pr ON pr."sourcePlanningId" = p."id";
