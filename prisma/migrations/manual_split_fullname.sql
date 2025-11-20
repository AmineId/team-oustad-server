-- Migration manuelle: Séparer fullName en firstName et lastName
-- À exécuter sur votre base de données

-- Étape 1: Ajouter les nouvelles colonnes
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- Étape 2: Migrer les données existantes (split sur le premier espace)
UPDATE "User" 
SET 
  "firstName" = SPLIT_PART("fullName", ' ', 1),
  "lastName" = CASE 
    WHEN POSITION(' ' IN "fullName") > 0 THEN SUBSTRING("fullName" FROM POSITION(' ' IN "fullName") + 1)
    ELSE ''
  END
WHERE "fullName" IS NOT NULL;

-- Étape 3: Rendre les colonnes obligatoires et ajouter des valeurs par défaut si nécessaire
UPDATE "User" SET "firstName" = 'Unknown' WHERE "firstName" IS NULL OR "firstName" = '';
UPDATE "User" SET "lastName" = 'User' WHERE "lastName" IS NULL OR "lastName" = '';

ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" SET NOT NULL;

-- Étape 4: Rendre fullName optionnel (nullable)
ALTER TABLE "User" ALTER COLUMN "fullName" DROP NOT NULL;

-- Vérification
SELECT id, "firstName", "lastName", "fullName" FROM "User" LIMIT 10;
