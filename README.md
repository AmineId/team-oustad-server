# 🏋️ Team Fitness API

> API REST complète pour la gestion des salles de sport avec système d'abonnements et paiements automatisés.

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5+-purple.svg)](https://www.prisma.io/)

## 🚀 Démarrage Rapide

```bash
# Installation
npm install

# Configuration
cp .env.example .env

# Base de données
npx prisma db push
npx prisma db seed

# Démarrage
npm start
```

**Serveur actif** : http://localhost:3000  
**Documentation API** : http://localhost:3000/api-docs

---

## ✨ Fonctionnalités

### 👥 Gestion des Utilisateurs
- **3 niveaux** : Owner, Admin, Member
- Authentification JWT sécurisée
- QR Codes uniques pour identification
- Réinitialisation mot de passe par email

### 🏢 Gestion des Salles
- CRUD complet des gyms
- Horaires d'ouverture
- Upload d'images
- Statistiques

### 💳 Système d'Abonnements
- Types personnalisables (Basic, Premium, VIP...)
- **Abonnements annuels** avec 12 paiements mensuels
- **Acquittement automatique** : paiement acquitté → abonnement activé ✅
- Gestion des statuts : actif, pending, pausé, expiré
- Vérification automatique des retards de paiement

### 📅 Planning d'Entraînement
- Programmes personnalisés
- Bibliothèque d'exercices
- Attribution par jour de la semaine

---

## 📡 Endpoints Principaux

### Authentification
```http
POST /auth/login              # Connexion
POST /auth/register           # Inscription
GET  /auth/me                 # Profil utilisateur
POST /auth/forgot-password    # Reset mot de passe
```

### Abonnements & Paiements
```http
POST /subscriptions                              # Créer abonnement (12 paiements)
GET  /subscriptions/:id                          # Détails abonnement
POST /subscriptions/payments/:id/acknowledge     # Acquitter paiement ⭐
GET  /subscriptions/payments/upcoming            # Paiements à venir
```

### Utilisateurs & Gyms
```http
GET  /users                   # Liste utilisateurs
GET  /gyms                    # Liste salles
POST /users                   # Créer utilisateur
PUT  /users/:id              # Modifier utilisateur
```

**Documentation complète** : `/api-docs` (Swagger UI)

---

## 🎯 Nouveauté : Acquittement de Paiement

### Endpoint Clé
```http
POST /subscriptions/payments/:paymentId/acknowledge
```

**Fonctionnalité** : Acquitte un paiement ET active automatiquement l'abonnement s'il est en statut "pending".

### Exemple
```javascript
// Requête
POST /subscriptions/payments/259/acknowledge
{
  "paymentMethod": "card",
  "transactionId": "TXN_12345"
}

// Réponse
{
  "message": "Paiement acquitté avec succès",
  "payment": {
    "id": 259,
    "status": "completed",
    "paidAt": "2025-11-11T19:51:57.000Z"
  },
  "subscription": {
    "id": 22,
    "status": "active"  // ← Activé automatiquement !
  }
}
```

### Données de Test
Après le seed, utilisez **Olivia** :
- Email: `olivia@example.com`
- Password: `member123`
- Abonnement: Découverte (pending)
- 12 paiements à acquitter

**Test rapide** :
```bash
node tests/test-acknowledge-olivia.js
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DB_SETUP.md](docs/DB_SETUP.md) | Configuration base de données |
| [PAYMENT_ACKNOWLEDGEMENT.md](docs/PAYMENT_ACKNOWLEDGEMENT.md) | Guide acquittement paiements |
| [FLUTTER_INTEGRATION.md](docs/FLUTTER_INTEGRATION.md) | Intégration Flutter |
| [Swagger UI](http://localhost:3000/api-docs) | Documentation API interactive |

### Guides Avancés
- [Quick Start Subscriptions](docs/guides/QUICK_START_SUBSCRIPTIONS.md)
- [Test Guide](docs/guides/TEST_GUIDE.md)

---

## 🧪 Tests

### Tests Automatiques
```bash
# Test acquittement avec Olivia (seed)
node tests/test-acknowledge-olivia.js

# Test complet avec création d'abonnement
node tests/test-acknowledge-payment.js

# Test complet (reset + seed + test)
./tests/run-full-test.sh
```

### Tests Manuels
```bash
# Démonstration avec curl
./tests/demo-acknowledge-payment.sh
```

---

## 🗂️ Structure du Projet

```
team_fitness_server/
├── prisma/
│   ├── schema.prisma           # Schéma de base de données
│   ├── seed.js                 # Données de test (dont Olivia)
│   └── migrations/             # Migrations
├── routes/
│   ├── auth.js                 # Authentification
│   ├── subscriptions.js        # Abonnements & paiements
│   ├── users.js                # Utilisateurs
│   └── gyms.js                 # Salles de sport
├── services/
│   ├── subscriptionService.js  # Logique métier abonnements
│   └── emailService.js         # Envoi d'emails
├── middleware/
│   └── auth.js                 # Vérification JWT
├── tests/                      # Tests automatiques
├── docs/                       # Documentation
│   ├── guides/                 # Guides utilisateurs
│   └── archive/                # Documentation archivée
├── swagger.yml                 # Documentation API
└── index.js                    # Point d'entrée
```

---

## 🔐 Sécurité

- ✅ Authentification JWT
- ✅ Hash des mots de passe (bcrypt)
- ✅ Validation des entrées
- ✅ Gestion des permissions par rôle
- ✅ Tokens de réinitialisation sécurisés

---

## 🛠️ Configuration

### Variables d'Environnement
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/fitness"
JWT_SECRET="votre_secret_jwt"
PORT=3000

# Email (optionnel)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
```

### Scripts Disponibles
```bash
npm start          # Démarrer le serveur
npm run dev        # Mode développement (nodemon)
npm run db:seed    # Peupler la base
npm test           # Lancer les tests
```

---

## 📊 Données de Test (Seed)

### Comptes Administrateurs
```
Owner:  owner@teamfitness.com / owner123
Admin1: admin@teamfitness.com / admin123
Admin2: admin2@teamfitness.com / admin123
```

### Membres de Test
```
Olivia:  olivia@example.com / member123  (abonnement pending ⏳)
Bob:     bob@example.com / member123     (Premium actif)
Charlie: charlie@example.com / member123 (Basic actif)
Alice:   alice@example.com / member123   (VIP actif)
```

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

## 📈 Prochaines Fonctionnalités

- [ ] Notifications push
- [ ] Webhooks Stripe/PayPal
- [ ] Dashboard analytics
- [ ] Export des données (PDF/Excel)
- [ ] API mobile dédiée

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
