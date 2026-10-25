-- AlterTable: description affichée sur la fiche vitrine de la salle
ALTER TABLE "Gym" ADD COLUMN "description" TEXT;

-- CreateTable: pages CMS du site vitrine (accueil + fiche de chaque salle)
CREATE TABLE "ShowcasePage" (
    "key" TEXT NOT NULL,
    "gymId" INTEGER,
    "content" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,

    CONSTRAINT "ShowcasePage_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowcasePage_gymId_key" ON "ShowcasePage"("gymId");

-- AddForeignKey
ALTER TABLE "ShowcasePage" ADD CONSTRAINT "ShowcasePage_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
