# 📱 Répertoire Android OTA Updates

Ce répertoire contient les fichiers nécessaires pour les mises à jour OTA (Over-The-Air) de l'application Android Team Fitness.

## 📂 Structure

```
android/
├── version.json          # Métadonnées de version actuelle
├── app-release.apk       # Fichier APK de l'application (à ajouter)
└── README.md            # Ce fichier
```

## 🔄 Configuration OTA Update

### URL d'accès
- **URL de vérification**: `https://app.team-oustam.com/android/version.json`
- **URL de téléchargement**: `https://app.team-oustam.com/android/app-release.apk`

### Format de réponse API (version.json)

```json
{
  "version_code": 1,
  "version_name": "1.0.0",
  "download_url": "https://app.team-oustam.com/android/app-release.apk",
  "changelog": "Version initiale de l'application Team Fitness",
  "min_supported_version": 1,
  "force_update": false,
  "release_date": "2025-11-15T00:00:00Z",
  "file_size": 0,
  "checksum": ""
}
```

### Champs du fichier version.json

- **version_code** (int): Code de version incrémental (1, 2, 3, ...)
- **version_name** (string): Nom de version lisible (1.0.0, 1.0.1, ...)
- **download_url** (string): URL complète de téléchargement de l'APK
- **changelog** (string): Description des changements de cette version
- **min_supported_version** (int): Version minimale supportée (pour forcer la mise à jour)
- **force_update** (bool): Si true, l'utilisateur doit mettre à jour
- **release_date** (string): Date de publication au format ISO 8601
- **file_size** (int): Taille du fichier APK en octets
- **checksum** (string): Hash MD5 ou SHA256 du fichier APK pour vérification

## 🚀 Déploiement d'une nouvelle version

### 1. Générer l'APK depuis Flutter

```bash
cd /chemin/vers/flutter/app
flutter build apk --release
```

### 2. Copier l'APK vers le serveur

```bash
# L'APK se trouve dans: build/app/outputs/flutter-apk/app-release.apk
scp build/app/outputs/flutter-apk/app-release.apk user@app.team-oustam.com:/root/team-server/db-server/public/android/
```

### 3. Mettre à jour version.json

Éditez `/root/team-server/db-server/public/android/version.json` :

```json
{
  "version_code": 2,
  "version_name": "1.0.1",
  "download_url": "https://app.team-oustam.com/android/app-release.apk",
  "changelog": "- Correction de bugs\n- Amélioration des performances\n- Nouvelles fonctionnalités",
  "min_supported_version": 1,
  "force_update": false,
  "release_date": "2025-11-15T12:00:00Z",
  "file_size": 25000000,
  "checksum": "abc123def456"
}
```

### 4. Calculer le checksum (optionnel mais recommandé)

```bash
md5sum app-release.apk
# ou
sha256sum app-release.apk
```

### 5. Redémarrer le serveur (si nécessaire)

```bash
pm2 restart team-fitness
```

## 📱 Configuration côté Flutter

### Variables d'environnement

```dart
// Dans votre app Flutter
static const String OTA_UPDATE_URL = 'https://app.team-oustam.com/android/version.json';
```

### Permissions requises (AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" 
                 android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" 
                 android:maxSdkVersion="32" />
```

## 🔒 Sécurité

### Vérifications recommandées

1. **Checksum**: Toujours vérifier le checksum après téléchargement
2. **HTTPS**: Utiliser uniquement HTTPS pour les téléchargements
3. **Signature**: Vérifier que l'APK est signé avec votre certificat
4. **Version**: Vérifier que version_code > version actuelle

### Exemple de vérification

```dart
Future<bool> verifyAPK(File apkFile, String expectedChecksum) async {
  final bytes = await apkFile.readAsBytes();
  final digest = md5.convert(bytes);
  return digest.toString() == expectedChecksum;
}
```

## 🧪 Tests

### Tester l'accès aux fichiers

```bash
# Vérifier version.json
curl https://app.team-oustam.com/android/version.json

# Vérifier l'APK (devrait retourner le fichier)
curl -I https://app.team-oustam.com/android/app-release.apk
```

### Tester depuis l'émulateur

```bash
# Si vous testez en local
adb reverse tcp:3000 tcp:3000
# Puis utilisez http://localhost:3000/android/version.json
```

## ⏰ Vérification automatique

Le service dans l'app vérifie automatiquement :
- Au démarrage de l'app
- Maximum une fois par 24h
- Peut être désactivé avec `auto_update_enabled` dans SharedPreferences

## 📊 Monitoring

### Logs serveur

Les accès aux fichiers sont loggés par Express :

```bash
pm2 logs team-fitness
```

### Métriques à surveiller

- Nombre de téléchargements
- Taux de réussite des mises à jour
- Versions installées par les utilisateurs

## 🆘 Dépannage

### L'APK ne se télécharge pas

1. Vérifier les permissions du fichier: `chmod 644 app-release.apk`
2. Vérifier que le serveur web sert les fichiers statiques
3. Vérifier les logs: `pm2 logs team-fitness`

### Version non détectée

1. Vérifier que version.json est valide: `cat version.json | jq`
2. Vérifier l'URL dans l'app Flutter
3. Vérifier les CORS si nécessaire

### Problème d'installation

1. Vérifier la signature de l'APK
2. Vérifier les permissions Android
3. Vérifier le checksum

## 📝 Notes

- Toujours tester sur un appareil de test avant le déploiement
- Garder une copie des anciennes versions pour rollback
- Documenter les changelogs de manière claire
- Prévoir un mécanisme de rollback en cas de problème
