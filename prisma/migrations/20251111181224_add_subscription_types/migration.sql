/*
  Warnings:

  - You are about to drop the column `billingCycle` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `membership` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Subscription` table. All the data in the column will be lost.
  - Added the required column `subscriptionTypeId` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/

-- Étape 1: Créer la table SubscriptionType
CREATE TABLE "SubscriptionType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" DOUBLE PRECISION NOT NULL,
    "features" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionType_name_key" ON "SubscriptionType"("name");

-- Étape 2: Insérer les types d'abonnements par défaut
INSERT INTO "SubscriptionType" ("name", "description", "monthlyPrice", "features", "createdAt", "updatedAt") 
VALUES 
    ('Basic', 'Abonnement de base avec accès limité', 29.99, ARRAY['Accès salle', '2 cours/semaine', 'Casier'], NOW(), NOW()),
    ('Standard', 'Abonnement standard avec accès étendu', 49.99, ARRAY['Accès illimité', '5 cours/semaine', 'Casier', 'Douches'], NOW(), NOW()),
    ('Premium', 'Abonnement premium avec tous les avantages', 79.99, ARRAY['Accès illimité', 'Cours illimités', 'Casier', 'Douches', 'Sauna', 'Coach personnel 1h/mois'], NOW(), NOW()),
    ('VIP', 'Abonnement VIP tout inclus', 129.99, ARRAY['Accès illimité 24/7', 'Cours illimités', 'Casier privé', 'Douches', 'Sauna', 'Spa', 'Coach personnel 4h/mois', 'Nutrition'], NOW(), NOW());

-- Étape 3: Ajouter la colonne subscriptionTypeId avec une valeur par défaut temporaire
ALTER TABLE "Subscription" ADD COLUMN "subscriptionTypeId" INTEGER;

-- Étape 4: Mapper les anciennes valeurs vers les nouveaux types
-- basic -> Basic (id 1), premium -> Premium (id 3), vip -> VIP (id 4)
UPDATE "Subscription" SET "subscriptionTypeId" = 1 WHERE "plan" = 'basic';
UPDATE "Subscription" SET "subscriptionTypeId" = 3 WHERE "plan" = 'premium';
UPDATE "Subscription" SET "subscriptionTypeId" = 4 WHERE "plan" = 'vip';
UPDATE "Subscription" SET "subscriptionTypeId" = 2 WHERE "subscriptionTypeId" IS NULL; -- Défaut vers Standard

-- Étape 5: Rendre la colonne NOT NULL maintenant qu'elle a des valeurs
ALTER TABLE "Subscription" ALTER COLUMN "subscriptionTypeId" SET NOT NULL;

-- Étape 6: Supprimer les anciennes colonnes
ALTER TABLE "Subscription" DROP COLUMN "billingCycle",
DROP COLUMN "membership",
DROP COLUMN "plan",
DROP COLUMN "price";

-- Étape 7: Ajouter la contrainte de clé étrangère
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscriptionTypeId_fkey" FOREIGN KEY ("subscriptionTypeId") REFERENCES "SubscriptionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
