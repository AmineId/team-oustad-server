# ✅ CONFIGURATION TERMINÉE - Android OTA Updates

## 🎉 Résumé de l'implémentation

Votre serveur Team Fitness est maintenant entièrement configuré pour gérer les mises à jour OTA (Over-The-Air) de votre application Android !

---

## 📍 URLs disponibles

### URL de base
```
https://app.team-oustam.com/android
```

### Endpoints API

| Endpoint | URL | Description |
|----------|-----|-------------|
| **Version Info** | `https://app.team-oustam.com/android/version.json` | Fichier statique avec métadonnées de version |
| **Check Update** | `https://app.team-oustam.com/android/check-update?current_version=1` | Vérifie si une mise à jour est disponible |
| **Download APK** | `https://app.team-oustam.com/android/download` | Télécharge le fichier APK |
| **Version API** | `https://app.team-oustam.com/android/version` | Retourne les infos de version (API) |
| **Checksum** | `https://app.team-oustam.com/android/checksum` | Calcule les checksums MD5/SHA256 |

---

## 🗂️ Structure créée

```
/root/team-server/db-server/
├── public/
│   └── android/
│       ├── version.json           ✅ Métadonnées de version
│       ├── README.md              ✅ Documentation complète
│       ├── .gitignore             ✅ Ignore les APK
│       └── app-release.apk        ⏳ À ajouter (votre APK)
│
├── routes/
│   └── android.js                 ✅ Routes API pour OTA
│
├── scripts/
│   └── deploy-android-apk.sh      ✅ Script de déploiement automatique
│
└── docs/
    ├── deployment/
    │   └── ANDROID_OTA_QUICKSTART.md  ✅ Guide de démarrage rapide
    └── development/
        └── flutter_ota_service_example.dart  ✅ Exemple code Flutter
```

---

## 🧪 Tests effectués

✅ **Serveur démarré** : Port 3001, PM2 online
✅ **Route `/android` chargée** : Logs confirment le chargement
✅ **Endpoint `version.json`** : Fonctionne correctement
✅ **Endpoint `check-update`** : Retourne la bonne réponse
✅ **Format JSON valide** : Testé et vérifié

### Résultat du test check-update
```bash
$ curl "http://localhost:3001/android/check-update?current_version=1"
{"update_available":false,"current_version":1,"latest_version":null}
```

✅ **PARFAIT !** Le serveur détecte correctement qu'aucune mise à jour n'est nécessaire.

---

## 📱 Configuration Flutter

### 1. Constantes à ajouter dans votre app

```dart
// lib/config/api_config.dart
class ApiConfig {
  static const String BASE_URL = 'https://app.team-oustam.com';
  static const String OTA_CHECK_URL = '$BASE_URL/android/check-update';
  static const String OTA_VERSION_URL = '$BASE_URL/android/version.json';
}
```

### 2. Code complet disponible

Un exemple complet d'intégration Flutter est disponible dans :
```
docs/development/flutter_ota_service_example.dart
```

Ce fichier contient :
- ✅ Service OTA complet avec toutes les fonctionnalités
- ✅ Gestion des permissions Android
- ✅ Téléchargement avec barre de progression
- ✅ Vérification de checksum
- ✅ Installation automatique
- ✅ Widgets UI prêts à l'emploi (dialogues, bannières)

### 3. Permissions Android requises

Ajoutez dans `android/app/src/main/AndroidManifest.xml` :

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" 
                 android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" 
                 android:maxSdkVersion="32" />
```

### 4. Dépendances Flutter à ajouter

```yaml
# pubspec.yaml
dependencies:
  http: ^1.1.0
  package_info_plus: ^5.0.0
  shared_preferences: ^2.2.0
  path_provider: ^2.1.0
  permission_handler: ^11.0.0
  open_file: ^3.3.0
  crypto: ^3.0.3
```

---

## 🚀 Déployer une nouvelle version APK

### Méthode automatique (Recommandée)

```bash
# 1. Générer l'APK depuis Flutter
cd /chemin/vers/flutter/app
flutter build apk --release

# 2. Déployer avec le script
cd /root/team-server/db-server
./scripts/deploy-android-apk.sh \
  ~/flutter/app/build/app/outputs/flutter-apk/app-release.apk \
  2 \
  "1.0.1" \
  "Corrections de bugs et nouvelles fonctionnalités"

# 3. Redémarrer le serveur
pm2 restart teamfitness-preprod
```

Le script automatique va :
- ✅ Sauvegarder l'ancienne version
- ✅ Copier le nouveau APK
- ✅ Calculer les checksums (MD5 + SHA256)
- ✅ Mettre à jour version.json
- ✅ Définir les bonnes permissions

---

## 🎯 Format de réponse API

### GET /android/check-update?current_version=1

**Aucune mise à jour disponible :**
```json
{
  "update_available": false,
  "current_version": 1,
  "latest_version": null
}
```

**Mise à jour disponible :**
```json
{
  "update_available": true,
  "current_version": 1,
  "latest_version": {
    "version_code": 2,
    "version_name": "1.0.1",
    "download_url": "https://app.team-oustam.com/android/app-release.apk",
    "changelog": "Corrections de bugs et améliorations",
    "force_update": false,
    "file_size": 25000000,
    "checksum": "abc123...",
    "release_date": "2025-11-15T12:00:00Z"
  }
}
```

**Mise à jour obligatoire (force_update: true) :**
- L'utilisateur ne pourra pas utiliser l'app sans mettre à jour
- Se déclenche quand `current_version < min_supported_version`

---

## 📚 Documentation disponible

| Document | Emplacement | Description |
|----------|-------------|-------------|
| **Guide complet** | `public/android/README.md` | Tout sur la configuration OTA |
| **Quick Start** | `docs/deployment/ANDROID_OTA_QUICKSTART.md` | Guide de démarrage rapide |
| **Exemple Flutter** | `docs/development/flutter_ota_service_example.dart` | Code Flutter complet |
| **Swagger API** | `https://app.team-oustam.com/api-docs` | Documentation API interactive |

---

## 🔒 Sécurité

### Fonctionnalités de sécurité implémentées

✅ **Vérification de checksum** : SHA256 calculé automatiquement
✅ **HTTPS uniquement** : Toutes les URLs utilisent HTTPS
✅ **Signature APK** : Vérifiée par Android lors de l'installation
✅ **Permissions Android** : Demandées à l'utilisateur
✅ **Force update** : Possibilité de forcer la mise à jour si version trop ancienne
✅ **Limite de vérification** : Maximum une fois par 24h pour économiser la bande passante

---

## ⏰ Vérification automatique

Le service Flutter vérifie automatiquement :
- ✅ Au démarrage de l'application
- ✅ Maximum une fois par 24 heures
- ✅ Peut être désactivé avec `auto_update_enabled` dans SharedPreferences

---

## 🛠️ Commandes utiles

### Gestion du serveur
```bash
# Redémarrer
pm2 restart teamfitness-preprod

# Voir les logs
pm2 logs teamfitness-preprod

# Status
pm2 status
```

### Tests des endpoints
```bash
# Test version.json
curl https://app.team-oustam.com/android/version.json

# Test check-update
curl "https://app.team-oustam.com/android/check-update?current_version=1"

# Test téléchargement (headers seulement)
curl -I https://app.team-oustam.com/android/download

# Calculer checksum d'un APK
sha256sum /root/team-server/db-server/public/android/app-release.apk
```

---

## 📊 Monitoring

### Logs serveur
```bash
# Logs en temps réel
pm2 logs teamfitness-preprod --lines 100

# Logs OTA spécifiquement
pm2 logs teamfitness-preprod | grep "OTA"
```

### Métriques à surveiller
- Nombre de vérifications de mise à jour
- Nombre de téléchargements d'APK
- Versions actuelles des utilisateurs
- Taux de succès des installations

---

## 🆘 Dépannage

### Problème : APK ne se télécharge pas

```bash
# 1. Vérifier que le fichier existe
ls -lh /root/team-server/db-server/public/android/app-release.apk

# 2. Vérifier les permissions
chmod 644 /root/team-server/db-server/public/android/app-release.apk

# 3. Tester l'accès
curl -I https://app.team-oustam.com/android/app-release.apk

# 4. Vérifier les logs
pm2 logs teamfitness-preprod
```

### Problème : version.json non accessible

```bash
# 1. Valider le JSON
cat /root/team-server/db-server/public/android/version.json | jq

# 2. Tester l'accès
curl https://app.team-oustam.com/android/version.json

# 3. Vérifier les permissions
ls -l /root/team-server/db-server/public/android/
```

---

## ✅ Checklist avant production

- [ ] APK signé et généré correctement
- [ ] APK copié dans `/root/team-server/db-server/public/android/`
- [ ] Permissions 644 sur tous les fichiers
- [ ] version.json mis à jour avec les bonnes infos
- [ ] Checksum calculé et vérifié
- [ ] Serveur redémarré (`pm2 restart teamfitness-preprod`)
- [ ] Test de `version.json` depuis l'URL publique
- [ ] Test de `check-update` depuis l'URL publique
- [ ] Test de téléchargement depuis l'app Flutter
- [ ] Permissions Android configurées dans AndroidManifest.xml
- [ ] Service OTA implémenté dans l'app Flutter
- [ ] Test sur appareil réel (pas seulement émulateur)
- [ ] Monitoring activé (`pm2 logs`)

---

## 🎉 Prochaines étapes

1. **Générer votre premier APK**
   ```bash
   cd /chemin/vers/flutter/app
   flutter build apk --release
   ```

2. **Déployer l'APK sur le serveur**
   ```bash
   ./scripts/deploy-android-apk.sh <chemin_apk> 1 "1.0.0" "Version initiale"
   ```

3. **Intégrer le service OTA dans Flutter**
   - Copier le code depuis `docs/development/flutter_ota_service_example.dart`
   - Ajouter les dépendances dans `pubspec.yaml`
   - Configurer les permissions dans `AndroidManifest.xml`

4. **Tester**
   - Installer l'app version 1.0.0
   - Déployer la version 1.0.1
   - Vérifier que la notification de mise à jour apparaît
   - Tester le téléchargement et l'installation

---

## 📞 Support

Pour toute question ou problème :
- 📖 Consultez la documentation dans `public/android/README.md`
- 🔍 Vérifiez les logs : `pm2 logs teamfitness-preprod`
- 📚 Swagger API : `https://app.team-oustam.com/api-docs`

---

## 🏆 Félicitations !

Votre système de mise à jour OTA est maintenant opérationnel ! 

Les utilisateurs de votre application pourront recevoir automatiquement les notifications de mises à jour et installer les nouvelles versions sans passer par le Play Store.

**Dernière mise à jour** : 15 novembre 2025
**Serveur** : app.team-oustam.com (Port 3001)
**Status** : ✅ OPÉRATIONNEL
