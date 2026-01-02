#!/bin/bash

echo "🧪 Suite de Tests Complète - Team Fitness Server"
echo "================================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Remonter au dossier racine
cd "$(dirname "$0")/../.."

# Compteurs
PASSED=0
FAILED=0
TOTAL=0

# Fonction pour exécuter un test
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "${BLUE}▶ Testing: ${test_name}${NC}"
    
    if npm run $test_command 2>&1 | tee /tmp/test_output.log; then
        echo -e "${GREEN}✅ ${test_name} - PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ ${test_name} - FAILED${NC}"
        ((FAILED++))
    fi
    ((TOTAL++))
    echo ""
}

echo -e "${YELLOW}📦 Préparation de l'environnement de test...${NC}"
echo ""

# Liste de tous les tests
echo -e "${BLUE}🔍 Exécution des tests de routes:${NC}"
echo ""

run_test "Auth Routes" "test:auth"
run_test "Android Routes" "test:android"
run_test "Banners Routes" "test:banners"
run_test "CheckIn Routes" "test:checkIn"
run_test "Gyms Routes" "test:gyms"
run_test "Members Routes" "test:members"
run_test "Plannings Routes" "test:plannings"
run_test "Store Routes" "test:store"
run_test "Subscriptions Routes" "test:subscriptions"
run_test "Subscription Types Routes" "test:subscriptionTypes"
run_test "Users Routes" "test:users"

echo ""
echo -e "${BLUE}🔍 Exécution des tests de services:${NC}"
echo ""

run_test "Email Service" "test:emailService"

echo ""
echo "================================================="
echo -e "${BLUE}📊 Résumé des Tests${NC}"
echo "================================================="
echo -e "Total: ${TOTAL}"
echo -e "${GREEN}Réussis: ${PASSED}${NC}"
echo -e "${RED}Échoués: ${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ Tous les tests sont passés avec succès!${NC}"
    exit 0
else
    echo -e "${RED}❌ Certains tests ont échoué.${NC}"
    exit 1
fi
