# 🚀 Guide de démarrage rapide - Vérification de version (multi-plateforme)

> **Note (OTA retiré)** : L'upload d'APK n'est plus nécessaire pour publier une version.
> La CI utilise `POST /android/update-version` (JSON uniquement) pour mettre à jour les métadonnées.
> L'app lit `check-update` et redirige vers le Play Store / App Store selon la plateforme.

## ✅ Configuration terminée

Votre serveur est maintenant configuré pour servir les informations de version à l'adresse :
**`https://app.team-oustad.com/android`**

## 📍 URLs disponibles

### 1. **Vérifier les mises à jour** (public, CORS ouvert)
```
GET https://app.team-oustad.com/android/check-update?current_version=1
GET https://app.team-oustad.com/android/beta/check-update?current_version=1
```

### 2. **Publier une nouvelle version** (CI / automatisé, bearer token)
```
POST https://app.team-oustad.com/android/update-version
Content-Type: application/json
Authorization: Bearer <OTA_BEARER_TOKEN>

{
  "version_code": 75,
  "version_name": "1.0.0-beta.70",
  "download_url": "https://play.google.com/store/apps/details?id=team.fitness.team_fitness_app",
  "changelog": "Corrections de bugs et améliorations",
  "force_update": false,
  "channel": "beta"
}
```

### 3. **Informations de version brutes**
```
GET https://app.team-oustad.com/android/version.json
```

### 4. **Upload APK** (toujours disponible, non requis pour publier une version)
```
POST https://app.team-oustad.com/android/upload
```

## 📱 Configuration Flutter

### 1. Ajouter la constante dans votre app Flutter

```dart
// lib/config/constants.dart ou lib/config/api_config.dart
class ApiConfig {
  static const String BASE_URL = 'https://app.team-oustam.com';
  static const String OTA_UPDATE_URL = '$BASE_URL/android/version.json';
  static const String OTA_CHECK_URL = '$BASE_URL/android/check-update';
}
```

### 2. Service de vérification des mises à jour

```dart
// lib/services/update_service.dart
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

class UpdateService {
  static const String LAST_CHECK_KEY = 'last_update_check';
  static const Duration CHECK_INTERVAL = Duration(hours: 24);

  Future<Map<String, dynamic>?> checkForUpdates() async {
    try {
      // Vérifier si on a déjà vérifié récemment
      final prefs = await SharedPreferences.getInstance();
      final lastCheck = prefs.getInt(LAST_CHECK_KEY) ?? 0;
      final now = DateTime.now().millisecondsSinceEpoch;
      
      if (now - lastCheck < CHECK_INTERVAL.inMilliseconds) {
        print('Update check skipped (checked recently)');
        return null;
      }

      // Obtenir la version actuelle
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = int.parse(packageInfo.buildNumber);

      // Appeler l'API
      final url = Uri.parse(
        '${ApiConfig.OTA_CHECK_URL}?current_version=$currentVersion'
      );
      
      final response = await http.get(url);
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        
        // Sauvegarder l'heure de la vérification
        await prefs.setInt(LAST_CHECK_KEY, now);
        
        if (data['update_available'] == true) {
          return data['latest_version'];
        }
      }
      
      return null;
    } catch (e) {
      print('Error checking for updates: $e');
      return null;
    }
  }
}
```

### 3. Widget de notification de mise à jour

```dart
// lib/widgets/update_banner.dart
import 'package:flutter/material.dart';

class UpdateBanner extends StatelessWidget {
  final String versionName;
  final String changelog;
  final bool forceUpdate;
  final VoidCallback onUpdate;

  const UpdateBanner({
    Key? key,
    required this.versionName,
    required this.changelog,
    required this.forceUpdate,
    required this.onUpdate,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: forceUpdate ? Colors.red.shade50 : Colors.blue.shade50,
        border: Border(
          bottom: BorderSide(
            color: forceUpdate ? Colors.red : Colors.blue,
            width: 2,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                forceUpdate ? Icons.warning : Icons.info,
                color: forceUpdate ? Colors.red : Colors.blue,
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  forceUpdate
                      ? 'Mise à jour requise'
                      : 'Nouvelle version disponible',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: forceUpdate ? Colors.red.shade900 : Colors.blue.shade900,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 8),
          Text(
            'Version $versionName',
            style: TextStyle(
              fontWeight: FontWeight.w500,
              color: Colors.grey.shade700,
            ),
          ),
          SizedBox(height: 4),
          Text(
            changelog,
            style: TextStyle(
              color: Colors.grey.shade600,
            ),
          ),
          SizedBox(height: 12),
          ElevatedButton(
            onPressed: onUpdate,
            style: ElevatedButton.styleFrom(
              backgroundColor: forceUpdate ? Colors.red : Colors.blue,
            ),
            child: Text('Mettre à jour'),
          ),
        ],
      ),
    );
  }
}
```

## 🔄 Déployer une nouvelle version

### Méthode recommandée : API metadata-only (CI automatisée)

La CI appelle `POST /android/update-version` après chaque release Play Store.
Aucun build APK ni upload de fichier n'est nécessaire côté serveur.

```bash
curl -X POST https://app.team-oustad.com/android/update-version \
  -H "Authorization: Bearer $OTA_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version_code": 75,
    "version_name": "1.0.0",
    "download_url": "https://play.google.com/store/apps/details?id=team.fitness.team_fitness_app",
    "changelog": "Corrections de bugs et améliorations de performance",
    "force_update": false,
    "channel": "production"
  }'
```

Comportements garantis :
- Rejet d'un `version_code` inférieur à la version déjà publiée (409)
- Sauvegarde automatique de l'ancien `version.json` dans `backups/`
- `min_supported_version` conservé depuis l'ancienne version si non fourni

## 🧪 Tester la configuration

### 1. Vérifier que les fichiers sont accessibles

```bash
# Test depuis le serveur
curl https://app.team-oustam.com/android/version.json

# Test de l'endpoint check-update
curl "https://app.team-oustam.com/android/check-update?current_version=1"

# Test du téléchargement (devrait retourner un 404 si pas d'APK)
curl -I https://app.team-oustam.com/android/download
```

### 2. Tester depuis l'application Flutter

```dart
// Dans un bouton de test ou au démarrage
final updateService = UpdateService();
final update = await updateService.checkForUpdates();

if (update != null) {
  print('Update available: ${update['version_name']}');
  // Afficher le dialogue de mise à jour
} else {
  print('App is up to date');
}
```

## 📊 Swagger Documentation

La documentation API est automatiquement générée et disponible sur :
**`https://app.team-oustam.com/api-docs`**

Vous y trouverez tous les endpoints Android OTA avec possibilité de les tester directement.

## 🔒 Permissions requises dans AndroidManifest.xml

Vérifiez que votre `android/app/src/main/AndroidManifest.xml` contient :

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" 
                     android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" 
                     android:maxSdkVersion="32" />
    
    <application>
        <!-- Permettre l'installation depuis des sources inconnues -->
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.provider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/provider_paths" />
        </provider>
    </application>
</manifest>
```

## 📦 Dépendances Flutter requises

Ajoutez ces packages dans votre `pubspec.yaml` :

```yaml
dependencies:
  http: ^1.1.0
  package_info_plus: ^5.0.0
  shared_preferences: ^2.2.0
  path_provider: ^2.1.0
  permission_handler: ^11.0.0
  open_file: ^3.3.0  # Pour ouvrir l'APK après téléchargement
```

## 🎯 Format de réponse attendu

### Vérification de mise à jour (check-update)

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
    "checksum": "abc123def456...",
    "release_date": "2025-11-15T12:00:00Z"
  }
}
```

## 🆘 Dépannage

### Problème : APK ne se télécharge pas

```bash
# Vérifier les permissions
ls -la /root/team-server/db-server/public/android/

# Vérifier que le fichier existe
ls -lh /root/team-server/db-server/public/android/app-release.apk

# Vérifier les logs du serveur
pm2 logs team-fitness

# Tester l'accès direct
curl -I https://app.team-oustam.com/android/app-release.apk
```

### Problème : version.json non trouvé

```bash
# Vérifier le fichier
cat /root/team-server/db-server/public/android/version.json

# Valider le JSON
cat /root/team-server/db-server/public/android/version.json | jq
```

## 📝 Notes importantes

1. **Sécurité** : Toujours vérifier le checksum après téléchargement
2. **Signature** : L'APK doit être signé avec le même certificat que l'app initiale
3. **Test** : Toujours tester sur un appareil de test avant déploiement production
4. **Backup** : Les anciennes versions sont automatiquement sauvegardées dans `public/android/backups/`
5. **Monitoring** : Surveillez les logs avec `pm2 logs team-fitness`

## ✅ Checklist de déploiement

- [ ] `POST /android/update-version` appelé avec les bonnes métadonnées
- [ ] Réponse 200 vérifiée (version publiée)
- [ ] Test de `GET /android/check-update?current_version=<ancienne>` → `update_available: true`
- [ ] Monitoring des logs activé (`pm2 logs team-fitness`)

## 🎉 C'est terminé !

Votre système de mise à jour OTA est maintenant opérationnel ! Les utilisateurs de votre application pourront recevoir automatiquement les notifications de mises à jour.
