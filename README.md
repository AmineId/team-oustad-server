# 🏋️ Team Fitness API# 🏋️ Team Fitness API



> API REST complète pour la gestion des salles de sport avec système d'abonnements, paiements automatisés et notifications push.> API REST complète pour la gestion des salles de sport avec système d'abonnements, paiements automatisés et notifications push.



[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)

[![Prisma](https://img.shields.io/badge/Prisma-6+-purple.svg)](https://www.prisma.io/)[![Prisma](https://img.shields.io/badge/Prisma-6+-purple.svg)](https://www.prisma.io/)

[![Express](https://img.shields.io/badge/Express-4+-lightgrey.svg)](https://expressjs.com/)[![Express](https://img.shields.io/badge/Express-4+-lightgrey.svg)](https://expressjs.com/)



## 🚀 Démarrage Rapide## 🚀 Démarrage Rapide



### Développement Local```bash

# Installation

```bashnpm install

# Installation

npm install# Configuration

cp .env.example .env

# Configuration# Éditer .env avec vos credentials

cp .env.example .env

# Éditer .env avec vos credentials# Base de données

npx prisma migrate dev

# Base de donnéesnpx prisma db seed

npx prisma migrate deploy

npx prisma db seed# Démarrage

npm run dev

# Démarrage```

npm run dev

```**Serveur local** : http://localhost:3000  

**Documentation API** : http://localhost:3000/api-docs  

### Production (VPS)**Health check** : http://localhost:3000/health



```bash### 🤖 Serveur MCP (Model Context Protocol)

# Installation

npm install --productionUn serveur MCP est disponible pour interagir avec l'API via des assistants IA (Claude, Cline, etc.) :



# Configuration```bash

cp .env.prod.example .env.prodcd mcp-server

# Éditer .env.prod avec vos credentials de productionnpm install

npm start

# Base de données```

NODE_ENV=production npx prisma migrate deploy

**📚 Documentation MCP** : [`mcp-server/README.md`](./mcp-server/README.md)

# Démarrage avec PM2

npm run start:prod**Fonctionnalités** :

```- ✅ **40 outils** pour gérer toute l'API

- ✅ **Multi-environnements** (dev, preprod, prod)

**📚 Documentation Complète** : [`docs/README.md`](./docs/README.md)- ✅ **Gestion des tokens** par environnement

- ✅ Support **Claude Desktop** et **Cline**

---

---

## 📡 URLs

## ✨ Fonctionnalités

| Environnement | URL | Documentation |

|---------------|-----|---------------|### 👥 Gestion des Utilisateurs

| **Local** | http://localhost:3000 | http://localhost:3000/api-docs |- **3 niveaux** : Owner, Admin, Member

| **Preprod** | https://preprod.teamfitness.com | https://preprod.teamfitness.com/api-docs |- Authentification JWT sécurisée

| **Production** | https://api.teamfitness.com | https://api.teamfitness.com/api-docs |- QR Codes uniques pour identification

- Réinitialisation mot de passe par email

**Health check** : `GET /health`

### 🏢 Gestion des Salles

---- CRUD complet des gyms

- Horaires d'ouverture

## ✨ Fonctionnalités Principales- Upload d'images

- Statistiques

- 👥 **Gestion Utilisateurs** : 3 niveaux (Owner, Admin, Member), JWT, QR Codes

- 🏢 **Gestion Salles** : CRUD complet, horaires, images### 💳 Système d'Abonnements

- 💳 **Abonnements** : Types personnalisables, paiements flexibles (1-12 mois), acquittement auto- Types personnalisables (Basic, Premium, VIP...)

- 💰 **Paiements** : Suivi automatique, relances, historique- **Abonnements annuels** avec paiements flexibles (1, 3, 6 ou 12 paiements)

- 🔔 **Notifications Push** : Firebase FCM, planning quotidien (6h), rappels paiements- **Acquittement automatique** : paiement acquitté → abonnement activé ✅

- 📅 **Planning** : Programmes personnalisés, bibliothèque d'exercices- Gestion des statuts : actif, pending, pausé, expiré

- 📸 **Photos** : Upload images profil et salles (base64)- Vérification automatique des retards de paiement (job quotidien)

- 🔐 **Sécurité** : JWT, bcrypt, permissions par rôle

### 🔔 Notifications Push

---- Firebase Cloud Messaging (FCM)

- Notifications de paiements (dû, retard, confirmé)

## 📂 Structure du Projet- **Notifications quotidiennes de planning (6h00)** 🆕

- Nouveaux plannings d'entraînement

```- Annonces salle de sport

team_fitness_server/- Intégration Flutter complète

├── docs/                    📚 Documentation centralisée

│   ├── deployment/          🚀 Guides de déploiement### 📅 Planning d'Entraînement

│   ├── api/                 📡 Documentation API- Programmes personnalisés

│   ├── setup/               ⚙️  Configuration- Bibliothèque d'exercices

│   └── development/         💻 Développement- Attribution par jour de la semaine

├── routes/                  🛣️  Routes API- **Rappel automatique quotidien à 6h** pour les membres avec entraînement du jour

├── services/                🔧 Logique métier

├── middleware/              🛡️  Middlewares---

├── prisma/                  🗄️  ORM & migrations

├── jobs/                    ⏰ Tâches cron## 📡 Endpoints Principaux

├── bin/                     📜 Scripts

├── tests/                   🧪 Tests### Authentification

└── index.js                 🎯 Point d'entrée```http

```POST /auth/login              # Connexion

POST /auth/register           # Inscription

---GET  /auth/me                 # Profil utilisateur

POST /auth/forgot-password    # Reset mot de passe

## 🔐 Variables d'Environnement```



### Fichiers### Abonnements & Paiements

- `.env` - Développement local```http

- `.env.preprod` - Preprod/StagingPOST /subscriptions                              # Créer abonnement (12 paiements)

- `.env.prod` - ProductionGET  /subscriptions/:id                          # Détails abonnement

POST /subscriptions/payments/:id/acknowledge     # Acquitter paiement ⭐

### Variables RequisesGET  /subscriptions/payments/upcoming            # Paiements à venir

```env```

DATABASE_URL="postgresql://user:pass@localhost:5432/fitness"

JWT_SECRET="votre_secret_jwt_tres_securise"### Utilisateurs & Gyms

PORT=3000```http

NODE_ENV="production"GET  /users                   # Liste utilisateurs

GET  /gyms                    # Liste salles

# Firebase (Notifications Push)POST /users                   # Créer utilisateur

GOOGLE_APPLICATION_CREDENTIALS="./firebase-service-account.json"PUT  /users/:id              # Modifier utilisateur

```

# Email (optionnel)

SMTP_HOST="smtp.gmail.com"**Documentation complète** : `/api-docs` (Swagger UI)

SMTP_PORT=587

SMTP_USER="noreply@teamfitness.com"---

SMTP_PASSWORD="your_app_password"

```## 🎯 Nouveauté : Acquittement de Paiement



---### Endpoint Clé

```http

## 🚀 Déploiement VPSPOST /subscriptions/payments/:paymentId/acknowledge

```

### Prérequis

- Node.js 18+ **Fonctionnalité** : Acquitte un paiement ET active automatiquement l'abonnement s'il est en statut "pending".

- PostgreSQL 14+

- PM2 (gestionnaire de processus)### Exemple

- Nginx (reverse proxy)```javascript

// Requête

### Installation RapidePOST /subscriptions/payments/259/acknowledge

{

```bash  "paymentMethod": "card",

# 1. Cloner le repository  "transactionId": "TXN_12345"

git clone https://github.com/TeamFitness/db-server.git}

cd db-server

// Réponse

# 2. Installer les dépendances{

npm install --production  "message": "Paiement acquitté avec succès",

  "payment": {

# 3. Configuration    "id": 259,

cp .env.prod.example .env.prod    "status": "completed",

nano .env.prod  # Éditer avec vos credentials    "paidAt": "2025-11-11T19:51:57.000Z"

  },

# 4. Base de données  "subscription": {

NODE_ENV=production npx prisma migrate deploy    "id": 22,

    "status": "active"  // ← Activé automatiquement !

# 5. Optionnel: Données de test  }

NODE_ENV=production npx prisma db seed}

```

# 6. Démarrer avec PM2

npm run start:prod### Données de Test

Après le seed, utilisez **Olivia** :

# 7. Vérifier le statut- Email: `olivia@example.com`

pm2 status- Password: `member123`

pm2 logs team-fitness-api- Abonnement: Découverte (pending)

```- 12 paiements à acquitter



### Scripts PM2 Disponibles**Test rapide** :

```bash

```bashnode tests/test-acknowledge-olivia.js

npm run start:prod      # Démarrer en production```

npm run stop:prod       # Arrêter

npm run restart:prod    # Redémarrer---

npm run logs:prod       # Voir les logs

```## 📚 Documentation



**Guide complet** : [`docs/deployment/VPS_DEPLOYMENT.md`](./docs/deployment/VPS_DEPLOYMENT.md)### Documentation Principale

| Document | Description |

---|----------|-------------|

| [DB_SETUP.md](docs/DB_SETUP.md) | Configuration PostgreSQL & Prisma |

## 📚 Documentation| [AUTH.md](docs/AUTH.md) | Système d'authentification JWT |

| [PUSH_NOTIFICATIONS.md](docs/PUSH_NOTIFICATIONS.md) | Configuration Firebase FCM |

| Document | Description || [CLOUDFLARE_TUNNEL.md](docs/CLOUDFLARE_TUNNEL.md) | Exposition serveur local |

|----------|-------------|| [PAYMENT_ACKNOWLEDGEMENT.md](docs/PAYMENT_ACKNOWLEDGEMENT.md) | Guide acquittement paiements |

| **[docs/README.md](docs/README.md)** | 📖 Index principal de documentation || [FLUTTER_INTEGRATION.md](docs/FLUTTER_INTEGRATION.md) | Intégration app mobile |

| **[docs/deployment/VPS_DEPLOYMENT.md](docs/deployment/VPS_DEPLOYMENT.md)** | 🚀 Guide de déploiement VPS complet || [Swagger UI](http://localhost:3000/api-docs) | Documentation API interactive |

| **[docs/setup/DB_SETUP.md](docs/setup/DB_SETUP.md)** | 🗄️ Configuration PostgreSQL & Prisma |

| **[docs/setup/FIREBASE_SETUP.md](docs/setup/FIREBASE_SETUP.md)** | 🔔 Configuration Firebase FCM |### Guides Rapides

| **[docs/api/SWAGGER_UPDATE.md](docs/api/SWAGGER_UPDATE.md)** | 📡 Documentation Swagger |- [Quick Start Subscriptions](docs/guides/QUICK_START_SUBSCRIPTIONS.md) - Démarrage rapide abonnements

| **[Swagger UI](http://localhost:3000/api-docs)** | 🌐 API interactive |- [Test Guide](docs/guides/TEST_GUIDE.md) - Guide de test complet

- [FCM Implementation Summary](docs/FCM_IMPLEMENTATION_SUMMARY.md) - Résumé notifications push

---

---

## 🧪 Tests

## 🧪 Tests

```bash

# Vérifier la santé de l'API### Tests Automatiques

curl http://localhost:3000/health```bash

# Test acquittement avec Olivia (seed)

# Test complet (avec reset DB)node tests/test-acknowledge-olivia.js

./bin/test-full.sh

# Test complet avec création d'abonnement

# Tests spécifiquesnode tests/test-acknowledge-payment.js

node tests/integration/test-subscriptions.js

node tests/integration/test-payments.js# Test complet (reset + seed + test)

```./tests/run-full-test.sh

```

---

### Tests Manuels

## 📊 Monitoring & Logs```bash

# Démonstration avec curl

```bash./tests/demo-acknowledge-payment.sh

# Voir les logs en temps réel```

pm2 logs team-fitness-api

---

# Voir les logs spécifiques

pm2 logs team-fitness-api --lines 100## 🗂️ Structure du Projet



# Monitoring```

pm2 monitteam_fitness_server/

├── bin/                        # Scripts exécutables

# Dashboard web│   └── start-tunnel.sh         # Cloudflare tunnel

pm2 plus├── config/                     # Fichiers de configuration

```│   ├── docker-compose.yml      # Docker setup

│   ├── nodemon.json            # Nodemon config

---│   └── prisma.config.ts        # Prisma config

├── docs/                       # Documentation

## 🔧 Maintenance│   ├── guides/                 # Guides utilisateurs

│   ├── archive/                # Documentation archivée

### Backup Base de Données│   ├── AUTH.md                 # Authentification

```bash│   ├── DB_SETUP.md             # Setup base de données

# Backup automatique quotidien (configuré dans crontab)│   ├── PUSH_NOTIFICATIONS.md   # Configuration FCM

pg_dump -U postgres fitness_prod > backup_$(date +%Y%m%d).sql│   └── CLOUDFLARE_TUNNEL.md    # Tunnel setup

├── jobs/                       # Tâches planifiées (Cron)

# Restauration│   ├── dailyPaymentCheck.js    # Vérification paiements (23h)

psql -U postgres fitness_prod < backup_20251115.sql│   └── dailyPlanningNotification.js # Notifications planning (6h)

```├── middleware/                 # Middlewares Express

│   └── auth.js                 # Vérification JWT

### Mises à jour├── prisma/                     # Prisma ORM

```bash│   ├── schema.prisma           # Schéma de base de données

# 1. Sauvegarder la DB│   ├── seed.js                 # Données de test

npm run backup:db│   └── migrations/             # Historique migrations

├── routes/                     # Routes API

# 2. Arrêter l'app│   ├── auth.js                 # Authentification

pm2 stop team-fitness-api│   ├── subscriptions.js        # Abonnements & paiements

│   ├── subscriptionTypes.js    # Types d'abonnements

# 3. Pull les changements│   ├── users.js                # Utilisateurs & FCM tokens

git pull origin main│   ├── gyms.js                 # Salles de sport

│   └── plannings.js            # Plannings d'entraînement

# 4. Installer les dépendances├── scripts/                    # Scripts utilitaires

npm install --production│   ├── dev/                    # Scripts développement

│   └── maintenance/            # Scripts maintenance

# 5. Migrations DB├── services/                   # Logique métier

NODE_ENV=production npx prisma migrate deploy│   ├── subscriptionService.js  # Gestion abonnements

│   ├── emailService.js         # Envoi d'emails

# 6. Redémarrer│   └── pushNotificationService.js # Notifications FCM

pm2 restart team-fitness-api├── tests/                      # Tests

```│   ├── integration/            # Tests d'intégration

│   └── unit/                   # Tests unitaires

---├── utils/                      # Utilitaires

│   └── subscriptionUtils.js    # Helpers abonnements

## 🐛 Troubleshooting├── .env                        # Variables d'environnement

├── .gitignore                  # Fichiers à ignorer

### L'API ne démarre pas├── index.js                    # Point d'entrée serveur

```bash├── package.json                # Dépendances npm

# Vérifier les logs├── swagger.yml                 # Documentation OpenAPI

pm2 logs team-fitness-api --err└── README.md                   # Ce fichier

```

# Vérifier la configuration

cat .env.prod---



# Tester la connexion DB## 🔐 Sécurité

npx prisma db pull

```- ✅ Authentification JWT

- ✅ Hash des mots de passe (bcrypt)

### Erreurs de base de données- ✅ Validation des entrées

```bash- ✅ Gestion des permissions par rôle

# Vérifier la connexion PostgreSQL- ✅ Tokens de réinitialisation sécurisés

psql -U postgres -d fitness_prod -c "SELECT 1;"

---

# Réappliquer les migrations

NODE_ENV=production npx prisma migrate deploy## 🛠️ Configuration



# Régénérer le client Prisma### Variables d'Environnement

npx prisma generate```env

```DATABASE_URL="postgresql://user:pass@localhost:5432/fitness"

JWT_SECRET="votre_secret_jwt"

### Erreurs de permissionsPORT=3000

```bash

# Vérifier les permissions des fichiers# Email (optionnel)

ls -la .env.prodSMTP_HOST="smtp.gmail.com"

ls -la firebase-service-account.jsonSMTP_PORT=587

SMTP_USER="your-email@gmail.com"

# Corriger les permissionsSMTP_PASSWORD="your-app-password"

chmod 600 .env.prod```

chmod 600 firebase-service-account.json

```### Scripts Disponibles

```bash

---# Serveur

npm start                    # Démarrer en production

## 🔒 Sécuriténpm run dev                  # Mode développement (nodemon)



- ✅ Authentification JWT avec expiration# Base de données

- ✅ Hash des mots de passe (bcrypt, 10 rounds)npx prisma migrate dev       # Créer/appliquer migrations

- ✅ Validation des entréesnpx prisma db seed           # Peupler avec données de test

- ✅ Permissions basées sur les rôlesnpx prisma studio            # Interface visuelle Prisma

- ✅ Rate limiting (à activer en production)

- ✅ CORS configuré# Tests

- ✅ Variables d'environnement sécuriséesnpm test                     # Lancer tous les tests

node tests/unit/test-*.js    # Test spécifique

**Checklist sécurité** : [`docs/deployment/SECURITY_CHECKLIST.md`](./docs/deployment/SECURITY_CHECKLIST.md)

# Utilitaires

---./bin/start-tunnel.sh        # Démarrer tunnel Cloudflare

node scripts/maintenance/*   # Scripts de maintenance

## 📈 Performance```



- 🚀 PM2 cluster mode (multi-instances)---

- 💾 Cache PostgreSQL optimisé

- 📦 Compression des réponses## 📊 Données de Test (Seed)

- 🔄 Connection pooling Prisma

- ⚡ Indexes sur les colonnes critiques### Comptes Administrateurs

```

---Owner:  owner@teamfitness.com / owner123

Admin1: admin@teamfitness.com / admin123

## 🆘 SupportAdmin2: admin2@teamfitness.com / admin123

```

- **Documentation** : [`docs/README.md`](./docs/README.md)

- **API Docs** : `/api-docs` (Swagger)### Membres de Test

- **Issues** : [GitHub Issues](https://github.com/TeamFitness/db-server/issues)```

Olivia:  olivia@example.com / member123  (abonnement pending ⏳)

---Bob:     bob@example.com / member123     (Premium actif)

Charlie: charlie@example.com / member123 (Basic actif)

## 📝 LicenseAlice:   alice@example.com / member123   (VIP actif)

```

MIT © Team Fitness - 2025

---

## 🎓 Cas d'Usage Typiques

### 1. Nouveau Membre
```
1. Admin crée le membre
2. Abonnement créé avec statut "pending"
3. Membre effectue le paiement
4. Admin acquitte via /acknowledge
5. Abonnement activé automatiquement ✅
```

### 2. Paiement en Retard
```
1. Système détecte retard (job quotidien)
2. Abonnement mis en pause
3. Membre règle les paiements
4. Admin acquitte les paiements
5. Abonnement réactivé ✅
```

---

## 📈 Roadmap

### ✅ Terminé
- ✅ Système d'authentification JWT
- ✅ Gestion des abonnements flexibles (1, 3, 6, 12 paiements)
- ✅ QR Codes membres
- ✅ Notifications push FCM
- ✅ Tunnel Cloudflare pour tests mobile
- ✅ Plannings d'entraînement
- ✅ Documentation Swagger complète

### 🚧 En développement
- [ ] Webhooks Stripe/PayPal
- [ ] Dashboard analytics temps réel
- [ ] Export données (PDF/Excel)
- [ ] Historique des actions (audit log)

### 🔮 Prochainement
- [ ] API GraphQL
- [ ] Chat en temps réel (support)
- [ ] Système de réservations
- [ ] Statistiques d'utilisation salle

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour les guidelines.

---

## 📝 License

MIT © Team Fitness

---

## 💡 Support

- **Documentation** : `/api-docs`
- **Email** : support@teamfitness.com
- **Issues** : [GitHub Issues](https://github.com/teamfitness/db-server/issues)

---

**Dernière mise à jour** : 11 novembre 2025
