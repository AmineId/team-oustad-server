-- Migration manuelle pour ajouter le champ lastLoginAt
-- À exécuter si vous ne pouvez pas utiliser prisma migrate

-- Ajouter la colonne lastLoginAt au modèle User
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- Optionnel : Initialiser avec la date de création pour les utilisateurs existants
-- Décommentez la ligne suivante si vous ne voulez PAS que les utilisateurs existants
-- soient considérés comme nouveaux lors de leur prochaine connexion
-- UPDATE "User" SET "lastLoginAt" = "createdAt" WHERE "lastLoginAt" IS NULL;

-- Vérification
SELECT id, email, "fullName", "createdAt", "lastLoginAt" FROM "User" LIMIT 5;
