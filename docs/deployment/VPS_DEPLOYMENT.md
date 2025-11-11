# 🚀 Scripts de Démarrage Multi-Environnements

Scripts simples pour démarrer votre serveur Team Fitness avec PostgreSQL sur votre VPS.

## 📋 Prérequis

- Docker et Docker Compose installés
- Node.js 18+ installé
- (Optionnel) PM2 pour la gestion des processus : `npm install -g pm2`

## 🎯 Scripts disponibles

### Démarrage simple (premier plan)

```bash
# Développement (port 3000)
./bin/start-dev.sh

# Préproduction (port 3001)
./bin/start-preprod.sh

# Production (port 3002)
./bin/start-prod.sh
```

### Démarrage avec PM2 (arrière-plan)

```bash
# Préproduction avec PM2
./bin/start-preprod-pm2.sh

# Production avec PM2
./bin/start-prod-pm2.sh
```

### Arrêt

```bash
# Arrêter dev
./bin/stop-dev.sh

# Arrêter preprod
./bin/stop-preprod.sh

# Arrêter prod
./bin/stop-prod.sh
```

## 🔧 Configuration initiale sur VPS

### 1. Cloner le projet
```bash
cd ~
git clone <votre-repo>
cd team_fitness_server
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configurer les environnements
```bash
# Copier les templates
cp .env.preprod.example .env.preprod
cp .env.prod.example .env.prod

# Éditer les configurations
nano .env.preprod  # Configurer preprod
nano .env.prod     # Configurer prod
```

### 4. Installer PM2 (recommandé pour VPS)
```bash
npm install -g pm2
```

## 🚀 Utilisation sur VPS

### Option 1 : Démarrage avec PM2 (recommandé)

```bash
# Démarrer preprod en arrière-plan
./bin/start-preprod-pm2.sh

# Démarrer prod en arrière-plan
./bin/start-prod-pm2.sh

# Voir les processus
pm2 list

# Voir les logs en temps réel
pm2 logs preprod
pm2 logs prod

# Redémarrer
pm2 restart preprod
pm2 restart prod

# Arrêter
pm2 stop preprod
pm2 stop prod

# Monitoring
pm2 monit
```

### Option 2 : Démarrage avec systemd (alternative)

Créer un service systemd pour chaque environnement :

#### Service preprod : `/etc/systemd/system/teamfitness-preprod.service`

```ini
[Unit]
Description=Team Fitness Preprod Server
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=votre-user
WorkingDirectory=/home/votre-user/team_fitness_server
ExecStart=/home/votre-user/team_fitness_server/bin/start-preprod.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Service prod : `/etc/systemd/system/teamfitness-prod.service`

```ini
[Unit]
Description=Team Fitness Production Server
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=votre-user
WorkingDirectory=/home/votre-user/team_fitness_server
ExecStart=/home/votre-user/team_fitness_server/bin/start-prod.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Puis activer les services :

```bash
# Recharger systemd
sudo systemctl daemon-reload

# Activer au démarrage
sudo systemctl enable teamfitness-preprod
sudo systemctl enable teamfitness-prod

# Démarrer
sudo systemctl start teamfitness-preprod
sudo systemctl start teamfitness-prod

# Voir le statut
sudo systemctl status teamfitness-preprod
sudo systemctl status teamfitness-prod

# Voir les logs
sudo journalctl -u teamfitness-preprod -f
sudo journalctl -u teamfitness-prod -f
```

## 🔐 Configuration Nginx (reverse proxy)

Exemple de configuration Nginx pour exposer les APIs :

```nginx
# Preprod
server {
    listen 80;
    server_name preprod-api.votredomaine.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# Production
server {
    listen 80;
    server_name api.votredomaine.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Ensuite activer HTTPS avec Let's Encrypt :

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d preprod-api.votredomaine.com
sudo certbot --nginx -d api.votredomaine.com
```

## 📊 Ce que font les scripts

### `start-preprod.sh`
1. ✅ Vérifie que Docker est installé
2. ✅ Vérifie que `.env.preprod` existe
3. 🐘 Démarre PostgreSQL preprod (port 5433)
4. ⏳ Attend que PostgreSQL soit prêt
5. 🔄 Applique les migrations Prisma
6. ⚙️ Génère le client Prisma
7. 🚀 Démarre le serveur Node.js (port 3001)

### `start-prod.sh`
1. ✅ Vérifie que Docker est installé
2. ✅ Vérifie que `.env.prod` existe
3. ⚠️ Demande confirmation (production!)
4. 🐘 Démarre PostgreSQL prod (port 5434)
5. ⏳ Attend que PostgreSQL soit prêt
6. 🔄 Applique les migrations Prisma
7. ⚙️ Génère le client Prisma
8. 🚀 Démarre le serveur Node.js (port 3002)

## 🎯 Ports utilisés

| Environnement | API | PostgreSQL |
|--------------|-----|------------|
| dev | 3000 | 5432 |
| preprod | 3001 | 5433 |
| prod | 3002 | 5434 |

## 🔍 Vérifier que tout fonctionne

```bash
# Health check
curl http://localhost:3001/health  # preprod
curl http://localhost:3002/health  # prod

# API docs
curl http://localhost:3001/api-docs  # preprod
curl http://localhost:3002/api-docs  # prod
```

## 📝 Workflow recommandé sur VPS

```bash
# 1. Se connecter au VPS
ssh votre-user@votre-vps

# 2. Aller dans le dossier du projet
cd ~/team_fitness_server

# 3. Mettre à jour le code
git pull

# 4. Installer les nouvelles dépendances
npm install

# 5. Démarrer ou redémarrer preprod
./bin/start-preprod-pm2.sh
# ou si déjà démarré :
pm2 restart preprod

# 6. Tester preprod
curl http://localhost:3001/health

# 7. Si tout est OK, démarrer/redémarrer prod
./bin/start-prod-pm2.sh
# ou si déjà démarré :
pm2 reload prod  # Reload sans downtime

# 8. Vérifier prod
curl http://localhost:3002/health

# 9. Voir les logs
pm2 logs
```

## 🆘 Dépannage

### Le script ne démarre pas
```bash
# Vérifier que le script est exécutable
chmod +x bin/start-preprod.sh

# Lancer manuellement pour voir l'erreur
bash -x bin/start-preprod.sh
```

### PostgreSQL ne démarre pas
```bash
# Voir les logs Docker
docker logs teamfitness-db-preprod
docker logs teamfitness-db-prod

# Redémarrer Docker
sudo systemctl restart docker
```

### Port déjà utilisé
```bash
# Trouver le processus
sudo lsof -i :3001
sudo lsof -i :3002

# Tuer le processus
sudo kill -9 <PID>
```

### Prisma ne trouve pas la base
```bash
# Vérifier la connexion
docker exec teamfitness-db-preprod psql -U admin -d fitness_preprod -c "SELECT 1"

# Vérifier DATABASE_URL dans .env.preprod
cat .env.preprod | grep DATABASE_URL
```

## 📚 Ressources

- [Documentation PM2](https://pm2.keymetrics.io/)
- [Documentation Docker Compose](https://docs.docker.com/compose/)
- [Documentation Nginx](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
