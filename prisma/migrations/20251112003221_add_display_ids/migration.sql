/*
  Warnings:

  - A unique constraint covering the columns `[displayId]` on the table `Exercise` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[displayId]` on the table `Gym` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[displayId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[displayId]` on the table `Planning` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[displayId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[displayId]` on the table `SubscriptionType` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[displayId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `displayId` to the `Exercise` table without a default value. This is not possible if the table is not empty.
  - Added the required column `displayId` to the `Gym` table without a default value. This is not possible if the table is not empty.
  - Added the required column `displayId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `displayId` to the `Planning` table without a default value. This is not possible if the table is not empty.
  - Added the required column `displayId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `displayId` to the `SubscriptionType` table without a default value. This is not possible if the table is not empty.
  - Added the required column `displayId` to the `User` table without a default value. This is not possible if the table is not empty.

*/

-- Function to generate random hex string
CREATE OR REPLACE FUNCTION generate_random_hex(length INT) RETURNS TEXT AS $$
DECLARE
  chars TEXT := '0123456789abcdef';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * 16 + 1)::INT, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- AlterTable: Add displayId columns with temporary values
ALTER TABLE "Exercise" ADD COLUMN "displayId" TEXT;
ALTER TABLE "Gym" ADD COLUMN "displayId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "displayId" TEXT;
ALTER TABLE "Planning" ADD COLUMN "displayId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "displayId" TEXT;
ALTER TABLE "SubscriptionType" ADD COLUMN "displayId" TEXT;
ALTER TABLE "User" ADD COLUMN "displayId" TEXT;

-- Generate displayIds for existing records
UPDATE "Exercise" SET "displayId" = 'EXER-' || generate_random_hex(16);
UPDATE "Gym" SET "displayId" = 'GYM-' || generate_random_hex(16);
UPDATE "Payment" SET "displayId" = 'PAY-' || generate_random_hex(16);
UPDATE "Planning" SET "displayId" = 'PLAN-' || generate_random_hex(16);
UPDATE "Subscription" SET "displayId" = 'SUB-' || generate_random_hex(16);
UPDATE "SubscriptionType" SET "displayId" = 'SUBTYPE-' || generate_random_hex(16);

-- Generate displayIds for Users based on their role
UPDATE "User" SET "displayId" = 
  CASE 
    WHEN "role" = 'member' THEN 'MEMBER-' || generate_random_hex(16)
    WHEN "role" = 'admin' THEN 'ADMIN-' || generate_random_hex(16)
    WHEN "role" = 'owner' THEN 'OWNER-' || generate_random_hex(16)
    ELSE 'USER-' || generate_random_hex(16)
  END;

-- Make columns NOT NULL after filling them
ALTER TABLE "Exercise" ALTER COLUMN "displayId" SET NOT NULL;
ALTER TABLE "Gym" ALTER COLUMN "displayId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "displayId" SET NOT NULL;
ALTER TABLE "Planning" ALTER COLUMN "displayId" SET NOT NULL;
ALTER TABLE "Subscription" ALTER COLUMN "displayId" SET NOT NULL;
ALTER TABLE "SubscriptionType" ALTER COLUMN "displayId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "displayId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_displayId_key" ON "Exercise"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "Gym_displayId_key" ON "Gym"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_displayId_key" ON "Payment"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "Planning_displayId_key" ON "Planning"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_displayId_key" ON "Subscription"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionType_displayId_key" ON "SubscriptionType"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "User_displayId_key" ON "User"("displayId");
