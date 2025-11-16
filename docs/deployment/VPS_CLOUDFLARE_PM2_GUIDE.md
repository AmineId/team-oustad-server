# 🎓 Guide Complet : VPS, Cloudflare & PM2

## 📖 Guide d'apprentissage pour maîtriser le déploiement d'applications Node.js

Ce guide est conçu pour vous apprendre progressivement à :
- 🖥️ Gérer un VPS (Virtual Private Server)
- ☁️ Utiliser Cloudflare pour sécuriser et accélérer votre application
- 🔄 Maîtriser PM2 pour la gestion de processus Node.js

---

## 📋 Table des matières

1. [VPS - Les Fondamentaux](#1-vps---les-fondamentaux)
2. [Cloudflare - Protection et Performance](#2-cloudflare---protection-et-performance)
3. [PM2 - Gestion de Processus](#3-pm2---gestion-de-processus)
4. [Intégration Complète](#4-intégration-complète)
5. [Cas Pratiques](#5-cas-pratiques)
6. [Ressources et Formation Continue](#6-ressources-et-formation-continue)

---

## 1. VPS - Les Fondamentaux

### 🎯 Qu'est-ce qu'un VPS ?

Un **VPS (Virtual Private Server)** est un serveur virtuel qui vous donne un contrôle total sur un environnement Linux isolé.

```
┌─────────────────────────────────────────────┐
│        SERVEUR PHYSIQUE (Provider)          │
├─────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  VPS #1  │  │  VPS #2  │  │  VPS #3  │  │
│  │  (Vous)  │  │ (Client) │  │ (Client) │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│       ▲             ▲             ▲         │
│       └─────────────┴─────────────┘         │
│         Hyperviseur (Isolation)             │
└─────────────────────────────────────────────┘
```

### 🏗️ Architecture d'un VPS

```
┌─────────────────────────────────────────────────────────┐
│                    VOTRE VPS                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────┐           │
│  │        Système d'exploitation           │           │
│  │         (Ubuntu 22.04 LTS)              │           │
│  └─────────────────┬───────────────────────┘           │
│                    │                                    │
│  ┌─────────────────┴───────────────────────┐           │
│  │           Services Système               │           │
│  ├─────────────────────────────────────────┤           │
│  │  • SSH (Port 22)     - Connexion        │           │
│  │  • Firewall (UFW)    - Sécurité         │           │
│  │  • Systemd           - Services         │           │
│  │  • Cron              - Tâches planifiées│           │
│  └─────────────────┬───────────────────────┘           │
│                    │                                    │
│  ┌─────────────────┴───────────────────────┐           │
│  │          Applications                    │           │
│  ├─────────────────────────────────────────┤           │
│  │  • Docker         - Containers          │           │
│  │  • Node.js (NVM)  - Runtime             │           │
│  │  • PM2            - Process Manager     │           │
│  │  • Nginx          - Reverse Proxy       │           │
│  └─────────────────────────────────────────┘           │
│                                                         │
└─────────────────────────────────────────────────────────┘
         │
         │ Internet (IP Publique: 46.62.194.206)
         │
         ▼
    ┌─────────┐
    │  Users  │
    └─────────┘
```

### 📚 Niveau 1 : Premiers pas avec VPS

#### 1.1 Se connecter à votre VPS

```bash
# Connexion SSH basique
ssh root@46.62.194.206

# Avec une clé SSH (plus sécurisé)
ssh -i ~/.ssh/ma_cle_privee root@46.62.194.206

# Avec un port personnalisé
ssh -p 2222 root@46.62.194.206
```

#### 1.2 Commandes essentielles Linux

```bash
# ═══════════════════════════════════════════════════════
# NAVIGATION ET FICHIERS
# ═══════════════════════════════════════════════════════

# Afficher le répertoire courant
pwd

# Lister les fichiers
ls -la              # Liste détaillée avec fichiers cachés
ls -lh              # Tailles en format lisible (KB, MB, GB)

# Naviguer
cd /var/www         # Aller dans un dossier
cd ..               # Dossier parent
cd ~                # Retour à /root (home)

# Créer/Supprimer
mkdir mon_dossier   # Créer un dossier
rm fichier.txt      # Supprimer un fichier
rm -rf dossier/     # Supprimer un dossier (DANGER!)
mv ancien nouveau   # Renommer/Déplacer
cp source dest      # Copier

# ═══════════════════════════════════════════════════════
# VISUALISATION DE FICHIERS
# ═══════════════════════════════════════════════════════

# Afficher le contenu d'un fichier
cat fichier.txt                  # Tout le fichier
head -n 20 fichier.txt          # Les 20 premières lignes
tail -n 50 fichier.txt          # Les 50 dernières lignes
tail -f fichier.log             # Suivre en temps réel (logs)
less fichier.txt                # Navigation interactive (q pour quitter)

# Rechercher dans un fichier
grep "error" fichier.log        # Chercher "error"
grep -i "error" fichier.log     # Insensible à la casse
grep -r "TODO" .                # Recherche récursive

# ═══════════════════════════════════════════════════════
# ÉDITION DE FICHIERS
# ═══════════════════════════════════════════════════════

# Éditeurs disponibles
nano fichier.txt    # Éditeur simple (Ctrl+X pour sauver)
vim fichier.txt     # Éditeur avancé (:wq pour sauver et quitter)

# ═══════════════════════════════════════════════════════
# GESTION DES PROCESSUS
# ═══════════════════════════════════════════════════════

# Voir les processus
ps aux                          # Tous les processus
ps aux | grep node              # Processus Node.js uniquement
top                             # Moniteur en temps réel (q pour quitter)
htop                            # Top amélioré (plus visuel)

# Tuer un processus
kill 1234                       # Par PID (Process ID)
kill -9 1234                    # Forcer l'arrêt
killall node                    # Tuer tous les processus "node"

# ═══════════════════════════════════════════════════════
# UTILISATION DISQUE ET MÉMOIRE
# ═══════════════════════════════════════════════════════

# Espace disque
df -h                           # Espace disque global
du -sh /var/www/*               # Taille des dossiers
du -ah --max-depth=1 .          # Taille détaillée

# Mémoire RAM
free -h                         # Utilisation mémoire
cat /proc/meminfo               # Détails mémoire

# ═══════════════════════════════════════════════════════
# RÉSEAU
# ═══════════════════════════════════════════════════════

# Informations réseau
ip addr                         # Adresses IP
ifconfig                        # Ancienne commande (deprecated)
curl ifconfig.me                # Votre IP publique

# Ports ouverts
netstat -tulpn                  # Tous les ports en écoute
ss -tulpn                       # Alternative moderne
lsof -i :3001                   # Quel processus utilise le port 3001?

# Tester une connexion
ping google.com                 # Test de connectivité
curl http://localhost:3001/health  # Tester une API locale
wget https://example.com        # Télécharger un fichier

# ═══════════════════════════════════════════════════════
# PERMISSIONS
# ═══════════════════════════════════════════════════════

# Changer les permissions
chmod 755 script.sh             # rwxr-xr-x
chmod +x script.sh              # Ajouter exécution
chmod 600 .env                  # Lecture/écriture propriétaire uniquement

# Changer le propriétaire
chown user:group fichier.txt
chown -R www-data:www-data /var/www/html

# ═══════════════════════════════════════════════════════
# ARCHIVES ET COMPRESSION
# ═══════════════════════════════════════════════════════

# Créer une archive
tar -czf backup.tar.gz dossier/     # Compresser
tar -xzf backup.tar.gz              # Décompresser

# Zip
zip -r archive.zip dossier/         # Créer un zip
unzip archive.zip                   # Extraire
```

### 📚 Niveau 2 : Sécuriser votre VPS

#### 2.1 Configuration du Firewall (UFW)

```bash
# Installer UFW (Ubuntu Firewall)
sudo apt update
sudo apt install ufw

# Configuration de base
sudo ufw default deny incoming     # Bloquer tout par défaut
sudo ufw default allow outgoing    # Autoriser sortant

# Autoriser les services essentiels
sudo ufw allow 22/tcp              # SSH
sudo ufw allow 80/tcp              # HTTP
sudo ufw allow 443/tcp             # HTTPS
sudo ufw allow 3001/tcp            # Votre API (preprod)

# Activer le firewall
sudo ufw enable

# Vérifier le statut
sudo ufw status verbose

# Supprimer une règle
sudo ufw delete allow 3001/tcp
```

#### 2.2 Sécuriser SSH

```bash
# Éditer la configuration SSH
sudo nano /etc/ssh/sshd_config

# Modifications recommandées :
# ─────────────────────────────
Port 2222                          # Changer le port par défaut
PermitRootLogin no                 # Désactiver login root direct
PasswordAuthentication no          # Utiliser uniquement les clés SSH
PubkeyAuthentication yes           # Activer l'authentification par clé

# Redémarrer SSH
sudo systemctl restart sshd

# ⚠️ IMPORTANT : Ne fermez pas votre session avant de tester !
# Ouvrez un nouveau terminal et testez :
ssh -p 2222 votre_user@46.62.194.206
```

#### 2.3 Créer un utilisateur non-root

```bash
# Créer un nouvel utilisateur
sudo adduser deploy

# Ajouter aux sudoers (droits admin)
sudo usermod -aG sudo deploy

# Configurer les clés SSH pour ce user
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys

# Tester la connexion
ssh deploy@46.62.194.206
```

#### 2.4 Fail2Ban - Protection contre les attaques

```bash
# Installer Fail2Ban
sudo apt install fail2ban

# Créer une configuration locale
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Éditer la configuration
sudo nano /etc/fail2ban/jail.local

# Configuration recommandée pour SSH :
# ────────────────────────────────────
[sshd]
enabled = true
port = 2222              # Votre port SSH
filter = sshd
logpath = /var/log/auth.log
maxretry = 3             # Nombre d'essais avant ban
bantime = 3600           # Durée du ban (1h)
findtime = 600           # Fenêtre de temps (10 min)

# Démarrer Fail2Ban
sudo systemctl start fail2ban
sudo systemctl enable fail2ban

# Vérifier le statut
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

### 📚 Niveau 3 : Gestion des services

#### 3.1 Systemd - Gestionnaire de services

```bash
# ═══════════════════════════════════════════════════════
# COMMANDES DE BASE
# ═══════════════════════════════════════════════════════

# Démarrer un service
sudo systemctl start nginx

# Arrêter un service
sudo systemctl stop nginx

# Redémarrer un service
sudo systemctl restart nginx

# Recharger la config (sans arrêter)
sudo systemctl reload nginx

# Activer au démarrage
sudo systemctl enable nginx

# Désactiver au démarrage
sudo systemctl disable nginx

# Voir le statut
sudo systemctl status nginx

# Voir tous les services
systemctl list-units --type=service

# Voir les logs d'un service
sudo journalctl -u nginx
sudo journalctl -u nginx -f          # Suivre en temps réel
sudo journalctl -u nginx --since today
sudo journalctl -u nginx --since "2 hours ago"
```

#### 3.2 Créer un service systemd personnalisé

```bash
# Exemple : Service pour votre API Node.js (alternative à PM2)
sudo nano /etc/systemd/system/teamfitness-preprod.service
```

Contenu du fichier :

```ini
[Unit]
Description=Team Fitness API - Preprod
Documentation=https://github.com/TeamFitness/db-server
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/root/team-server/db-server
Environment=NODE_ENV=preprod
EnvironmentFile=/root/team-server/db-server/.env.preprod
ExecStart=/root/.nvm/versions/node/v24.11.1/bin/node index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/teamfitness-preprod.log
StandardError=append:/var/log/teamfitness-preprod-error.log

# Limites de ressources
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

Activer le service :

```bash
# Recharger systemd
sudo systemctl daemon-reload

# Démarrer le service
sudo systemctl start teamfitness-preprod

# Activer au boot
sudo systemctl enable teamfitness-preprod

# Vérifier
sudo systemctl status teamfitness-preprod
```

---

## 2. Cloudflare - Protection et Performance

### 🎯 Qu'est-ce que Cloudflare ?

Cloudflare est un **CDN (Content Delivery Network)** et **WAF (Web Application Firewall)** qui :
- 🛡️ Protège contre les attaques DDoS
- 🚀 Accélère votre site avec un cache global
- 🔒 Fournit des certificats SSL gratuits
- 🌐 Offre un DNS rapide et fiable
- 🔐 Cache et optimise le contenu

```
┌──────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE CLOUDFLARE                   │
└──────────────────────────────────────────────────────────────┘

    Utilisateur                Cloudflare                VPS
        │                          │                      │
        │  1. GET /api/users       │                      │
        ├─────────────────────────►│                      │
        │                          │                      │
        │                    ┌─────┴──────┐              │
        │                    │  Cache ?   │              │
        │                    └─────┬──────┘              │
        │                          │                      │
        │                     OUI  │  NON                 │
        │            ┌─────────────┼──────────────┐       │
        │            │             │              │       │
        │      ┌─────▼─────┐ ┌────▼────────┐     │       │
        │      │ Réponse   │ │  Proxy      │     │       │
        │      │ depuis    │ │  Request    ├─────┼──────►│
        │      │ Cache     │ │  vers VPS   │     │       │
        │      └─────┬─────┘ └────┬────────┘     │       │
        │            │             │              │       │
        │◄───────────┴─────────────┴──────────────┘       │
        │                                                  │
        │  2. Réponse (rapide et sécurisée)               │
        │                                                  │

         Protection DDoS, SSL/TLS, Compression, Minification
```

### 📚 Niveau 1 : Configuration Cloudflare DNS

#### 1.1 Ajouter votre domaine

```bash
# Étapes dans l'interface Cloudflare :
# ────────────────────────────────────

1. Créer un compte sur https://cloudflare.com
2. Cliquer sur "Add a Site"
3. Entrer votre domaine : team-oustad.com
4. Choisir le plan (Free suffit pour commencer)
5. Cloudflare va scanner vos DNS existants
6. Vérifier et confirmer les enregistrements
7. Changer les nameservers chez votre registrar :
   
   Exemples de nameservers Cloudflare :
   ─────────────────────────────────────
   ns1.cloudflare.com
   ns2.cloudflare.com
   
8. Attendre la propagation (5 min à 24h)
```

#### 1.2 Configurer les enregistrements DNS

```
┌─────────────────────────────────────────────────────────────┐
│              PANNEAU DNS CLOUDFLARE                         │
├──────┬──────────┬────────────────────────┬────────┬─────────┤
│ Type │   Name   │        Content         │  TTL   │  Proxy  │
├──────┼──────────┼────────────────────────┼────────┼─────────┤
│  A   │    @     │    46.62.194.206       │  Auto  │  ☁️ ON  │
│  A   │   www    │    46.62.194.206       │  Auto  │  ☁️ ON  │
│  A   │   api    │    46.62.194.206       │  Auto  │  ☁️ ON  │
│ CNAME│  preprod │  api.team-oustad.com   │  Auto  │  ☁️ ON  │
└──────┴──────────┴────────────────────────┴────────┴─────────┘

Résultat :
──────────
team-oustad.com           → 46.62.194.206 (site principal)
www.team-oustad.com       → 46.62.194.206 (alias)
api.team-oustad.com       → 46.62.194.206 (API prod)
api-pprod.team-oustad.com → 46.62.194.206 (API preprod)
```

**☁️ Proxy (Orange Cloud)** :
- **ON** : Trafic passe par Cloudflare (recommandé)
- **OFF** : Connexion directe au VPS (pas de protection)

### 📚 Niveau 2 : SSL/TLS avec Cloudflare

#### 2.1 Choisir le mode SSL

```
┌─────────────────────────────────────────────────────────┐
│             MODES SSL/TLS CLOUDFLARE                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. OFF (❌ Non recommandé)                             │
│     User ──HTTP──► Cloudflare ──HTTP──► VPS            │
│     Aucun chiffrement                                   │
│                                                         │
│  2. FLEXIBLE (⚠️ Éviter si possible)                    │
│     User ──HTTPS──► Cloudflare ──HTTP──► VPS           │
│     Chiffré jusqu'à Cloudflare seulement               │
│                                                         │
│  3. FULL (✅ Bon)                                        │
│     User ──HTTPS──► Cloudflare ──HTTPS──► VPS          │
│     Certificat auto-signé sur VPS accepté              │
│                                                         │
│  4. FULL (STRICT) (🏆 Meilleur)                         │
│     User ──HTTPS──► Cloudflare ──HTTPS──► VPS          │
│     Certificat valide requis sur VPS                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 2.2 Configuration recommandée

```bash
# Dans le dashboard Cloudflare :
# ─────────────────────────────

SSL/TLS → Overview
├─ Mode: Full (strict)
│
SSL/TLS → Edge Certificates
├─ Always Use HTTPS: ON
├─ Minimum TLS Version: TLS 1.2
├─ Opportunistic Encryption: ON
├─ TLS 1.3: ON
├─ Automatic HTTPS Rewrites: ON
└─ Certificate Transparency Monitoring: ON
```

### 📚 Niveau 3 : Cloudflare Tunnel (Alternative au port forwarding)

#### 3.1 Qu'est-ce qu'un Cloudflare Tunnel ?

Au lieu d'exposer directement votre VPS avec des ports ouverts, le tunnel crée une connexion sécurisée sortante.

```
┌──────────────────────────────────────────────────────────┐
│         TUNNEL CLOUDFLARE (Méthode sécurisée)            │
└──────────────────────────────────────────────────────────┘

    Internet              Cloudflare Edge         Votre VPS
        │                       │                     │
        │                       │                     │
        │  1. Request           │   Tunnel sortant    │
        │  GET api.domain.com   │◄────────────────────┤
        ├──────────────────────►│                     │
        │                       │                     │
        │                  ┌────┴─────┐              │
        │                  │ Routing  │              │
        │                  │ & Cache  │              │
        │                  └────┬─────┘              │
        │                       │                     │
        │                       ├────────────────────►│
        │                       │  2. Forward via     │
        │                       │     tunnel          │
        │                       │                     │
        │                       │◄────────────────────┤
        │                       │  3. Response        │
        │◄──────────────────────┤                     │
        │  4. Response to user  │                     │
        │                       │                     │

Avantages :
──────────
✅ Pas besoin d'ouvrir les ports 80/443 sur le VPS
✅ Protection DDoS intégrée
✅ IP du VPS restent cachée
✅ Connexion chiffrée de bout en bout
```

#### 3.2 Installer et configurer Cloudflare Tunnel

```bash
# ═══════════════════════════════════════════════════════
# INSTALLATION
# ═══════════════════════════════════════════════════════

# Méthode 1 : Via le gestionnaire de paquets (recommandé)
# Ajouter le repository Cloudflare
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-archive-keyring.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-archive-keyring.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Installer
sudo apt update
sudo apt install cloudflared

# Vérifier
cloudflared --version

# ═══════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════

# 1. Se connecter à Cloudflare
cloudflared tunnel login
# Une URL s'affiche, ouvrez-la dans un navigateur
# Sélectionnez votre domaine et autorisez

# 2. Créer un tunnel
cloudflared tunnel create teamfitness-preprod
# Note: Gardez l'UUID du tunnel affiché !

# 3. Lister vos tunnels
cloudflared tunnel list

# 4. Créer le fichier de configuration
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

Contenu de `config.yml` :

```yaml
# Cloudflare Tunnel Configuration
tunnel: <VOTRE_TUNNEL_UUID>
credentials-file: /root/.cloudflared/<VOTRE_TUNNEL_UUID>.json

# Services à exposer
ingress:
  # API Preprod
  - hostname: api-pprod.team-oustad.com
    service: http://localhost:3001
    originRequest:
      noTLSVerify: true
  
  # API Production
  - hostname: api.team-oustad.com
    service: http://localhost:3002
    originRequest:
      noTLSVerify: true
  
  # Dashboard monitoring (optionnel)
  - hostname: monitor.team-oustad.com
    service: http://localhost:9090
  
  # Règle par défaut (obligatoire)
  - service: http_status:404
```

```bash
# 5. Créer les enregistrements DNS automatiquement
cloudflared tunnel route dns teamfitness-preprod api-pprod.team-oustad.com
cloudflared tunnel route dns teamfitness-preprod api.team-oustad.com

# Ou manuellement dans le dashboard Cloudflare :
# Type: CNAME
# Name: api-pprod
# Content: <TUNNEL_UUID>.cfargotunnel.com

# 6. Tester le tunnel
cloudflared tunnel run teamfitness-preprod

# 7. Installer comme service (démarrage automatique)
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Vérifier
sudo systemctl status cloudflared
```

#### 3.3 Gestion du tunnel

```bash
# Voir les logs
sudo journalctl -u cloudflared -f

# Redémarrer
sudo systemctl restart cloudflared

# Arrêter
sudo systemctl stop cloudflared

# Mettre à jour la configuration
sudo nano /etc/cloudflared/config.yml
sudo systemctl restart cloudflared

# Supprimer un tunnel
cloudflared tunnel delete teamfitness-preprod
```

### 📚 Niveau 4 : Optimisations Cloudflare

#### 4.1 Page Rules (Règles de cache et sécurité)

```bash
# Dans le dashboard Cloudflare → Rules → Page Rules
# ─────────────────────────────────────────────────

# Exemple 1 : Cache agressif pour les assets statiques
URL: api.team-oustad.com/public/*
Settings:
├─ Cache Level: Cache Everything
├─ Edge Cache TTL: 1 month
└─ Browser Cache TTL: 1 day

# Exemple 2 : Bypass cache pour l'API
URL: api.team-oustad.com/api/*
Settings:
└─ Cache Level: Bypass

# Exemple 3 : Toujours HTTPS
URL: *team-oustad.com/*
Settings:
└─ Always Use HTTPS: ON

# Exemple 4 : Rate limiting (anti-spam)
URL: api.team-oustad.com/auth/login
Settings:
└─ Rate Limiting: 5 requests per 10 seconds per IP
```

#### 4.2 Firewall Rules

```bash
# Exemples de règles WAF (Web Application Firewall)
# ──────────────────────────────────────────────────

# 1. Bloquer des pays spécifiques
(ip.geoip.country in {"CN" "RU" "KP"})
Action: Block

# 2. Protéger l'endpoint de login
(http.request.uri.path eq "/auth/login" and http.request.method eq "POST")
and rate.limit.requests > 5 per 60s
Action: Challenge (CAPTCHA)

# 3. Bloquer les user-agents suspects
(http.user_agent contains "bot" or http.user_agent contains "scan")
and not (http.user_agent contains "Googlebot")
Action: Block

# 4. Whitelist d'IP de confiance
(ip.src eq 1.2.3.4 or ip.src eq 5.6.7.8)
Action: Allow

# 5. Protection contre les injections SQL
(http.request.uri.query contains "select" and http.request.uri.query contains "from")
or (http.request.uri.query contains "union" and http.request.uri.query contains "select")
Action: Block
```

---

## 3. PM2 - Gestion de Processus

### 🎯 Qu'est-ce que PM2 ?

PM2 est un **gestionnaire de processus** pour Node.js qui :
- 🔄 Redémarre automatiquement en cas de crash
- 📊 Fournit un monitoring en temps réel
- 📈 Permet le clustering (multi-core)
- 📝 Gère les logs
- 🚀 Zero-downtime reload

```
┌──────────────────────────────────────────────────────────┐
│                    ARCHITECTURE PM2                      │
└──────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────┐
    │          PM2 Daemon                 │
    │     (Process Manager)               │
    └───────────────┬─────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
    ┌───────┐  ┌───────┐  ┌───────┐
    │ App 1 │  │ App 2 │  │ App 3 │
    │ Port  │  │ Port  │  │ Port  │
    │ 3001  │  │ 3002  │  │ 3003  │
    └───────┘  └───────┘  └───────┘
        │           │           │
        └───────────┴───────────┘
                    │
            Monitoring, Logs,
           Auto-restart, etc.
```

### 📚 Niveau 1 : Installation et bases

#### 1.1 Installation

```bash
# Avec NVM (recommandé)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Installer PM2
npm install -g pm2

# Vérifier
pm2 --version

# Mettre à jour PM2
npm install -g pm2@latest
pm2 update  # Mettre à jour le daemon
```

#### 1.2 Commandes de base

```bash
# ═══════════════════════════════════════════════════════
# DÉMARRAGE
# ═══════════════════════════════════════════════════════

# Démarrer une application simple
pm2 start app.js

# Avec un nom personnalisé
pm2 start app.js --name "mon-app"

# Avec des variables d'environnement
pm2 start app.js --name "api" --env production

# Avec un fichier de config (recommandé)
pm2 start ecosystem.config.js

# Démarrer uniquement une app spécifique
pm2 start ecosystem.config.js --only api-preprod

# ═══════════════════════════════════════════════════════
# GESTION
# ═══════════════════════════════════════════════════════

# Lister toutes les apps
pm2 list
pm2 ls                # Alias

# Arrêter une app
pm2 stop api
pm2 stop 0           # Par ID
pm2 stop all         # Tout arrêter

# Redémarrer
pm2 restart api
pm2 restart all

# Recharger (zero-downtime, cluster uniquement)
pm2 reload api

# Supprimer une app de PM2
pm2 delete api
pm2 delete all

# ═══════════════════════════════════════════════════════
# LOGS
# ═══════════════════════════════════════════════════════

# Voir tous les logs en temps réel
pm2 logs

# Logs d'une app spécifique
pm2 logs api

# Dernières 100 lignes
pm2 logs api --lines 100

# Logs sans streaming
pm2 logs api --nostream

# Vider les logs
pm2 flush
pm2 flush api

# ═══════════════════════════════════════════════════════
# MONITORING
# ═══════════════════════════════════════════════════════

# Moniteur temps réel (CPU, RAM)
pm2 monit

# Informations détaillées
pm2 show api
pm2 describe api

# Statistiques
pm2 status
```

### 📚 Niveau 2 : Configuration avancée (ecosystem.config.js)

#### 2.1 Structure complète

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    // ═══════════════════════════════════════════════════════
    // APPLICATION PREPROD
    // ═══════════════════════════════════════════════════════
    {
      name: 'api-preprod',
      script: './index.js',
      
      // Environnement
      env_file: '.env.preprod',  // Charger depuis fichier
      env: {
        NODE_ENV: 'preprod',
        PORT: 3001
      },
      
      // Mode d'exécution
      instances: 1,              // Nombre d'instances
      exec_mode: 'fork',         // 'fork' ou 'cluster'
      
      // Logs
      error_file: './logs/preprod-error.log',
      out_file: './logs/preprod-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Restart strategy
      autorestart: true,         // Auto-restart en cas de crash
      max_restarts: 10,          // Max 10 redémarrages
      min_uptime: '10s',         // Uptime minimum avant de compter
      max_memory_restart: '500M',// Restart si > 500MB
      restart_delay: 4000,       // Attente avant restart (ms)
      
      // Monitoring
      watch: false,              // Ne pas watch les fichiers (prod)
      ignore_watch: ['node_modules', 'logs'],
      
      // Gestion des erreurs
      kill_timeout: 5000,        // Timeout avant SIGKILL (ms)
      listen_timeout: 3000,      // Timeout écoute (ms)
      shutdown_with_message: true,
      
      // Cron restart (optionnel)
      cron_restart: '0 4 * * *', // Restart à 4h du matin
      
      // Time
      time: true,                // Ajouter timestamp aux logs
    },
    
    // ═══════════════════════════════════════════════════════
    // APPLICATION PRODUCTION (Cluster mode)
    // ═══════════════════════════════════════════════════════
    {
      name: 'api-prod',
      script: './index.js',
      
      env_file: '.env.prod',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      
      // Cluster = utiliser tous les CPU
      instances: 'max',          // Utilise tous les CPU
      exec_mode: 'cluster',
      
      error_file: './logs/prod-error.log',
      out_file: './logs/prod-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      
      // Zero-downtime deployment
      kill_timeout: 5000,
      listen_timeout: 3000,
      wait_ready: true,          // Attendre app.listen()
      
      watch: false,
    },
  ],
  
  // ═══════════════════════════════════════════════════════
  // DÉPLOIEMENT (optionnel)
  // ═══════════════════════════════════════════════════════
  deploy: {
    production: {
      user: 'deploy',
      host: '46.62.194.206',
      ref: 'origin/main',
      repo: 'git@github.com:TeamFitness/db-server.git',
      path: '/var/www/production',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --only api-prod'
    },
    preprod: {
      user: 'deploy',
      host: '46.62.194.206',
      ref: 'origin/develop',
      repo: 'git@github.com:TeamFitness/db-server.git',
      path: '/var/www/preprod',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --only api-preprod'
    }
  }
};
```

### 📚 Niveau 3 : Clustering et Load Balancing

#### 3.1 Mode Cluster

```javascript
// Utiliser tous les CPU disponibles
{
  name: 'api-prod',
  script: './index.js',
  instances: 'max',        // Tous les CPU
  exec_mode: 'cluster',
}

// Ou nombre spécifique
{
  instances: 4,            // 4 processus
  exec_mode: 'cluster',
}
```

```
┌──────────────────────────────────────────────────────────┐
│              PM2 CLUSTER MODE (4 CPUs)                   │
└──────────────────────────────────────────────────────────┘

                    Requêtes entrantes
                            │
                            ▼
                    ┌───────────────┐
                    │  Load Balancer│
                    │  (Round Robin)│
                    └───────┬───────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
        ┌───────┐       ┌───────┐     ┌───────┐
        │Worker │       │Worker │ ... │Worker │
        │CPU 1  │       │CPU 2  │     │CPU 4  │
        │Port   │       │Port   │     │Port   │
        │3002   │       │3002   │     │3002   │
        └───────┘       └───────┘     └───────┘

Avantages :
──────────
✅ Utilise tous les CPU
✅ Load balancing automatique
✅ Si un worker crash, les autres continuent
✅ Zero-downtime reload possible
```

#### 3.2 Zero-Downtime Deployment

```bash
# Méthode 1 : Reload (cluster uniquement)
pm2 reload api-prod

# Méthode 2 : Graceful reload avec ecosystem
pm2 reload ecosystem.config.js --only api-prod

# Processus :
# 1. PM2 démarre de nouveaux workers
# 2. Les nouveaux workers sont prêts
# 3. PM2 envoie SIGINT aux anciens workers
# 4. Les anciens terminent leurs requêtes en cours
# 5. Les anciens s'arrêtent
# Résultat : Aucune requête perdue !
```

### 📚 Niveau 4 : Startup et Persistence

#### 4.1 Démarrage automatique au boot

```bash
# Générer le script de startup
pm2 startup

# Copier-coller la commande affichée (exemple Ubuntu) :
sudo env PATH=$PATH:/root/.nvm/versions/node/v24.11.1/bin \
  pm2 startup systemd -u root --hp /root

# Sauvegarder la configuration actuelle
pm2 save

# Résultat : PM2 redémarrera au boot avec toutes vos apps !
```

#### 4.2 Gestion de la configuration sauvegardée

```bash
# Sauvegarder l'état actuel
pm2 save

# Restaurer depuis la sauvegarde
pm2 resurrect

# Voir la liste sauvegardée
cat ~/.pm2/dump.pm2

# Supprimer la sauvegarde
pm2 cleardump

# Désactiver le startup
pm2 unstartup
```

### 📚 Niveau 5 : Monitoring avancé

#### 5.1 PM2 Plus (Monitoring cloud - optionnel)

```bash
# S'inscrire sur https://app.pm2.io

# Lier votre serveur
pm2 link <SECRET_KEY> <PUBLIC_KEY>

# Fonctionnalités PM2 Plus :
# ──────────────────────────
# ✅ Dashboard web en temps réel
# ✅ Alertes email/SMS
# ✅ Historique des métriques
# ✅ Gestion à distance
# ✅ Comparaison de performances
```

#### 5.2 Modules PM2

```bash
# Rotation des logs automatique
pm2 install pm2-logrotate

# Configuration
pm2 set pm2-logrotate:max_size 10M        # Taille max par fichier
pm2 set pm2-logrotate:retain 7            # Garder 7 fichiers
pm2 set pm2-logrotate:compress true       # Compresser les anciens logs
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'  # Rotation à minuit

# Serveur web de monitoring
pm2 install pm2-server-monit

# Voir les modules installés
pm2 ls
```

---

## 4. Intégration Complète

### 🎯 Stack complète : VPS + Cloudflare + PM2

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        ARCHITECTURE COMPLÈTE                              │
└───────────────────────────────────────────────────────────────────────────┘

    Utilisateur                                                   VPS
        │                                                          │
        │  1. https://api.team-oustad.com/users                   │
        ▼                                                          │
┌────────────────┐                                                │
│   CLOUDFLARE   │                                                │
├────────────────┤                                                │
│  • DNS         │                                                │
│  • SSL/TLS     │                                                │
│  • WAF         │                                                │
│  • DDoS        │                                                │
│  • Cache CDN   │                                                │
└────────┬───────┘                                                │
         │                                                         │
         │  2. Route vers VPS                                     │
         │     (via Tunnel ou IP directe)                         │
         ▼                                                         │
    ┌────────────────────────────────────────────────┐           │
    │            CLOUDFLARE TUNNEL (optionnel)       │           │
    │         cloudflared (Port 7844)                │           │
    └────────────────────┬───────────────────────────┘           │
                         │                                        │
                         │  3. Forward to localhost               │
                         ▼                                        │
                    ┌─────────────────────────┐                  │
                    │    NGINX (optionnel)    │                  │
                    │    Reverse Proxy        │                  │
                    │    Port 80/443          │                  │
                    └───────────┬─────────────┘                  │
                                │                                 │
                                │  4. Proxy to apps               │
                                ▼                                 │
                    ┌────────────────────────┐                   │
                    │         PM2            │                   │
                    │   Process Manager      │                   │
                    └─────────┬──────────────┘                   │
                              │                                   │
                ┌─────────────┼─────────────┐                   │
                │             │             │                   │
                ▼             ▼             ▼                   │
           ┌────────┐   ┌────────┐   ┌────────┐               │
           │ Node.js│   │ Node.js│   │ Node.js│               │
           │ Worker │   │ Worker │   │ Worker │               │
           │ Port   │   │ Port   │   │ Port   │               │
           │ 3001   │   │ 3002   │   │ 3003   │               │
           └────┬───┘   └────┬───┘   └────┬───┘               │
                │            │            │                     │
                └────────────┴────────────┘                     │
                              │                                 │
                              ▼                                 │
                    ┌──────────────────┐                        │
                    │   PostgreSQL     │                        │
                    │   Docker         │                        │
                    │   Port 5432-5434 │                        │
                    └──────────────────┘                        │
```

### 📚 Configuration complète step-by-step

#### Étape 1 : Préparer le VPS

```bash
# 1. Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# 2. Installer les outils essentiels
sudo apt install -y curl wget git build-essential ufw fail2ban

# 3. Configurer le firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# 4. Installer Node.js via NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20

# 5. Installer PM2
npm install -g pm2

# 6. Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

#### Étape 2 : Déployer l'application

```bash
# 1. Cloner le projet
cd /root
git clone https://github.com/TeamFitness/db-server.git
cd db-server

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.preprod.example .env.preprod
nano .env.preprod
# Éditer avec vos vraies valeurs

# 4. Créer le dossier logs
mkdir -p logs

# 5. Démarrer la base de données
docker compose -f config/docker-compose-multi-env.yml up -d postgres-preprod

# 6. Lancer les migrations Prisma
npx prisma migrate deploy --schema=./prisma/schema.prisma

# 7. Démarrer avec PM2
pm2 start index.js \
  --name teamfitness-preprod \
  --node-args="-r dotenv/config" \
  -- dotenv_config_path=.env.preprod

# 8. Sauvegarder la config PM2
pm2 save

# 9. Activer le démarrage automatique
pm2 startup
# Copier-coller la commande affichée
```

#### Étape 3 : Configurer Cloudflare

```bash
# Option A : Via Dashboard (méthode simple)
# ─────────────────────────────────────────
# 1. Aller sur https://dash.cloudflare.com
# 2. Ajouter votre domaine
# 3. Configurer les DNS records
# 4. Choisir SSL/TLS Full (strict)
# 5. Activer Always Use HTTPS

# Option B : Via Cloudflare Tunnel (méthode sécurisée)
# ────────────────────────────────────────────────────
# 1. Installer cloudflared
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | \
  sudo tee /usr/share/keyrings/cloudflare-archive-keyring.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-archive-keyring.gpg] \
  https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | \
  sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update
sudo apt install cloudflared

# 2. Authentifier
cloudflared tunnel login

# 3. Créer un tunnel
cloudflared tunnel create teamfitness

# 4. Configurer
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml

# Contenu :
# ─────────
# tunnel: <UUID>
# credentials-file: /root/.cloudflared/<UUID>.json
# ingress:
#   - hostname: api-pprod.team-oustad.com
#     service: http://localhost:3001
#   - service: http_status:404

# 5. Créer le DNS
cloudflared tunnel route dns teamfitness api-pprod.team-oustad.com

# 6. Installer comme service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

#### Étape 4 : Vérifier le déploiement

```bash
# 1. Vérifier PM2
pm2 list
pm2 logs teamfitness-preprod --lines 20

# 2. Vérifier Docker
docker ps

# 3. Tester localement
curl http://localhost:3001/health

# 4. Tester via le domaine
curl https://api-pprod.team-oustad.com/health

# 5. Vérifier le tunnel (si utilisé)
sudo systemctl status cloudflared

# 6. Vérifier les logs
tail -f logs/preprod-out.log
```

---

## 5. Cas Pratiques

### 🎯 Cas 1 : Déployer une mise à jour sans downtime

```bash
# Prérequis : Mode cluster activé

# 1. Se connecter au VPS
ssh root@46.62.194.206

# 2. Aller dans le projet
cd /root/team-server/db-server

# 3. Sauvegarder (optionnel)
pm2 save

# 4. Récupérer le code
git pull origin main

# 5. Installer les nouvelles dépendances
npm install

# 6. Recharger sans downtime
pm2 reload teamfitness-prod

# 7. Vérifier
pm2 logs teamfitness-prod --lines 50
curl https://api.team-oustad.com/health
```

### 🎯 Cas 2 : Gérer un crash applicatif

```bash
# 1. Voir les apps en erreur
pm2 list
# Chercher status: "errored" ou restart count élevé

# 2. Voir les logs d'erreur
pm2 logs teamfitness-preprod --err --lines 100

# 3. Identifier le problème (exemples)
# - Port déjà utilisé → Changer PORT dans .env
# - DB inaccessible → Vérifier docker ps
# - Module manquant → npm install
# - Erreur de syntaxe → Corriger le code

# 4. Redémarrer après correction
pm2 restart teamfitness-preprod

# 5. Si le problème persiste
pm2 delete teamfitness-preprod
pm2 start ecosystem.config.js --only teamfitness-preprod
```

### 🎯 Cas 3 : Optimiser les performances

```bash
# 1. Activer le mode cluster (production)
# Dans ecosystem.config.js :
{
  name: 'api-prod',
  instances: 'max',
  exec_mode: 'cluster',
}

# 2. Configurer le cache Cloudflare
# Dans le dashboard → Caching → Configuration
# - Cache Level: Standard
# - Browser Cache TTL: Respect Existing Headers
# - Page Rules pour assets statiques

# 3. Activer la compression
# Dans le dashboard → Speed → Optimization
# - Auto Minify: HTML, CSS, JS
# - Brotli: ON
# - Rocket Loader: ON (si pas d'erreurs JS)

# 4. Monitorer les performances
pm2 monit
pm2 plus  # Pour monitoring cloud

# 5. Logs rotate pour éviter saturation disque
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 🎯 Cas 4 : Sécuriser davantage

```bash
# 1. Activer Cloudflare WAF
# Dashboard → Security → WAF
# - Activer les règles OWASP
# - Créer des règles personnalisées

# 2. Rate limiting sur l'API
# Dashboard → Security → Rate Limiting
# Exemple: 100 req/min par IP sur /api/*

# 3. Protection DDoS
# Dashboard → Security → DDoS
# - Activer "I'm Under Attack Mode" si attaque en cours

# 4. Fail2Ban sur le VPS
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 5. Monitoring des intrusions
# Installer AIDE (Advanced Intrusion Detection Environment)
sudo apt install aide
sudo aideinit
sudo aide --check
```

---

## 6. Ressources et Formation Continue

### 📚 Documentation officielle

- **VPS / Linux**
  - [Ubuntu Server Guide](https://ubuntu.com/server/docs)
  - [Linux Command Line](https://linuxcommand.org/)
  - [DigitalOcean Tutorials](https://www.digitalocean.com/community/tutorials)

- **Cloudflare**
  - [Cloudflare Docs](https://developers.cloudflare.com/)
  - [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
  - [Workers & Pages](https://developers.cloudflare.com/workers/)

- **PM2**
  - [PM2 Documentation](https://pm2.keymetrics.io/docs/)
  - [PM2 Plus](https://app.pm2.io/)
  - [PM2 GitHub](https://github.com/Unitech/pm2)

### 🎓 Cours en ligne recommandés

- **Udemy**
  - "Linux Administration Bootcamp"
  - "Docker Mastery"
  - "Node.js: The Complete Guide"

- **YouTube**
  - [Traversy Media](https://www.youtube.com/user/TechGuyWeb)
  - [Fireship](https://www.youtube.com/c/Fireship)
  - [NetworkChuck](https://www.youtube.com/c/NetworkChuck)

### 🛠️ Outils utiles

```bash
# Monitoring système
htop              # Moniteur processus interactif
iotop             # Moniteur I/O disque
nethogs           # Moniteur réseau par processus
glances           # Dashboard système complet

# Installation
sudo apt install htop iotop nethogs glances

# Performance testing
ab -n 1000 -c 10 https://api.team-oustad.com/health  # Apache Bench
hey -n 1000 -c 10 https://api.team-oustad.com/health # Hey (moderne)
```

### 📊 Checklist de production

- [ ] VPS sécurisé (Firewall, Fail2Ban, SSH keys)
- [ ] Utilisateur non-root créé
- [ ] Node.js installé via NVM
- [ ] PM2 installé et configuré
- [ ] Démarrage automatique PM2 activé
- [ ] Docker installé et configuré
- [ ] Base de données PostgreSQL en production
- [ ] Cloudflare DNS configuré
- [ ] SSL/TLS Full (strict) activé
- [ ] Cloudflare Tunnel configuré (optionnel)
- [ ] Firewall rules Cloudflare configurées
- [ ] Rate limiting activé
- [ ] Logs rotate configuré
- [ ] Backups automatiques configurés
- [ ] Monitoring activé (PM2 Plus ou autre)
- [ ] Alertes configurées
- [ ] Documentation à jour

---

**📝 Version** : 1.0  
**📅 Dernière mise à jour** : 15 novembre 2025  
**✍️ Auteur** : Team Fitness DevOps  
**📧 Questions** : [Créer une issue GitHub](https://github.com/TeamFitness/db-server/issues)

---

## 💡 Conseils finaux

1. **Toujours tester en preprod avant la prod**
2. **Faire des backups réguliers (base de données + code)**
3. **Monitorer vos logs quotidiennement**
4. **Garder votre système à jour** : `sudo apt update && sudo apt upgrade`
5. **Documenter vos changements** : tenez un journal de bord
6. **Ne jamais exposer vos .env sur GitHub**
7. **Utiliser des secrets forts et uniques par environnement**

Bon courage dans votre apprentissage ! 🚀
