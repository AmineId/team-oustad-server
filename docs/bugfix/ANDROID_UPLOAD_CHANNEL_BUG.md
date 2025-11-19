# 🐛 Bug Fix: Android APK Upload - Mauvais Canal (Channel)

**Date:** 19 novembre 2025  
**Gravité:** Critique  
**Statut:** ✅ Résolu

## 📋 Description du Problème

Lors de l'upload d'un APK via l'endpoint `/android/upload` avec `channel=beta`, le fichier était systématiquement uploadé dans le mauvais dossier (`release/` au lieu de `beta/`).

### Comportement Observé

- L'API retournait une réponse 200 OK avec les métadonnées correctes (channel: beta)
- Le fichier `version.json` était correctement mis à jour dans le bon dossier
- Le backup de l'ancien APK était créé correctement
- **MAIS** le nouveau fichier APK était écrit dans `/public/android/release/app-release.apk` au lieu de `/public/android/beta/app-beta.apk`

### Impact

- Les utilisateurs sur le canal beta téléchargeaient l'ancienne version
- Le workflow GitHub Actions recevait une confirmation de succès alors que le déploiement avait échoué
- Confusion entre les versions déployées et les versions disponibles

## 🔍 Cause Racine

Le problème venait de la configuration de **Multer** dans `routes/android.js`.

### Code Problématique

```javascript
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const channel = req.body.channel || 'production';
    // ...
  },
  filename: function (req, file, cb) {
    const channel = req.body.channel || 'production';
    // ...
  }
});
```

**Le problème:** Multer configure le `destination` et le `filename` **AVANT** que le parsing complet du body multipart ne soit terminé. À ce moment-là, `req.body.channel` n'est pas encore disponible, donc il utilisait toujours la valeur par défaut `'production'`.

## ✅ Solution Appliquée

### 1. Upload temporaire

Modifier Multer pour uploader dans un dossier temporaire avec un nom unique:

```javascript
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use a temp directory first
    const uploadPath = path.join(__dirname, '../public/android/temp');
    fs.mkdir(uploadPath, { recursive: true })
      .then(() => cb(null, uploadPath))
      .catch(err => cb(err));
  },
  filename: function (req, file, cb) {
    // Use a temporary unique name
    const timestamp = Date.now();
    const fileName = `temp-upload-${timestamp}.apk`;
    cb(null, fileName);
  }
});
```

### 2. Déplacement après parsing

Après que Multer ait fini et que `req.body` soit disponible, déplacer le fichier vers sa destination finale:

```javascript
// Determine target paths based on channel (NOW available)
const channelPath = getChannelPath(uploadChannel);
const apkFileName = getApkFileName(uploadChannel);
const finalApkPath = path.join(channelPath, apkFileName);

// Calculate checksums from temp file
const fileBuffer = await fs.readFile(req.file.path);
const md5Hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

// Backup old version...

// Move temp file to final destination
await fs.rename(req.file.path, finalApkPath);
```

### 3. Nettoyage en cas d'erreur

Ajouter un nettoyage du fichier temporaire en cas d'erreur:

```javascript
} catch (error) {
  console.error('❌ Error uploading APK:', error);
  
  // Clean up temp file if it exists
  if (req.file && req.file.path) {
    await fs.unlink(req.file.path).catch(() => {});
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
}
```

## 🧪 Tests de Validation

### Test 1: Upload Beta
```bash
curl -X POST "https://app.team-oustad.com/android/upload" \
  -H "Authorization: Bearer TOKEN" \
  -F "apk=@app.apk" \
  -F "version_code=16" \
  -F "version_name=1.0.0-beta.14" \
  -F "channel=beta"
```

**Résultat attendu:**
- Fichier dans `/public/android/beta/app-beta.apk`
- version.json mis à jour avec channel: "beta"
- Backup créé avec préfixe `apk-beta-v`

### Test 2: Upload Production
```bash
curl -X POST "https://app.team-oustad.com/android/upload" \
  -H "Authorization: Bearer TOKEN" \
  -F "apk=@app.apk" \
  -F "version_code=16" \
  -F "version_name=1.0.0" \
  -F "channel=production"
```

**Résultat attendu:**
- Fichier dans `/public/android/release/app-release.apk`
- version.json mis à jour sans champ `channel`
- Backup créé avec préfixe `apk-release-v`

## 📊 Vérification Post-Déploiement

```bash
# Vérifier les checksums
cd /root/team-server/db-server/public/android/beta
md5sum app-beta.apk
sha256sum app-beta.apk

# Vérifier le contenu de version.json
cat version.json | jq '.version_code, .version_name, .checksum'

# Vérifier que le fichier a la bonne date
ls -lh app-beta.apk
```

## 🔄 Workflow GitHub Actions

Le workflow continue de fonctionner sans modification. Il envoie:
- `channel=beta` pour les builds beta
- `channel=production` (ou omis) pour les builds production

## 📝 Notes Additionnelles

### Pourquoi Multer ne peut pas lire req.body directement?

Multer est un middleware qui parse les requêtes `multipart/form-data`. Il traite les fichiers **pendant** le parsing du body, pas après. Les champs du formulaire (comme `channel`) ne sont disponibles qu'**après** que Multer ait terminé de traiter tous les champs et fichiers.

### Solutions alternatives considérées

1. ❌ **Utiliser multer().any() puis parser les champs manuellement** - Trop complexe
2. ❌ **Configurer deux middlewares Multer différents** - Code dupliqué
3. ✅ **Upload temporaire puis déplacement** - Simple, robuste, fonctionne à tous les coups

## 🔗 Références

- Commit: [À définir après commit]
- Issue GitHub Actions: Workflow run #[numéro du run qui a révélé le bug]
- Documentation Multer: https://github.com/expressjs/multer#diskstorage
