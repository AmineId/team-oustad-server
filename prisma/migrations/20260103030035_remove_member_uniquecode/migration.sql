-- AlterTable: Remove uniqueCode from Member table
ALTER TABLE "Member" DROP COLUMN IF EXISTS "uniqueCode";

-- DropIndex: Remove unique index on Member.uniqueCode
DROP INDEX IF EXISTS "Member_uniqueCode_key";
