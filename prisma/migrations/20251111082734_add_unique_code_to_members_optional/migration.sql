/*
  Warnings:

  - A unique constraint covering the columns `[uniqueCode]` on the table `Member` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "uniqueCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Member_uniqueCode_key" ON "Member"("uniqueCode");
