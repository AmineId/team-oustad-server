#!/bin/bash

###############################################################################
# Script de démarrage PRODUCTION
# Ce script démarre la base de données prod et le serveur Node.js
###############################################################################

set -e  # Arrêter en cas d'erreur

echo "🚀 Démarrage environnement PRODUCTION"
echo "====================================="

# Couleurs pour les messages
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Installez Docker d'abord."
    exit 1
fi

# Vérifier si .env.prod existe
if [ ! -f ".env.prod" ]; then
    echo -e "${RED}❌ Fichier .env.prod introuvable${NC}"
    echo "   Copiez .env.prod.example vers .env.prod et configurez-le"
    exit 1
fi

# Confirmation avant de démarrer en production
echo -e "${YELLOW}⚠️  ATTENTION: Vous allez démarrer l'environnement PRODUCTION${NC}"
echo "   Assurez-vous que:"
echo "   - Le fichier .env.prod est correctement configuré"
echo "   - Les secrets JWT et DB sont forts et uniques"
echo "   - Les migrations ont été testées en preprod"
echo ""
read -p "Voulez-vous continuer ? (oui/non): " -r
echo
if [[ ! $REPLY =~ ^[Oo][Uu][Ii]$ ]]; then
    echo "Annulé."
    exit 1
fi

# Démarrer PostgreSQL prod
echo -e "${BLUE}📦 Démarrage PostgreSQL prod (port 5434)...${NC}"
docker compose -f config/docker-compose-multi-env.yml up -d postgres-prod

# Attendre que PostgreSQL soit prêt
echo -e "${YELLOW}⏳ Attente que PostgreSQL soit prêt...${NC}"
sleep 3

# Vérifier la connexion
if docker exec teamfitness-db-prod pg_isready -U produser -d fitness_prod > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL prod prêt${NC}"
else
    echo "❌ PostgreSQL prod ne répond pas"
    exit 1
fi

# Appliquer les migrations
echo -e "${BLUE}🔄 Application des migrations Prisma...${NC}"
npx dotenv -e .env.prod -- prisma migrate deploy

# Générer le client Prisma
echo -e "${BLUE}⚙️  Génération du client Prisma...${NC}"
npx prisma generate

# Démarrer le serveur Node.js
echo -e "${GREEN}🚀 Démarrage du serveur Node.js (port 3002)...${NC}"
echo ""
echo "==============================================="
echo "  Serveur PRODUCTION démarré avec succès !"
echo "==============================================="
echo "  📍 API: http://localhost:3002"
echo "  📚 Swagger: http://localhost:3002/api-docs"
echo "  🏥 Health: http://localhost:3002/health"
echo "  💾 Database: localhost:5434"
echo ""
echo "  Pour arrêter:"
echo "  - Ctrl+C pour le serveur"
echo "  - ./bin/stop-prod.sh pour tout arrêter"
echo "==============================================="
echo ""

npm run start:prod
