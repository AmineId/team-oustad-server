// 📱 Team Fitness - Service de mise à jour OTA complet
// Fichier: lib/services/ota_update_service.dart

import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:open_file/open_file.dart';
import 'package:crypto/crypto.dart';

/// Configuration des URLs pour les mises à jour OTA
class OTAConfig {
  static const String BASE_URL = 'https://app.team-oustam.com';
  static const String CHECK_UPDATE_URL = '$BASE_URL/android/check-update';
  static const String VERSION_URL = '$BASE_URL/android/version.json';
  static const String DOWNLOAD_URL = '$BASE_URL/android/download';
}

/// Modèle pour les informations de version
class VersionInfo {
  final int versionCode;
  final String versionName;
  final String downloadUrl;
  final String changelog;
  final bool forceUpdate;
  final int fileSize;
  final String checksum;
  final DateTime releaseDate;

  VersionInfo({
    required this.versionCode,
    required this.versionName,
    required this.downloadUrl,
    required this.changelog,
    required this.forceUpdate,
    required this.fileSize,
    required this.checksum,
    required this.releaseDate,
  });

  factory VersionInfo.fromJson(Map<String, dynamic> json) {
    return VersionInfo(
      versionCode: json['version_code'] as int,
      versionName: json['version_name'] as String,
      downloadUrl: json['download_url'] as String,
      changelog: json['changelog'] as String,
      forceUpdate: json['force_update'] as bool? ?? false,
      fileSize: json['file_size'] as int? ?? 0,
      checksum: json['checksum'] as String? ?? '',
      releaseDate: DateTime.parse(json['release_date'] as String),
    );
  }

  String get fileSizeMB => (fileSize / (1024 * 1024)).toStringAsFixed(2);
}

/// Service de gestion des mises à jour OTA
class OTAUpdateService {
  static const String _lastCheckKey = 'last_update_check';
  static const String _autoUpdateEnabledKey = 'auto_update_enabled';
  static const Duration _checkInterval = Duration(hours: 24);

  /// Vérifier si les mises à jour automatiques sont activées
  Future<bool> isAutoUpdateEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_autoUpdateEnabledKey) ?? true;
  }

  /// Activer/désactiver les mises à jour automatiques
  Future<void> setAutoUpdateEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_autoUpdateEnabledKey, enabled);
  }

  /// Vérifier si on peut vérifier les mises à jour (respecter l'intervalle)
  Future<bool> canCheckForUpdates() async {
    final prefs = await SharedPreferences.getInstance();
    final lastCheck = prefs.getInt(_lastCheckKey) ?? 0;
    final now = DateTime.now().millisecondsSinceEpoch;
    
    return (now - lastCheck) >= _checkInterval.inMilliseconds;
  }

  /// Obtenir la version actuelle de l'application
  Future<int> getCurrentVersionCode() async {
    final packageInfo = await PackageInfo.fromPlatform();
    return int.parse(packageInfo.buildNumber);
  }

  /// Vérifier s'il y a une mise à jour disponible
  Future<VersionInfo?> checkForUpdate({bool force = false}) async {
    try {
      // Vérifier si les mises à jour auto sont activées
      if (!force && !await isAutoUpdateEnabled()) {
        print('🔄 Auto-update disabled');
        return null;
      }

      // Vérifier l'intervalle de vérification
      if (!force && !await canCheckForUpdates()) {
        print('🔄 Update check skipped (checked recently)');
        return null;
      }

      print('🔍 Checking for updates...');

      // Obtenir la version actuelle
      final currentVersion = await getCurrentVersionCode();
      print('📱 Current version: $currentVersion');

      // Appeler l'API
      final url = Uri.parse(
        '${OTAConfig.CHECK_UPDATE_URL}?current_version=$currentVersion'
      );
      
      final response = await http.get(url).timeout(
        const Duration(seconds: 10),
      );

      if (response.statusCode != 200) {
        print('❌ Update check failed: ${response.statusCode}');
        return null;
      }

      final data = json.decode(response.body) as Map<String, dynamic>;
      
      // Sauvegarder l'heure de la vérification
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(_lastCheckKey, DateTime.now().millisecondsSinceEpoch);

      // Vérifier s'il y a une mise à jour
      if (data['update_available'] == true) {
        final latestVersion = data['latest_version'] as Map<String, dynamic>;
        final versionInfo = VersionInfo.fromJson(latestVersion);
        
        print('✅ Update available: ${versionInfo.versionName}');
        print('   Force update: ${versionInfo.forceUpdate}');
        print('   Size: ${versionInfo.fileSizeMB} MB');
        
        return versionInfo;
      }

      print('✅ App is up to date');
      return null;
    } catch (e) {
      print('❌ Error checking for updates: $e');
      return null;
    }
  }

  /// Télécharger l'APK avec progression
  Future<File?> downloadUpdate(
    VersionInfo versionInfo, {
    Function(double progress)? onProgress,
  }) async {
    try {
      print('📥 Starting download: ${versionInfo.versionName}');

      // Demander les permissions
      if (!await _requestStoragePermission()) {
        print('❌ Storage permission denied');
        return null;
      }

      // Créer le dossier de téléchargement
      final dir = await getExternalStorageDirectory();
      final downloadPath = '${dir!.path}/team_fitness_update.apk';
      final file = File(downloadPath);

      // Supprimer l'ancien fichier si existe
      if (await file.exists()) {
        await file.delete();
      }

      // Télécharger le fichier
      final request = http.Request('GET', Uri.parse(versionInfo.downloadUrl));
      final response = await request.send();

      if (response.statusCode != 200) {
        print('❌ Download failed: ${response.statusCode}');
        return null;
      }

      final contentLength = response.contentLength ?? versionInfo.fileSize;
      int bytesDownloaded = 0;

      // Écrire le fichier avec suivi de progression
      final sink = file.openWrite();
      
      await for (var chunk in response.stream) {
        bytesDownloaded += chunk.length;
        sink.add(chunk);
        
        if (onProgress != null && contentLength > 0) {
          final progress = bytesDownloaded / contentLength;
          onProgress(progress);
          print('📥 Download progress: ${(progress * 100).toStringAsFixed(1)}%');
        }
      }

      await sink.close();
      print('✅ Download completed: $downloadPath');

      // Vérifier le checksum si disponible
      if (versionInfo.checksum.isNotEmpty) {
        final valid = await _verifyChecksum(file, versionInfo.checksum);
        if (!valid) {
          print('❌ Checksum verification failed');
          await file.delete();
          return null;
        }
        print('✅ Checksum verified');
      }

      return file;
    } catch (e) {
      print('❌ Error downloading update: $e');
      return null;
    }
  }

  /// Installer l'APK téléchargé
  Future<bool> installUpdate(File apkFile) async {
    try {
      print('📲 Installing update: ${apkFile.path}');

      // Demander la permission d'installer
      if (!await _requestInstallPermission()) {
        print('❌ Install permission denied');
        return false;
      }

      // Ouvrir le fichier APK pour installation
      final result = await OpenFile.open(apkFile.path);
      
      if (result.type == ResultType.done) {
        print('✅ Install initiated');
        return true;
      } else {
        print('❌ Install failed: ${result.message}');
        return false;
      }
    } catch (e) {
      print('❌ Error installing update: $e');
      return false;
    }
  }

  /// Vérifier le checksum du fichier
  Future<bool> _verifyChecksum(File file, String expectedChecksum) async {
    try {
      final bytes = await file.readAsBytes();
      final digest = sha256.convert(bytes);
      final actualChecksum = digest.toString();
      
      return actualChecksum.toLowerCase() == expectedChecksum.toLowerCase();
    } catch (e) {
      print('❌ Error verifying checksum: $e');
      return false;
    }
  }

  /// Demander la permission de stockage
  Future<bool> _requestStoragePermission() async {
    if (Platform.isAndroid) {
      // Android 13+ n'a plus besoin de permission de stockage pour le téléchargement
      if (await Permission.storage.isGranted) {
        return true;
      }
      
      final status = await Permission.storage.request();
      return status.isGranted;
    }
    return true;
  }

  /// Demander la permission d'installer des packages
  Future<bool> _requestInstallPermission() async {
    if (Platform.isAndroid) {
      if (await Permission.requestInstallPackages.isGranted) {
        return true;
      }
      
      final status = await Permission.requestInstallPackages.request();
      return status.isGranted;
    }
    return true;
  }
}

/// Widget pour afficher un dialogue de mise à jour
class UpdateDialog extends StatelessWidget {
  final VersionInfo versionInfo;
  final VoidCallback onUpdate;
  final VoidCallback? onLater;

  const UpdateDialog({
    Key? key,
    required this.versionInfo,
    required this.onUpdate,
    this.onLater,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Row(
        children: [
          Icon(
            versionInfo.forceUpdate ? Icons.warning : Icons.system_update,
            color: versionInfo.forceUpdate ? Colors.red : Colors.blue,
          ),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              versionInfo.forceUpdate
                  ? 'Mise à jour requise'
                  : 'Mise à jour disponible',
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Version ${versionInfo.versionName}',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Taille: ${versionInfo.fileSizeMB} MB',
              style: TextStyle(
                color: Colors.grey.shade600,
                fontSize: 14,
              ),
            ),
            SizedBox(height: 16),
            Text(
              'Nouveautés :',
              style: TextStyle(
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 4),
            Text(versionInfo.changelog),
            if (versionInfo.forceUpdate) ...[
              SizedBox(height: 16),
              Container(
                padding: EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning, color: Colors.red, size: 20),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Cette mise à jour est obligatoire pour continuer à utiliser l\'application.',
                        style: TextStyle(
                          color: Colors.red.shade900,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        if (!versionInfo.forceUpdate && onLater != null)
          TextButton(
            onPressed: onLater,
            child: Text('Plus tard'),
          ),
        ElevatedButton(
          onPressed: onUpdate,
          style: ElevatedButton.styleFrom(
            backgroundColor: versionInfo.forceUpdate ? Colors.red : Colors.blue,
          ),
          child: Text('Mettre à jour'),
        ),
      ],
    );
  }
}

/// Widget pour afficher la progression du téléchargement
class DownloadProgressDialog extends StatelessWidget {
  final double progress;
  final VersionInfo versionInfo;

  const DownloadProgressDialog({
    Key? key,
    required this.progress,
    required this.versionInfo,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Téléchargement en cours...'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          LinearProgressIndicator(value: progress),
          SizedBox(height: 16),
          Text(
            '${(progress * 100).toStringAsFixed(1)}%',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Version ${versionInfo.versionName}',
            style: TextStyle(
              color: Colors.grey.shade600,
            ),
          ),
          Text(
            '${((progress * versionInfo.fileSize) / (1024 * 1024)).toStringAsFixed(1)} / ${versionInfo.fileSizeMB} MB',
            style: TextStyle(
              color: Colors.grey.shade600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

/// Exemple d'utilisation complète
/// 
/// ```dart
/// // Au démarrage de l'app
/// void checkForUpdatesOnStartup() async {
///   final updateService = OTAUpdateService();
///   final update = await updateService.checkForUpdate();
///   
///   if (update != null) {
///     showDialog(
///       context: context,
///       barrierDismissible: !update.forceUpdate,
///       builder: (context) => UpdateDialog(
///         versionInfo: update,
///         onUpdate: () => _performUpdate(update),
///         onLater: update.forceUpdate ? null : () => Navigator.pop(context),
///       ),
///     );
///   }
/// }
/// 
/// Future<void> _performUpdate(VersionInfo versionInfo) async {
///   final updateService = OTAUpdateService();
///   double currentProgress = 0;
///   
///   // Afficher le dialogue de progression
///   showDialog(
///     context: context,
///     barrierDismissible: false,
///     builder: (context) => DownloadProgressDialog(
///       progress: currentProgress,
///       versionInfo: versionInfo,
///     ),
///   );
///   
///   // Télécharger
///   final apkFile = await updateService.downloadUpdate(
///     versionInfo,
///     onProgress: (progress) {
///       setState(() => currentProgress = progress);
///     },
///   );
///   
///   Navigator.pop(context); // Fermer le dialogue
///   
///   if (apkFile != null) {
///     // Installer
///     await updateService.installUpdate(apkFile);
///   } else {
///     // Erreur
///     ScaffoldMessenger.of(context).showSnackBar(
///       SnackBar(content: Text('Erreur lors du téléchargement')),
///     );
///   }
/// }
/// ```
