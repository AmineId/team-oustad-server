#!/bin/bash

# Script de démonstration des tests
# Ce script montre comment exécuter les différents types de tests

set -e

echo "🧪 Démonstration de la Suite de Tests - Team Fitness Server"
echo "=============================================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher une section
show_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# 1. Vérifier l'environnement
show_section "1. Vérification de l'environnement"
echo "📋 Vérification des prérequis..."

if [ ! -f ".env.test" ]; then
    echo -e "${YELLOW}⚠️  Fichier .env.test manquant${NC}"
    echo "Création du fichier .env.test..."
    cat > .env.test << EOF
NODE_ENV=test
DATABASE_URL="postgresql://teamfitness:password@localhost:5432/teamfitness_test?schema=public"
JWT_SECRET=test_jwt_secret_key_for_testing_purposes
FIREBASE_SERVICE_ACCOUNT_PATH=""
EOF
    echo -e "${GREEN}✅ Fichier .env.test créé${NC}"
else
    echo -e "${GREEN}✅ Fichier .env.test présent${NC}"
fi

if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}❌ Node.js n'est pas installé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}❌ npm n'est pas installé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm: $(npm --version)${NC}"

# 2. Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    show_section "2. Installation des dépendances"
    echo "📦 Installation des dépendances npm..."
    npm install
    echo -e "${GREEN}✅ Dépendances installées${NC}"
else
    echo -e "${GREEN}✅ Dépendances déjà installées${NC}"
fi

# 3. Afficher les commandes disponibles
show_section "3. Commandes de test disponibles"
echo "Voici les principales commandes de test:"
echo ""
echo "  npm test                     - Exécuter tous les tests"
echo "  npm run test:coverage        - Tests avec rapport de couverture"
echo "  npm run test:watch           - Mode watch (auto-refresh)"
echo "  npm run test:auth            - Tests authentification uniquement"
echo "  npm run test:gyms            - Tests salles uniquement"
echo "  npm run test:subscriptions   - Tests abonnements uniquement"
echo "  npm run test:members         - Tests membres uniquement"
echo ""

# 4. Afficher un aperçu de la structure
show_section "4. Structure des tests"
echo "📁 Structure des fichiers de test:"
echo ""
tree -L 3 tests/ 2>/dev/null || find tests/ -type f -name "*.js" -o -name "*.md" -o -name "*.sh" | head -20

# 5. Proposer d'exécuter les tests
show_section "5. Exécution des tests"
echo ""
echo "Voulez-vous exécuter les tests maintenant? (y/n)"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo ""
    echo "🚀 Lancement des tests..."
    echo ""
    
    # Choisir le type de test
    echo "Choisissez le type de test à exécuter:"
    echo "  1) Tous les tests (rapide)"
    echo "  2) Tous les tests avec couverture (complet)"
    echo "  3) Tests authentification uniquement"
    echo "  4) Tests salles uniquement"
    echo "  5) Tests abonnements uniquement"
    echo "  6) Tests membres uniquement"
    echo ""
    read -p "Votre choix (1-6): " choice
    
    case $choice in
        1)
            echo -e "${BLUE}Exécution: npm test${NC}"
            npm test
            ;;
        2)
            echo -e "${BLUE}Exécution: npm run test:coverage${NC}"
            npm run test:coverage
            
            if [ -f "coverage/lcov-report/index.html" ]; then
                echo ""
                echo -e "${GREEN}📊 Rapport de couverture généré:${NC}"
                echo "   file://$(pwd)/coverage/lcov-report/index.html"
            fi
            ;;
        3)
            echo -e "${BLUE}Exécution: npm run test:auth${NC}"
            npm run test:auth
            ;;
        4)
            echo -e "${BLUE}Exécution: npm run test:gyms${NC}"
            npm run test:gyms
            ;;
        5)
            echo -e "${BLUE}Exécution: npm run test:subscriptions${NC}"
            npm run test:subscriptions
            ;;
        6)
            echo -e "${BLUE}Exécution: npm run test:members${NC}"
            npm run test:members
            ;;
        *)
            echo -e "${YELLOW}Choix invalide. Annulation.${NC}"
            exit 0
            ;;
    esac
    
    echo ""
    show_section "✅ Tests terminés"
    echo ""
    echo "Pour plus d'informations, consultez:"
    echo "  - tests/QUICK_START.md  - Guide de démarrage rapide"
    echo "  - tests/README.md       - Documentation complète"
    echo "  - TESTS_SUMMARY.md      - Résumé de la couverture"
    
else
    echo ""
    echo "Tests annulés. Pour exécuter les tests plus tard:"
    echo "  npm test"
    echo ""
    echo "Pour plus d'informations:"
    echo "  - tests/QUICK_START.md"
    echo "  - tests/README.md"
fi

echo ""
echo -e "${GREEN}🎉 Démonstration terminée!${NC}"
echo ""
