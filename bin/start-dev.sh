#!/bin/bash

###############################################################################
# Script de démarrage DÉVELOPPEMENT
# Ce script démarre la base de données dev et le serveur Node.js
###############################################################################

set -e  # Arrêter en cas d'erreur

echo "🚀 Démarrage environnement DÉVELOPPEMENT"
echo "========================================"

# Couleurs pour les messages
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Installez Docker d'abord."
    exit 1
fi

# Démarrer PostgreSQL dev
echo -e "${BLUE}📦 Démarrage PostgreSQL dev (port 5432)...${NC}"
docker compose -f config/docker-compose-multi-env.yml up -d postgres-dev

# Attendre que PostgreSQL soit prêt
echo -e "${YELLOW}⏳ Attente que PostgreSQL soit prêt...${NC}"
sleep 3

# Vérifier la connexion
if docker exec teamfitness-db-dev pg_isready -U admin -d fitness > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL dev prêt${NC}"
else
    echo "❌ PostgreSQL dev ne répond pas"
    exit 1
fi

# Appliquer les migrations
echo -e "${BLUE}🔄 Application des migrations Prisma...${NC}"
npx prisma migrate deploy

# Générer le client Prisma
echo -e "${BLUE}⚙️  Génération du client Prisma...${NC}"
npx prisma generate

# Démarrer le serveur Node.js
echo -e "${GREEN}🚀 Démarrage du serveur Node.js (port 3000)...${NC}"
echo ""
echo "==============================================="
echo "  Serveur DEV démarré avec succès !"
echo "==============================================="
echo "  📍 API: http://localhost:3000"
echo "  📚 Swagger: http://localhost:3000/api-docs"
echo "  🏥 Health: http://localhost:3000/health"
echo "  💾 Database: localhost:5432"
echo ""
echo "  Pour arrêter:"
echo "  - Ctrl+C pour le serveur"
echo "  - ./bin/stop-dev.sh pour tout arrêter"
echo "==============================================="
echo ""

npm start
