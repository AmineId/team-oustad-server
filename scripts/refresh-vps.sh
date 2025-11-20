#!/bin/bash

# Script pour régénérer Prisma Client et redémarrer PM2 sur le VPS
# Usage: ./scripts/refresh-vps.sh

set -e  # Arrêter en cas d'erreur

echo "🔄 Régénération Prisma et redémarrage PM2..."

# Couleurs pour les logs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
VPS_USER="root"
VPS_HOST="YOUR_VPS_IP_OR_DOMAIN"  # À remplacer par l'IP ou le domaine de votre VPS
PM2_APP_NAME="teamfitness-preprod"

echo -e "${BLUE}📡 Connexion au VPS...${NC}"

# Exécuter les commandes sur le VPS
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
set -e

echo "📂 Navigation vers le dossier du serveur..."
cd /root/team-server/db-server

echo "🔧 Génération du Prisma Client..."
npx prisma generate

echo "🔄 Redémarrage de l'application avec PM2..."
pm2 restart teamfitness-preprod

echo "✅ Redémarrage terminé!"

echo "📋 Derniers logs:"
pm2 logs teamfitness-preprod --lines 15 --nostream

ENDSSH

echo -e "${GREEN}✅ Prisma régénéré et PM2 redémarré avec succès!${NC}"
echo -e "${YELLOW}💡 Pour voir les logs: ssh ${VPS_USER}@${VPS_HOST} 'pm2 logs ${PM2_APP_NAME}'${NC}"
