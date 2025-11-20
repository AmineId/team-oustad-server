# Migration fullName vers firstName + lastName

## Problème
La migration automatique échoue car il y a déjà 18 utilisateurs dans la base avec `fullName`, et Prisma ne peut pas ajouter des champs requis sans valeur par défaut.

## Solution: Migration en 4 étapes

### Étape 1: Exécuter le script SQL manuel
```bash
# Connectez-vous à PostgreSQL
psql -U your_user -d fitness_preprod -p 5433

# Ou utilisez le script directement
psql -U your_user -d fitness_preprod -p 5433 -f prisma/migrations/migrate_fullname_to_firstname_lastname.sql
```

Le script fait:
1. Ajoute `firstName` et `lastName` comme champs optionnels
2. Migre les données: split `fullName` en `firstName` (premier mot) et `lastName` (reste)
3. Rend `firstName` et `lastName` obligatoires
4. Supprime la colonne `fullName`

### Étape 2: Appliquer la migration Prisma
```bash
npx prisma migrate dev --name replace_fullname_with_firstname_lastname
```

### Étape 3: Mettre à jour le client Prisma
```bash
npx prisma generate
```

### Étape 4: Redémarrer le serveur
```bash
pm2 restart teamfitness-preprod
```

## Vérification
```sql
-- Vérifier que tous les users ont firstName et lastName
SELECT id, email, "firstName", "lastName" FROM "User" LIMIT 10;

-- Compter les users sans nom
SELECT COUNT(*) FROM "User" WHERE "firstName" IS NULL OR "lastName" IS NULL;
```

## Rollback (si besoin)
```sql
-- Ajouter fullName
ALTER TABLE "User" ADD COLUMN "fullName" TEXT;

-- Reconstituer fullName
UPDATE "User" SET "fullName" = "firstName" || ' ' || "lastName";

-- Rendre fullName obligatoire
ALTER TABLE "User" ALTER COLUMN "fullName" SET NOT NULL;

-- Supprimer firstName et lastName
ALTER TABLE "User" DROP COLUMN "firstName";
ALTER TABLE "User" DROP COLUMN "lastName";
```
