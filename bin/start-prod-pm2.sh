#!/bin/bash

###############################################################################
# Script de démarrage avec PM2 - PRODUCTION
# Utilise PM2 pour gérer le processus en arrière-plan
###############################################################################

set -e

echo "🚀 Démarrage environnement PRODUCTION avec PM2"
echo "=============================================="

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Vérifier PM2
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 n'est pas installé."
    echo "   Installez-le avec: npm install -g pm2"
    exit 1
fi

# Vérifier .env.prod
if [ ! -f ".env.prod" ]; then
    echo -e "${RED}❌ Fichier .env.prod introuvable${NC}"
    exit 1
fi

# Confirmation
echo -e "${YELLOW}⚠️  ATTENTION: Démarrage PRODUCTION${NC}"
read -p "Continuer ? (oui/non): " -r
if [[ ! $REPLY =~ ^[Oo][Uu][Ii]$ ]]; then
    exit 1
fi

# Démarrer PostgreSQL prod
echo -e "${BLUE}📦 Démarrage PostgreSQL prod...${NC}"
docker compose -f config/docker-compose-multi-env.yml up -d postgres-prod
sleep 3

# Vérifier PostgreSQL
if docker exec teamfitness-db-prod pg_isready -U produser -d fitness_prod > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL prod prêt${NC}"
else
    echo "❌ PostgreSQL prod ne répond pas"
    exit 1
fi

# Migrations
echo -e "${BLUE}🔄 Migrations Prisma...${NC}"
npx dotenv -e .env.prod -- prisma migrate deploy
npx prisma generate

# Démarrer avec PM2
echo -e "${GREEN}🚀 Démarrage serveur avec PM2...${NC}"
pm2 start ecosystem.config.js --only teamfitness-prod

echo ""
echo "==============================================="
echo "  ✅ Serveur PRODUCTION démarré avec PM2 !"
echo "==============================================="
echo "  📍 API: http://localhost:3002"
echo "  📚 Swagger: http://localhost:3002/api-docs"
echo "  💾 Database: localhost:5434"
echo ""
echo "  Commandes PM2 utiles:"
echo "  - pm2 logs prod        # Voir les logs"
echo "  - pm2 restart prod     # Redémarrer"
echo "  - pm2 stop prod        # Arrêter"
echo "  - pm2 monit            # Monitoring"
echo "==============================================="
