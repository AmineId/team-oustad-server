/*
  Migration: Restructure planning system to use PlanningDay
  - Create PlanningDay table
  - Migrate existing PlanningExercise data
  - Update foreign keys
*/

-- Create PlanningDay table first
CREATE TABLE "PlanningDay" (
    "id" SERIAL NOT NULL,
    "planningId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,

    CONSTRAINT "PlanningDay_pkey" PRIMARY KEY ("id")
);

-- Create unique index for PlanningDay
CREATE UNIQUE INDEX "PlanningDay_planningId_dayOfWeek_key" ON "PlanningDay"("planningId", "dayOfWeek");

-- Add foreign key for PlanningDay
ALTER TABLE "PlanningDay" ADD CONSTRAINT "PlanningDay_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data: Create PlanningDay entries for each unique (planningId, dayOfWeek) combination
INSERT INTO "PlanningDay" ("planningId", "dayOfWeek")
SELECT DISTINCT "planningId", "dayOfWeek"
FROM "PlanningExercise";

-- Add planningDayId column to PlanningExercise (nullable for now)
ALTER TABLE "PlanningExercise" ADD COLUMN "planningDayId" INTEGER;

-- Update planningDayId based on the new PlanningDay entries
UPDATE "PlanningExercise"
SET "planningDayId" = "PlanningDay"."id"
FROM "PlanningDay"
WHERE "PlanningExercise"."planningId" = "PlanningDay"."planningId"
  AND "PlanningExercise"."dayOfWeek" = "PlanningDay"."dayOfWeek";

-- Make planningDayId NOT NULL now that all data is migrated
ALTER TABLE "PlanningExercise" ALTER COLUMN "planningDayId" SET NOT NULL;

-- Drop the old foreign key constraint
ALTER TABLE "PlanningExercise" DROP CONSTRAINT "PlanningExercise_planningId_fkey";

-- Drop the old unique index
DROP INDEX "PlanningExercise_planningId_exerciseId_dayOfWeek_order_key";

-- Drop the old columns
ALTER TABLE "PlanningExercise" DROP COLUMN "planningId",
DROP COLUMN "dayOfWeek";

-- Create the new unique index
CREATE UNIQUE INDEX "PlanningExercise_planningDayId_exerciseId_order_key" ON "PlanningExercise"("planningDayId", "exerciseId", "order");

-- Add the new foreign key
ALTER TABLE "PlanningExercise" ADD CONSTRAINT "PlanningExercise_planningDayId_fkey" FOREIGN KEY ("planningDayId") REFERENCES "PlanningDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
