# 🔔 Implémentation des Notifications Push

## Vue d'ensemble

Toutes les notifications push FCM ont été implémentées pour les événements critiques du système. Les notifications sont envoyées automatiquement lorsque les conditions sont remplies.

## ✅ Notifications Implémentées

### 1. 📋 Abonnements

#### 1.1 Création d'abonnement
**Déclencheur:** Création d'un nouvel abonnement  
**Route:** `POST /api/subscriptions`  
**Fonction:** `notifyNewSubscription()`  
**Contenu:**
- Titre: "📋 Nouvel abonnement créé"
- Corps: Nom du type d'abonnement, montant et fréquence de paiement
- Données: subscriptionId, type, montant, fréquence

**Exemple:**
```
Titre: 📋 Nouvel abonnement créé
Corps: Abonnement Premium - 600€ en mensuel
```

#### 1.2 Création de paiement
**Déclencheur:** Création d'un paiement dans un abonnement  
**Route:** `POST /api/subscriptions` (lors de la création d'abonnement)  
**Fonction:** `notifyNewPayment()`  
**Contenu:**
- Titre: "💳 Nouveau paiement enregistré"
- Corps: Numéro du paiement, montant et date d'échéance
- Données: paymentId, montant, dueDate, monthNumber

**Exemple:**
```
Titre: 💳 Nouveau paiement enregistré
Corps: Paiement #1 de 50€ - Échéance: 11/11/2025
```

### 2. 💳 Paiements

#### 2.1 Paiement dû (rappel)
**Déclencheur:** Paiement à venir dans les 3 jours (job quotidien)  
**Route:** Job batch quotidien  
**Fonction:** `notifyPaymentDue()`  
**Contenu:**
- Titre: "💳 Paiement à effectuer"
- Corps: Montant et date d'échéance
- Données: paymentId, montant, dueDate

**Exemple:**
```
Titre: 💳 Paiement à effectuer
Corps: Votre paiement de 50€ est dû le 14/11/2025
```

#### 2.2 Paiement confirmé
**Déclencheur:** Acquittement d'un paiement  
**Route:** `POST /api/subscriptions/payments/:paymentId/acknowledge`  
**Fonction:** `notifyPaymentConfirmed()`  
**Contenu:**
- Titre: "✅ Paiement confirmé"
- Corps: Confirmation du montant payé
- Données: paymentId, montant

**Exemple:**
```
Titre: ✅ Paiement confirmé
Corps: Votre paiement de 50€ a été confirmé avec succès
```

#### 2.3 Paiement en retard
**Déclencheur:** Paiement non payé 7 jours après l'échéance (job quotidien)  
**Route:** Job batch quotidien  
**Fonction:** `notifyPaymentOverdue()`  
**Contenu:**
- Titre: "⚠️ Paiement en retard"
- Corps: Montant et nombre de jours de retard
- Données: paymentId, montant, dueDate, daysOverdue
- Priorité: Haute
- Couleur: Rouge (Android)

**Exemple:**
```
Titre: ⚠️ Paiement en retard
Corps: Votre paiement de 50€ est en retard de 3 jour(s)
```

#### 2.4 Changement de statut de paiement
**Déclencheur:** Changement de statut d'un paiement  
**Fonctions appelées dans:**
- `checkOverduePayments()` - Service (pending → overdue)
- `markPaymentAsCompleted()` - Service (any → completed)
**Fonction:** `notifyPaymentStatusChange()`  
**Contenu:**
- Titre: Variable selon le nouveau statut
- Corps: Ancien statut → Nouveau statut
- Données: paymentId, montant, oldStatus, newStatus

**Exemples:**
```
Titre: ✅ Paiement confirmé
Corps: Votre paiement de 50€ a été confirmé avec succès

Titre: ⚠️ Paiement en retard
Corps: Votre paiement de 50€ est maintenant en retard
```

### 3. 💪 Plannings

#### 3.1 Création de planning
**Déclencheur:** Création d'un nouveau planning par un coach  
**Route:** `POST /api/plannings`  
**Fonction:** `notifyNewTrainingPlan()`  
**Contenu:**
- Titre: "💪 Nouveau planning d'entraînement"
- Corps: Titre du planning et période
- Données: planningId, title

**Exemple:**
```
Titre: 💪 Nouveau planning d'entraînement
Corps: Programme Musculation - Du 11/11/2025 au 11/12/2025
```

#### 3.2 Ajout d'exercice au planning
**Déclencheur:** Ajout d'un exercice à un jour du planning  
**Route:** `POST /api/plannings/:planningId/days/:dayOfWeek/exercises`  
**Fonction:** `notifyPlanningModified(type: 'exercise_added')`  
**Contenu:**
- Titre: "📝 Planning modifié"
- Corps: Titre du planning - Nouvel exercice ajouté
- Données: planningId, modificationType, title

**Exemple:**
```
Titre: 📝 Planning modifié
Corps: Programme Musculation - Nouvel exercice ajouté
```

#### 3.3 Suppression d'exercice du planning
**Déclencheur:** Suppression d'un exercice d'un jour du planning  
**Route:** `DELETE /api/plannings/:planningId/days/:dayOfWeek/exercises/:exerciseId`  
**Fonction:** `notifyPlanningModified(type: 'exercise_removed')`  
**Contenu:**
- Titre: "📝 Planning modifié"
- Corps: Titre du planning - Exercice supprimé
- Données: planningId, modificationType, title

**Exemple:**
```
Titre: 📝 Planning modifié
Corps: Programme Musculation - Exercice supprimé
```

#### 3.4 Suppression de planning
**Déclencheur:** Suppression ou annulation d'un planning  
**Route:** À implémenter (DELETE /api/plannings/:id)  
**Fonction:** `notifyPlanningDeleted()`  
**Contenu:**
- Titre: "🗑️ Planning supprimé"
- Corps: Nom du planning supprimé
- Données: planningId, title

**Exemple:**
```
Titre: 🗑️ Planning supprimé
Corps: Le planning "Programme Musculation" a été supprimé
```

## 📋 Configuration Requise

### Firebase Setup
1. Créer un projet Firebase sur https://console.firebase.google.com
2. Générer une clé privée (Service Account) dans Project Settings > Service Accounts
3. Télécharger le fichier JSON
4. Placer le fichier dans le projet
5. Ajouter dans `.env`:
```env
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

### FCM Token
Chaque utilisateur doit avoir un `fcmToken` enregistré dans la base de données pour recevoir les notifications.

## 🔄 Job Quotidien

Le job batch quotidien (`jobs/dailyPaymentCheck.js`) s'exécute chaque jour à 23h00 pour:
1. Vérifier les paiements en retard (J+7)
2. Mettre les abonnements en pause si nécessaire
3. Envoyer des notifications pour:
   - Paiements en retard
   - Paiements à venir (dans 3 jours)

**Configuration du job:**
```javascript
// Démarrer le job (dans index.js)
const { startDailyPaymentCheckCron } = require('./jobs/dailyPaymentCheck');
startDailyPaymentCheckCron(); // Démarre à 23h00 tous les jours
```

## 🧪 Tests

### Test manuel d'une notification
```javascript
const { sendPushNotification } = require('./services/pushNotificationService');

// Envoyer une notification de test
await sendPushNotification(fcmToken, {
  title: '🧪 Test',
  body: 'Ceci est une notification de test',
  data: {
    type: 'test'
  }
});
```

### Test du job quotidien
```bash
# Exécuter immédiatement (sans attendre 23h00)
node jobs/dailyPaymentCheck.js
```

## 📊 Logs

Toutes les notifications sont loggées avec des détails:
- ✅ Succès: `✅ Notification envoyée avec succès - Message ID: xxx`
- ❌ Erreur: `❌ Erreur envoi notification push: xxx`
- ⚠️ Avertissement: `⚠️ Firebase non initialisé - Notification non envoyée`

## 🔐 Sécurité

- Les notifications sont envoyées uniquement aux utilisateurs concernés
- Le FCM token n'est jamais exposé dans les logs complets
- Les données sensibles (montants, dates) sont incluses dans le payload `data` pour l'app mobile

## 📱 Côté Application Mobile

L'application Flutter doit:
1. Demander la permission pour les notifications
2. Récupérer le FCM token
3. Envoyer le token au serveur lors du login
4. Mettre à jour le token si nécessaire
5. Gérer les notifications reçues selon leur type

### Exemple d'update du token
```dart
POST /api/auth/update-fcm-token
{
  "fcmToken": "xxx..."
}
```

## ✅ Checklist d'Implémentation

- [x] Service de notifications push créé
- [x] Notification création abonnement
- [x] Notification création paiement
- [x] Notification paiement dû
- [x] Notification paiement confirmé
- [x] Notification paiement en retard
- [x] Notification changement statut paiement
- [x] Notification création planning
- [x] Notification modification planning (ajout exercice)
- [x] Notification modification planning (suppression exercice)
- [x] Notification suppression planning (fonction créée)
- [x] Job quotidien pour vérifications automatiques
- [x] Documentation complète

## 🔄 Prochaines Étapes

1. Configurer Firebase dans le projet
2. Tester les notifications avec des FCM tokens réels
3. Implémenter la route DELETE pour les plannings
4. Ajouter des notifications pour d'autres événements si nécessaire (messages, annonces, etc.)
5. Implémenter l'historique des notifications côté app mobile
