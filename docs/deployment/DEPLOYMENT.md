# Déploiement Multi-Environnements

Ce guide explique comment déployer et gérer plusieurs instances du serveur Team Fitness (développement, préproduction et production).

## 📋 Table des matières

- [Architecture](#architecture)
- [Configuration](#configuration)
- [Déploiement Simple (sans PM2)](#déploiement-simple-sans-pm2)
- [Déploiement avec PM2 (recommandé)](#déploiement-avec-pm2-recommandé)
- [Gestion des bases de données](#gestion-des-bases-de-données)
- [Bonnes pratiques](#bonnes-pratiques)

## 🏗️ Architecture

Le serveur supporte 3 environnements distincts :

| Environnement | Port | Base de données | Fichier config | Usage |
|--------------|------|-----------------|----------------|-------|
| **dev** | 3000 | `fitness` (localhost:5432) | `.env` | Développement local |
| **preprod** | 3001 | `fitness_preprod` (localhost:5433) | `.env.preprod` | Tests avant production |
| **prod** | 3002 | `fitness_prod` (serveur distant) | `.env.prod` | Production |

## ⚙️ Configuration

### 1. Créer les fichiers d'environnement

Chaque environnement a son propre fichier de configuration :

```bash
# Copier les templates
cp .env .env.example  # Garder un template dev
```

Les fichiers `.env.preprod` et `.env.prod` ont déjà été créés. **Vous devez les configurer** :

#### Configuration préproduction (`.env.preprod`)

```env
NODE_ENV=preprod
DATABASE_URL="postgresql://admin:admin@localhost:5433/fitness_preprod?schema=public"
PORT=3001
HOST=0.0.0.0
JWT_SECRET="preprod_votre_secret_unique"
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account-preprod.json
```

#### Configuration production (`.env.prod`)

```env
NODE_ENV=production
DATABASE_URL="postgresql://user:password@prod-db-host:5432/fitness_prod?schema=public"
PORT=3002
HOST=0.0.0.0
JWT_SECRET="prod_SECRET_TRES_FORT_ET_UNIQUE"
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account-prod.json
```

### 2. Créer les bases de données

#### Base de données préproduction (Docker local)

Ajouter un service preprod dans `config/docker-compose.yml` :

```yaml
services:
  postgres:
    # ... config existante pour dev ...

  postgres-preprod:
    image: postgres:17-alpine
    container_name: fitness-preprod-db
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin
      POSTGRES_DB: fitness_preprod
    ports:
      - "5433:5432"
    volumes:
      - fitness-preprod-data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  fitness-data:
  fitness-preprod-data:
```

Démarrer les bases de données :

```bash
npm run db:up
```

#### Base de données production

Pour la production, utilisez une base de données hébergée (AWS RDS, Google Cloud SQL, Azure Database, etc.).

## 🚀 Déploiement Simple (sans PM2)

### Démarrer manuellement

```bash
# Développement (avec nodemon)
npm run dev

# Préproduction
npm run start:preprod

# Production
npm run start:prod
```

### En arrière-plan avec nohup

```bash
# Préproduction
nohup npm run start:preprod > logs/preprod.log 2>&1 &

# Production
nohup npm run start:prod > logs/prod.log 2>&1 &

# Voir les logs
tail -f logs/preprod.log
tail -f logs/prod.log

# Arrêter
pkill -f "start:preprod"
pkill -f "start:prod"
```

## 🔧 Déploiement avec PM2 (recommandé)

PM2 est un gestionnaire de processus professionnel pour Node.js.

### Installation de PM2

```bash
# Installation globale (une seule fois)
npm install -g pm2
```

### Commandes PM2

#### Démarrage

```bash
# Démarrer uniquement preprod
pm2 start ecosystem.config.js --only teamfitness-preprod

# Démarrer uniquement prod
pm2 start ecosystem.config.js --only teamfitness-prod

# Démarrer les deux
pm2 start ecosystem.config.js

# Ou démarrer tout avec des noms courts
pm2 start ecosystem.config.js --only preprod
pm2 start ecosystem.config.js --only prod
```

#### Gestion

```bash
# Lister tous les processus
pm2 list

# Voir les logs
pm2 logs preprod              # Logs preprod en temps réel
pm2 logs prod                 # Logs prod en temps réel
pm2 logs --lines 100          # Voir les 100 dernières lignes

# Redémarrer
pm2 restart preprod           # Redémarrer preprod
pm2 restart prod              # Redémarrer prod
pm2 restart all               # Redémarrer tout

# Recharger (zero-downtime pour cluster mode)
pm2 reload prod               # Rechargement sans interruption

# Arrêter
pm2 stop preprod              # Arrêter preprod
pm2 stop prod                 # Arrêter prod
pm2 stop all                  # Tout arrêter

# Supprimer
pm2 delete preprod            # Supprimer preprod de PM2
pm2 delete all                # Tout supprimer

# Monitoring
pm2 monit                     # Interface de monitoring
```

#### Sauvegarder et démarrage automatique

```bash
# Sauvegarder la configuration actuelle
pm2 save

# Configurer le démarrage automatique au boot du serveur
pm2 startup
# Suivre les instructions affichées

# Mettre à jour le démarrage automatique
pm2 save
```

#### Logs et debugging

```bash
# Voir tous les logs
pm2 logs

# Logs d'un processus spécifique
pm2 logs preprod

# Vider les logs
pm2 flush

# Informations détaillées
pm2 show preprod
pm2 show prod
```

## 💾 Gestion des bases de données

### Migrations Prisma

#### Développement

```bash
# Créer une migration
npm run prisma:migrate

# Générer le client Prisma
npm run prisma:generate
```

#### Préproduction

```bash
# Appliquer les migrations
npm run prisma:migrate:preprod

# Ouvrir Prisma Studio
npm run prisma:studio:preprod
```

#### Production

```bash
# Appliquer les migrations (ATTENTION: production!)
npm run prisma:migrate:prod

# Ouvrir Prisma Studio
npm run prisma:studio:prod
```

### Seed des données

```bash
# Dev
NODE_ENV=dev npm run db:seed

# Preprod
NODE_ENV=preprod node -r dotenv/config prisma/seed.js dotenv_config_path=.env.preprod

# Prod (ATTENTION: vérifier avant!)
NODE_ENV=production node -r dotenv/config prisma/seed.js dotenv_config_path=.env.prod
```

## 🔒 Bonnes pratiques

### Secrets et sécurité

1. ⚠️ **Ne JAMAIS commiter `.env.preprod` et `.env.prod`** (ils sont dans `.gitignore`)
2. ✅ Utiliser des **JWT_SECRET différents** pour chaque environnement
3. ✅ Utiliser des **mots de passe forts** pour la base de données production
4. ✅ Séparer les **projets Firebase** (preprod et prod)
5. ✅ Utiliser des **variables d'environnement** pour les secrets sensibles

### Déploiement

1. **Tester en preprod d'abord** avant de déployer en prod
2. **Sauvegarder la base de données** avant les migrations en production
3. **Utiliser PM2 en mode cluster** pour la production (déjà configuré)
4. **Monitorer les logs** régulièrement avec `pm2 logs`
5. **Configurer les alertes** (PM2 Plus, Sentry, etc.)

### Workflow recommandé

```bash
# 1. Développement local
npm run dev

# 2. Tester les modifications

# 3. Déployer en preprod
git pull origin main
npm install
npm run prisma:migrate:preprod
pm2 restart preprod
pm2 logs preprod

# 4. Tester en preprod
# Vérifier que tout fonctionne

# 5. Déployer en production
git pull origin main
npm install
npm run prisma:migrate:prod
pm2 reload prod  # Zero-downtime reload
pm2 logs prod

# 6. Vérifier la santé
curl http://localhost:3002/health
```

## 📊 Monitoring

### Health Check

```bash
# Dev
curl http://localhost:3000/health

# Preprod
curl http://localhost:3001/health

# Prod
curl http://localhost:3002/health
```

### PM2 Monitoring

PM2 offre un service de monitoring avancé (PM2 Plus) :

```bash
pm2 link [secret-key] [public-key]
```

Plus d'infos : https://pm2.io/

## 🆘 Dépannage

### Le serveur ne démarre pas

```bash
# Vérifier les logs PM2
pm2 logs preprod --lines 50

# Vérifier la configuration
cat .env.preprod

# Tester manuellement
npm run start:preprod
```

### Erreur de connexion à la base de données

```bash
# Vérifier que PostgreSQL est démarré
docker ps

# Tester la connexion
psql "postgresql://admin:admin@localhost:5433/fitness_preprod"

# Vérifier l'URL dans .env.preprod
cat .env.preprod | grep DATABASE_URL
```

### Port déjà utilisé

```bash
# Trouver le processus utilisant le port 3001
lsof -i :3001

# Tuer le processus
kill -9 <PID>
```

### Prisma Client non généré

```bash
# Regénérer le client
npm run prisma:generate
```

## 🔗 Ressources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## 📝 Checklist de déploiement

Avant de déployer en production :

- [ ] `.env.prod` configuré avec des secrets forts
- [ ] Base de données production créée et accessible
- [ ] Migrations testées en preprod
- [ ] Firebase configuré pour production
- [ ] Sauvegarde de la base de données effectuée
- [ ] PM2 configuré et testé
- [ ] Démarrage automatique configuré (`pm2 startup`)
- [ ] Monitoring en place
- [ ] Logs accessibles et configurés
- [ ] Tests de santé validés (`/health`)
- [ ] Swagger UI désactivé en prod (optionnel pour sécurité)
