-- AlterTable: add public showcase fields to Gym
ALTER TABLE "Gym" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Gym" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Gym_slug_key" ON "Gym"("slug");
CREATE INDEX "Gym_isPublished_idx" ON "Gym"("isPublished");
CREATE INDEX "Gym_slug_idx" ON "Gym"("slug");

-- CreateTable: GymPhoto gallery
CREATE TABLE "GymPhoto" (
    "id" SERIAL NOT NULL,
    "gymId" INTEGER NOT NULL,
    "imageData" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GymPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for GymPhoto
CREATE INDEX "GymPhoto_gymId_idx" ON "GymPhoto"("gymId");
CREATE INDEX "GymPhoto_gymId_position_idx" ON "GymPhoto"("gymId", "position");

-- AddForeignKey
ALTER TABLE "GymPhoto" ADD CONSTRAINT "GymPhoto_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
