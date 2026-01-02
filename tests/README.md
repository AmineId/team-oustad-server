# Tests - Team Fitness Server

Suite de tests complète pour l'API Team Fitness Server avec Jest et Supertest.

## 📋 Structure des Tests

```
tests/
├── setup.js                      # Configuration globale Jest
├── helpers/
│   └── testHelpers.js           # Utilitaires de test (création fixtures, etc.)
├── services/
│   └── emailService.test.js     # Tests des services (email mocking)
└── routes/
    ├── auth.test.js             # Tests authentification
    ├── gyms.test.js             # Tests gestion des salles
    ├── subscriptions.test.js    # Tests abonnements et paiements
    ├── members.test.js          # Tests profils membres
    ├── plannings.test.js        # Tests plannings et exercices
    ├── subscriptionTypes.test.js # Tests types d'abonnements
    ├── banners.test.js          # Tests bannières
    ├── checkIn.test.js          # Tests check-in/check-out
    ├── store.test.js            # Tests boutique
    ├── users.test.js            # Tests utilisateurs
    └── android.test.js          # Tests endpoints Android
```

## 🚀 Commandes de Test

### Tests Complets
```bash
# Exécuter tous les tests
npm test

# Exécuter avec couverture de code
npm run test:coverage

# Mode watch (re-exécute automatiquement)
npm run test:watch

# Mode verbose (plus de détails)
npm run test:verbose

# Mode CI (pour GitHub Actions)
npm run test:ci
```

### Tests par Module
```bash
# Tests d'authentification
npm run test:auth

# Tests des salles de sport
npm run test:gyms

# Tests des abonnements
npm run test:subscriptions

# Tests des membres
npm run test:members
```

## ⚙️ Configuration des Tests

### 1. Base de Données de Test

Les tests nécessitent une base de données PostgreSQL séparée. Deux options :

#### Option A : Docker (Recommandé)
```bash
# Lancer PostgreSQL avec Docker
docker run -d \
  --name teamfitness-test-db \
  -p 5432:5432 \
  -e POSTGRES_USER=testuser \
  -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_DB=team_fitness_test \
  postgres:14

# Arrêter
docker stop teamfitness-test-db

# Supprimer
docker rm teamfitness-test-db
```

#### Option B : PostgreSQL Local
```bash
# Créer une base de test
createdb team_fitness_test -U testuser

# Ou via psql
psql -U postgres
CREATE DATABASE team_fitness_test;
CREATE USER testuser WITH PASSWORD 'testpass';
GRANT ALL PRIVILEGES ON DATABASE team_fitness_test TO testuser;
```

### 2. Configuration de l'Environnement

```bash
# Copier le fichier d'exemple
cp .env.test.example .env.test

# Éditer si nécessaire (déjà configuré par défaut)
nano .env.test
```

### 3. Migrations de la Base de Test

```bash
# Appliquer les migrations
DATABASE_URL="postgresql://testuser:testpass@localhost:5432/team_fitness_test" \
  npx prisma migrate deploy

# Générer le client Prisma
npx prisma generate
```

### 4. Exécuter les Tests

```bash
npm test
```

### Tests CI/CD
```bash
# Tests optimisés pour CI/CD
npm run test:ci
```

## 📊 Couverture de Code

Les objectifs de couverture sont définis dans `jest.config.js`:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

Générer le rapport de couverture:
```bash
npm run test:coverage
```

Le rapport sera disponible dans `coverage/lcov-report/index.html`

## 🔧 Configuration

### Variables d'Environnement
Le fichier `.env.test` contient la configuration pour les tests:
```env
NODE_ENV=test
DATABASE_URL="postgresql://teamfitness:password@localhost:5432/teamfitness_test?schema=public"
JWT_SECRET=test_jwt_secret_key_for_testing_purposes
```

### Base de Données de Test
**Important**: Les tests utilisent une base de données séparée (`teamfitness_test`).

Créer la base de données de test:
```bash
# PostgreSQL
createdb teamfitness_test

# Ou via Docker
docker exec -it postgres_container psql -U teamfitness -c "CREATE DATABASE teamfitness_test;"
```

Appliquer les migrations:
```bash
DATABASE_URL="postgresql://teamfitness:password@localhost:5432/teamfitness_test?schema=public" npx prisma migrate deploy
```

## 📝 Couverture Actuelle

### Routes Testées

#### ✅ Authentication (`/auth`)
- [x] POST `/auth/check-phone` - Vérification numéro de téléphone
- [x] POST `/auth/login` - Connexion utilisateur
- [x] GET `/auth/me` - Profil utilisateur connecté
- [x] POST `/auth/forgot-password` - Demande de réinitialisation
- [x] POST `/auth/reset-password` - Réinitialisation mot de passe
- [x] POST `/auth/setup-password` - Configuration initiale mot de passe
- [x] POST `/auth/send-setup-email` - Envoi email configuration
- [x] POST `/auth/scan-qr` - Scan QR code membre

**Total**: 45+ tests d'authentification

#### ✅ Gyms (`/gyms`)
- [x] POST `/gyms` - Création salle de sport
- [x] GET `/gyms` - Liste des salles
- [x] GET `/gyms/:id` - Détails d'une salle
- [x] PUT `/gyms/:id` - Mise à jour salle
- [x] DELETE `/gyms/:id` - Suppression salle
- [x] POST `/gyms/:id/opening-hours` - Définir horaires
- [x] GET `/gyms/:id/opening-hours` - Récupérer horaires
- [x] PUT `/gyms/:id/image` - Upload image salle
- [x] GET `/gyms/:id/image` - Récupérer image salle
- [x] DELETE `/gyms/:id/image` - Supprimer image salle

**Total**: 35+ tests gyms

#### ✅ Subscriptions (`/subscriptions`)
- [x] POST `/subscriptions` - Création abonnement (mensuel/trimestriel/semestriel/oneshot)
- [x] GET `/subscriptions/member/:memberId` - Abonnements d'un membre
- [x] POST `/subscriptions/:id/renew` - Renouvellement abonnement
- [x] POST `/subscriptions/payments/:id/complete` - Marquer paiement complété
- [x] POST `/subscriptions/payments/:id/acknowledge` - Acknowledgement paiement
- [x] GET `/subscriptions/payments/pending` - Paiements en attente
- [x] GET `/subscriptions/payments/unacknowledged` - Paiements non acknowledgés

**Total**: 30+ tests abonnements

#### ✅ Members (`/members`)
- [x] PUT `/members/:id/profile` - Mise à jour profil membre
- [x] PUT `/members/:id/onboarding` - Gestion onboarding
- [x] PUT `/members/:id/profile-picture` - Upload photo profil
- [x] GET `/members/:id/profile-picture` - Récupérer photo profil
- [x] DELETE `/members/:id/profile-picture` - Supprimer photo profil
- [x] PUT `/members/:id/preferred-training-days` - Jours d'entraînement préférés

**Total**: 25+ tests membres

### Total: **135+ tests** avec taux de couverture élevé

## 🎯 Points Testés

### Sécurité & Permissions
- ✅ Authentification JWT
- ✅ Contrôle d'accès par rôle (owner/admin/member)
- ✅ Isolation des données par salle de sport
- ✅ Validation des permissions inter-salles
- ✅ Sanitization des entrées (null bytes, etc.)

### Validation des Données
- ✅ Champs requis
- ✅ Formats de données (email, téléphone, dates)
- ✅ Enums (profession, fitnessLevel, paymentMethod)
- ✅ Types de données
- ✅ Contraintes métier

### Cas Limites
- ✅ Ressources inexistantes (404)
- ✅ Permissions insuffisantes (403)
- ✅ Données manquantes (400)
- ✅ Tokens expirés/invalides
- ✅ Mises à jour partielles
- ✅ Données dupliquées

### Logique Métier
- ✅ Création d'abonnements avec différentes fréquences de paiement
- ✅ Gestion des statuts (actif/expiré/suspendu)
- ✅ Workflow de paiement complet
- ✅ Système d'acknowledgement
- ✅ Upload et gestion d'images
- ✅ Génération de placeholders SVG

## 🧪 Écrire de Nouveaux Tests

### Structure d'un Test

```javascript
const request = require('supertest');
const express = require('express');
const myRoutes = require('../../routes/myRoutes');
const {
  cleanDatabase,
  disconnectDatabase,
  createTestGym,
  createTestAdmin,
  authHeader,
  prisma
} = require('../helpers/testHelpers');

const app = express();
app.use(express.json());
app.use('/my-routes', myRoutes);

describe('My Routes', () => {
  let testGym;
  let testAdmin;

  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    testGym = await createTestGym();
    testAdmin = await createTestAdmin(testGym.id);
  });

  describe('POST /my-routes', () => {
    it('should create resource successfully', async () => {
      const response = await request(app)
        .post('/my-routes')
        .set('Authorization', authHeader(testAdmin))
        .send({ name: 'Test' });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Test');
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/my-routes')
        .set('Authorization', authHeader(testAdmin))
        .send({});

      expect(response.status).toBe(400);
    });
  });
});
```

### Helpers Disponibles

```javascript
// Création d'une salle
const gym = await createTestGym({ name: 'My Gym' });

// Création d'utilisateurs
const owner = await createTestOwner(gymId, { email: 'owner@test.com' });
const admin = await createTestAdmin(gymId, { email: 'admin@test.com' });
const member = await createTestMember(gymId, { email: 'member@test.com' });

// Création d'abonnements
const subType = await createTestSubscriptionType(gymId, { price: 50 });
const subscription = await createTestSubscription(memberId, subTypeId);
const payment = await createTestPayment(memberId, subscriptionId);

// Authentification
const token = generateToken(user);
const header = authHeader(user); // Retourne "Bearer <token>"
```

## 🐛 Debugging

### Activer les Logs
Commentez la suppression des logs dans `tests/setup.js`:
```javascript
// global.console = {
//   ...console,
//   log: jest.fn(),
//   // ...
// };
```

### Exécuter un Test Spécifique
```bash
# Par fichier
npm test -- tests/routes/auth.test.js

# Par nom de test
npm test -- -t "should login admin with email and password"
```

### Mode Debug
```bash
# Avec node inspector
node --inspect-brk node_modules/.bin/jest --runInBand tests/routes/auth.test.js
```

## 📚 Ressources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)

## 🔄 Intégration Continue

Les tests sont conçus pour être exécutés dans un environnement CI/CD:

```yaml
# Exemple GitHub Actions
- name: Run tests
  run: |
    npm run test:ci
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    JWT_SECRET: ${{ secrets.TEST_JWT_SECRET }}
```

## ⚠️ Notes Importantes

1. **Isolation**: Chaque test est isolé avec `cleanDatabase()` avant/après
2. **Mocks**: Les services externes (emails, notifications) sont mockés
3. **Sequential**: Les tests s'exécutent séquentiellement (`--runInBand`) pour éviter les conflits de BDD
4. **BDD Séparée**: Toujours utiliser une base de données de test dédiée

## 📈 Prochaines Étapes

- [ ] Tests pour `/users` (création, modification, suppression utilisateurs)
- [ ] Tests pour `/plannings` (exercices, plannings d'entraînement)
- [ ] Tests pour `/subscription-types` (types d'abonnements)
- [ ] Tests d'intégration end-to-end
- [ ] Tests de performance
- [ ] Tests de charge

## 🤝 Contribution

Pour ajouter de nouveaux tests:
1. Créer un fichier `tests/routes/nom-route.test.js`
2. Utiliser les helpers existants
3. Suivre la structure des tests existants
4. Viser une couverture > 80% pour le nouveau code
5. Exécuter `npm run test:coverage` avant de commit
