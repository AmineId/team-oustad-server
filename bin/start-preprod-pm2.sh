#!/bin/bash

###############################################################################
# Script de démarrage avec PM2 - PRÉPRODUCTION
# Utilise PM2 pour gérer le processus en arrière-plan
###############################################################################

set -e

echo "🚀 Démarrage environnement PREPROD avec PM2"
echo "==========================================="

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Vérifier PM2
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 n'est pas installé."
    echo "   Installez-le avec: npm install -g pm2"
    exit 1
fi

# Vérifier .env.preprod
if [ ! -f ".env.preprod" ]; then
    echo "❌ Fichier .env.preprod introuvable"
    exit 1
fi

# Démarrer PostgreSQL preprod
echo -e "${BLUE}📦 Démarrage PostgreSQL preprod...${NC}"
docker compose -f config/docker-compose-multi-env.yml up -d postgres-preprod
sleep 3

# Vérifier PostgreSQL
if docker exec teamfitness-db-preprod pg_isready -U admin -d fitness_preprod > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL preprod prêt${NC}"
else
    echo "❌ PostgreSQL preprod ne répond pas"
    exit 1
fi

# Migrations
echo -e "${BLUE}🔄 Migrations Prisma...${NC}"
npx dotenv -e .env.preprod -- prisma migrate deploy
npx prisma generate

# Démarrer avec PM2
echo -e "${GREEN}🚀 Démarrage serveur avec PM2...${NC}"
pm2 start ecosystem.config.js --only teamfitness-preprod

echo ""
echo "==============================================="
echo "  ✅ Serveur PREPROD démarré avec PM2 !"
echo "==============================================="
echo "  📍 API: http://localhost:3001"
echo "  📚 Swagger: http://localhost:3001/api-docs"
echo "  💾 Database: localhost:5433"
echo ""
echo "  Commandes PM2 utiles:"
echo "  - pm2 logs preprod     # Voir les logs"
echo "  - pm2 restart preprod  # Redémarrer"
echo "  - pm2 stop preprod     # Arrêter"
echo "  - pm2 monit            # Monitoring"
echo "==============================================="
