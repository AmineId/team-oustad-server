-- AlterTable
ALTER TABLE "User" ADD COLUMN "phoneNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- AlterTable - Rename phone column to phoneNumber in User table
ALTER TABLE "User" DROP COLUMN IF EXISTS "phone";
