# 🚀 Guide de Déploiement Preprod avec PM2

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Installation initiale](#installation-initiale)
- [Configuration](#configuration)
- [Démarrage automatique](#démarrage-automatique)
- [Commandes PM2](#commandes-pm2)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Vue d'ensemble

Ce guide explique comment configurer un serveur Node.js en **preprod** qui :
- ✅ Démarre automatiquement au boot du serveur
- ✅ Redémarre automatiquement en cas de crash
- ✅ Utilise PM2 pour la gestion des processus
- ✅ Supporte plusieurs environnements (dev, preprod, prod)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SERVEUR UBUNTU 22.04                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────┐                                             │
│  │   SYSTEMD      │  ◄─── Démarre au boot                      │
│  │  (pm2-root)    │                                             │
│  └────────┬───────┘                                             │
│           │                                                     │
│           ▼                                                     │
│  ┌────────────────┐         ┌──────────────────┐              │
│  │      PM2       │────────►│  Node.js v24     │              │
│  │  Process Mgr   │         │  + Express       │              │
│  └────────┬───────┘         └──────────────────┘              │
│           │                                                     │
│           ├─► teamfitness-preprod (Port 3001)                  │
│           ├─► teamfitness-prod     (Port 3002) [optional]      │
│           └─► teamfitness-dev      (Port 3000) [optional]      │
│                                                                 │
│  ┌────────────────────────────────────────────┐                │
│  │           DOCKER CONTAINERS                │                │
│  ├────────────────────────────────────────────┤                │
│  │  postgres-dev     → Port 5432              │                │
│  │  postgres-preprod → Port 5433              │                │
│  │  postgres-prod    → Port 5434              │                │
│  └────────────────────────────────────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Internet
         ▼
┌─────────────────┐
│  Utilisateurs   │
│  & API Clients  │
└─────────────────┘
```

---

## 🔧 Installation initiale

### 1️⃣ Installer Node.js via NVM

```bash
# Télécharger et installer NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Recharger le shell
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Installer Node.js LTS (v20 ou v24)
nvm install 20
nvm use 20
nvm alias default 20

# Vérifier l'installation
node --version  # v20.x.x ou v24.x.x
npm --version   # 10.x.x
```

### 2️⃣ Configurer NVM au démarrage

Ajouter au fichier `~/.bashrc` ou `~/.zshrc` :

```bash
# NVM Configuration
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
```

Puis recharger :

```bash
source ~/.bashrc  # ou ~/.zshrc si vous utilisez zsh
```

### 3️⃣ Installer PM2

```bash
# Installer PM2 globalement
npm install -g pm2

# Vérifier l'installation
pm2 --version  # 6.x.x
```

### 4️⃣ Installer Docker (pour PostgreSQL)

```bash
# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker $USER

# Démarrer Docker
sudo systemctl start docker
sudo systemctl enable docker

# Vérifier
docker --version
```

---

## ⚙️ Configuration

### Structure des fichiers

```
db-server/
├── .env.example          # Template pour dev
├── .env.preprod.example  # Template pour preprod
├── .env.prod.example     # Template pour prod
├── .env.preprod          # Configuration preprod active (à créer)
├── ecosystem.config.js   # Configuration PM2
├── index.js              # Point d'entrée du serveur
├── logs/                 # Logs PM2 (auto-créé)
│   ├── preprod-out.log
│   └── preprod-error.log
└── config/
    ├── docker-compose.yml
    └── docker-compose-multi-env.yml
```

### Créer le fichier .env.preprod

```bash
cd /root/team-server/db-server

# Copier depuis l'exemple
cp .env.preprod.example .env.preprod

# Éditer avec vos vraies valeurs
nano .env.preprod
```

### Exemple de configuration `.env.preprod`

```bash
# Environment
NODE_ENV=preprod

# Database
DATABASE_URL="postgresql://admin:admin@localhost:5433/fitness_preprod?schema=public"

# Server
PORT=3001
HOST=0.0.0.0

# JWT
JWT_SECRET="votre_secret_jwt_unique_et_fort_pour_preprod"

# Email (Brevo)
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="votre-email@votredomaine.com"
SMTP_PASS="votre-cle-api-brevo"

# API URL (utilisée dans les emails)
API_URL=https://api-preprod.votredomaine.com

# Firebase (optionnel)
# FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account-preprod.json
```

### Configuration PM2 (ecosystem.config.js)

Le fichier est déjà configuré. Voici la partie preprod :

```javascript
{
  name: 'teamfitness-preprod',
  script: './index.js',
  env_file: '.env.preprod',
  instances: 1,
  exec_mode: 'fork',
  autorestart: true,
  max_restarts: 10,
  error_file: './logs/preprod-error.log',
  out_file: './logs/preprod-out.log',
}
```

---

## 🚀 Démarrage automatique

### Étape 1 : Créer le dossier logs

```bash
cd /root/team-server/db-server
mkdir -p logs
```

### Étape 2 : Démarrer PostgreSQL

```bash
# Démarrer uniquement la base preprod (port 5433)
docker compose -f config/docker-compose-multi-env.yml up -d postgres-preprod

# Vérifier
docker ps | grep postgres-preprod
```

### Étape 3 : Démarrer le serveur avec PM2

```bash
# S'assurer que NVM est chargé
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Aller dans le répertoire du projet
cd /root/team-server/db-server

# Démarrer avec PM2 (méthode correcte pour charger .env)
pm2 start index.js \
  --name teamfitness-preprod \
  --node-args="-r dotenv/config" \
  -- dotenv_config_path=.env.preprod

# Vérifier le statut
pm2 list
pm2 logs teamfitness-preprod --lines 20
```

### Étape 4 : Configurer le démarrage automatique au boot

```bash
# Générer le script systemd
pm2 startup

# Copier-coller la commande affichée (exemple) :
# sudo env PATH=$PATH:/root/.nvm/versions/node/v24.11.1/bin pm2 startup systemd -u root --hp /root

# Sauvegarder la configuration actuelle
pm2 save
```

### Étape 5 : Vérifier le service systemd

```bash
# Vérifier le statut
sudo systemctl status pm2-root

# Logs du service
sudo journalctl -u pm2-root -f
```

---

## 🎮 Commandes PM2

### Commandes de base

```bash
# Toujours charger NVM d'abord !
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Lister tous les processus
pm2 list

# Voir les logs en temps réel
pm2 logs teamfitness-preprod

# Voir les dernières 50 lignes
pm2 logs teamfitness-preprod --lines 50

# Logs sans streaming
pm2 logs teamfitness-preprod --nostream
```

### Gestion des processus

```bash
# Redémarrer
pm2 restart teamfitness-preprod

# Arrêter
pm2 stop teamfitness-preprod

# Supprimer
pm2 delete teamfitness-preprod

# Recharger (zero-downtime pour cluster mode)
pm2 reload teamfitness-preprod
```

### Monitoring

```bash
# Moniteur en temps réel (CPU, RAM)
pm2 monit

# Informations détaillées
pm2 show teamfitness-preprod

# Voir l'utilisation ressources
pm2 status
```

### Gestion de plusieurs environnements

```bash
# Démarrer uniquement preprod
pm2 start ecosystem.config.js --only teamfitness-preprod

# Démarrer uniquement prod
pm2 start ecosystem.config.js --only teamfitness-prod

# Démarrer tous les environnements
pm2 start ecosystem.config.js

# Redémarrer tout
pm2 restart all

# Arrêter tout
pm2 stop all
```

---

## 📊 Monitoring

### Dashboard PM2

```
┌────┬────────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name                   │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │
├────┼────────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ teamfitness-preprod    │ default     │ 1.0.0   │ fork    │ 12345    │ 2D     │ 0    │ online    │ 0.1%     │ 125mb    │
└────┴────────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┘
```

### Indicateurs clés

- **status** : `online` (bon) / `errored` (problème) / `stopped` (arrêté)
- **uptime** : Temps depuis le dernier démarrage
- **↺** : Nombre de redémarrages
- **cpu** : Utilisation CPU en %
- **mem** : Utilisation mémoire

### Fichiers de logs

```bash
# Emplacement des logs
/root/team-server/db-server/logs/preprod-out.log    # Sorties standard
/root/team-server/db-server/logs/preprod-error.log  # Erreurs

# Voir en temps réel
tail -f logs/preprod-out.log
tail -f logs/preprod-error.log

# Rechercher une erreur
grep -i "error" logs/preprod-error.log
grep -i "database" logs/preprod-out.log
```

---

## 🩹 Troubleshooting

### ❌ Problème : PM2 command not found

**Cause** : NVM n'est pas chargé

**Solution** :
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
pm2 list
```

### ❌ Problème : Le serveur utilise le mauvais port

**Cause** : Le fichier `.env.preprod` n'est pas chargé correctement

**Solution** :
```bash
# Supprimer et recréer avec la bonne commande
pm2 delete teamfitness-preprod

pm2 start index.js \
  --name teamfitness-preprod \
  --node-args="-r dotenv/config" \
  -- dotenv_config_path=.env.preprod

pm2 save
```

### ❌ Problème : Can't reach database server

**Cause** : PostgreSQL n'est pas démarré

**Solution** :
```bash
# Démarrer la base de données
docker compose -f config/docker-compose-multi-env.yml up -d postgres-preprod

# Vérifier
docker ps | grep postgres-preprod

# Tester la connexion
docker exec -it teamfitness-db-preprod psql -U admin -d fitness_preprod
```

### ❌ Problème : Le serveur ne redémarre pas au boot

**Cause** : PM2 startup non configuré ou configuration non sauvegardée

**Solution** :
```bash
# Reconfigurer le startup
pm2 startup

# Copier-coller la commande affichée
# sudo env PATH=... pm2 startup systemd ...

# Sauvegarder
pm2 save

# Vérifier
sudo systemctl status pm2-root
```

### ❌ Problème : Logs trop volumineux

**Solution** : Installer pm2-logrotate
```bash
pm2 install pm2-logrotate

# Configuration (optionnel)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### ❌ Problème : Trop de redémarrages (status: errored)

**Diagnostic** :
```bash
# Voir les logs d'erreur
pm2 logs teamfitness-preprod --err --lines 50

# Voir les infos détaillées
pm2 show teamfitness-preprod
```

**Causes communes** :
- Port déjà utilisé (changer `PORT` dans `.env.preprod`)
- Base de données inaccessible (vérifier Docker et `DATABASE_URL`)
- Fichier manquant (vérifier les chemins dans `.env.preprod`)
- Erreur de syntaxe dans le code (vérifier les logs)

---

## 🔐 Bonnes pratiques

### Sécurité

```bash
# ✅ Utiliser des secrets forts et uniques
JWT_SECRET="$(openssl rand -base64 32)"

# ✅ Ne jamais commiter les fichiers .env
echo ".env*" >> .gitignore
echo "!.env.example" >> .gitignore
echo "!.env.*.example" >> .gitignore

# ✅ Limiter les permissions
chmod 600 .env.preprod
```

### Performance

```bash
# Pour la production, utiliser le mode cluster
pm2 start ecosystem.config.js --only teamfitness-prod

# Le fichier ecosystem.config.js est déjà configuré avec :
# instances: 'max'  → Utilise tous les CPU
# exec_mode: 'cluster'  → Load balancing automatique
```

### Sauvegarde

```bash
# Sauvegarder la configuration PM2
pm2 save

# Sauvegarder la base de données
docker exec teamfitness-db-preprod pg_dump -U admin fitness_preprod > backup.sql

# Restaurer
docker exec -i teamfitness-db-preprod psql -U admin fitness_preprod < backup.sql
```

---

## 📚 Ressources

- [Documentation PM2](https://pm2.keymetrics.io/)
- [NVM Documentation](https://github.com/nvm-sh/nvm)
- [Docker Compose](https://docs.docker.com/compose/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## 🎯 Checklist de déploiement

- [ ] Node.js installé via NVM
- [ ] NVM configuré dans `~/.bashrc` ou `~/.zshrc`
- [ ] PM2 installé globalement
- [ ] Docker installé et démarré
- [ ] Fichier `.env.preprod` créé et configuré
- [ ] Dossier `logs/` créé
- [ ] Base de données PostgreSQL démarrée
- [ ] Serveur Node.js lancé avec PM2
- [ ] PM2 startup configuré
- [ ] Configuration PM2 sauvegardée
- [ ] Service systemd vérifié
- [ ] Test de l'API effectué (`curl http://localhost:3001/health`)
- [ ] Logs vérifiés (aucune erreur critique)

---

**📝 Dernière mise à jour** : 15 novembre 2025  
**✍️ Auteur** : Team Fitness DevOps  
**📧 Support** : [Créer une issue](https://github.com/TeamFitness/db-server/issues)
