-- Drop the uniqueCode column from Member table (it's redundant with User.uniqueCode)
ALTER TABLE "Member" DROP COLUMN IF EXISTS "uniqueCode";

-- Drop the unique index if it exists
DROP INDEX IF EXISTS "Member_uniqueCode_key";
