#!/bin/bash

# Script de configuration de la base de données de test
# Usage: ./tests/setup-test-db.sh

set -e

echo "🔧 Configuration de la base de données de test..."

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Variables de configuration
DB_NAME="teamfitness_test"
DB_USER="${POSTGRES_USER:-teamfitness}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

echo "📋 Configuration:"
echo "   - Database: $DB_NAME"
echo "   - User: $DB_USER"
echo "   - Host: $DB_HOST"
echo "   - Port: $DB_PORT"
echo ""

# Vérifier si PostgreSQL est accessible
echo "🔍 Vérification de la connexion PostgreSQL..."
if ! PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${RED}❌ Impossible de se connecter à PostgreSQL${NC}"
    echo "   Vérifiez que PostgreSQL est démarré et que les identifiants sont corrects."
    echo "   Variables d'environnement: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT"
    exit 1
fi
echo -e "${GREEN}✅ Connexion PostgreSQL OK${NC}"

# Supprimer la base de données de test si elle existe
echo ""
echo "🗑️  Suppression de l'ancienne base de données de test (si elle existe)..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" > /dev/null 2>&1
echo -e "${GREEN}✅ Ancienne base supprimée${NC}"

# Créer la nouvelle base de données de test
echo ""
echo "🏗️  Création de la base de données de test..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" > /dev/null 2>&1
echo -e "${GREEN}✅ Base de données créée${NC}"

# Appliquer les migrations
echo ""
echo "📦 Application des migrations Prisma..."
export DATABASE_URL="postgresql://$DB_USER:${POSTGRES_PASSWORD}@$DB_HOST:$DB_PORT/$DB_NAME?schema=public"

if npx prisma migrate deploy > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Migrations appliquées${NC}"
else
    echo -e "${YELLOW}⚠️  Aucune migration à appliquer ou erreur${NC}"
fi

# Générer le client Prisma
echo ""
echo "🔨 Génération du client Prisma..."
if npx prisma generate > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Client Prisma généré${NC}"
else
    echo -e "${RED}❌ Erreur lors de la génération du client Prisma${NC}"
    exit 1
fi

# Vérifier la connexion à la base de test
echo ""
echo "🔍 Vérification de la base de données de test..."
if PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM \"_prisma_migrations\";" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Base de données de test prête${NC}"
else
    echo -e "${YELLOW}⚠️  Base de données créée mais les migrations semblent manquantes${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Configuration terminée avec succès!${NC}"
echo ""
echo "Vous pouvez maintenant exécuter les tests:"
echo "  npm test"
echo "  npm run test:coverage"
echo ""
echo "Base de données de test: postgresql://$DB_USER:***@$DB_HOST:$DB_PORT/$DB_NAME"
