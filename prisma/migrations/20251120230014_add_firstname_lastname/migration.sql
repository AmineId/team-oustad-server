-- AlterTable: Add firstName and lastName columns to User
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- Migrate data from fullName to firstName/lastName
UPDATE "User" SET 
  "firstName" = SPLIT_PART("fullName", ' ', 1),
  "lastName" = CASE 
    WHEN POSITION(' ' IN "fullName") > 0 
    THEN SUBSTRING("fullName" FROM POSITION(' ' IN "fullName") + 1)
    ELSE ''
  END
WHERE "fullName" IS NOT NULL;

-- Drop fullName column
ALTER TABLE "User" DROP COLUMN IF EXISTS "fullName";
