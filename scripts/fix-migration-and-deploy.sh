#!/bin/bash

# =====================================================
# Script de correction automatique de migration Prisma
# =====================================================

set -e

echo "🔧 Correction automatique de la migration..."

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Chemin du projet (modifier si nécessaire)
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
MIGRATION_FILE="$PROJECT_DIR/prisma/migrations/20251231170011_add_checkin_and_session_quotas/migration.sql"
ENV_FILE="${ENV_FILE:-.env.preprod}"

echo -e "${YELLOW}📁 Projet: $PROJECT_DIR${NC}"
echo -e "${YELLOW}📄 Fichier de migration: $MIGRATION_FILE${NC}"
echo -e "${YELLOW}🔐 Fichier env: $ENV_FILE${NC}"
echo ""

# Vérifier que le fichier existe
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Fichier de migration non trouvé: $MIGRATION_FILE${NC}"
    exit 1
fi

# 1. Corriger le fichier de migration
echo "📝 Étape 1/4: Correction du fichier de migration..."
sed -i 's/REFERENCES "Member"("id")/REFERENCES "Member"("userId")/g' "$MIGRATION_FILE"
echo -e "${GREEN}✅ Fichier corrigé${NC}"

# Vérifier la correction
if grep -q 'REFERENCES "Member"("userId")' "$MIGRATION_FILE"; then
    echo -e "${GREEN}✅ Vérification OK: La correction a été appliquée${NC}"
else
    echo -e "${RED}❌ Erreur: La correction n'a pas été appliquée${NC}"
    exit 1
fi

# 2. Résoudre la migration échouée
echo ""
echo "🔄 Étape 2/4: Résolution de la migration échouée..."
if [ -f "$PROJECT_DIR/$ENV_FILE" ]; then
    dotenv -e "$ENV_FILE" -- npx prisma migrate resolve --rolled-back 20251231170011_add_checkin_and_session_quotas
else
    npx prisma migrate resolve --rolled-back 20251231170011_add_checkin_and_session_quotas
fi
echo -e "${GREEN}✅ Migration marquée comme rolled-back${NC}"

# 3. Réappliquer les migrations
echo ""
echo "🚀 Étape 3/4: Application des migrations..."
if [ -f "$PROJECT_DIR/$ENV_FILE" ]; then
    dotenv -e "$ENV_FILE" -- npx prisma migrate deploy
else
    npx prisma migrate deploy
fi
echo -e "${GREEN}✅ Migrations appliquées${NC}"

# 4. Générer le client Prisma
echo ""
echo "⚙️  Étape 4/4: Génération du client Prisma..."
npx prisma generate
echo -e "${GREEN}✅ Client Prisma généré${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 Migration corrigée et appliquée !${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Prochaines étapes:"
echo "  1. Exécuter le seed: NODE_ENV=preprod node -r dotenv/config prisma/seed.js dotenv_config_path=.env.preprod"
echo "  2. Seed des quotas: NODE_ENV=preprod node -r dotenv/config scripts/seed-subscription-quotas.js dotenv_config_path=.env.preprod"
echo "  3. Redémarrer PM2: pm2 restart teamfitness-preprod"
