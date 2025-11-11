# 🚀 Guide de Démarrage Rapide - Système d'Abonnements

## Installation

Aucune installation supplémentaire requise ! Le système est déjà configuré et prêt à l'emploi.

Dépendances ajoutées:
- ✅ `node-cron` - Pour les tâches planifiées

## Démarrage Automatique

Le système démarre automatiquement avec le serveur:

```bash
npm start
# ou
nodemon
```

Dans les logs, vous verrez:
```
⏰ Démarrage du job de vérification quotidienne des paiements...
✅ Cron job démarré avec succès
```

Le job s'exécute automatiquement **tous les soirs à 23h00**.

## Test Rapide en 3 Étapes

### 1. Créer un abonnement de test

```bash
# D'abord, obtenir un token JWT
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' \
  | jq -r '.token')

# Créer un abonnement annuel
curl -X POST http://localhost:3000/subscriptions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": 23,
    "plan": "premium",
    "monthlyPrice": 49.99
  }' | jq '.'
```

**Résultat attendu:**
```json
{
  "message": "Abonnement annuel créé avec succès",
  "subscription": {
    "id": 18,
    "status": "active",
    ...
  },
  "paymentsGenerated": 12,
  "payments": [...]
}
```

### 2. Vérifier le statut

```bash
# Remplacer 18 par l'ID de votre abonnement
curl -X GET http://localhost:3000/subscriptions/18 \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

**Résultat attendu:**
```json
{
  "subscription": {...},
  "stats": {
    "totalPayments": 12,
    "completedPayments": 0,
    "overduePayments": 0,
    "pendingPayments": 12,
    "percentComplete": 0
  },
  "nextPayment": {
    "amount": 49.99,
    "dueDate": "2025-11-11",
    "monthNumber": 1
  }
}
```

### 3. Tester le job batch manuellement

```bash
node scripts/run-payment-check.js
```

**Résultat attendu:**
```
═══════════════════════════════════════════════════════════
🤖 JOB BATCH - Vérification quotidienne des paiements
═══════════════════════════════════════════════════════════

🔍 Vérification des paiements en retard...
📊 0 paiement(s) en retard détecté(s)
✅ Vérification terminée

✅ Job exécuté avec succès!
```

## Test Complet du Système

```bash
# Exécute tous les tests automatiques
node test-subscription-system.js

# Avec nettoyage des données de test
node test-subscription-system.js --cleanup
```

## Endpoints API Disponibles

### 1. Créer un abonnement
```
POST /subscriptions
Body: { memberId, plan, monthlyPrice, startDate? }
→ Crée un abonnement + 12 paiements mensuels
```

### 2. Obtenir le statut d'un abonnement
```
GET /subscriptions/:id
→ Retourne l'abonnement avec statistiques
```

### 3. Abonnements d'un membre
```
GET /subscriptions/member/:memberId
→ Liste tous les abonnements du membre
```

### 4. Marquer un paiement comme payé
```
POST /subscriptions/payments/:paymentId/complete
Body: { paymentMethod, transactionId? }
→ Marque le paiement comme complété
```

### 5. Paiements à venir (Admin)
```
GET /subscriptions/payments/upcoming
→ Liste les paiements dus dans les 7 prochains jours
```

## Workflow Typique

### Scénario: Nouveau membre s'abonne

```javascript
// 1. Le membre ou l'admin crée l'abonnement
POST /subscriptions
{
  "memberId": 23,
  "plan": "premium",
  "monthlyPrice": 49.99
}

// → Système génère automatiquement:
//   - 1 abonnement (active, 1 an)
//   - 12 paiements (pending, un par mois)

// 2. Chaque nuit à 23h, le job batch vérifie:
//    - Si paiement dû depuis > 7 jours
//    - Si oui → status: overdue
//    - Si oui → abonnement: paused

// 3. Quand le membre paie:
POST /subscriptions/payments/40/complete
{
  "paymentMethod": "card",
  "transactionId": "TXN_123"
}

// → Système:
//   - Marque le paiement: completed
//   - Si plus de paiements en retard → abonnement: active
```

## Configuration du Cron Job

Par défaut, le job s'exécute à **23h00** tous les soirs.

Pour changer l'horaire, modifiez `index.js`:

```javascript
// Exemples de cron expressions:
startDailyPaymentCheckCron('0 23 * * *');  // 23h00 (défaut)
startDailyPaymentCheckCron('0 0 * * *');   // Minuit
startDailyPaymentCheckCron('0 2 * * *');   // 02h00
startDailyPaymentCheckCron('0 */6 * * *'); // Toutes les 6h
```

Format: `minute heure jour mois jour_semaine`

## Surveillance et Logs

### Logs du serveur
```bash
# Voir les logs en temps réel
tail -f logs/server.log

# Chercher les exécutions du job batch
grep "JOB BATCH" logs/server.log
```

### Vérifier les paiements en retard
```bash
# Via Prisma Studio
npx prisma studio
# → Aller dans Payment → Filtrer par status: overdue

# Ou en ligne de commande
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.payment.findMany({ 
  where: { status: 'overdue' },
  include: { member: { include: { user: true } } }
}).then(console.log).finally(() => prisma.\$disconnect());
"
```

## Dépannage

### Le cron job ne s'exécute pas
1. Vérifier que le serveur est démarré
2. Chercher dans les logs: `Cron job démarré`
3. Tester manuellement: `node scripts/run-payment-check.js`

### Les paiements ne sont pas marqués en retard
1. Vérifier la date `dueDate` des paiements
2. Le job ne marque en retard que si `dueDate < (aujourd'hui - 7 jours)`
3. Exécuter manuellement pour tester

### Un abonnement n'est pas réactivé après paiement
1. Vérifier qu'il n'y a plus d'autres paiements `overdue`
2. L'abonnement se réactive uniquement quand TOUS les paiements en retard sont payés

## Documentation Complète

Pour plus de détails:
- 📚 [Documentation système complète](docs/SUBSCRIPTION_SYSTEM.md)
- 💻 [Exemples d'API](docs/SUBSCRIPTION_API_EXAMPLES.md)
- 📝 [Résumé de l'implémentation](SUBSCRIPTION_IMPLEMENTATION_SUMMARY.md)

## Commandes Utiles

```bash
# Démarrer le serveur
npm start

# Tester le système complet
node test-subscription-system.js

# Exécuter le job batch manuellement
node scripts/run-payment-check.js

# Voir la base de données
npx prisma studio

# Voir les migrations
npx prisma migrate status

# Logs en temps réel
tail -f logs/server.log
```

## Support

En cas de problème:
1. Vérifier les logs du serveur
2. Exécuter les tests: `node test-subscription-system.js`
3. Consulter la documentation dans `docs/`

---

**🎉 Le système est prêt à l'emploi !**

Créez votre premier abonnement et laissez le système gérer automatiquement les paiements mensuels et les relances. 🚀
