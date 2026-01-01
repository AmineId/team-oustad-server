#!/bin/bash

# =====================================================
# Script d'initialisation rapide pour nouveau VPS/Serveur
# =====================================================
# Ce script configure tout automatiquement pour un nouveau serveur
# Usage: ./scripts/init-server.sh
# =====================================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🆕 Team Fitness - Initialisation Nouveau Serveur       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Détection de l'environnement
if [ -f ".env.preprod" ]; then
    ENV_FILE=".env.preprod"
elif [ -f ".env.prod" ]; then
    ENV_FILE=".env.prod"
else
    ENV_FILE=".env"
fi

echo -e "${YELLOW}📁 Projet: $PROJECT_DIR${NC}"
echo -e "${YELLOW}🔐 Env détecté: $ENV_FILE${NC}"
echo ""

# Charger les variables d'environnement
if [ -f "$ENV_FILE" ]; then
    export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
    echo -e "${GREEN}✅ Variables d'environnement chargées${NC}"
fi

# Étape 1: Installation des dépendances
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  📦 ÉTAPE 1: INSTALLATION DES DÉPENDANCES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
npm install
echo -e "${GREEN}✅ Dépendances installées${NC}"

# Étape 2: Vérification de la connexion à la base de données
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  🔌 ÉTAPE 2: VÉRIFICATION DE LA CONNEXION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Tester la connexion
if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Connexion à la base de données OK${NC}"
else
    echo -e "${RED}❌ Impossible de se connecter à la base de données${NC}"
    echo -e "${YELLOW}Vérifiez votre DATABASE_URL dans $ENV_FILE${NC}"
    exit 1
fi

# Étape 3: Initialisation de la base de données
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  🗄️ ÉTAPE 3: INITIALISATION DE LA BASE DE DONNÉES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Vérifier si la base a déjà des tables
TABLE_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | grep -oE '[0-9]+' | head -1 || echo "0")

if [ "$TABLE_COUNT" -gt "1" ]; then
    echo -e "${YELLOW}⚠️ Base de données existante détectée ($TABLE_COUNT tables)${NC}"
    read -p "Voulez-vous réinitialiser? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}🔄 Réinitialisation...${NC}"
        npx prisma migrate reset --force --skip-seed
    else
        echo -e "${BLUE}🔄 Application des migrations manquantes...${NC}"
        npx prisma migrate deploy
    fi
else
    echo -e "${BLUE}🆕 Nouvelle base de données - Application du schéma complet...${NC}"
    
    # Pour une nouvelle base, on utilise la baseline directement
    # D'abord, on crée le schéma depuis zéro
    npx prisma db push --accept-data-loss
    
    # Puis on marque toutes les migrations comme appliquées
    echo -e "${BLUE}📝 Marquage des migrations comme appliquées...${NC}"
    npx prisma migrate resolve --applied 0_baseline 2>/dev/null || true
    
    # Marquer toutes les autres migrations existantes
    for migration_dir in prisma/migrations/*/; do
        migration_name=$(basename "$migration_dir")
        if [[ "$migration_name" != "0_baseline" && "$migration_name" != "migration_lock.toml" && -d "$migration_dir" ]]; then
            npx prisma migrate resolve --applied "$migration_name" 2>/dev/null || true
        fi
    done
fi

echo -e "${GREEN}✅ Base de données prête${NC}"

# Étape 4: Génération du client Prisma
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  ⚙️ ÉTAPE 4: GÉNÉRATION DU CLIENT PRISMA${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
npx prisma generate
echo -e "${GREEN}✅ Client Prisma généré${NC}"

# Étape 5: Exécution des seeds
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  🌱 ÉTAPE 5: SEEDS (DONNÉES INITIALES)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

read -p "Exécuter les seeds? (Y/n): " seed_confirm
if [[ ! "$seed_confirm" =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}📊 Seed principal...${NC}"
    node prisma/seed.js
    
    echo -e "${YELLOW}📊 Seed des quotas d'abonnement...${NC}"
    node scripts/seed-subscription-quotas.js
    
    echo -e "${GREEN}✅ Seeds terminés${NC}"
else
    echo -e "${YELLOW}⏭️ Seeds ignorés${NC}"
fi

# Étape 6: Configuration PM2
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  🚀 ÉTAPE 6: DÉMARRAGE DU SERVEUR${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if command -v pm2 &> /dev/null; then
    read -p "Démarrer avec PM2? (Y/n): " pm2_confirm
    if [[ ! "$pm2_confirm" =~ ^[Nn]$ ]]; then
        if [ -f "ecosystem.config.js" ]; then
            pm2 start ecosystem.config.js
        else
            pm2 start index.js --name teamfitness-preprod
        fi
        pm2 save
        echo -e "${GREEN}✅ Serveur démarré avec PM2${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ PM2 non installé. Installez-le avec: npm install -g pm2${NC}"
fi

# Résumé final
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         ✅ INITIALISATION TERMINÉE AVEC SUCCÈS             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Comptes par défaut créés:"
echo -e "  • Owner: ${BLUE}owner@teamfitness.com${NC} / ${YELLOW}owner123${NC}"
echo -e "  • Admin: ${BLUE}admin@teamfitness.com${NC} / ${YELLOW}admin123${NC}"
echo -e "  • Member: ${BLUE}bob@example.com${NC} / ${YELLOW}member123${NC}"
echo ""
echo -e "Commandes utiles:"
echo -e "  • Logs: ${BLUE}pm2 logs${NC}"
echo -e "  • Status: ${BLUE}pm2 status${NC}"
echo -e "  • Prisma Studio: ${BLUE}npx prisma studio${NC}"
echo -e "  • Redéployer: ${BLUE}./scripts/deploy.sh${NC}"
echo ""
