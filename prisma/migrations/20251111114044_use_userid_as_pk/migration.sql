/*
  Warnings:

  - The primary key for the `Admin` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Admin` table. All the data in the column will be lost.
  - The primary key for the `Member` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Member` table. All the data in the column will be lost.
  - The primary key for the `Owner` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Owner` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_memberId_fkey";

-- DropForeignKey
ALTER TABLE "Planning" DROP CONSTRAINT "Planning_memberId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_memberId_fkey";

-- DropIndex
DROP INDEX "Admin_userId_key";

-- DropIndex
DROP INDEX "Member_userId_key";

-- DropIndex
DROP INDEX "Owner_userId_key";

-- AlterTable
ALTER TABLE "Admin" DROP CONSTRAINT "Admin_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Admin_pkey" PRIMARY KEY ("userId");

-- AlterTable
ALTER TABLE "Member" DROP CONSTRAINT "Member_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Member_pkey" PRIMARY KEY ("userId");

-- AlterTable
ALTER TABLE "Owner" DROP CONSTRAINT "Owner_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Owner_pkey" PRIMARY KEY ("userId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
