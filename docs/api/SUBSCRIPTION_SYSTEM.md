# Système de Gestion Automatique des Abonnements et Paiements

## 📋 Vue d'ensemble

Ce système gère automatiquement les abonnements annuels avec paiements mensuels. Lorsqu'un abonnement est créé, 12 paiements mensuels sont générés automatiquement pour l'année. Un job batch s'exécute tous les soirs pour vérifier les paiements en retard et mettre en pause les abonnements si nécessaire.

## 🎯 Fonctionnalités

### 1. Création d'abonnements annuels
- Génération automatique de 12 paiements mensuels
- Date de fin fixée à 1 an après la date de début
- Statut initial : `active`
- Chaque paiement a sa date d'échéance (dueDate) calculée automatiquement

### 2. Vérification quotidienne automatique
- **Job batch** exécuté tous les soirs à 23h00
- Vérifie les paiements en retard (date due > J-7)
- Met automatiquement les abonnements en pause si paiement en retard
- Identifie les paiements à venir dans les 7 prochains jours

### 3. États des paiements
- `pending` - En attente
- `completed` - Payé
- `overdue` - En retard (date due dépassée de plus de 7 jours)
- `failed` - Échoué
- `refunded` - Remboursé

### 4. États des abonnements
- `active` - Actif
- `paused` - En pause (paiement en retard)
- `cancelled` - Annulé
- `expired` - Expiré

## 🗄️ Modèle de données

### Payment
```prisma
model Payment {
  id            Int      @id @default(autoincrement())
  memberId      Int
  subscriptionId Int?
  amount        Float
  currency      String   @default("EUR")
  status        String   // pending, completed, failed, refunded, overdue
  type          String   // subscription, one-time
  paymentMethod String?  // null pour paiements générés automatiquement
  transactionId String?  @unique
  description   String?
  dueDate       DateTime // Date à laquelle le paiement est dû
  paidAt        DateTime? // Date effective du paiement
  monthNumber   Int?     // Numéro du mois (1-12)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### Subscription
```prisma
model Subscription {
  id            Int      @id @default(autoincrement())
  memberId      Int
  plan          String   // basic, premium, vip
  status        String   // active, cancelled, expired, paused
  startDate     DateTime
  endDate       DateTime?
  autoRenew     Boolean  @default(true)
  price         Float    // prix mensuel
  billingCycle  String   // monthly, yearly
  payments      Payment[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

## 🔌 API Endpoints

### POST /subscriptions
Créer un nouvel abonnement annuel avec 12 paiements mensuels.

**Requête:**
```json
{
  "memberId": 23,
  "plan": "premium",
  "monthlyPrice": 49.99,
  "startDate": "2025-11-11T00:00:00.000Z" // optionnel, par défaut: maintenant
}
```

**Réponse:**
```json
{
  "message": "Abonnement annuel créé avec succès",
  "subscription": {
    "id": 18,
    "memberId": 23,
    "plan": "premium",
    "status": "active",
    "startDate": "2025-11-11T00:00:00.000Z",
    "endDate": "2026-11-11T00:00:00.000Z",
    "price": 49.99,
    "billingCycle": "monthly"
  },
  "paymentsGenerated": 12,
  "payments": [
    {
      "id": 40,
      "monthNumber": 1,
      "amount": 49.99,
      "dueDate": "2025-11-11T00:00:00.000Z",
      "status": "pending"
    },
    // ... 11 autres paiements
  ]
}
```

### GET /subscriptions/:id
Obtenir le statut détaillé d'un abonnement.

**Réponse:**
```json
{
  "subscription": { /* ... */ },
  "stats": {
    "totalPayments": 12,
    "completedPayments": 1,
    "overduePayments": 1,
    "pendingPayments": 10,
    "percentComplete": 8
  },
  "nextPayment": {
    "id": 42,
    "amount": 49.99,
    "dueDate": "2025-12-11T00:00:00.000Z",
    "monthNumber": 2
  }
}
```

### GET /subscriptions/member/:memberId
Obtenir tous les abonnements d'un membre.

### POST /subscriptions/payments/:paymentId/complete
Marquer un paiement comme complété.

**Requête:**
```json
{
  "paymentMethod": "card",
  "transactionId": "TXN_123456789" // optionnel
}
```

**Comportement:** Si c'était le dernier paiement en retard, l'abonnement est automatiquement réactivé.

### GET /subscriptions/payments/upcoming
Obtenir les paiements à venir dans les 7 prochains jours (admin/owner uniquement).

## ⚙️ Services

### subscriptionService.js

#### createYearlySubscriptionWithPayments(memberId, plan, monthlyPrice, startDate)
Crée un abonnement annuel avec 12 paiements mensuels automatiques.

#### checkOverduePayments()
Vérifie les paiements en retard (J-7) et met les abonnements en pause.

#### checkUpcomingPayments()
Identifie les paiements à venir dans les 7 prochains jours.

#### markPaymentAsCompleted(paymentId, paymentMethod, transactionId)
Marque un paiement comme complété et réactive l'abonnement si nécessaire.

#### getSubscriptionStatus(subscriptionId)
Obtient le statut détaillé d'un abonnement avec statistiques.

## 🤖 Job Batch

### Configuration
Le job batch s'exécute automatiquement tous les soirs à **23h00** (heure de Paris).

Configuration dans `index.js`:
```javascript
const { startDailyPaymentCheckCron } = require('./jobs/dailyPaymentCheck');
startDailyPaymentCheckCron(); // Planning par défaut: '0 23 * * *'
```

### Fonctionnement
1. **Vérifie les paiements en retard**
   - Trouve les paiements `pending` dont la date due est dépassée de plus de 7 jours
   - Change leur statut en `overdue`
   - Met l'abonnement associé en `paused`

2. **Identifie les paiements à venir**
   - Trouve les paiements `pending` dont la date due est dans les 7 prochains jours
   - Peut être utilisé pour envoyer des rappels aux membres

### Exécution manuelle
```bash
# Via le script dédié
node scripts/run-payment-check.js

# Ou directement
node jobs/dailyPaymentCheck.js
```

## 🧪 Tests

### Test complet du système
```bash
node test-subscription-system.js

# Avec nettoyage des données de test
node test-subscription-system.js --cleanup
```

**Ce test vérifie:**
1. ✅ Création d'abonnement annuel
2. ✅ Génération des 12 paiements
3. ✅ Statut initial de l'abonnement
4. ✅ Complétion d'un paiement
5. ✅ Détection de paiement en retard
6. ✅ Mise en pause automatique
7. ✅ Mise à jour des statuts

### Résultat attendu
```
🧪 === TEST DU SYSTÈME D'ABONNEMENTS AUTOMATIQUES ===

1️⃣ Recherche d'un membre de test...
✅ Membre trouvé: Bob Williams (ID: 23)

2️⃣ Création d'un abonnement annuel avec 12 paiements...
✅ Abonnement créé avec ID: 18
   12 paiements générés

3️⃣ Vérification du statut de l'abonnement...
📊 Statut de l'abonnement:
   - Statut: active
   - Paiements totaux: 12
   - Paiements complétés: 0
   - Paiements en attente: 12

6️⃣ Exécution du job de vérification...
📊 Résultats de la vérification:
   - Paiements en retard: 1
   - Abonnements pausés: 1

7️⃣ Vérification du nouveau statut...
   - Statut de l'abonnement: paused
   - Paiements en retard: 1

🎉 === TEST TERMINÉ AVEC SUCCÈS ===
```

## 📊 Workflow complet

### 1. Création d'abonnement
```
Admin/Owner crée un abonnement
    ↓
Système génère 12 paiements mensuels
    ↓
Abonnement status = "active"
Paiements status = "pending"
```

### 2. Cycle de vie d'un paiement
```
pending (créé)
    ↓
    ├─→ completed (payé à temps)
    │   ↓
    │   Abonnement reste "active"
    │
    └─→ overdue (J-7 dépassé)
        ↓
        Abonnement → "paused"
        ↓
        completed (payé en retard)
        ↓
        Si plus de "overdue" → Abonnement → "active"
```

### 3. Job batch quotidien
```
Tous les jours à 23h00
    ↓
Cherche paiements "pending" avec dueDate < J-7
    ↓
Change status → "overdue"
    ↓
Met abonnement → "paused"
    ↓
Log les résultats
```

## 🔒 Permissions

### Créer un abonnement
- **Owner**: Pour n'importe quel membre
- **Admin**: Pour les membres de sa salle uniquement
- **Member**: Pour soi-même uniquement

### Voir les abonnements
- **Owner**: Tous les abonnements
- **Admin**: Abonnements des membres de sa salle
- **Member**: Ses propres abonnements

### Compléter un paiement
- **Owner**: N'importe quel paiement
- **Admin**: Paiements des membres de sa salle
- **Member**: Ses propres paiements

## 📝 Fichiers créés/modifiés

### Nouveaux fichiers
- `services/subscriptionService.js` - Service de gestion des abonnements
- `jobs/dailyPaymentCheck.js` - Job batch de vérification quotidienne
- `routes/subscriptions.js` - Routes API pour les abonnements
- `scripts/run-payment-check.js` - Script d'exécution manuelle du job
- `test-subscription-system.js` - Tests du système complet

### Fichiers modifiés
- `prisma/schema.prisma` - Ajout de champs pour Payment (dueDate, paidAt, monthNumber)
- `index.js` - Intégration du cron job et de la route subscriptions
- `package.json` - Ajout de la dépendance node-cron

### Migration Prisma
- `20251111175725_add_payment_due_date_fields` - Ajout des nouveaux champs

## 🚀 Mise en production

### Checklist
- [x] Migration de la base de données appliquée
- [x] Service de gestion des abonnements créé
- [x] Job batch configuré
- [x] Routes API créées et protégées
- [x] Tests passés avec succès
- [x] Cron job démarré automatiquement avec le serveur

### Démarrage
Le système démarre automatiquement avec le serveur:
```bash
npm start
# ou
nodemon
```

Le cron job sera actif et s'exécutera tous les soirs à 23h00.

## 💡 Améliorations futures

1. **Notifications par email**
   - Rappel 7 jours avant l'échéance
   - Alerte de paiement en retard
   - Confirmation de paiement reçu

2. **Renouvellement automatique**
   - Créer un nouvel abonnement 12 mois après si autoRenew = true

3. **Paiements récurrents**
   - Intégration avec Stripe/PayPal pour prélèvements automatiques

4. **Dashboard**
   - Vue d'ensemble des paiements à venir
   - Statistiques de recouvrement
   - Graphiques de revenus

5. **Relances automatiques**
   - Système de relances progressives pour paiements en retard

## 🐛 Dépannage

### Le cron job ne s'exécute pas
Vérifier que le serveur est démarré et les logs de démarrage affichent:
```
⏰ Démarrage du job de vérification quotidienne des paiements...
✅ Cron job démarré avec succès
```

### Tester le cron job manuellement
```bash
node scripts/run-payment-check.js
```

### Vérifier les paiements en retard
```bash
# Via Prisma Studio
npx prisma studio

# Ou requête directe
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.payment.findMany({ where: { status: 'overdue' } }).then(console.log)"
```
