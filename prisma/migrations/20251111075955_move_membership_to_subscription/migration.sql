/*
  Warnings:

  - You are about to drop the column `membership` on the `Member` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Member" DROP COLUMN "membership";

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "membership" TEXT NOT NULL DEFAULT 'Basic';
