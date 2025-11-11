# 📁 Structure du Projet Team Fitness

## 🎯 Organisation Générale

Le projet suit une architecture modulaire MVC (Model-View-Controller) adaptée pour Express.js avec Prisma ORM.

## 📂 Arborescence Détaillée

```
team_fitness_server/
│
├── 📁 bin/                              # Scripts exécutables
│   └── start-tunnel.sh                  # Lancement tunnel Cloudflare
│
├── 📁 config/                           # Configuration
│   ├── docker-compose.yml               # Conteneurs Docker (PostgreSQL)
│   ├── nodemon.json                     # Configuration auto-reload
│   └── prisma.config.ts                 # Configuration Prisma
│
├── 📁 docs/                             # Documentation
│   ├── 📁 guides/                       # Guides utilisateurs
│   │   ├── QUICK_START_SUBSCRIPTIONS.md # Démarrage rapide
│   │   ├── SUBSCRIPTION_IMPLEMENTATION_SUMMARY.md
│   │   └── TEST_GUIDE.md                # Guide tests
│   ├── 📁 archive/                      # Documentation archivée
│   ├── AUTH.md                          # Authentification & JWT
│   ├── CLOUDFLARE_TUNNEL.md             # Configuration tunnel
│   ├── DB_SETUP.md                      # Setup base de données
│   ├── FCM_IMPLEMENTATION_SUMMARY.md    # Résumé FCM
│   ├── FLUTTER_EMULATOR_TROUBLESHOOTING.md
│   ├── FLUTTER_INTEGRATION.md           # Intégration Flutter
│   ├── PAYMENT_ACKNOWLEDGEMENT.md       # Acquittement paiements
│   ├── PUSH_NOTIFICATIONS.md            # Notifications push
│   ├── SEED_DATA.md                     # Données seed
│   ├── SUBSCRIPTION_API_EXAMPLES.md     # Exemples API
│   ├── SUBSCRIPTION_SYSTEM.md           # Système abonnements
│   ├── SUBSCRIPTION_TYPES.md            # Types abonnements
│   └── SWAGGER_UPDATE.md                # Mise à jour Swagger
│
├── 📁 jobs/                             # Tâches planifiées (cron)
│   └── dailyPaymentCheck.js             # Vérification paiements quotidienne
│
├── 📁 middleware/                       # Middlewares Express
│   └── auth.js                          # Vérification JWT & permissions
│
├── 📁 prisma/                           # Prisma ORM
│   ├── schema.prisma                    # Schéma base de données
│   ├── seed.js                          # Données de test (14 users, 2 gyms...)
│   └── 📁 migrations/                   # Historique migrations
│       ├── migration_lock.toml
│       ├── 20251110221943_init/
│       ├── 20251111065519_add_payment_table/
│       ├── 20251111065611_add_subscription_table/
│       ├── ...
│       └── 20251111205200_add_fcm_token_to_user/
│
├── 📁 routes/                           # Routes API (endpoints)
│   ├── auth.js                          # POST /auth/login, /register, /forgot-password
│   ├── gyms.js                          # CRUD gyms, horaires, images
│   ├── plannings.js                     # CRUD plannings d'entraînement
│   ├── subscriptions.js                 # CRUD abonnements & paiements
│   ├── subscriptionTypes.js             # CRUD types abonnements
│   └── users.js                         # CRUD users, QR codes, FCM tokens
│
├── 📁 scripts/                          # Scripts utilitaires
│   ├── 📁 dev/                          # Scripts développement
│   │   ├── test-all-qr-codes.js
│   │   ├── test-image-upload.js
│   │   ├── test-planning-system.js
│   │   ├── test-qr-endpoint.js
│   │   ├── test-scan-qr.js
│   │   └── test-user-setup.js
│   └── 📁 maintenance/                  # Scripts maintenance
│       ├── check-swagger.js             # Vérifier Swagger
│       ├── check-unique-codes.js        # Vérifier codes uniques
│       ├── generate-unique-codes.js     # Générer codes
│       ├── generate-user-codes.js       # Générer codes users
│       └── run-payment-check.js         # Lancer vérif paiements
│
├── 📁 services/                         # Logique métier
│   ├── emailService.js                  # Envoi emails (reset password)
│   ├── pushNotificationService.js       # Notifications FCM
│   └── subscriptionService.js           # Logique abonnements
│
├── 📁 tests/                            # Tests
│   ├── 📁 integration/                  # Tests d'intégration
│   │   ├── demo-acknowledge-payment.sh
│   │   └── run-full-test.sh
│   └── 📁 unit/                         # Tests unitaires
│       ├── fix-encoding-issue.js
│       ├── migrate-users.js
│       ├── test-acknowledge-olivia.js
│       ├── test-acknowledge-payment.js
│       ├── test-api-quick.js
│       ├── test-bob-login.js
│       ├── test-null-byte-login.js
│       ├── test-subscription-system.js
│       └── test-subscription-types.js
│
├── 📁 utils/                            # Utilitaires
│   └── subscriptionUtils.js             # Helpers abonnements
│
├── 📄 .env                              # Variables d'environnement (gitignored)
├── 📄 .env.example                      # Template variables env
├── 📄 .gitignore                        # Fichiers à ignorer Git
├── 📄 CONTRIBUTING.md                   # Guide contribution
├── 📄 index.js                          # Point d'entrée serveur
├── 📄 OPTIMIZATION_SUMMARY.md           # Résumé optimisations
├── 📄 package.json                      # Dépendances npm
├── 📄 README.md                         # Documentation principale
└── 📄 swagger.yml                       # Documentation OpenAPI/Swagger
```

## 🎨 Conventions de Nommage

### Fichiers
- **Routes**: `nomRoute.js` (ex: `users.js`, `subscriptions.js`)
- **Services**: `nomService.js` (ex: `emailService.js`)
- **Tests**: `test-description.js` (ex: `test-acknowledge-payment.js`)
- **Scripts**: `kebab-case.js` (ex: `check-swagger.js`)
- **Documentation**: `UPPER_SNAKE_CASE.md` (ex: `DB_SETUP.md`)

### Code
- **Variables**: `camelCase` (ex: `userId`, `fcmToken`)
- **Constantes**: `UPPER_SNAKE_CASE` (ex: `JWT_SECRET`, `PORT`)
- **Fonctions**: `camelCase` (ex: `sendPushNotification`)
- **Classes**: `PascalCase` (ex: `PrismaClient`)

## 📋 Responsabilités des Dossiers

### `/routes` - Endpoints API
**Responsabilité**: Définir les routes HTTP et déléguer la logique métier aux services.
- Validation des paramètres
- Gestion des réponses HTTP
- Appel aux services
- Logging des requêtes

**Exemple**:
```javascript
router.post('/subscriptions', auth, async (req, res) => {
  const { memberId, subscriptionTypeId } = req.body;
  const subscription = await subscriptionService.create(...);
  res.status(201).json(subscription);
});
```

### `/services` - Logique Métier
**Responsabilité**: Implémenter la logique métier complexe.
- Interactions Prisma
- Calculs business
- Orchestration de plusieurs opérations
- Envoi de notifications

**Exemple**:
```javascript
async function createYearlySubscriptionWithPayments(memberId, typeId, startDate, frequency) {
  // Logique complexe
  const subscription = await prisma.subscription.create({...});
  const payments = await generatePayments(...);
  return { subscription, payments };
}
```

### `/middleware` - Middlewares Express
**Responsabilité**: Traiter les requêtes avant qu'elles atteignent les routes.
- Authentification JWT
- Vérification des permissions
- Logging
- Validation

### `/jobs` - Tâches Planifiées
**Responsabilité**: Exécuter des tâches automatiques périodiques.
- Vérification paiements en retard
- Envoi notifications planifiées
- Nettoyage base de données

### `/prisma` - Base de Données
**Responsabilité**: Définir le schéma et gérer les migrations.
- `schema.prisma`: Modèles de données
- `seed.js`: Données de test
- `migrations/`: Historique des changements

### `/docs` - Documentation
**Responsabilité**: Documenter le projet pour les développeurs et utilisateurs.
- Guides setup
- Exemples API
- Architecture
- Troubleshooting

### `/tests` - Tests
**Responsabilité**: Valider le fonctionnement du code.
- **`integration/`**: Tests end-to-end (scripts shell)
- **`unit/`**: Tests de composants individuels (scripts Node)

### `/scripts` - Scripts Utilitaires
**Responsabilité**: Automatiser des tâches de développement et maintenance.
- **`dev/`**: Tests manuels, prototypage
- **`maintenance/`**: Vérifications, corrections, génération

## 🔄 Flux de Requête Typique

```
1. Client → HTTP Request
2. index.js → Express App
3. middleware/auth.js → Vérification JWT
4. routes/*.js → Validation params
5. services/*.js → Logique métier
6. prisma → Base de données
7. services/*.js → Formatage résultat
8. routes/*.js → HTTP Response
9. Client → Réception réponse
```

## 📊 Modèles de Données (Prisma)

### Entités Principales
- **User**: Utilisateurs (owner, admin, member)
- **Gym**: Salles de sport
- **Member**: Profil membre (relation 1-1 avec User)
- **Admin**: Profil admin (relation 1-1 avec User)
- **Owner**: Profil propriétaire (relation 1-1 avec User)
- **Subscription**: Abonnements membres
- **SubscriptionType**: Types d'abonnements (Basic, Premium, VIP...)
- **Payment**: Paiements individuels
- **Planning**: Programmes d'entraînement
- **Exercise**: Bibliothèque d'exercices
- **OpeningHour**: Horaires des salles

### Relations Clés
```
User 1→1 Member/Admin/Owner
User N→1 Gym
Member 1→N Subscription
Member 1→N Payment
Subscription 1→N Payment
Subscription N→1 SubscriptionType
Member 1→N Planning
Planning 1→N PlanningDay
PlanningDay N→N Exercise
```

## 🔐 Sécurité

### Variables Sensibles (.env)
```env
DATABASE_URL           # Connection PostgreSQL
JWT_SECRET             # Secret JWT
SMTP_PASSWORD          # Mot de passe email
FIREBASE_SERVICE_ACCOUNT_PATH  # Credentials Firebase
```

**⚠️ Ne jamais commiter ces fichiers !**

### Fichiers Gitignored
- `.env`
- `node_modules/`
- `firebase-service-account.json`
- `*.log`
- `*.db` (SQLite local)

## 🧪 Tests

### Structure de Test
```
tests/
├── integration/              # Tests complets (shell scripts)
│   ├── run-full-test.sh     # Reset + Seed + Test
│   └── demo-*.sh            # Démos avec curl
└── unit/                     # Tests unitaires (Node.js)
    ├── test-*.js            # Tests fonctionnels
    ├── fix-*.js             # Scripts de correction
    └── migrate-*.js         # Scripts migration
```

### Commandes de Test
```bash
# Test intégration complet
./tests/integration/run-full-test.sh

# Test unitaire spécifique
node tests/unit/test-acknowledge-payment.js

# Démonstration API
./tests/integration/demo-acknowledge-payment.sh
```

## 📝 Logs & Debugging

### Emojis de Logging
Le projet utilise des emojis pour faciliter la lecture des logs:

```javascript
console.log('🚀 Démarrage...');        // Démarrage
console.log('✅ Succès');              // Succès
console.log('❌ Erreur');              // Erreur
console.log('📋 Info');                // Information
console.log('🔄 Traitement...');       // En cours
console.log('⚠️ Avertissement');       // Warning
console.log('🔔 Notification');        // Notification
console.log('💳 Paiement');            // Paiement
console.log('🏋️ Gym');                 // Salle de sport
console.log('👤 Utilisateur');         // User
```

## 🚀 Déploiement

### Environnements
1. **Development** (localhost:3000)
   - Nodemon auto-reload
   - Logs verbeux
   - Données seed

2. **Testing** (Cloudflare Tunnel)
   - Exposition temporaire
   - Tests mobile physique
   - URL publique éphémère

3. **Production** (à configurer)
   - Variables env production
   - HTTPS
   - Monitoring

## 📚 Ressources

- [Prisma Docs](https://www.prisma.io/docs)
- [Express Docs](https://expressjs.com/)
- [JWT Best Practices](https://jwt.io/introduction)
- [Firebase FCM](https://firebase.google.com/docs/cloud-messaging)
- [Swagger/OpenAPI](https://swagger.io/specification/)

---

**Dernière mise à jour**: 11 novembre 2025
