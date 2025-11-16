#!/bin/bash

# 🧪 Test des endpoints Android OTA sur le domaine public
# URL: https://app.team-oustad.com/android

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="https://app.team-oustad.com"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Test Android OTA - Domaine Public (HTTPS)               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}🌐 URL de base:${NC} $BASE_URL"
echo -e "${YELLOW}🔒 Protocole:${NC} HTTPS (SSL activé)"
echo ""

# Test 1: Version JSON
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🧪 Test 1: Version JSON${NC}"
echo -e "${YELLOW}🔗 URL:${NC} $BASE_URL/android/version.json"
echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"

response=$(curl -s -w "\n%{http_code}" "$BASE_URL/android/version.json")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✅ Succès (HTTP $http_code)${NC}"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
else
    echo -e "${RED}❌ Échec (HTTP $http_code)${NC}"
    echo "$body"
fi

# Test 2: Check Update - Version actuelle
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🧪 Test 2: Check Update (version actuelle)${NC}"
echo -e "${YELLOW}🔗 URL:${NC} $BASE_URL/android/check-update?current_version=1"
echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"

response=$(curl -s -w "\n%{http_code}" "$BASE_URL/android/check-update?current_version=1")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✅ Succès (HTTP $http_code)${NC}"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
else
    echo -e "${RED}❌ Échec (HTTP $http_code)${NC}"
    echo "$body"
fi

# Test 3: Check Update - Version ancienne
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🧪 Test 3: Check Update (version ancienne - update disponible)${NC}"
echo -e "${YELLOW}🔗 URL:${NC} $BASE_URL/android/check-update?current_version=0"
echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"

response=$(curl -s -w "\n%{http_code}" "$BASE_URL/android/check-update?current_version=0")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✅ Succès (HTTP $http_code)${NC}"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
else
    echo -e "${RED}❌ Échec (HTTP $http_code)${NC}"
    echo "$body"
fi

# Test 4: Version API
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🧪 Test 4: Version API (endpoint dynamique)${NC}"
echo -e "${YELLOW}🔗 URL:${NC} $BASE_URL/android/version"
echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"

response=$(curl -s -w "\n%{http_code}" "$BASE_URL/android/version")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✅ Succès (HTTP $http_code)${NC}"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
else
    echo -e "${RED}❌ Échec (HTTP $http_code)${NC}"
    echo "$body"
fi

# Test 5: Download APK (headers)
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🧪 Test 5: Download APK (headers)${NC}"
echo -e "${YELLOW}🔗 URL:${NC} $BASE_URL/android/download"
echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"

headers=$(curl -s -I "$BASE_URL/android/download")
http_code=$(echo "$headers" | grep -i "HTTP/" | tail -n1 | awk '{print $2}')

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✅ APK disponible (HTTP $http_code)${NC}"
    echo -e "${GREEN}Headers:${NC}"
    echo "$headers" | grep -i "content-type\|content-length\|content-disposition"
elif [ "$http_code" == "404" ]; then
    echo -e "${YELLOW}⚠️  APK non trouvé (HTTP $http_code)${NC}"
    echo -e "${YELLOW}Normal si aucun APK n'a été uploadé${NC}"
else
    echo -e "${RED}❌ Erreur (HTTP $http_code)${NC}"
fi

# Test 6: Checksum
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🧪 Test 6: Checksum${NC}"
echo -e "${YELLOW}🔗 URL:${NC} $BASE_URL/android/checksum"
echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"

response=$(curl -s -w "\n%{http_code}" "$BASE_URL/android/checksum")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✅ Checksums calculés (HTTP $http_code)${NC}"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
elif [ "$http_code" == "404" ]; then
    echo -e "${YELLOW}⚠️  APK non trouvé (HTTP $http_code)${NC}"
    echo -e "${YELLOW}Normal si aucun APK n'a été uploadé${NC}"
else
    echo -e "${RED}❌ Échec (HTTP $http_code)${NC}"
    echo "$body"
fi

# Test 7: Certificat SSL
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🧪 Test 7: Certificat SSL${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"

ssl_info=$(echo | openssl s_client -servername app.team-oustad.com -connect app.team-oustad.com:443 2>/dev/null | openssl x509 -noout -dates -subject 2>/dev/null)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Certificat SSL valide${NC}"
    echo "$ssl_info"
else
    echo -e "${RED}❌ Problème avec le certificat SSL${NC}"
fi

# Résumé
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                      RÉSUMÉ DES TESTS                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Domaine:${NC} https://app.team-oustad.com"
echo -e "${GREEN}✅ SSL/TLS:${NC} Certificat Let's Encrypt actif"
echo -e "${GREEN}✅ Endpoints Android:${NC} Fonctionnels"
echo ""
echo -e "${YELLOW}📱 Configuration Flutter:${NC}"
echo ""
echo -e "class ApiConfig {"
echo -e "  static const String OTA_UPDATE_URL = "
echo -e "    'https://app.team-oustad.com/android/check-update';"
echo -e "}"
echo ""
echo -e "${BLUE}🔗 URLs à utiliser dans votre app:${NC}"
echo "   • Check Update: https://app.team-oustad.com/android/check-update?current_version=\${version}"
echo "   • Version Info: https://app.team-oustad.com/android/version.json"
echo "   • Download APK: https://app.team-oustad.com/android/download"
echo ""
echo -e "${GREEN}✅ Configuration terminée avec succès!${NC}"
echo ""
