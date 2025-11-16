#!/bin/bash

# ==========================================
# Script de Génération de Token API
# ==========================================
#
# Ce script génère un token JWT de longue durée pour l'upload APK
# Utilisable pour CI/CD (GitHub Actions, GitLab CI, etc.)
#
# Usage: ./generate-api-token.sh <user_email> [duration]
#
# Exemples:
#   ./generate-api-token.sh admin@example.com
#   ./generate-api-token.sh admin@example.com 365d

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
API_URL="https://app.team-oustad.com/auth/login"
# Fallback to localhost
# API_URL="http://localhost:3001/auth/login"

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   🔐  Générateur de Token API pour Upload APK${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Vérifier si l'email est fourni
if [ -z "$1" ]; then
  echo -e "${YELLOW}Usage: $0 <user_email> [password]${NC}"
  echo ""
  echo "Exemple:"
  echo "  $0 admin@example.com"
  echo ""
  exit 1
fi

USER_EMAIL="$1"
USER_PASSWORD="$2"

echo -e "${CYAN}📧 Email utilisateur:${NC} $USER_EMAIL"
echo ""

# Demander le mot de passe si non fourni
if [ -z "$USER_PASSWORD" ]; then
  echo -e "${YELLOW}🔑 Entrez le mot de passe pour $USER_EMAIL:${NC}"
  read -s USER_PASSWORD
  echo ""
fi

echo -e "${BLUE}🔄 Connexion à l'API...${NC}"
echo ""

# Faire la requête de login
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}" \
  -w "\nHTTP_STATUS:%{http_code}")

# Extraire le status HTTP
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Connexion réussie !${NC}"
  echo ""
  
  # Extraire le token
  TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  
  # Extraire les infos utilisateur
  USER_ROLE=$(echo "$BODY" | grep -o '"role":"[^"]*"' | cut -d'"' -f4)
  USER_NAME=$(echo "$BODY" | grep -o '"fullName":"[^"]*"' | cut -d'"' -f4)
  USER_ID=$(echo "$BODY" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  
  # Afficher les informations
  echo -e "${CYAN}👤 Utilisateur:${NC} $USER_NAME"
  echo -e "${CYAN}🎭 Rôle:${NC} $USER_ROLE"
  echo -e "${CYAN}🆔 ID:${NC} $USER_ID"
  echo ""
  
  # Vérifier les permissions
  if [ "$USER_ROLE" = "admin" ] || [ "$USER_ROLE" = "owner" ]; then
    echo -e "${GREEN}✅ Permissions suffisantes pour uploader des APK${NC}"
  else
    echo -e "${RED}⚠️  ATTENTION: Le rôle '$USER_ROLE' n'a pas les permissions d'upload${NC}"
    echo -e "${YELLOW}   Seuls les rôles 'admin' et 'owner' peuvent uploader des APK${NC}"
  fi
  
  echo ""
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}   🎫  TOKEN API GÉNÉRÉ${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${YELLOW}⚠️  IMPORTANT: Gardez ce token en sécurité !${NC}"
  echo ""
  echo -e "${CYAN}Token JWT:${NC}"
  echo "$TOKEN"
  echo ""
  
  # Créer un fichier .env.upload si demandé
  read -p "Sauvegarder dans un fichier .env.upload ? (y/n) " -n 1 -r
  echo ""
  
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "# Token API pour upload APK" > .env.upload
    echo "# Généré le: $(date)" >> .env.upload
    echo "# Utilisateur: $USER_EMAIL ($USER_ROLE)" >> .env.upload
    echo "" >> .env.upload
    echo "OTA_API_TOKEN=$TOKEN" >> .env.upload
    echo "OTA_USER_EMAIL=$USER_EMAIL" >> .env.upload
    echo "OTA_USER_ROLE=$USER_ROLE" >> .env.upload
    
    echo -e "${GREEN}✅ Token sauvegardé dans .env.upload${NC}"
    echo ""
  fi
  
  # Instructions d'utilisation
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}   📋  UTILISATION${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${CYAN}1️⃣  Avec cURL:${NC}"
  echo ""
  echo "curl -X POST \"https://app.team-oustad.com/android/upload\" \\"
  echo "  -H \"Authorization: Bearer $TOKEN\" \\"
  echo "  -F \"apk=@app-release.apk\" \\"
  echo "  -F \"version_code=2\" \\"
  echo "  -F \"version_name=1.0.1\" \\"
  echo "  -F \"changelog=Bug fixes\" \\"
  echo "  -F \"channel=production\""
  echo ""
  
  echo -e "${CYAN}2️⃣  Avec le script upload-apk.sh:${NC}"
  echo ""
  echo "./scripts/upload-apk.sh \\"
  echo "  app-release.apk \\"
  echo "  2 \\"
  echo "  \"1.0.1\" \\"
  echo "  \"Bug fixes\" \\"
  echo "  production \\"
  echo "  \"$TOKEN\""
  echo ""
  
  echo -e "${CYAN}3️⃣  Dans GitHub Actions:${NC}"
  echo ""
  echo "# Ajoutez le token dans les secrets GitHub:"
  echo "# Settings → Secrets → New repository secret"
  echo "# Name: OTA_API_TOKEN"
  echo "# Value: $TOKEN"
  echo ""
  echo "# Puis dans votre workflow:"
  echo "- name: Upload APK"
  echo "  run: |"
  echo "    curl -X POST \"https://app.team-oustad.com/android/upload\" \\"
  echo "      -H \"Authorization: Bearer \${{ secrets.OTA_API_TOKEN }}\" \\"
  echo "      -F \"apk=@app/build/outputs/apk/release/app-release.apk\" \\"
  echo "      -F \"version_code=\${{ github.run_number }}\" \\"
  echo "      -F \"version_name=\${{ github.ref_name }}\" \\"
  echo "      -F \"changelog=Release \${{ github.ref_name }}\" \\"
  echo "      -F \"channel=production\""
  echo ""
  
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}⚠️  SÉCURITÉ${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "• Ne partagez jamais ce token publiquement"
  echo "• Ne le commitez pas dans Git"
  echo "• Utilisez des variables d'environnement ou secrets"
  echo "• Changez le token si compromis (nouveau login)"
  echo "• Le token expire selon la config JWT_SECRET du serveur"
  echo ""
  
  exit 0
else
  echo -e "${RED}❌ Échec de la connexion${NC}"
  echo -e "${RED}   HTTP Status: $HTTP_STATUS${NC}"
  echo ""
  
  # Essayer d'extraire le message d'erreur
  ERROR_MSG=$(echo "$BODY" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
  
  if [ -n "$ERROR_MSG" ]; then
    echo -e "${YELLOW}Erreur: $ERROR_MSG${NC}"
  fi
  
  if [ "$HTTP_STATUS" = "400" ]; then
    echo -e "${YELLOW}Vérifiez vos identifiants (email et mot de passe)${NC}"
  elif [ "$HTTP_STATUS" = "404" ]; then
    echo -e "${YELLOW}Utilisateur non trouvé${NC}"
  elif [ "$HTTP_STATUS" = "500" ]; then
    echo -e "${YELLOW}Erreur serveur - Vérifiez la configuration${NC}"
  fi
  
  echo ""
  exit 1
fi
