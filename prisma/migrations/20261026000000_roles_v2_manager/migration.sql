-- Rôles V2 : le rôle `admin` devient `manager`.

-- Table de détail Admin -> Manager (données conservées)
ALTER TABLE "Admin" RENAME TO "Manager";
ALTER TABLE "Manager" RENAME CONSTRAINT "Admin_pkey" TO "Manager_pkey";
ALTER TABLE "Manager" RENAME CONSTRAINT "Admin_userId_fkey" TO "Manager_userId_fkey";

-- Rôle des utilisateurs existants
UPDATE "User" SET "role" = 'manager' WHERE "role" = 'admin';

-- Session kiosk séparée de la session app
ALTER TABLE "User" ADD COLUMN "kioskSessionId" TEXT;
