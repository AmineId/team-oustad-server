/*
  Warnings:

  - You are about to drop the column `dayOfWeek` on the `Planning` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[planningId,exerciseId,dayOfWeek,order]` on the table `PlanningExercise` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dayOfWeek` to the `PlanningExercise` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "PlanningExercise_planningId_exerciseId_order_key";

-- AlterTable
ALTER TABLE "Planning" DROP COLUMN "dayOfWeek";

-- AlterTable
ALTER TABLE "PlanningExercise" ADD COLUMN     "dayOfWeek" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PlanningExercise_planningId_exerciseId_dayOfWeek_order_key" ON "PlanningExercise"("planningId", "exerciseId", "dayOfWeek", "order");
