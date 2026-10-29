-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "notifyMembers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifiedAt" TIMESTAMP(3);
