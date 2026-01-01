#!/bin/bash

# =====================================================
# Script de déploiement Team Fitness Server
# =====================================================
# Usage: ./scripts/deploy.sh [OPTIONS]
#
# Options:
#   --fresh     Réinitialise complètement la base de données
#   --seed      Exécute les seeds après le déploiement
#   --prod      Mode production (demande confirmation)
#   --env FILE  Fichier d'environnement à utiliser (.env.preprod, .env.prod)
#   --help      Affiche cette aide
# =====================================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables par défaut
FRESH=false
SEED=false
PROD=false
ENV_FILE=".env"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --fresh)
            FRESH=true
            shift
            ;;
        --seed)
            SEED=true
            shift
            ;;
        --prod)
            PROD=true
            shift
            ;;
        --env)
            ENV_FILE="$2"
            shift 2
            ;;
        --help)
            echo "Usage: ./scripts/deploy.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --fresh     Réinitialise complètement la base de données"
            echo "  --seed      Exécute les seeds après le déploiement"
            echo "  --prod      Mode production (demande confirmation)"
            echo "  --env FILE  Fichier d'environnement à utiliser"
            echo "  --help      Affiche cette aide"
            exit 0
            ;;
        *)
            echo -e "${RED}Option inconnue: $1${NC}"
            exit 1
            ;;
    esac
done

cd "$PROJECT_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         🚀 Team Fitness Server - Déploiement               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📁 Projet: $PROJECT_DIR${NC}"
echo -e "${YELLOW}🔐 Env: $ENV_FILE${NC}"
echo -e "${YELLOW}🔄 Fresh: $FRESH${NC}"
echo -e "${YELLOW}🌱 Seed: $SEED${NC}"
echo ""

# Confirmation en mode production
if [ "$PROD" = true ] && [ "$FRESH" = true ]; then
    echo -e "${RED}⚠️  ATTENTION: Vous êtes sur le point de réinitialiser la base de PRODUCTION !${NC}"
    read -p "Tapez 'CONFIRMER' pour continuer: " confirm
    if [ "$confirm" != "CONFIRMER" ]; then
        echo -e "${RED}❌ Annulé.${NC}"
        exit 1
    fi
fi

# Charger les variables d'environnement
if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}📦 Chargement de $ENV_FILE...${NC}"
    export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
fi

# Fonction pour vérifier si la base de données existe et a des tables
check_database() {
    echo -e "${BLUE}🔍 Vérification de la base de données...${NC}"
    
    # Vérifier si la table _prisma_migrations existe
    TABLE_EXISTS=$(npx prisma db execute --stdin <<< "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '_prisma_migrations');" 2>/dev/null | grep -c "t" || echo "0")
    
    if [ "$TABLE_EXISTS" -gt 0 ]; then
        echo -e "${GREEN}✅ Base de données existante détectée${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️ Base de données vide ou nouvelle${NC}"
        return 1
    fi
}

# Fonction pour appliquer la baseline sur une base vide
apply_baseline() {
    echo -e "${BLUE}🏗️ Application de la migration baseline...${NC}"
    
    # Marquer toutes les migrations comme appliquées
    npx prisma migrate resolve --applied 0_baseline 2>/dev/null || true
    
    # Appliquer les migrations restantes
    npx prisma migrate deploy
}

# Étape 1: Installation des dépendances (si nécessaire)
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installation des dépendances...${NC}"
    npm install
fi

# Étape 2: Migration de la base de données
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  📊 MIGRATION DE LA BASE DE DONNÉES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$FRESH" = true ]; then
    echo -e "${YELLOW}🔄 Réinitialisation complète de la base de données...${NC}"
    npx prisma migrate reset --force --skip-seed
else
    # Vérifier l'état de la base
    echo -e "${BLUE}🔍 Vérification du statut des migrations...${NC}"
    
    # Essayer d'appliquer les migrations
    if ! npx prisma migrate deploy 2>&1; then
        echo -e "${YELLOW}⚠️ Erreur lors de l'application des migrations${NC}"
        echo -e "${YELLOW}🔄 Tentative de résolution...${NC}"
        
        # Vérifier s'il y a des migrations en échec
        FAILED=$(npx prisma migrate status 2>&1 | grep -c "failed" || echo "0")
        
        if [ "$FAILED" -gt 0 ]; then
            echo -e "${YELLOW}⚠️ Migrations en échec détectées. Utilisez --fresh pour réinitialiser.${NC}"
            exit 1
        fi
    fi
fi

echo -e "${GREEN}✅ Migrations appliquées${NC}"

# Étape 3: Génération du client Prisma
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  ⚙️ GÉNÉRATION DU CLIENT PRISMA${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

npx prisma generate
echo -e "${GREEN}✅ Client Prisma généré${NC}"

# Étape 4: Seeds (si demandé)
if [ "$SEED" = true ]; then
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  🌱 EXÉCUTION DES SEEDS${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    echo -e "${YELLOW}📊 Seed principal...${NC}"
    node prisma/seed.js
    echo -e "${GREEN}✅ Seed principal terminé${NC}"
    
    echo -e "${YELLOW}📊 Seed des quotas d'abonnement...${NC}"
    node scripts/seed-subscription-quotas.js
    echo -e "${GREEN}✅ Seed des quotas terminé${NC}"
fi

# Étape 5: Redémarrage de PM2 (si en mode preprod/prod)
if command -v pm2 &> /dev/null; then
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  🔄 REDÉMARRAGE DU SERVEUR${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ "$PROD" = true ]; then
        pm2 restart teamfitness-prod 2>/dev/null || echo -e "${YELLOW}⚠️ Processus PM2 prod non trouvé${NC}"
    else
        pm2 restart teamfitness-preprod 2>/dev/null || echo -e "${YELLOW}⚠️ Processus PM2 preprod non trouvé${NC}"
    fi
fi

# Résumé
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Prochaines étapes suggérées:"
echo -e "  • Vérifier les logs: ${BLUE}pm2 logs${NC}"
echo -e "  • Tester l'API: ${BLUE}curl http://localhost:3000/health${NC}"
echo -e "  • Ouvrir Prisma Studio: ${BLUE}npx prisma studio${NC}"
echo ""
