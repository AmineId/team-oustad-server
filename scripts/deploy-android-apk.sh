#!/bin/bash

# Script de déploiement d'une nouvelle version APK pour OTA Updates
# Usage: ./scripts/deploy-android-apk.sh <chemin_vers_apk> <version_code> <version_name> [changelog] [channel]
# Channel: production (default) ou beta

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'affichage
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérifier les arguments
if [ $# -lt 3 ]; then
    log_error "Usage: $0 <chemin_vers_apk> <version_code> <version_name> [changelog] [channel]"
    echo ""
    echo "Exemples:"
    echo "  # Production"
    echo "  $0 ~/flutter/app/build/app/outputs/flutter-apk/app-release.apk 2 \"1.0.1\" \"Corrections de bugs\""
    echo ""
    echo "  # Beta"
    echo "  $0 ~/flutter/app/build/app/outputs/flutter-apk/app-release.apk 2 \"1.0.1-beta.1\" \"Test nouvelles fonctionnalités\" beta"
    exit 1
fi

APK_SOURCE="$1"
VERSION_CODE="$2"
VERSION_NAME="$3"
CHANGELOG="${4:-Nouvelle version de l'application}"
CHANNEL="${5:-production}"

# Valider le canal
if [ "$CHANNEL" != "production" ] && [ "$CHANNEL" != "beta" ]; then
    log_error "Le canal doit être 'production' ou 'beta'"
    exit 1
fi

# Chemins
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ANDROID_BASE_DIR="$PROJECT_ROOT/public/android"

if [ "$CHANNEL" == "beta" ]; then
    ANDROID_DIR="$ANDROID_BASE_DIR/beta"
else
    ANDROID_DIR="$ANDROID_BASE_DIR"
fi

APK_DEST="$ANDROID_DIR/app-release.apk"
VERSION_FILE="$ANDROID_DIR/version.json"
BACKUP_DIR="$ANDROID_DIR/backups"

log_info "Déploiement APK Android OTA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Canal:         $CHANNEL"
echo "APK Source:    $APK_SOURCE"
echo "Version Code:  $VERSION_CODE"
echo "Version Name:  $VERSION_NAME"
echo "Changelog:     $CHANGELOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier que le fichier APK source existe
if [ ! -f "$APK_SOURCE" ]; then
    log_error "Le fichier APK n'existe pas: $APK_SOURCE"
    exit 1
fi

# Créer le répertoire de backup si nécessaire
log_info "Création du répertoire de backup..."
mkdir -p "$BACKUP_DIR"

# Backup de l'ancienne version si elle existe
if [ -f "$APK_DEST" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    OLD_VERSION=$(grep -o '"version_name": "[^"]*' "$VERSION_FILE" | grep -o '[^"]*$' || echo "unknown")
    BACKUP_FILE="$BACKUP_DIR/app-release-${OLD_VERSION}-${TIMESTAMP}.apk"
    
    log_info "Sauvegarde de l'ancienne version: $OLD_VERSION"
    cp "$APK_DEST" "$BACKUP_FILE"
    log_success "Backup créé: $BACKUP_FILE"
    
    # Backup du fichier version.json
    cp "$VERSION_FILE" "$BACKUP_DIR/version-${OLD_VERSION}-${TIMESTAMP}.json"
fi

# Copier le nouveau APK
log_info "Copie du nouveau APK..."
cp "$APK_SOURCE" "$APK_DEST"
log_success "APK copié vers: $APK_DEST"

# Calculer les checksums
log_info "Calcul des checksums..."
MD5_CHECKSUM=$(md5sum "$APK_DEST" | awk '{print $1}')
SHA256_CHECKSUM=$(sha256sum "$APK_DEST" | awk '{print $1}')
FILE_SIZE=$(stat -f%z "$APK_DEST" 2>/dev/null || stat -c%s "$APK_DEST")

log_success "MD5:     $MD5_CHECKSUM"
log_success "SHA256:  $SHA256_CHECKSUM"
log_success "Taille:  $FILE_SIZE bytes ($(($FILE_SIZE / 1024 / 1024)) MB)"

# Générer l'URL de téléchargement
if [ "$CHANNEL" == "beta" ]; then
    DOWNLOAD_URL="${API_URL:-https://app.team-oustad.com}/android/beta/app-release.apk"
else
    DOWNLOAD_URL="${API_URL:-https://app.team-oustad.com}/android/app-release.apk"
fi

# Mettre à jour version.json
log_info "Mise à jour de version.json..."
cat > "$VERSION_FILE" << EOF
{
  "version_code": ${VERSION_CODE},
  "version_name": "${VERSION_NAME}",
  "download_url": "${DOWNLOAD_URL}",
  "changelog": "${CHANGELOG}",
  "min_supported_version": 1,
  "force_update": false,
  "release_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "file_size": ${FILE_SIZE},
  "checksum": "${SHA256_CHECKSUM}",
  "channel": "${CHANNEL}",
  "is_beta": $([ "$CHANNEL" == "beta" ] && echo "true" || echo "false")
}
EOF

log_success "version.json mis à jour"

# Afficher le contenu de version.json
log_info "Contenu de version.json:"
cat "$VERSION_FILE"
echo ""

# Vérifier les permissions
log_info "Vérification des permissions..."
chmod 644 "$APK_DEST"
chmod 644 "$VERSION_FILE"
log_success "Permissions définies (644)"

# Résumé
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "Déploiement terminé avec succès!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "URLs d'accès:"
if [ "$CHANNEL" == "beta" ]; then
    echo "  • Version Info: ${API_URL:-https://app.team-oustad.com}/android/beta/version.json"
    echo "  • Check Update: ${API_URL:-https://app.team-oustad.com}/android/beta/check-update?current_version=1"
    echo "  • Download APK: ${DOWNLOAD_URL}"
else
    echo "  • Version Info: ${API_URL:-https://app.team-oustad.com}/android/version.json"
    echo "  • Check Update: ${API_URL:-https://app.team-oustad.com}/android/check-update?current_version=1"
    echo "  • Download APK: ${DOWNLOAD_URL}"
fi
echo ""
log_info "Prochaines étapes:"
echo "  1. Tester l'accès aux URLs ci-dessus"
echo "  2. Tester la mise à jour depuis l'application mobile"
echo "  3. Surveiller les logs: pm2 logs team-fitness"
echo ""
if [ "$CHANNEL" == "beta" ]; then
    log_info "Canal Beta:"
    echo "  • Cette version est destinée aux beta-testeurs"
    echo "  • Activez le canal beta dans l'app Flutter pour recevoir cette mise à jour"
    echo ""
fi
log_warning "N'oubliez pas de redémarrer le serveur si nécessaire:"
echo "  pm2 restart team-fitness"
echo ""
