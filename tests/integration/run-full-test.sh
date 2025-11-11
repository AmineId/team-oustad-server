#!/bin/bash

echo "🔄 Script de Test Complet - Acquittement de Paiement"
echo "===================================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Remonter au dossier racine
cd "$(dirname "$0")/.."

# 1. Reset de la base de données
echo -e "${BLUE}1️⃣  Réinitialisation de la base de données...${NC}"
npx prisma db push --force-reset > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Base réinitialisée${NC}"
else
    echo -e "❌ Erreur lors de la réinitialisation"
    exit 1
fi

# 2. Exécution du seed
echo -e "${BLUE}2️⃣  Exécution du seed...${NC}"
npx prisma db seed > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Seed exécuté (Olivia créée avec abonnement pending)${NC}"
else
    echo -e "❌ Erreur lors du seed"
    exit 1
fi

# 3. Vérifier si le serveur tourne
echo -e "${BLUE}3️⃣  Vérification du serveur...${NC}"
SERVER_STATUS=$(curl -s http://localhost:3000/health)

if [[ $SERVER_STATUS == *"ok"* ]]; then
    echo -e "${GREEN}✅ Serveur actif${NC}"
else
    echo -e "${YELLOW}⚠️  Le serveur ne répond pas${NC}"
    echo -e "${YELLOW}   Veuillez démarrer le serveur avec: node index.js${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}4️⃣  Exécution du test d'acquittement avec Olivia...${NC}"
echo ""

# 4. Attendre un peu pour que le serveur soit prêt
sleep 2

# 5. Exécuter le test
node tests/test-acknowledge-olivia.js

echo ""
echo "======================================================"
echo -e "${GREEN}✅ Test complet terminé${NC}"
echo ""
echo "📚 Pour plus d'informations:"
echo "   - Documentation: docs/PAYMENT_ACKNOWLEDGEMENT.md"
echo "   - README: README.md"
echo "   - Swagger: http://localhost:3000/api-docs"
