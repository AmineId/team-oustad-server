/*
  Warnings:

  - Made the column `uniqueCode` on table `Member` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Member" ALTER COLUMN "uniqueCode" SET NOT NULL;
