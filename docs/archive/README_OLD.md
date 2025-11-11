# Team Fitness Server

Serveur backend complet pour l'application Team Fitness avec gestion des gyms, membres, paiements et abonnements.

> Guide de démarrage rapide : voir [docs/DB_SETUP.md](docs/DB_SETUP.md) pour la configuration DB, migrations, seeding et exécution de l'API.

Guide d'intégration Flutter : [docs/FLUTTER_INTEGRATION.md](docs/FLUTTER_INTEGRATION.md)

## 🚀 Fonctionnalités

### 👥 Gestion des utilisateurs (3 niveaux)
- **Owner/SuperAdmin** : Propriétaire avec tous les droits système
- **Admin** : Administrateur de gym
- **Member** : Membre avec abonnements et paiements

### 🏋️ Gestion complète des gyms
- CRUD des salles de sport
- Attribution d'admins
- Statistiques par gym

### 💳 Système de paiement avancé
- Suivi des paiements (abonnements + achats ponctuels)
- Différents moyens de paiement
- Historique des transactions

### 📱 Codes QR uniques
- Chaque membre possède un `uniqueCode` unique (8 caractères)
- Utilisable pour générer des QR codes d'identification
- Accessible via l'endpoint `/auth/me` pour les membres

### 📊 Abonnements intelligents
- Gestion des abonnements actifs/inactifs
- Plans différenciés (Basic, Premium, Gold)
- Renouvellements automatiques

## 🏗️ Architecture

### Base de données (Prisma + PostgreSQL)
```
User (commun à tous les rôles)
├── Owner (super admin avec permissions étendues)
├── Admin (admin de gym)
└── Member (membre)
    ├── Subscription (abonnement actif)
    └── Payment (historique paiements)
```

### API REST organisée
- **Auth** : `/auth/*` - Authentification universelle
- **Owners** : `/owners/*` - Fonctions super admin (réservé)
- **Admins** : `/admins/*` - Gestion des gyms
- **Members** : `/members/*` - Gestion des membres
- **Gyms** : `/gyms/*` - Gestion des salles

## 🛠️ Installation & Configuration

### Prérequis
- Node.js 18+
- Docker (optionnel, pour PostgreSQL local)

### Configuration
```bash
# Installation des dépendances
npm install

# Configuration de l'environnement
cp .env.example .env
# Éditer .env avec vos paramètres SMTP et DB
```

### Base de données
```bash
# Démarrer PostgreSQL local (optionnel)
npm run db:up

# Appliquer les migrations
npx prisma migrate dev

# Générer le client Prisma
npx prisma generate

# Peupler avec des données de test
npm run db:seed

# Interface graphique DB
npx prisma studio
```

### Démarrage
```bash
# Développement (auto-reload)
npm run dev

# Production
npm start
```

## 📋 Comptes de test

### Owner (Super Admin)
- Email: `owner@teamfitness.com`
- Password: `owner123`

### Admin
- Email: `admin@teamfitness.com`
- Password: `admin123`

### Membres
- Bob: `bob@example.com` / `member123` (Code QR: généré dynamiquement)
- Charlie: `charlie@example.com` / `member123` (Code QR: généré dynamiquement)

## 🌐 Endpoints principaux

### Authentification (tous les rôles)
- `POST /auth/login` - Connexion universelle
- `GET /auth/me` - Profil utilisateur connecté (inclut `uniqueCode` pour les membres)
- `POST /auth/scan-qr` - Scanner et valider un QR code pour l'accès salle
- `POST /auth/forgot-password` - Demande reset password
- `POST /auth/reset-password` - Reset password avec token

#### 🔍 Scan QR Code (`POST /auth/scan-qr`)

**Corps de la requête :**
```json
{
  "uniqueCode": "B3F1A9B5"
}
```

**Réponses possibles :**

**✅ Accès autorisé (Membre avec abonnement actif) :**
```json
{
  "access": true,
  "reason": "Accès membre - Abonnement actif",
  "user": {
    "id": 3,
    "fullName": "Bob Member",
    "role": "member",
    "gym": {
      "id": 1,
      "name": "Downtown Fitness",
      "address": "123 Main St"
    }
  },
  "subscription": {
    "plan": "premium",
    "membership": "Gold",
    "endDate": "2026-11-11T00:00:00.000Z",
    "daysRemaining": 365
  },
  "scannedAt": "2025-11-11T10:30:00.000Z"
}
```

**❌ Accès refusé (Abonnement expiré) :**
```json
{
  "access": false,
  "reason": "Accès refusé - Abonnement expiré",
  "user": {
    "id": 3,
    "fullName": "Bob Member",
    "role": "member",
    "gym": {
      "id": 1,
      "name": "Downtown Fitness",
      "address": "123 Main St"
    }
  },
  "subscription": {
    "plan": "basic",
    "membership": "Silver",
    "endDate": "2025-10-11T00:00:00.000Z",
    "expired": true
  },
  "scannedAt": "2025-11-11T10:30:00.000Z"
}
```

**✅ Accès autorisé (Admin/Owner) :**
```json
{
  "access": true,
  "reason": "Accès admin - Salle autorisée",
  "user": {
    "id": 2,
    "fullName": "Admin TeamFitness",
    "role": "admin",
    "gym": {
      "id": 1,
      "name": "Downtown Fitness",
      "address": "123 Main St"
    }
  },
  "scannedAt": "2025-11-11T10:30:00.000Z"
}
```

### Owners uniquement (Super Admin)
- `POST /owners/create` - Créer un nouveau owner
- `POST /owners/create-admin` - Créer un admin
- `GET /owners/gyms` - Liste de toutes les gyms
- `GET /owners/stats` - Statistiques globales

### Utilisateurs (QR codes)
- `GET /users/:id/qr` - Générer QR code PNG pour n'importe quel utilisateur (authentification requise)
- `GET /users/:id` - Profil détaillé d'un utilisateur (authentification requise)

### Membres
- `GET /members/:id/qr` - Générer QR code PNG pour un membre (authentification requise)
- `GET /members/:id` - Détails d'un membre
- `PUT /members/:id` - Modifier un membre (admin uniquement)
- `DELETE /members/:id` - Supprimer un membre (admin uniquement)

### Santé système
- `GET /health` - Vérification DB + serveur

## 📚 Documentation

### 📖 Documentation API Interactive
La documentation complète de l'API est disponible via Swagger UI :

**URL** : `http://localhost:3000/api-docs`

**Fonctionnalités** :
- Interface interactive pour tester tous les endpoints
- Schémas détaillés des requêtes/réponses
- Authentification JWT intégrée
- Exemples de code pour chaque endpoint
- Validation en temps réel des paramètres

**Fichier de spécification** : `swagger.yml` (OpenAPI 3.0)

### Guides détaillés
- [Authentification](./docs/AUTH.md) - Guide complet auth + rôles
- [Configuration DB](./docs/DB_SETUP.md) - Setup base de données
- [Intégration Flutter](./docs/FLUTTER_INTEGRATION.md) - Guide mobile

## 🔧 Scripts disponibles

```bash
# Développement
npm run dev              # Nodemon auto-reload
npm start               # Production

# Base de données
npm run db:up           # Démarrer Docker DB
npm run db:down         # Arrêter Docker DB
npm run db:seed         # Peupler la DB

# Prisma
npx prisma generate     # Générer client
npx prisma migrate dev  # Migration dev
npx prisma studio       # Interface graphique
npx prisma validate     # Valider schéma
```

## 🔒 Sécurité

- **JWT** avec expiration 30 jours
- **Bcrypt** pour hash des mots de passe
- **Validation** emails et mots de passe
- **Middleware auth** pour protection routes
- **Reset password** avec tokens temporaires
- **Hiérarchie de rôles** stricte

## 📊 Données de test (après seeding)

- **1 Gym** : Downtown Fitness
- **4 Utilisateurs** : 1 Owner, 1 Admin, 2 Members
- **4 Codes QR uniques** pour tous les utilisateurs (8 caractères chacun)
- **2 Abonnements** actifs (Premium + Basic)
- **3 Paiements** (2 abonnements + 1 séance)
- **1 Token** de réinitialisation de mot de passe

## 🚀 Déploiement

```bash
# Build production
npm run build

# Démarrage
npm start
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonction`)
3. Commit (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Push (`git push origin feature/nouvelle-fonction`)
5. Créer une Pull Request

## 📝 Licence

ISC

