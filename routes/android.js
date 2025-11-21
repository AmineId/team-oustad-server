const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const multer = require('multer');
const uploadAuth = require('../middleware/uploadAuth');

// Configure multer for APK uploads
// NOTE: Multer processes file upload BEFORE body parsing is complete.
// We need to use a temporary directory first, then move the file after we know the channel.
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use a temp directory first - we'll move the file after we parse the channel
    const uploadPath = path.join(__dirname, '../public/android/temp');
    // Ensure directory exists
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

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/vnd.android.package-archive' || file.originalname.endsWith('.apk')) {
      cb(null, true);
    } else {
      cb(new Error('Only APK files are allowed'));
    }
  },
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB max
  }
});

// Helper function to get the correct path based on channel
function getChannelPath(channel = 'production') {
  const baseDir = path.join(__dirname, '../public/android');
  const channelFolder = channel === 'beta' ? 'beta' : 'release';
  return path.join(baseDir, channelFolder);
}

// Helper function to get the correct APK filename based on channel
function getApkFileName(channel = 'production') {
  return channel === 'beta' ? 'app-beta.apk' : 'app-release.apk';
}

// Generic handler for check-update endpoint
async function handleCheckUpdate(req, res, channel) {
  try {
    const currentVersion = parseInt(req.query.current_version);
    const deviceId = req.query.device_id || 'unknown';

    if (req.query.current_version === undefined || isNaN(currentVersion)) {
      return res.status(400).json({
        error: 'Parameter current_version is required and must be a number',
      });
    }

    console.log(`📱 OTA Update Check (${channel}) - Device: ${deviceId}, Current Version: ${currentVersion}`);

    const channelPath = getChannelPath(channel);
    const versionPath = path.join(channelPath, 'version.json');
    const versionData = await fs.readFile(versionPath, 'utf-8');
    const latestVersion = JSON.parse(versionData);

    const updateAvailable = latestVersion.version_code > currentVersion;
    const forceUpdate = currentVersion < latestVersion.min_supported_version;

    // Pour le canal beta, utiliser le lien Google Play Internal Testing
    const downloadUrl = channel === 'beta' 
      ? 'https://play.google.com/store/apps/details?id=team.fitness.team_fitness_app&hl=en-US&ah=97EU213tjbmnn9POyHV8HPW1_EI'
      : latestVersion.download_url;

    const response = {
      update_available: updateAvailable,
      current_version: currentVersion,
      channel: channel,
      latest_version: updateAvailable ? {
        version_code: latestVersion.version_code,
        version_name: latestVersion.version_name,
        download_url: downloadUrl,
        changelog: latestVersion.changelog,
        force_update: forceUpdate,
        file_size: latestVersion.file_size,
        checksum: latestVersion.checksum,
        release_date: latestVersion.release_date,
      } : null,
    };

    if (updateAvailable) {
      console.log(`✅ Update available: v${latestVersion.version_name} (${latestVersion.version_code})`);
      if (forceUpdate) {
        console.log(`⚠️  Force update required (min version: ${latestVersion.min_supported_version})`);
      }
    } else {
      console.log(`✅ App is up to date`);
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Error checking update:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

// Generic handler for download endpoint
async function handleDownload(req, res, channel) {
  try {
    // Pour le canal beta, rediriger vers Google Play Internal Testing
    if (channel === 'beta') {
      console.log(`🔄 Redirecting beta download to Google Play Internal Testing`);
      return res.redirect(301, 'https://play.google.com/store/apps/details?id=team.fitness.team_fitness_app&hl=en-US&ah=97EU213tjbmnn9POyHV8HPW1_EI');
    }

    const channelPath = getChannelPath(channel);
    const apkFileName = getApkFileName(channel);
    const apkPath = path.join(channelPath, apkFileName);
    
    console.log(`📥 APK Download requested (${channel} channel)`);

    try {
      await fs.access(apkPath);
    } catch (error) {
      console.error('❌ APK file not found:', apkPath);
      const channelFolder = channel === 'beta' ? 'beta' : 'release';
      const apkFileName = getApkFileName(channel);
      return res.status(404).json({
        error: 'APK file not found',
        message: `Please upload the APK file to /public/android/${channelFolder}/${apkFileName}`,
      });
    }

    // Get file stats for Content-Length header
    const stats = await fs.stat(apkPath);
    
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename=${apkFileName}`);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Increase timeout for large file downloads
    req.setTimeout(10 * 60 * 1000); // 10 minutes
    res.setTimeout(10 * 60 * 1000); // 10 minutes

    console.log(`✅ Sending APK file (${Math.round(stats.size / 1024 / 1024)}MB)...`);

    res.sendFile(apkPath, (err) => {
      if (err) {
        // Client abort is expected if connection drops - don't treat as error
        if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET') {
          console.log(`⚠️  Client connection closed during download (${channel})`);
        } else {
          console.error('❌ Error sending APK:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Error sending file' });
          }
        }
      } else {
        console.log(`✅ APK sent successfully (${channel})`);
      }
    });
  } catch (error) {
    console.error('❌ Error downloading APK:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

// Generic handler for version endpoint
async function handleVersion(req, res, channel) {
  try {
    const channelPath = getChannelPath(channel);
    const versionPath = path.join(channelPath, 'version.json');
    const versionData = await fs.readFile(versionPath, 'utf-8');
    const version = JSON.parse(versionData);

    console.log(`📋 Version info requested (${channel}): v${version.version_name} (${version.version_code})`);

    res.json(version);
  } catch (error) {
    console.error('❌ Error reading version:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

// Generic handler for checksum endpoint
async function handleChecksum(req, res, channel) {
  try {
    const channelPath = getChannelPath(channel);
    const apkFileName = getApkFileName(channel);
    const apkPath = path.join(channelPath, apkFileName);

    try {
      await fs.access(apkPath);
    } catch (error) {
      return res.status(404).json({
        error: 'APK file not found',
      });
    }

    console.log(`🔐 Calculating checksums for APK (${channel})...`);

    const fileBuffer = await fs.readFile(apkPath);
    const md5Hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const fileSize = fileBuffer.length;

    console.log(`✅ Checksums calculated:`);
    console.log(`   MD5: ${md5Hash}`);
    console.log(`   SHA256: ${sha256Hash}`);
    console.log(`   Size: ${fileSize} bytes`);

    res.json({
      md5: md5Hash,
      sha256: sha256Hash,
      file_size: fileSize,
      channel: channel,
    });
  } catch (error) {
    console.error('❌ Error calculating checksum:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * @swagger
 * /android/check-update:
 *   get:
 *     tags:
 *       - Android OTA Updates
 *     summary: Vérifier la disponibilité d'une mise à jour
 *     description: Vérifie si une nouvelle version de l'application Android est disponible
 *     parameters:
 *       - in: query
 *         name: current_version
 *         schema:
 *           type: integer
 *         required: true
 *         description: Version actuelle installée (version_code)
 *       - in: query
 *         name: device_id
 *         schema:
 *           type: string
 *         description: Identifiant unique de l'appareil (optionnel, pour analytics)
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *           enum: [production, beta]
 *         description: Canal de mise à jour (production ou beta)
 *         default: production
 *     responses:
 *       200:
 *         description: Informations sur la mise à jour disponible
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 update_available:
 *                   type: boolean
 *                 current_version:
 *                   type: integer
 *                 latest_version:
 *                   type: object
 *                   properties:
 *                     version_code:
 *                       type: integer
 *                     version_name:
 *                       type: string
 *                     download_url:
 *                       type: string
 *                     changelog:
 *                       type: string
 *                     force_update:
 *                       type: boolean
 *                     file_size:
 *                       type: integer
 *                     checksum:
 *                       type: string
 *       400:
 *         description: Paramètre current_version manquant
 *       500:
 *         description: Erreur serveur
 */
router.get('/check-update', (req, res) => {
  const channel = req.query.channel || 'production';
  return handleCheckUpdate(req, res, channel);
});

/**
 * @swagger
 * /android/download:
 *   get:
 *     tags:
 *       - Android OTA Updates
 *     summary: Télécharger la dernière version APK
 *     description: Télécharge le fichier APK de la dernière version
 *     parameters:
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *           enum: [production, beta]
 *         description: Canal de téléchargement (production ou beta)
 *         default: production
 *       - in: query
 *         name: version
 *         schema:
 *           type: integer
 *         description: Version spécifique à télécharger (optionnel)
 *     responses:
 *       200:
 *         description: Fichier APK
 *         content:
 *           application/vnd.android.package-archive:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Fichier APK non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/download', (req, res) => {
  const channel = req.query.channel || 'production';
  return handleDownload(req, res, channel);
});

/**
 * @swagger
 * /android/version:
 *   get:
 *     tags:
 *       - Android OTA Updates
 *     summary: Obtenir les informations de version
 *     description: Retourne les métadonnées de la version actuelle disponible
 *     parameters:
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *           enum: [production, beta]
 *         description: Canal de version (production ou beta)
 *         default: production
 *     responses:
 *       200:
 *         description: Informations de version
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version_code:
 *                   type: integer
 *                 version_name:
 *                   type: string
 *                 download_url:
 *                   type: string
 *                 changelog:
 *                   type: string
 *                 min_supported_version:
 *                   type: integer
 *                 force_update:
 *                   type: boolean
 *                 release_date:
 *                   type: string
 *                 file_size:
 *                   type: integer
 *                 checksum:
 *                   type: string
 *       500:
 *         description: Erreur serveur
 */
router.get('/version', (req, res) => {
  const channel = req.query.channel || 'production';
  return handleVersion(req, res, channel);
});

/**
 * @swagger
 * /android/checksum:
 *   get:
 *     tags:
 *       - Android OTA Updates
 *     summary: Calculer le checksum de l'APK actuel
 *     description: Calcule et retourne le checksum MD5 et SHA256 de l'APK actuel
 *     parameters:
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *           enum: [production, beta]
 *         description: Canal de l'APK (production ou beta)
 *         default: production
 *     responses:
 *       200:
 *         description: Checksums calculés
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 md5:
 *                   type: string
 *                 sha256:
 *                   type: string
 *                 file_size:
 *                   type: integer
 *       404:
 *         description: Fichier APK non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/checksum', (req, res) => {
  const channel = req.query.channel || 'production';
  return handleChecksum(req, res, channel);
});

/**
 * @swagger
 * /android/upload:
 *   post:
 *     tags:
 *       - Android OTA Updates
 *     summary: Upload APK with metadata
 *     description: Upload a new APK file with version metadata (requires authentication)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - apk
 *               - version_code
 *               - version_name
 *             properties:
 *               apk:
 *                 type: string
 *                 format: binary
 *                 description: APK file to upload
 *               version_code:
 *                 type: integer
 *                 description: Version code (numeric, incremental)
 *                 example: 2
 *               version_name:
 *                 type: string
 *                 description: Version name (semantic versioning)
 *                 example: "1.0.1"
 *               changelog:
 *                 type: string
 *                 description: Changes in this version
 *                 example: "Bug fixes and performance improvements"
 *               min_supported_version:
 *                 type: integer
 *                 description: Minimum supported version code (for force update)
 *                 example: 1
 *               force_update:
 *                 type: boolean
 *                 description: Force users to update
 *                 example: false
 *               channel:
 *                 type: string
 *                 enum: [production, beta]
 *                 description: Deployment channel
 *                 example: production
 *                 default: production
 *     responses:
 *       200:
 *         description: APK uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 version:
 *                   type: object
 *                   properties:
 *                     version_code:
 *                       type: integer
 *                     version_name:
 *                       type: string
 *                     download_url:
 *                       type: string
 *                     file_size:
 *                       type: integer
 *                     checksum:
 *                       type: string
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/upload', uploadAuth, upload.single('apk'), async (req, res) => {
  try {
    const { version_code, version_name, changelog, min_supported_version, force_update, channel } = req.body;
    const uploadUser = req.user; // Fourni par le middleware uploadAuth
    
    // Validate required fields
    if (!version_code || !version_name) {
      // Clean up temp file
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      return res.status(400).json({
        error: 'version_code and version_name are required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'APK file is required'
      });
    }

    const uploadChannel = channel || 'production';
    if (!['production', 'beta'].includes(uploadChannel)) {
      // Clean up temp file
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        error: 'channel must be either "production" or "beta"'
      });
    }

    console.log(`📤 Uploading APK to ${uploadChannel} channel...`);
    console.log(`   Uploaded by: ${uploadUser.email} (${uploadUser.type})`);
    console.log(`   Version: ${version_name} (${version_code})`);
    console.log(`   Temp file: ${req.file.filename} (${req.file.size} bytes)`);

    // Determine target paths based on channel
    const channelFolder = uploadChannel === 'beta' ? 'beta' : 'release';
    const channelPath = getChannelPath(uploadChannel);
    const apkFileName = getApkFileName(uploadChannel);
    const finalApkPath = path.join(channelPath, apkFileName);
    const versionPath = path.join(channelPath, 'version.json');
    const backupDir = path.join(channelPath, 'backups');
    
    // Ensure channel directory exists
    await fs.mkdir(channelPath, { recursive: true });

    // Calculate checksums from temp file
    const fileBuffer = await fs.readFile(req.file.path);
    const md5Hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    console.log(`   📝 Checksums calculated:`);
    console.log(`      MD5: ${md5Hash}`);
    console.log(`      SHA256: ${sha256Hash}`);

    // Backup old APK and version metadata if exists
    try {
      await fs.access(versionPath);
      await fs.access(finalApkPath);
      
      // Read old version to get version name
      const oldVersionData = await fs.readFile(versionPath, 'utf-8');
      const oldVersion = JSON.parse(oldVersionData);
      
      // Create backup directory
      await fs.mkdir(backupDir, { recursive: true });
      
      // Backup APK with its version name (different naming for beta vs release)
      const apkPrefix = uploadChannel === 'beta' ? 'apk-beta' : 'apk-release';
      const backupApkName = `${apkPrefix}-v${oldVersion.version_name}.apk`;
      const backupApkPath = path.join(backupDir, backupApkName);
      await fs.copyFile(finalApkPath, backupApkPath);
      console.log(`   ✅ Old APK backed up: ${backupApkName}`);
      
      // Backup metadata with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await fs.copyFile(versionPath, path.join(backupDir, `version-${timestamp}.json`));
      console.log(`   ✅ Old version metadata backed up`);
    } catch (error) {
      // No existing version or APK, skip backup
      console.log(`   ℹ️  No previous version to backup`);
    }

    // Move temp file to final destination
    console.log(`   📦 Moving APK to: ${finalApkPath}`);
    await fs.rename(req.file.path, finalApkPath);
    console.log(`   ✅ APK moved successfully`);

    // Prepare version metadata
    const baseUrl = `https://app.team-oustad.com/android/${channelFolder}`;
    const versionMetadata = {
      version_code: parseInt(version_code),
      version_name: version_name,
      download_url: `${baseUrl}/${apkFileName}`,
      file_name: apkFileName,
      changelog: changelog || 'No changelog provided',
      min_supported_version: min_supported_version ? parseInt(min_supported_version) : parseInt(version_code),
      force_update: force_update === 'true' || force_update === true,
      release_date: new Date().toISOString(),
      file_size: req.file.size,
      checksum: sha256Hash
    };

    if (uploadChannel === 'beta') {
      versionMetadata.channel = 'beta';
      versionMetadata.is_beta = true;
    }

    // Save version metadata with upload info
    versionMetadata.uploaded_by = {
      user_id: uploadUser.sub,
      email: uploadUser.email,
      role: uploadUser.type
    };
    
    await fs.writeFile(versionPath, JSON.stringify(versionMetadata, null, 2));

    console.log(`✅ APK uploaded successfully to ${uploadChannel} channel`);
    console.log(`   Uploaded by: ${uploadUser.email}`);
    console.log(`   Filename: ${apkFileName}`);
    console.log(`   MD5: ${md5Hash}`);
    console.log(`   SHA256: ${sha256Hash}`);

    res.json({
      message: `APK uploaded successfully to ${uploadChannel} channel`,
      version: versionMetadata,
      checksums: {
        md5: md5Hash,
        sha256: sha256Hash
      }
    });
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
});

// ==========================================
// BETA CHANNEL ROUTES (alias pour compatibilité)
// Les routes /beta/* utilisent les mêmes handlers avec channel='beta'
// ==========================================

/**
 * @swagger
 * /android/beta/check-update:
 *   get:
 *     tags:
 *       - Android OTA Updates - Beta Channel
 *     summary: Vérifier les mises à jour beta
 *     description: Vérifie si une nouvelle version beta est disponible
 *     parameters:
 *       - in: query
 *         name: current_version
 *         required: true
 *         schema:
 *           type: integer
 *         description: Version actuelle installée
 *       - in: query
 *         name: device_id
 *         schema:
 *           type: string
 *         description: Identifiant unique de l'appareil
 *     responses:
 *       200:
 *         description: Informations sur la mise à jour beta disponible
 */
router.get('/beta/check-update', (req, res) => handleCheckUpdate(req, res, 'beta'));

/**
 * @swagger
 * /android/beta/download:
 *   get:
 *     tags:
 *       - Android OTA Updates - Beta Channel
 *     summary: Télécharger l'APK beta
 *     description: Télécharge le fichier APK de la dernière version beta
 */
router.get('/beta/download', (req, res) => handleDownload(req, res, 'beta'));

/**
 * @swagger
 * /android/beta/version:
 *   get:
 *     tags:
 *       - Android OTA Updates - Beta Channel
 *     summary: Obtenir les informations de version beta
 *     description: Retourne les métadonnées de la version beta actuelle
 */
router.get('/beta/version', (req, res) => handleVersion(req, res, 'beta'));

/**
 * @swagger
 * /android/beta/checksum:
 *   get:
 *     tags:
 *       - Android OTA Updates - Beta Channel
 *     summary: Calculer le checksum de l'APK beta
 *     description: Calcule et retourne les checksums MD5 et SHA256 de l'APK beta
 */
router.get('/beta/checksum', (req, res) => handleChecksum(req, res, 'beta'));

module.exports = router;

