#!/bin/bash

# ==========================================
# Script d'Upload d'APK via API
# ==========================================
# 
# Usage: ./upload-apk.sh <apk_file> <version_code> <version_name> [changelog] [channel] [token]
#
# Exemples:
#   ./upload-apk.sh app-release.apk 2 "1.0.1" "Bug fixes" production "your-jwt-token"
#   ./upload-apk.sh app-release.apk 2 "1.0.1-beta.1" "Test features" beta "your-jwt-token"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vérifier les arguments
if [ "$#" -lt 3 ]; then
  echo -e "${RED}❌ Usage: $0 <apk_file> <version_code> <version_name> [changelog] [channel] [token]${NC}"
  echo ""
  echo "Arguments:"
  echo "  apk_file        - Chemin vers le fichier APK"
  echo "  version_code    - Code de version (entier, ex: 2)"
  echo "  version_name    - Nom de version (ex: 1.0.1 ou 1.0.1-beta.1)"
  echo "  changelog       - Description des changements (optionnel)"
  echo "  channel         - Canal de déploiement: production ou beta (défaut: production)"
  echo "  token           - JWT token d'authentification (optionnel si .env existe)"
  echo ""
  echo "Exemples:"
  echo "  $0 app.apk 2 \"1.0.1\" \"Bug fixes\" production"
  echo "  $0 app.apk 3 \"1.0.2-beta.1\" \"New features\" beta"
  exit 1
fi

APK_FILE="$1"
VERSION_CODE="$2"
VERSION_NAME="$3"
CHANGELOG="${4:-No changelog provided}"
CHANNEL="${5:-production}"
TOKEN="${6:-}"

# Configuration
API_URL="https://app.team-oustad.com/android/upload"
# Fallback to localhost if HTTPS not available
# API_URL="http://localhost:3001/android/upload"

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   📤  Upload APK via API${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Vérifier si le fichier APK existe
if [ ! -f "$APK_FILE" ]; then
  echo -e "${RED}❌ Erreur: Fichier APK non trouvé: $APK_FILE${NC}"
  exit 1
fi

# Vérifier la taille du fichier
FILE_SIZE=$(stat -c%s "$APK_FILE" 2>/dev/null || stat -f%z "$APK_FILE" 2>/dev/null)
FILE_SIZE_MB=$((FILE_SIZE / 1024 / 1024))

echo -e "${GREEN}📱 Fichier APK:${NC} $APK_FILE"
echo -e "${GREEN}📏 Taille:${NC} $FILE_SIZE_MB MB"
echo -e "${GREEN}🔢 Version Code:${NC} $VERSION_CODE"
echo -e "${GREEN}📝 Version Name:${NC} $VERSION_NAME"
echo -e "${GREEN}📋 Changelog:${NC} $CHANGELOG"
echo -e "${GREEN}📡 Canal:${NC} $CHANNEL"
echo ""

# Si le token n'est pas fourni, essayer de le récupérer depuis .env ou demander
if [ -z "$TOKEN" ]; then
  # Essayer de charger depuis .env
  if [ -f ".env" ]; then
    # Vous pouvez stocker un token de test dans .env
    # TEST_TOKEN=your-jwt-token-here
    source .env 2>/dev/null
    TOKEN="$TEST_TOKEN"
  fi
  
  if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}⚠️  Pas de token d'authentification fourni${NC}"
    echo -e "${YELLOW}   L'upload nécessite un token JWT valide (admin/owner)${NC}"
    echo ""
    read -p "Entrez votre token JWT (ou appuyez sur Entrée pour tester sans auth): " TOKEN
    echo ""
  fi
fi

# Construire la commande curl
CURL_CMD="curl -X POST \"$API_URL\" \
  -F \"apk=@$APK_FILE\" \
  -F \"version_code=$VERSION_CODE\" \
  -F \"version_name=$VERSION_NAME\" \
  -F \"changelog=$CHANGELOG\" \
  -F \"channel=$CHANNEL\""

# Ajouter le header d'authentification si token fourni
if [ -n "$TOKEN" ]; then
  CURL_CMD="$CURL_CMD -H \"Authorization: Bearer $TOKEN\""
fi

# Ajouter les options de sortie
CURL_CMD="$CURL_CMD -w \"\n\nHTTP Status: %{http_code}\n\" -s"

echo -e "${BLUE}🚀 Upload en cours...${NC}"
echo ""

# Exécuter la commande
RESPONSE=$(eval $CURL_CMD)

# Afficher la réponse
echo "$RESPONSE"
echo ""

# Vérifier le statut HTTP
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP Status:" | awk '{print $3}')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ APK uploadé avec succès !${NC}"
  echo ""
  
  # Extraire et afficher les informations de version
  VERSION_INFO=$(echo "$RESPONSE" | grep -o '"version_name":"[^"]*"' | cut -d'"' -f4)
  DOWNLOAD_URL=$(echo "$RESPONSE" | grep -o '"download_url":"[^"]*"' | cut -d'"' -f4)
  
  if [ -n "$VERSION_INFO" ]; then
    echo -e "${GREEN}📦 Version:${NC} $VERSION_INFO"
  fi
  
  if [ -n "$DOWNLOAD_URL" ]; then
    echo -e "${GREEN}🔗 URL de téléchargement:${NC} $DOWNLOAD_URL"
  fi
  
  echo ""
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}   ✅ Upload terminé avec succès !${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
  
  exit 0
else
  echo -e "${RED}❌ Erreur lors de l'upload${NC}"
  echo -e "${RED}   HTTP Status: $HTTP_STATUS${NC}"
  
  if [ "$HTTP_STATUS" = "401" ]; then
    echo -e "${YELLOW}   → Authentication requise. Fournissez un token JWT valide.${NC}"
  elif [ "$HTTP_STATUS" = "400" ]; then
    echo -e "${YELLOW}   → Paramètres invalides. Vérifiez les arguments.${NC}"
  fi
  
  exit 1
fi
