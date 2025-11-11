# Configuration des Notifications Push Firebase

## 📋 Vue d'ensemble

Ce document explique comment configurer Firebase Cloud Messaging (FCM) pour envoyer des notifications push aux utilisateurs de l'application Team Fitness.

## 🚀 Étapes de configuration

### 1. Créer un projet Firebase

1. Aller sur [Firebase Console](https://console.firebase.google.com)
2. Cliquer sur "Ajouter un projet" ou "Add project"
3. Donner un nom au projet (ex: "Team Fitness")
4. Suivre les étapes de création

### 2. Obtenir les credentials du service

1. Dans Firebase Console, aller dans **Project Settings** (⚙️ en haut à gauche)
2. Aller dans l'onglet **Service Accounts**
3. Sélectionner **Node.js** comme langage
4. Cliquer sur **Generate new private key**
5. Télécharger le fichier JSON (ex: `team-fitness-firebase-adminsdk.json`)

### 3. Configurer le serveur

1. Placer le fichier JSON téléchargé dans le répertoire du projet:
```bash
/mnt/i/Dev Projects/team_fitness_server/firebase-service-account.json
```

2. Ajouter le chemin dans le fichier `.env`:
```env
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

3. **Important**: Ajouter ce fichier au `.gitignore` pour ne pas le commiter:
```bash
echo "firebase-service-account.json" >> .gitignore
```

### 4. Installer les dépendances

```bash
npm install firebase-admin
```

### 5. Configurer l'application Flutter

Dans votre app Flutter, vous devez:

1. Installer le package FCM:
```yaml
dependencies:
  firebase_core: ^latest_version
  firebase_messaging: ^latest_version
```

2. Initialiser Firebase dans votre app

3. Obtenir le FCM token:
```dart
import 'package:firebase_messaging/firebase_messaging.dart';

final fcmToken = await FirebaseMessaging.instance.getToken();
print('FCM Token: $fcmToken');
```

4. Envoyer ce token au serveur via l'endpoint `/api/users/fcm-token`

## 📡 API Endpoints

### Mettre à jour le FCM token

```http
PUT /api/users/fcm-token
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "fcmToken": "dXZw8fR3QkG..."
}
```

**Réponse:**
```json
{
  "message": "FCM token mis à jour avec succès",
  "user": {
    "id": 5,
    "email": "user@example.com",
    "fullName": "John Doe",
    "fcmToken": "dXZw8fR3QkG..."
  }
}
```

### Supprimer le FCM token (déconnexion)

```http
DELETE /api/users/fcm-token
Authorization: Bearer <jwt_token>
```

**Réponse:**
```json
{
  "message": "FCM token supprimé avec succès"
}
```

## 🔔 Types de notifications

Le service `pushNotificationService.js` fournit plusieurs fonctions pour différents types de notifications:

### 1. Paiement dû
```javascript
const { notifyPaymentDue } = require('./services/pushNotificationService');

await notifyPaymentDue(user.fcmToken, {
  id: 123,
  amount: 50.00,
  dueDate: new Date('2024-12-01')
});
```

### 2. Paiement en retard
```javascript
const { notifyPaymentOverdue } = require('./services/pushNotificationService');

await notifyPaymentOverdue(user.fcmToken, {
  id: 123,
  amount: 50.00,
  dueDate: new Date('2024-11-01')
});
```

### 3. Paiement confirmé
```javascript
const { notifyPaymentConfirmed } = require('./services/pushNotificationService');

await notifyPaymentConfirmed(user.fcmToken, {
  id: 123,
  amount: 50.00
});
```

### 4. Nouveau planning d'entraînement
```javascript
const { notifyNewTrainingPlan } = require('./services/pushNotificationService');

await notifyNewTrainingPlan(user.fcmToken, {
  id: 10,
  title: "Programme Force - Semaine 1",
  startDate: new Date('2024-12-01'),
  endDate: new Date('2024-12-07')
});
```

### 5. Notification personnalisée
```javascript
const { sendPushNotification } = require('./services/pushNotificationService');

await sendPushNotification(user.fcmToken, {
  title: "Titre de la notification",
  body: "Message de la notification",
  data: {
    type: "custom",
    customField: "valeur"
  }
});
```

### 6. Notification à tous les membres d'une salle
```javascript
const { notifyGymMembers } = require('./services/pushNotificationService');

await notifyGymMembers(gymId, {
  title: "Fermeture exceptionnelle",
  body: "La salle sera fermée le 25 décembre",
  data: {
    type: "gym_announcement"
  }
});
```

## 🔄 Intégration automatique

### Dans le job de vérification des paiements

Le job `dailyPaymentCheck.js` peut être modifié pour envoyer des notifications:

```javascript
const { notifyPaymentOverdue } = require('../services/pushNotificationService');

// Après détection d'un paiement en retard
if (payment.status === 'overdue') {
  const member = await prisma.member.findUnique({
    where: { userId: payment.memberId },
    include: { user: true }
  });
  
  if (member.user.fcmToken) {
    await notifyPaymentOverdue(member.user.fcmToken, payment);
  }
}
```

### Dans la route d'acknowledgement de paiement

Modifier `routes/subscriptions.js`:

```javascript
const { notifyPaymentConfirmed } = require('../services/pushNotificationService');

// Après confirmation du paiement
const payment = await prisma.payment.update({
  where: { id: paymentId },
  data: { status: 'completed', paidAt: new Date() }
});

// Envoyer notification
const member = await prisma.member.findUnique({
  where: { userId: payment.memberId },
  include: { user: true }
});

if (member.user.fcmToken) {
  await notifyPaymentConfirmed(member.user.fcmToken, payment);
}
```

### Dans la création de planning

Modifier `routes/plannings.js`:

```javascript
const { notifyNewTrainingPlan } = require('../services/pushNotificationService');

// Après création du planning
const planning = await prisma.planning.create({
  data: { /* ... */ }
});

// Envoyer notification au membre
const member = await prisma.member.findUnique({
  where: { userId: planning.memberId },
  include: { user: true }
});

if (member.user.fcmToken) {
  await notifyNewTrainingPlan(member.user.fcmToken, planning);
}
```

## 📱 Gestion des tokens côté Flutter

### Sauvegarder le token lors de la connexion

```dart
// Après login réussi
final token = await FirebaseMessaging.instance.getToken();
if (token != null) {
  await apiService.updateFcmToken(token);
}
```

### Gérer le rafraîchissement du token

```dart
FirebaseMessaging.instance.onTokenRefresh.listen((newToken) async {
  await apiService.updateFcmToken(newToken);
});
```

### Supprimer le token lors de la déconnexion

```dart
// Lors du logout
await apiService.deleteFcmToken();
await FirebaseMessaging.instance.deleteToken();
```

### Gérer les notifications reçues

```dart
// Notification reçue en foreground
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  print('Notification reçue: ${message.notification?.title}');
  
  // Afficher une notification locale ou un dialog
  if (message.data['type'] == 'payment_due') {
    // Naviguer vers l'écran des paiements
  }
});

// Notification cliquée (app en background)
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
  print('Notification cliquée: ${message.notification?.title}');
  
  // Naviguer vers l'écran approprié selon message.data['type']
});
```

## 🧪 Tester les notifications

### Depuis le serveur (route de test)

Créer une route temporaire pour tester:

```javascript
router.post('/test-notification', auth, async (req, res) => {
  const { sendPushNotification } = require('../services/pushNotificationService');
  
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub }
  });
  
  if (!user.fcmToken) {
    return res.status(400).json({ error: 'Aucun FCM token' });
  }
  
  const result = await sendPushNotification(user.fcmToken, {
    title: "Test Notification",
    body: "Ceci est une notification de test",
    data: { type: "test" }
  });
  
  res.json(result);
});
```

### Depuis Postman

```http
POST http://localhost:3000/api/users/test-notification
Authorization: Bearer <jwt_token>
```

## ⚠️ Considérations importantes

### Sécurité

- ✅ **Ne jamais commiter** le fichier `firebase-service-account.json`
- ✅ Toujours utiliser des variables d'environnement
- ✅ Valider les permissions avant d'envoyer des notifications

### Performance

- ⚠️ Pour les envois groupés (>100 tokens), utiliser `sendMulticastPushNotification`
- ⚠️ Ne pas envoyer de notifications trop fréquemment
- ⚠️ Gérer les tokens invalides et les supprimer de la base

### Gestion des erreurs

Les tokens FCM peuvent devenir invalides si:
- L'utilisateur désinstalle l'app
- L'utilisateur se déconnecte de Firebase
- Le token expire (rare)

Il faut gérer ces cas et supprimer les tokens invalides:

```javascript
const result = await sendPushNotification(fcmToken, notification);

if (!result.success && result.error.includes('registration-token-not-registered')) {
  // Supprimer le token invalide
  await prisma.user.update({
    where: { id: userId },
    data: { fcmToken: null }
  });
}
```

## 📊 Monitoring

Pour suivre l'utilisation des notifications:

1. **Firebase Console** > Cloud Messaging
   - Nombre de notifications envoyées
   - Taux de délivrabilité
   - Taux d'ouverture

2. **Logs serveur**
   - Toutes les notifications sont loggées avec emoji 📲
   - Succès: ✅
   - Échecs: ❌

## 🔗 Ressources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK Node.js](https://firebase.google.com/docs/admin/setup)
- [Flutter Firebase Messaging](https://firebase.flutter.dev/docs/messaging/overview/)
- [FCM HTTP v1 API](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages)

## 📝 Checklist de configuration

- [ ] Projet Firebase créé
- [ ] Service account key téléchargée
- [ ] Fichier JSON placé dans le projet
- [ ] Variable `FIREBASE_SERVICE_ACCOUNT_PATH` ajoutée au `.env`
- [ ] Fichier ajouté au `.gitignore`
- [ ] Package `firebase-admin` installé
- [ ] App Flutter configurée avec Firebase
- [ ] Endpoint de mise à jour du token testé
- [ ] Notification de test envoyée et reçue
- [ ] Intégrations dans les routes appropriées
