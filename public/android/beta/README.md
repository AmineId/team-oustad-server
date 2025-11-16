# 📱 Canal Beta - Versions de test (Preprod)

Ce répertoire contient les versions **beta/preprod** de l'application Android Team Fitness, destinées aux tests avant déploiement en production.

## 🎯 Objectif

Le canal beta permet de :
- ✅ Tester les nouvelles fonctionnalités avant production
- ✅ Valider les corrections de bugs
- ✅ Collecter les retours des beta-testeurs
- ✅ Détecter les problèmes avant le déploiement large

## 📂 Structure

```
beta/
├── version.json          # Métadonnées de version beta
├── app-release.apk       # APK beta (à ajouter)
├── README.md            # Ce fichier
└── backups/             # Anciennes versions beta
```

## 🔄 URLs Beta

- **Check Update Beta**: `https://app.team-oustad.com/android/beta/check-update?current_version=1`
- **Version JSON Beta**: `https://app.team-oustad.com/android/beta/version.json`
- **Download APK Beta**: `https://app.team-oustad.com/android/beta/download`

## 🚀 Déployer une version beta

### Méthode automatique

```bash
cd /root/team-server/db-server
./scripts/deploy-android-apk.sh \
  ~/flutter/app/build/app/outputs/flutter-apk/app-release.apk \
  2 \
  "1.0.1-beta.1" \
  "Test de nouvelles fonctionnalités" \
  beta
```

### Méthode manuelle

1. **Générer l'APK depuis Flutter (preprod)**
   ```bash
   cd /chemin/vers/flutter/app
   flutter build apk --release --flavor preprod
   # ou
   flutter build apk --release --dart-define=ENV=preprod
   ```

2. **Copier l'APK vers le serveur**
   ```bash
   scp build/app/outputs/flutter-apk/app-release.apk \
       root@app.team-oustad.com:/root/team-server/db-server/public/android/beta/
   ```

3. **Mettre à jour version.json**
   ```bash
   ssh root@app.team-oustad.com
   cd /root/team-server/db-server/public/android/beta
   
   # Éditer version.json avec les nouvelles infos
   nano version.json
   ```

## 📱 Configuration Flutter pour Beta

### Option 1: Environnements séparés

```dart
// lib/config/api_config.dart
class ApiConfig {
  static const String BASE_URL = String.fromEnvironment(
    'BASE_URL',
    defaultValue: 'https://app.team-oustad.com',
  );
  
  static const bool IS_BETA = bool.fromEnvironment(
    'IS_BETA',
    defaultValue: false,
  );
  
  static String get otaChannel => IS_BETA ? 'beta' : 'production';
  static String get otaPath => IS_BETA ? '/android/beta' : '/android';
  
  static String get OTA_CHECK_URL => 
    '$BASE_URL$otaPath/check-update';
}
```

Compilation :
```bash
# Version beta
flutter build apk --release --dart-define=IS_BETA=true

# Version production
flutter build apk --release --dart-define=IS_BETA=false
```

### Option 2: Configuration dans l'app

```dart
class UpdateService {
  // Toggle beta dans les paramètres de l'app
  Future<bool> isBetaChannelEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('beta_channel_enabled') ?? false;
  }
  
  Future<String> getUpdateChannel() async {
    final isBeta = await isBetaChannelEnabled();
    return isBeta ? 'beta' : 'production';
  }
  
  String getCheckUpdateUrl(String channel, int version) {
    final path = channel == 'beta' ? '/android/beta' : '/android';
    return 'https://app.team-oustad.com$path/check-update?current_version=$version';
  }
}
```

### Option 3: APK séparés

Créez deux APK distincts :
- `com.teamfitness.app` → Canal production
- `com.teamfitness.app.beta` → Canal beta

## 🧪 Tests

```bash
# Test version beta
curl https://app.team-oustad.com/android/beta/version.json

# Test check-update beta
curl "https://app.team-oustad.com/android/beta/check-update?current_version=1"

# Comparer production vs beta
echo "=== Production ===" && \
curl -s https://app.team-oustad.com/android/version.json | jq .version_name && \
echo "=== Beta ===" && \
curl -s https://app.team-oustad.com/android/beta/version.json | jq .version_name
```

## 📋 Format de version beta

Convention de nommage :
```
<major>.<minor>.<patch>-beta.<beta_number>

Exemples :
- 1.0.0-beta.1    (première beta de la v1.0.0)
- 1.0.0-beta.2    (deuxième beta de la v1.0.0)
- 1.0.1-beta.1    (première beta de la v1.0.1)
- 1.0.0           (version stable finale)
```

## 🔄 Workflow Beta → Production

1. **Développement**
   - Nouvelles fonctionnalités sur branche `develop`

2. **Beta (Preprod)**
   ```bash
   ./scripts/deploy-android-apk.sh app.apk 10 "1.2.0-beta.1" "..." beta
   ```
   - Tests internes
   - Beta-testeurs
   - Validation QA

3. **Production**
   ```bash
   ./scripts/deploy-android-apk.sh app.apk 10 "1.2.0" "..." production
   ```
   - Déploiement pour tous les utilisateurs

## 👥 Gestion des beta-testeurs

### Dans l'app Flutter

```dart
class BetaSettings extends StatefulWidget {
  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      title: Text('Canal Beta'),
      subtitle: Text('Recevoir les mises à jour beta en avant-première'),
      value: isBetaEnabled,
      onChanged: (value) async {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool('beta_channel_enabled', value);
        setState(() => isBetaEnabled = value);
        
        // Vérifier immédiatement les mises à jour
        checkForUpdates();
      },
    );
  }
}
```

## ⚠️ Avertissements Beta

Dans votre UI Flutter, affichez clairement le statut beta :

```dart
if (isBetaVersion) {
  Container(
    padding: EdgeInsets.all(8),
    color: Colors.orange,
    child: Row(
      children: [
        Icon(Icons.warning, color: Colors.white),
        SizedBox(width: 8),
        Text(
          'VERSION BETA - Fonctionnalités en test',
          style: TextStyle(color: Colors.white),
        ),
      ],
    ),
  );
}
```

## 📊 Différences Production vs Beta

| Aspect | Production | Beta |
|--------|-----------|------|
| **URL** | `/android/` | `/android/beta/` |
| **Stabilité** | ✅ Stable | ⚠️ En test |
| **Public** | Tous les utilisateurs | Beta-testeurs |
| **Fréquence MAJ** | Moins fréquente | Plus fréquente |
| **Version** | 1.0.0 | 1.0.0-beta.1 |
| **Force Update** | Rare | Plus courant |

## 🔒 Sécurité

- ✅ Même niveau de sécurité que production
- ✅ HTTPS obligatoire
- ✅ Vérification de checksum
- ✅ Signature APK identique

## 📝 Notes

- Les versions beta sont automatiquement sauvegardées dans `backups/`
- Le canal beta peut être activé/désactivé dans l'app
- Les beta-testeurs peuvent revenir au canal stable à tout moment
- Les versions beta expirent automatiquement après X jours (configurable)

## 🆘 Support Beta

En cas de problème avec une version beta :
1. Signaler le bug via l'app ou email
2. Revenir au canal stable dans les paramètres
3. Désinstaller et réinstaller la version stable si nécessaire
