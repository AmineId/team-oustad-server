/*
  Warnings:

  - You are about to drop the column `email` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the column `gymId` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `gymId` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `adminId` on the `PasswordResetToken` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Admin` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `Member` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Admin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Member` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `PasswordResetToken` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "gymId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Add temporary columns for migration
ALTER TABLE "Admin" ADD COLUMN "userId" INTEGER;
ALTER TABLE "Member" ADD COLUMN "userId" INTEGER;
ALTER TABLE "PasswordResetToken" ADD COLUMN "userId" INTEGER;

-- Migrate Admin data to User
INSERT INTO "User" ("email", "password", "fullName", "role", "gymId", "createdAt", "updatedAt")
SELECT "email", "password", "fullName", 'admin', "gymId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Admin";

-- Migrate Member data to User
INSERT INTO "User" ("email", "password", "fullName", "role", "gymId", "createdAt", "updatedAt")
SELECT "email", COALESCE("password", '$2a$10$dummy.hash.for.members'), "fullName", 'member', "gymId", "joinedAt", CURRENT_TIMESTAMP
FROM "Member";

-- Update Admin table with user references
UPDATE "Admin" SET "userId" = "User"."id"
FROM "User"
WHERE "Admin"."email" = "User"."email" AND "User"."role" = 'admin';

-- Update Member table with user references
UPDATE "Member" SET "userId" = "User"."id"
FROM "User"
WHERE "Member"."email" = "User"."email" AND "User"."role" = 'member';

-- Update PasswordResetToken table with user references
UPDATE "PasswordResetToken" SET "userId" = "User"."id"
FROM "User", "Admin"
WHERE "PasswordResetToken"."adminId" = "Admin"."id" AND "Admin"."userId" = "User"."id";

-- DropForeignKey
ALTER TABLE "Admin" DROP CONSTRAINT "Admin_gymId_fkey";

-- DropForeignKey
ALTER TABLE "Member" DROP CONSTRAINT "Member_gymId_fkey";

-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_adminId_fkey";

-- DropIndex
DROP INDEX "Admin_email_key";

-- DropIndex
DROP INDEX "Member_email_key";

-- AlterTable
ALTER TABLE "Admin" DROP COLUMN "email",
DROP COLUMN "fullName",
DROP COLUMN "gymId",
DROP COLUMN "password";

-- Make userId NOT NULL
ALTER TABLE "Admin" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Member" DROP COLUMN "email",
DROP COLUMN "fullName",
DROP COLUMN "gymId",
DROP COLUMN "password";

-- Make userId NOT NULL
ALTER TABLE "Member" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PasswordResetToken" DROP COLUMN "adminId";

-- Make userId NOT NULL
ALTER TABLE "PasswordResetToken" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Admin_userId_key" ON "Admin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_userId_key" ON "Member"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
