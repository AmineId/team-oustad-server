# 📚 Documentation Team Fitness API# 📚 Documentation Team Fitness API



> Centre de documentation complet pour l'API Team FitnessBienvenue dans la documentation complète du projet Team Fitness API.



---## 🗂️ Organisation



## 🎯 Navigation RapideCette documentation est organisée en plusieurs catégories pour faciliter la navigation.



| 🚀 Déploiement | 📡 API | ⚙️ Configuration | 💻 Développement |## 📖 Documents Principaux

|---------------|--------|------------------|------------------|

| [VPS Deployment](deployment/VPS_DEPLOYMENT.md) | [Swagger](../swagger.yml) | [Database](setup/DB_SETUP.md) | [Project Structure](development/PROJECT_STRUCTURE.md) |### Démarrage

| [Cloudflare Tunnel](deployment/CLOUDFLARE_TUNNEL.md) | [API Examples](api/SUBSCRIPTION_API_EXAMPLES.md) | [Firebase](setup/FIREBASE_SETUP.md) | [Flutter Integration](development/FLUTTER_INTEGRATION.md) |- **[INDEX.md](INDEX.md)** - Index complet de toute la documentation

| [Guide Deployment](deployment/DEPLOYMENT.md) | [Swagger Update](api/SWAGGER_UPDATE.md) | [Email](setup/EMAIL_SETUP.md) | [Flutter Troubleshooting](development/FLUTTER_EMULATOR_TROUBLESHOOTING.md) |- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Référence rapide pour développeurs

| | | [Seed Data](setup/SEED_DATA.md) | |- **[DB_SETUP.md](DB_SETUP.md)** - Configuration PostgreSQL et Prisma

- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Architecture détaillée

---

### Authentification & Sécurité

## 📖 Documentation par Catégorie- **[AUTH.md](AUTH.md)** - Système d'authentification JWT complet



### 🚀 Déploiement### Abonnements & Paiements

- **[SUBSCRIPTION_SYSTEM.md](SUBSCRIPTION_SYSTEM.md)** - Vue d'ensemble du système

Guides pour déployer l'API en production sur VPS.- **[SUBSCRIPTION_TYPES.md](SUBSCRIPTION_TYPES.md)** - Types d'abonnements

- **[SUBSCRIPTION_API_EXAMPLES.md](SUBSCRIPTION_API_EXAMPLES.md)** - Exemples d'utilisation

| Document | Description | Priorité |- **[PAYMENT_ACKNOWLEDGEMENT.md](PAYMENT_ACKNOWLEDGEMENT.md)** - Guide acquittement

|----------|-------------|----------|

| **[VPS_DEPLOYMENT.md](deployment/VPS_DEPLOYMENT.md)** | Guide complet de déploiement sur VPS (Ubuntu/Debian) | ⭐⭐⭐ |### Notifications Push

| **[DEPLOYMENT.md](deployment/DEPLOYMENT.md)** | Guide général de déploiement | ⭐⭐ |- **[PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md)** - Configuration Firebase FCM complète

| **[CLOUDFLARE_TUNNEL.md](deployment/CLOUDFLARE_TUNNEL.md)** | Configuration du tunnel Cloudflare pour tests mobile | ⭐ |- **[FCM_IMPLEMENTATION_SUMMARY.md](FCM_IMPLEMENTATION_SUMMARY.md)** - Résumé implémentation



**À faire avant de déployer :**### Intégration Mobile

1. ✅ Configurer PostgreSQL (voir [DB_SETUP.md](setup/DB_SETUP.md))- **[FLUTTER_INTEGRATION.md](FLUTTER_INTEGRATION.md)** - Guide intégration Flutter

2. ✅ Configurer Firebase FCM (voir [FIREBASE_SETUP.md](setup/FIREBASE_SETUP.md))- **[FLUTTER_EMULATOR_TROUBLESHOOTING.md](FLUTTER_EMULATOR_TROUBLESHOOTING.md)** - Dépannage émulateur

3. ✅ Configurer les variables d'environnement (`.env.prod`)- **[CLOUDFLARE_TUNNEL.md](CLOUDFLARE_TUNNEL.md)** - Tests sur appareils physiques

4. ✅ Installer PM2 et Nginx

5. ✅ Exécuter les migrations Prisma### Tests & Développement

- **[SEED_DATA.md](SEED_DATA.md)** - Données de test

---- **[SWAGGER_UPDATE.md](SWAGGER_UPDATE.md)** - Mise à jour documentation API



### 📡 API## 📁 Sous-Dossiers



Documentation de l'API REST et exemples d'utilisation.### guides/

Guides thématiques détaillés:

| Document | Description | Format |- **[QUICK_START_SUBSCRIPTIONS.md](guides/QUICK_START_SUBSCRIPTIONS.md)** - Démarrage rapide abonnements

|----------|-------------|--------|- **[SUBSCRIPTION_IMPLEMENTATION_SUMMARY.md](guides/SUBSCRIPTION_IMPLEMENTATION_SUMMARY.md)** - Résumé implémentation

| **[swagger.yml](../swagger.yml)** | Spécification OpenAPI complète | YAML |- **[TEST_GUIDE.md](guides/TEST_GUIDE.md)** - Guide complet des tests

| **[API Interactive](http://localhost:3000/api-docs)** | Documentation Swagger UI interactive | Web |

| **[SUBSCRIPTION_API_EXAMPLES.md](api/SUBSCRIPTION_API_EXAMPLES.md)** | Exemples concrets d'utilisation des abonnements | MD |### archive/

| **[SWAGGER_UPDATE.md](api/SWAGGER_UPDATE.md)** | Guide de mise à jour du Swagger | MD |Documentation historique conservée pour référence:

- Anciens README

**Endpoints principaux :**- Changelogs de features spécifiques

- 🔐 `/auth/*` - Authentification (login, register, reset password)- Résumés de migrations passées

- 👥 `/users/*` - Gestion utilisateurs et photos de profil- Documentation obsolète mais référencée

- 🏢 `/gyms/*` - Gestion des salles de sport

- 💳 `/subscriptions/*` - Abonnements et paiements## 🎯 Par Objectif

- 📅 `/plannings/*` - Planning d'entraînement

- 🎯 `/subscription-types/*` - Types d'abonnements### Je débute sur le projet

1. Commencer par [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

---2. Lire [DB_SETUP.md](DB_SETUP.md)

3. Explorer [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

### ⚙️ Configuration & Setup

### Je développe une fonctionnalité

Guides de configuration des services et dépendances.1. Consulter [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

2. Référencer [AUTH.md](AUTH.md) si besoin d'auth

| Document | Description | Service |3. Voir [Swagger UI](http://localhost:3000/api-docs) pour API

|----------|-------------|---------|

| **[DB_SETUP.md](setup/DB_SETUP.md)** | Installation et configuration PostgreSQL + Prisma | PostgreSQL |### J'intègre l'app mobile

| **[FIREBASE_SETUP.md](setup/FIREBASE_SETUP.md)** | Configuration Firebase Cloud Messaging (FCM) | Firebase |1. Suivre [FLUTTER_INTEGRATION.md](FLUTTER_INTEGRATION.md)

| **[EMAIL_SETUP.md](setup/EMAIL_SETUP.md)** | Configuration du service d'envoi d'emails | SMTP |2. Configurer [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md)

| **[SEED_DATA.md](setup/SEED_DATA.md)** | Documentation des données de test | Prisma |3. Tester avec [CLOUDFLARE_TUNNEL.md](CLOUDFLARE_TUNNEL.md)



**Stack technique :**### Je teste l'application

- **Runtime** : Node.js 18+1. Lire [guides/TEST_GUIDE.md](guides/TEST_GUIDE.md)

- **Framework** : Express.js 42. Utiliser [SEED_DATA.md](SEED_DATA.md)

- **Database** : PostgreSQL 14+ avec Prisma ORM3. Tester [PAYMENT_ACKNOWLEDGEMENT.md](PAYMENT_ACKNOWLEDGEMENT.md)

- **Authentification** : JWT (jsonwebtoken)

- **Notifications** : Firebase Cloud Messaging## 📊 Statistiques

- **Email** : Nodemailer

- **Process Manager** : PM2- **16** documents principaux

- **3** guides spécialisés

---- **7** documents archivés

- **26** documents au total

### 💻 Développement

## 🔍 Recherche Rapide

Ressources pour les développeurs et intégration mobile.

### Par Technologie

| Document | Description | Public |- **PostgreSQL**: [DB_SETUP.md](DB_SETUP.md)

|----------|-------------|--------|- **Prisma**: [DB_SETUP.md](DB_SETUP.md), [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

| **[PROJECT_STRUCTURE.md](development/PROJECT_STRUCTURE.md)** | Architecture du projet et organisation du code | Backend |- **JWT**: [AUTH.md](AUTH.md)

| **[FLUTTER_INTEGRATION.md](development/FLUTTER_INTEGRATION.md)** | Guide d'intégration avec l'app Flutter | Mobile |- **Firebase**: [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md)

| **[FLUTTER_EMULATOR_TROUBLESHOOTING.md](development/FLUTTER_EMULATOR_TROUBLESHOOTING.md)** | Résolution de problèmes émulateur Flutter | Mobile |- **Flutter**: [FLUTTER_INTEGRATION.md](FLUTTER_INTEGRATION.md)

- **Cloudflare**: [CLOUDFLARE_TUNNEL.md](CLOUDFLARE_TUNNEL.md)

---

### Par Feature

## 🔧 Fonctionnalités- **Login**: [AUTH.md](AUTH.md)

- **Abonnements**: [SUBSCRIPTION_SYSTEM.md](SUBSCRIPTION_SYSTEM.md)

### ✨ Fonctionnalités Principales- **Paiements**: [PAYMENT_ACKNOWLEDGEMENT.md](PAYMENT_ACKNOWLEDGEMENT.md)

- **Notifications**: [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md)

- **👥 Gestion Utilisateurs**- **QR Codes**: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

  - 3 niveaux : Owner, Admin, Member- **Planning**: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

  - Authentification JWT sécurisée

  - QR Codes uniques pour identification## 💡 Conventions

  - Photos de profil (upload base64)

  - Réinitialisation mot de passe par email### Format

- Headers avec emojis (📚 🔐 💳 etc.)

- **🏢 Gestion des Salles**- Code blocks avec syntaxe highlighting

  - CRUD complet des gyms- Liens internes relatifs

  - Horaires d'ouverture configurables- Exemples pratiques

  - Upload d'images de salle

  - Statistiques par salle### Structure Type

```markdown

- **💳 Système d'Abonnements**# 📚 Titre

  - Types personnalisables (Basic, Premium, VIP...)

  - Abonnements annuels avec paiements flexibles (1, 3, 6 ou 12 paiements)> Description courte

  - Acquittement automatique : paiement acquitté → abonnement activé

  - Gestion des statuts : actif, pending, pausé, expiré## 🎯 Objectif

  - Vérification automatique des retards (job quotidien à 23h)## 📋 Prérequis

## 🚀 Instructions

- **🔔 Notifications Push**## 💡 Exemples

  - Firebase Cloud Messaging (FCM)## ⚠️ Points d'Attention

  - Notifications de paiements (dû, retard, confirmé)## 🔗 Voir Aussi

  - Notifications quotidiennes de planning (6h00)```

  - Nouveaux plannings d'entraînement

  - Intégration Flutter complète## 🆘 Aide



- **📅 Planning d'Entraînement**### Documentation manquante ?

  - Programmes personnalisés par membreCréer une issue ou contacter l'équipe.

  - Bibliothèque d'exercices

  - Attribution par jour de la semaine### Erreur dans la doc ?

  - Rappel automatique quotidienPull requests bienvenues !



### 🔐 Sécurité### Question spécifique ?

1. Consulter [INDEX.md](INDEX.md)

- ✅ Authentification JWT avec expiration2. Chercher dans [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

- ✅ Hash des mots de passe (bcrypt, 10 rounds)3. Voir [Swagger UI](http://localhost:3000/api-docs)

- ✅ Validation stricte des entrées4. Demander à l'équipe

- ✅ Permissions basées sur les rôles

- ✅ Protection CORS## 📝 Contribution

- ✅ Variables d'environnement sécurisées

- ✅ Rate limiting (recommandé en production)Pour contribuer à la documentation:



---1. Suivre les conventions ci-dessus

2. Utiliser le format Markdown

## 🚦 Guides de Démarrage3. Ajouter des exemples pratiques

4. Mettre à jour [INDEX.md](INDEX.md) si nouveau doc

### 1️⃣ Installation Locale (Développement)5. Tester tous les liens



```bash## 🔗 Liens Utiles

# Cloner le repo

git clone https://github.com/TeamFitness/db-server.git### Documentation Projet

cd db-server- [README principal](../README.md)

- [CHANGELOG](../CHANGELOG.md)

# Installer les dépendances- [NAVIGATION](../NAVIGATION.md)

npm install- [Swagger UI](http://localhost:3000/api-docs)



# Configurer l'environnement### Ressources Externes

cp .env.example .env- [Express Docs](https://expressjs.com/)

nano .env  # Éditer avec vos credentials- [Prisma Docs](https://www.prisma.io/docs)

- [PostgreSQL Docs](https://www.postgresql.org/docs/)

# Initialiser la base de données- [Firebase Docs](https://firebase.google.com/docs)

npx prisma migrate dev- [Flutter Docs](https://flutter.dev/docs)

npx prisma db seed

---

# Démarrer le serveur

npm run dev**Dernière mise à jour**: 11 novembre 2025  

```**Mainteneur**: Équipe Team Fitness  

**Feedback**: Toujours bienvenu !

**Résultat** : API disponible sur http://localhost:3000

---

### 2️⃣ Déploiement Production (VPS)

```bash
# Sur votre VPS
git clone https://github.com/TeamFitness/db-server.git
cd db-server

# Installer les dépendances (production only)
npm install --production

# Configurer l'environnement de production
cp .env.prod.example .env.prod
nano .env.prod

# Migrations de base de données
NODE_ENV=production npx prisma migrate deploy

# Démarrer avec PM2
npm run start:prod

# Vérifier le statut
pm2 status
pm2 logs team-fitness-api
```

**Guide complet** : [VPS_DEPLOYMENT.md](deployment/VPS_DEPLOYMENT.md)

---

## 🧪 Tests

### Tests Automatiques

```bash
# Test de santé
curl http://localhost:3000/health

# Tests d'intégration
node tests/integration/test-subscriptions.js
node tests/integration/test-payments.js
node tests/integration/test-auth.js

# Test complet (avec reset DB)
./bin/test-full.sh
```

### Données de Test

Après `npx prisma db seed`, vous disposez de :

**Comptes Admin :**
- Owner: `owner@teamfitness.com` / `owner123`
- Admin: `admin@teamfitness.com` / `admin123`

**Membres :**
- Olivia: `olivia@example.com` / `member123` (abonnement pending)
- Bob: `bob@example.com` / `member123` (Premium actif)
- Charlie: `charlie@example.com` / `member123` (Basic actif)

---

## 📊 Architecture

```
team_fitness_server/
├── docs/                       📚 Documentation (vous êtes ici !)
│   ├── deployment/             🚀 Guides de déploiement VPS
│   ├── api/                    📡 Documentation API et exemples
│   ├── setup/                  ⚙️  Configuration des services
│   └── development/            💻 Ressources développeurs
│
├── routes/                     🛣️  Routes Express
│   ├── auth.js                 🔐 Authentification
│   ├── users.js                👥 Gestion utilisateurs
│   ├── gyms.js                 🏢 Gestion salles
│   ├── subscriptions.js        💳 Abonnements & paiements
│   ├── subscriptionTypes.js    🎯 Types d'abonnements
│   └── plannings.js            📅 Plannings d'entraînement
│
├── services/                   🔧 Logique métier
│   ├── subscriptionService.js  💼 Gestion abonnements
│   ├── emailService.js         📧 Envoi d'emails
│   └── pushNotificationService.js 🔔 Notifications FCM
│
├── middleware/                 🛡️  Middlewares
│   └── auth.js                 🔐 Vérification JWT
│
├── prisma/                     🗄️  ORM & Migrations
│   ├── schema.prisma           📋 Schéma de base de données
│   ├── seed.js                 🌱 Données de test
│   └── migrations/             📦 Historique migrations
│
├── jobs/                       ⏰ Tâches planifiées (Cron)
│   ├── dailyPaymentCheck.js    💰 Vérification paiements (23h)
│   └── dailyPlanningNotification.js 📅 Rappels planning (6h)
│
├── bin/                        📜 Scripts exécutables
├── tests/                      🧪 Tests
├── utils/                      🔨 Utilitaires
├── index.js                    🎯 Point d'entrée serveur
├── swagger.yml                 📖 Spécification OpenAPI
└── ecosystem.config.js         🚀 Configuration PM2
```

---

## 🔧 Configuration

### Variables d'Environnement Essentielles

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# JWT
JWT_SECRET="secret_tres_securise_a_changer"

# Server
PORT=3000
NODE_ENV="production"

# Firebase (Notifications)
GOOGLE_APPLICATION_CREDENTIALS="./firebase-service-account.json"

# Email (optionnel)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="noreply@teamfitness.com"
SMTP_PASSWORD="app_password"
```

**Fichiers de configuration :**
- `.env` → Développement local
- `.env.preprod` → Preprod/Staging
- `.env.prod` → Production

---

## 🆘 Aide & Support

### 📝 Ressources

- **API Interactive** : http://localhost:3000/api-docs
- **Spécification OpenAPI** : [swagger.yml](../swagger.yml)
- **GitHub** : https://github.com/TeamFitness/db-server

### 🐛 Troubleshooting

**Problème de connexion DB ?**
→ Voir [DB_SETUP.md](setup/DB_SETUP.md) section "Troubleshooting"

**Notifications ne fonctionnent pas ?**
→ Voir [FIREBASE_SETUP.md](setup/FIREBASE_SETUP.md) section "Configuration"

**Erreur de déploiement ?**
→ Voir [VPS_DEPLOYMENT.md](deployment/VPS_DEPLOYMENT.md) section "Troubleshooting"

**Problème d'intégration Flutter ?**
→ Voir [FLUTTER_INTEGRATION.md](development/FLUTTER_INTEGRATION.md)

---

## 📅 Mise à jour

**Dernière mise à jour** : 15 Novembre 2025  
**Version API** : 1.0.0  
**Node.js requis** : 18+  
**PostgreSQL requis** : 14+

---

## 📝 License

MIT © Team Fitness - 2025
