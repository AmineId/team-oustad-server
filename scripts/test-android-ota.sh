#!/bin/bash

# 🧪 Script de test des endpoints Android OTA
# Ce script teste tous les endpoints Android OTA pour vérifier qu'ils fonctionnent correctement

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-http://localhost:3001}"  # Utiliser l'URL passée en paramètre ou localhost par défaut

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Test des endpoints Android OTA - Team Fitness         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}URL de base:${NC} $BASE_URL"
echo ""

# Fonction pour afficher le résultat d'un test
test_endpoint() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}🧪 Test:${NC} $name"
    echo -e "${YELLOW}🔗 URL:${NC} $url"
    echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"
    
    response=$(curl -s -w "\n%{http_code}" "$url")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✅ Succès (HTTP $http_code)${NC}"
        echo -e "${GREEN}Réponse:${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    elif [ "$http_code" -eq 404 ]; then
        echo -e "${YELLOW}⚠️  Non trouvé (HTTP $http_code)${NC}"
        echo -e "${YELLOW}Réponse:${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}❌ Échec (HTTP $http_code)${NC}"
        echo -e "${RED}Réponse:${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi
}

# Test 1: Health check
test_endpoint \
    "Health Check" \
    "$BASE_URL/health"

# Test 2: Version JSON (fichier statique)
test_endpoint \
    "Version JSON (Fichier statique)" \
    "$BASE_URL/android/version.json"

# Test 3: Version API
test_endpoint \
    "Version API (Endpoint dynamique)" \
    "$BASE_URL/android/version"

# Test 4: Check Update - Aucune mise à jour (version actuelle)
test_endpoint \
    "Check Update - Version actuelle (1)" \
    "$BASE_URL/android/check-update?current_version=1"

# Test 5: Check Update - Mise à jour disponible (version ancienne)
test_endpoint \
    "Check Update - Version ancienne (0)" \
    "$BASE_URL/android/check-update?current_version=0"

# Test 6: Check Update - Sans paramètre (devrait échouer)
test_endpoint \
    "Check Update - Sans paramètre (erreur attendue)" \
    "$BASE_URL/android/check-update"

# Test 7: Check Update - Avec device_id
test_endpoint \
    "Check Update - Avec device_id" \
    "$BASE_URL/android/check-update?current_version=1&device_id=test-device-123"

# Test 8: Download APK (headers seulement)
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🧪 Test:${NC} Download APK (Headers)"
echo -e "${YELLOW}🔗 URL:${NC} $BASE_URL/android/download"
echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"

headers=$(curl -s -I "$BASE_URL/android/download")
http_code=$(echo "$headers" | grep -i "HTTP/" | tail -n1 | awk '{print $2}')

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✅ APK disponible (HTTP $http_code)${NC}"
    echo -e "${GREEN}Headers:${NC}"
    echo "$headers" | grep -i "content-type\|content-length\|content-disposition"
elif [ "$http_code" == "404" ]; then
    echo -e "${YELLOW}⚠️  APK non trouvé (HTTP $http_code) - Normal si aucun APK n'a été uploadé${NC}"
else
    echo -e "${RED}❌ Erreur (HTTP $http_code)${NC}"
fi

# Test 9: Checksum (seulement si APK existe)
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🧪 Test:${NC} Calcul des checksums"
echo -e "${YELLOW}🔗 URL:${NC} $BASE_URL/android/checksum"
echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"

checksum_response=$(curl -s -w "\n%{http_code}" "$BASE_URL/android/checksum")
checksum_http_code=$(echo "$checksum_response" | tail -n1)
checksum_body=$(echo "$checksum_response" | sed '$d')

if [ "$checksum_http_code" == "200" ]; then
    echo -e "${GREEN}✅ Checksums calculés (HTTP $checksum_http_code)${NC}"
    echo -e "${GREEN}Réponse:${NC}"
    echo "$checksum_body" | jq '.'
elif [ "$checksum_http_code" == "404" ]; then
    echo -e "${YELLOW}⚠️  APK non trouvé (HTTP $checksum_http_code) - Normal si aucun APK n'a été uploadé${NC}"
else
    echo -e "${RED}❌ Échec (HTTP $checksum_http_code)${NC}"
fi

# Résumé
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                      RÉSUMÉ DES TESTS                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Endpoints testés:${NC}"
echo "   • Health Check"
echo "   • Version JSON (statique)"
echo "   • Version API (dynamique)"
echo "   • Check Update (plusieurs scénarios)"
echo "   • Download APK"
echo "   • Checksum"
echo ""
echo -e "${YELLOW}📝 Notes:${NC}"
echo "   • Si APK non trouvé (404), c'est normal si vous n'avez pas encore uploadé d'APK"
echo "   • Pour uploader un APK, utilisez: ./scripts/deploy-android-apk.sh"
echo "   • Documentation complète: /root/team-server/db-server/ANDROID_OTA_SETUP_COMPLETE.md"
echo ""
echo -e "${BLUE}🔗 URLs utiles:${NC}"
echo "   • Swagger API: $BASE_URL/api-docs"
echo "   • Health: $BASE_URL/health"
echo "   • Version: $BASE_URL/android/version.json"
echo ""
echo -e "${GREEN}✅ Tests terminés!${NC}"
echo ""
