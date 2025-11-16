# 📤 Android OTA - API d'Upload d'APK

## Vue d'ensemble

L'API d'upload permet de déployer de nouvelles versions d'APK directement via HTTP, sans accès SSH au serveur. C'est idéal pour :

- 🔄 **CI/CD automatique** : Déploiement depuis GitHub Actions, GitLab CI, etc.
- 🖥️ **Interface web** : Créer un dashboard d'administration
- 📱 **Upload depuis mobile** : Application d'administration pour gérer les versions
- 🚀 **Déploiement rapide** : Upload en une seule requête HTTP

## 🔐 Authentification

L'endpoint `/android/upload` nécessite une authentification JWT (JSON Web Token).

**Header requis :**
```
Authorization: Bearer <votre-jwt-token>
```

**Rôles autorisés :**
- `owner` ✅
- `admin` ✅
- `member` ❌

## 📡 Endpoint

```
POST https://app.team-oustad.com/android/upload
```

**Content-Type :** `multipart/form-data`

## 📋 Paramètres

| Paramètre | Type | Requis | Description | Exemple |
|-----------|------|--------|-------------|---------|
| `apk` | File | ✅ | Fichier APK | `app-release.apk` |
| `version_code` | Integer | ✅ | Code de version (numérique incrémental) | `2` |
| `version_name` | String | ✅ | Nom de version (semantic versioning) | `"1.0.1"` |
| `changelog` | String | ❌ | Description des changements | `"Bug fixes and improvements"` |
| `min_supported_version` | Integer | ❌ | Version minimale supportée (force update) | `1` |
| `force_update` | Boolean | ❌ | Forcer la mise à jour | `false` |
| `channel` | String | ❌ | Canal de déploiement (`production` ou `beta`) | `"production"` |

## 📦 Canaux de Déploiement

### 🟢 Production (par défaut)
- **URL :** `channel=production` (ou omis)
- **Destination :** `public/android/`
- **Public :** Tous les utilisateurs
- **Version :** Versions stables (ex: `1.0.0`, `1.0.1`)

### 🔶 Beta
- **URL :** `channel=beta`
- **Destination :** `public/android/beta/`
- **Public :** Beta-testeurs
- **Version :** Versions de test (ex: `1.0.0-beta.1`, `1.0.1-rc.1`)

## 📝 Exemples d'utilisation

### 1️⃣ Avec cURL (Ligne de commande)

#### Production
```bash
curl -X POST "https://app.team-oustad.com/android/upload" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -F "apk=@app-release.apk" \
  -F "version_code=2" \
  -F "version_name=1.0.1" \
  -F "changelog=Bug fixes and performance improvements" \
  -F "channel=production"
```

#### Beta
```bash
curl -X POST "https://app.team-oustad.com/android/upload" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -F "apk=@app-release.apk" \
  -F "version_code=3" \
  -F "version_name=1.0.2-beta.1" \
  -F "changelog=Testing new features" \
  -F "channel=beta"
```

### 2️⃣ Avec le Script Shell

```bash
# Production
./scripts/upload-apk.sh \
  app-release.apk \
  2 \
  "1.0.1" \
  "Bug fixes and improvements" \
  production \
  "your-jwt-token"

# Beta
./scripts/upload-apk.sh \
  app-release.apk \
  3 \
  "1.0.2-beta.1" \
  "Testing new features" \
  beta \
  "your-jwt-token"
```

### 3️⃣ Avec JavaScript/Node.js

```javascript
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function uploadAPK() {
  const form = new FormData();
  form.append('apk', fs.createReadStream('app-release.apk'));
  form.append('version_code', '2');
  form.append('version_name', '1.0.1');
  form.append('changelog', 'Bug fixes and improvements');
  form.append('channel', 'production');

  const response = await axios.post(
    'https://app.team-oustad.com/android/upload',
    form,
    {
      headers: {
        ...form.getHeaders(),
        'Authorization': 'Bearer your-jwt-token'
      }
    }
  );

  console.log(response.data);
}

uploadAPK();
```

### 4️⃣ Avec Python

```python
import requests

def upload_apk():
    url = 'https://app.team-oustad.com/android/upload'
    
    files = {
        'apk': open('app-release.apk', 'rb')
    }
    
    data = {
        'version_code': '2',
        'version_name': '1.0.1',
        'changelog': 'Bug fixes and improvements',
        'channel': 'production'
    }
    
    headers = {
        'Authorization': 'Bearer your-jwt-token'
    }
    
    response = requests.post(url, files=files, data=data, headers=headers)
    print(response.json())

upload_apk()
```

### 5️⃣ Avec GitHub Actions

```yaml
name: Deploy APK

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build APK
        run: ./gradlew assembleRelease
      
      - name: Get version info
        id: version
        run: |
          VERSION_NAME=$(cat version.txt)
          VERSION_CODE=$(cat version_code.txt)
          echo "version_name=$VERSION_NAME" >> $GITHUB_OUTPUT
          echo "version_code=$VERSION_CODE" >> $GITHUB_OUTPUT
      
      - name: Upload to OTA Server
        run: |
          curl -X POST "https://app.team-oustad.com/android/upload" \
            -H "Authorization: Bearer ${{ secrets.OTA_API_TOKEN }}" \
            -F "apk=@app/build/outputs/apk/release/app-release.apk" \
            -F "version_code=${{ steps.version.outputs.version_code }}" \
            -F "version_name=${{ steps.version.outputs.version_name }}" \
            -F "changelog=Release ${{ steps.version.outputs.version_name }}" \
            -F "channel=production"
```

## ✅ Réponse de succès

**Status Code :** `200 OK`

```json
{
  "message": "APK uploaded successfully to production channel",
  "version": {
    "version_code": 2,
    "version_name": "1.0.1",
    "download_url": "https://app.team-oustad.com/android/app-release.apk",
    "changelog": "Bug fixes and performance improvements",
    "min_supported_version": 1,
    "force_update": false,
    "release_date": "2025-11-15T12:30:00.000Z",
    "file_size": 25000000,
    "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  "checksums": {
    "md5": "d41d8cd98f00b204e9800998ecf8427e",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
}
```

## ❌ Erreurs possibles

### 400 Bad Request
```json
{
  "error": "version_code and version_name are required"
}
```

**Causes :**
- Paramètres manquants
- Fichier APK manquant
- Canal invalide (doit être `production` ou `beta`)

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

**Causes :**
- Token JWT manquant
- Token JWT expiré
- Token JWT invalide

### 403 Forbidden
```json
{
  "error": "Insufficient permissions"
}
```

**Causes :**
- Rôle insuffisant (member)
- Token valide mais pas de permissions d'upload

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Erreur détaillée..."
}
```

**Causes :**
- Erreur serveur
- Problème d'écriture disque
- Fichier corrompu

## 🔄 Workflow complet

### 1️⃣ Développement local
```bash
# Compiler l'APK
cd ~/flutter/app
flutter build apk --release

# Tester l'upload
cd ~/team-server/db-server
./scripts/upload-apk.sh \
  ~/flutter/app/build/app/outputs/flutter-apk/app-release.apk \
  2 \
  "1.0.1" \
  "Bug fixes" \
  production \
  "$MY_JWT_TOKEN"
```

### 2️⃣ Beta Testing
```bash
# Upload vers le canal beta
./scripts/upload-apk.sh \
  app-release.apk \
  3 \
  "1.0.2-beta.1" \
  "Testing new feature X" \
  beta \
  "$MY_JWT_TOKEN"

# Les beta-testeurs reçoivent la mise à jour
```

### 3️⃣ Production Release
```bash
# Une fois la beta validée, upload en production
./scripts/upload-apk.sh \
  app-release.apk \
  3 \
  "1.0.2" \
  "New feature X released" \
  production \
  "$MY_JWT_TOKEN"

# Tous les utilisateurs reçoivent la mise à jour
```

## 🔐 Sécurité

### Obtenir un Token JWT

**Méthode 1 : Via l'API Login**
```bash
curl -X POST "https://app.team-oustad.com/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'
```

Réponse :
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "role": "admin",
    ...
  }
}
```

**Méthode 2 : Token de longue durée**

Créez un token spécifique pour le CI/CD avec une durée de validité longue :

```javascript
// Dans votre base de code serveur
const jwt = require('jsonwebtoken');

const cicdToken = jwt.sign(
  { 
    userId: 1, 
    role: 'owner',
    purpose: 'cicd'
  },
  process.env.JWT_SECRET,
  { expiresIn: '365d' } // 1 an
);

console.log('CI/CD Token:', cicdToken);
```

Stockez ce token dans :
- GitHub Secrets (`OTA_API_TOKEN`)
- GitLab CI/CD Variables
- Variables d'environnement du serveur CI

### Permissions requises

| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| Upload APK | ✅ | ✅ | ❌ |
| Upload Beta | ✅ | ✅ | ❌ |
| Check Update | ✅ | ✅ | ✅ |
| Download APK | ✅ | ✅ | ✅ |

## 📊 Monitoring

Les uploads sont loggés dans PM2 :

```bash
# Voir les logs en temps réel
pm2 logs teamfitness-preprod

# Logs d'upload
pm2 logs teamfitness-preprod | grep "Uploading APK"

# Filtrer par canal
pm2 logs teamfitness-preprod | grep "beta channel"
```

**Exemple de log :**
```
📤 Uploading APK to production channel...
   Version: 1.0.1 (2)
   File: app-release.apk (25000000 bytes)
   ✅ Old version backed up
✅ APK uploaded successfully to production channel
   MD5: d41d8cd98f00b204e9800998ecf8427e
   SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## 🧪 Tests

### Test manuel
```bash
# Créer un fichier APK de test (vide)
touch test.apk

# Tester l'upload
curl -X POST "http://localhost:3001/android/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "apk=@test.apk" \
  -F "version_code=999" \
  -F "version_name=0.0.1-test" \
  -F "changelog=Test upload" \
  -F "channel=beta"
```

### Test automatisé
```bash
# Script de test
./scripts/test-upload-api.sh
```

## 📚 Ressources

- **Swagger UI :** https://app.team-oustad.com/api-docs
- **Script d'upload :** `scripts/upload-apk.sh`
- **Documentation OTA :** `docs/api/ANDROID_OTA_SETUP_COMPLETE.md`
- **Configuration Nginx :** `/etc/nginx/sites-available/app.team-oustad.com`

## 🆘 Dépannage

### Erreur : "Only APK files are allowed"
**Solution :** Vérifiez que le fichier est bien un APK et a l'extension `.apk`

### Erreur : "File too large"
**Solution :** Limite actuelle = 200 MB. Modifiez dans `routes/android.js` :
```javascript
limits: {
  fileSize: 200 * 1024 * 1024 // Augmenter si nécessaire
}
```

Et dans Nginx (`/etc/nginx/sites-available/app.team-oustad.com`) :
```nginx
client_max_body_size 200M; # Augmenter si nécessaire
```

### Erreur : "Unauthorized"
**Solution :** 
1. Vérifiez que le token est valide
2. Vérifiez que le header `Authorization` est bien formaté
3. Vérifiez que l'utilisateur a le rôle `admin` ou `owner`

### Upload très lent
**Solutions :**
- Vérifier la connexion réseau
- Compresser l'APK si possible
- Utiliser ProGuard/R8 pour réduire la taille
- Vérifier la bande passante serveur

## 🎯 Prochaines étapes

1. ✅ Tester l'upload via cURL
2. ✅ Intégrer dans un script CI/CD
3. ✅ Créer un dashboard web d'administration
4. ✅ Ajouter des statistiques d'upload
5. ✅ Notification automatique aux utilisateurs après upload

---

**Documentation mise à jour le :** 15 novembre 2025  
**Version API :** 1.0.0
