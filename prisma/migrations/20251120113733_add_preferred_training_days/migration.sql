-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "preferredTrainingDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
