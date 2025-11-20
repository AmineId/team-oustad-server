-- Migration étape 1: Ajouter firstName et lastName comme optionnels
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" TEXT;

-- Migration étape 2: Migrer les données de fullName vers firstName/lastName
UPDATE "User" 
SET 
  "firstName" = CASE 
    WHEN "fullName" IS NOT NULL AND position(' ' in "fullName") > 0 
    THEN split_part("fullName", ' ', 1)
    ELSE "fullName"
  END,
  "lastName" = CASE 
    WHEN "fullName" IS NOT NULL AND position(' ' in "fullName") > 0 
    THEN substring("fullName" from position(' ' in "fullName") + 1)
    ELSE ''
  END
WHERE "firstName" IS NULL OR "lastName" IS NULL;

-- Migration étape 3: Rendre firstName et lastName obligatoires
ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" SET NOT NULL;

-- Migration étape 4: Supprimer fullName
ALTER TABLE "User" DROP COLUMN IF EXISTS "fullName";
