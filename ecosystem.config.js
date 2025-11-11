/**
 * PM2 Ecosystem Configuration
 * 
 * Ce fichier permet de gérer plusieurs instances du serveur Team Fitness
 * avec PM2 (Process Manager 2).
 * 
 * Installation de PM2 (globalement):
 *   npm install -g pm2
 * 
 * Commandes utiles:
 *   pm2 start ecosystem.config.js --only preprod    # Démarrer preprod uniquement
 *   pm2 start ecosystem.config.js --only prod       # Démarrer prod uniquement
 *   pm2 start ecosystem.config.js                   # Démarrer tout
 *   pm2 list                                         # Lister les processus
 *   pm2 logs preprod                                 # Voir les logs preprod
 *   pm2 logs prod                                    # Voir les logs prod
 *   pm2 restart preprod                              # Redémarrer preprod
 *   pm2 stop preprod                                 # Arrêter preprod
 *   pm2 delete preprod                               # Supprimer preprod
 *   pm2 monit                                        # Moniteur en temps réel
 *   pm2 save                                         # Sauvegarder la configuration
 *   pm2 startup                                      # Démarrage automatique au boot
 */

module.exports = {
  apps: [
    // ===== PREPROD =====
    {
      name: 'teamfitness-preprod',
      script: './index.js',
      env: {
        NODE_ENV: 'preprod',
        // Le fichier .env.preprod sera chargé
      },
      env_file: '.env.preprod',
      instances: 1, // Une seule instance pour preprod
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/preprod-error.log',
      out_file: './logs/preprod-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // Redémarrage automatique en cas d'erreur
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Variables d'environnement spécifiques
      env_preprod: {
        NODE_ENV: 'preprod',
      },
    },

    // ===== PRODUCTION =====
    {
      name: 'teamfitness-prod',
      script: './index.js',
      env: {
        NODE_ENV: 'production',
        // Le fichier .env.prod sera chargé
      },
      env_file: '.env.prod',
      instances: 'max', // Utilise tous les CPU disponibles pour production
      exec_mode: 'cluster', // Mode cluster pour meilleures performances
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/prod-error.log',
      out_file: './logs/prod-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // Redémarrage automatique en cas d'erreur
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Variables d'environnement spécifiques
      env_production: {
        NODE_ENV: 'production',
      },
      // Redémarrage en douceur (zero-downtime)
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,
    },
  ],
};
