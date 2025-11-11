# 🔔 Firebase Cloud Messaging (FCM) - Notifications Push

## ✅ Implémentation complète

### 📊 Base de données

- **Champ ajouté**: `fcmToken` (String, nullable) dans le modèle `User`
- **Migration créée**: `20251111205200_add_fcm_token_to_user`

### 🛣️ API Endpoints

#### 1. Mettre à jour le FCM token
```http
PUT /api/users/fcm-token
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "fcmToken": "dXZw8fR3QkG..."
}
```

#### 2. Supprimer le FCM token (logout)
```http
DELETE /api/users/fcm-token
Authorization: Bearer <jwt_token>
```

### 🚀 Service de notifications

Fichier: `services/pushNotificationService.js`

**Fonctions disponibles:**

1. `sendPushNotification(fcmToken, notification)` - Envoyer à un utilisateur
2. `sendMulticastPushNotification(fcmTokens, notification)` - Envoyer à plusieurs utilisateurs
3. `notifyPaymentDue(fcmToken, payment)` - Notifier paiement dû
4. `notifyPaymentOverdue(fcmToken, payment)` - Notifier paiement en retard
5. `notifyPaymentConfirmed(fcmToken, payment)` - Confirmer paiement
6. `notifyNewTrainingPlan(fcmToken, planning)` - Nouveau planning
7. `notifyGymMembers(gymId, notification)` - Notifier tous les membres d'une salle

### 📚 Documentation complète

- **Setup**: `docs/PUSH_NOTIFICATIONS.md`
- **Swagger**: Endpoints documentés dans `/api-docs`

## 🔧 Configuration requise

### 1. Firebase
```bash
# Créer un projet sur https://console.firebase.google.com
# Télécharger le service account JSON
# Placer dans: firebase-service-account.json
```

### 2. Variables d'environnement
```env
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

### 3. Installation
```bash
npm install firebase-admin
```

### 4. Sécurité
```bash
echo "firebase-service-account.json" >> .gitignore
```

## 📱 Intégration Flutter

### Obtenir et envoyer le token
```dart
import 'package:firebase_messaging/firebase_messaging.dart';

// Obtenir le token
final token = await FirebaseMessaging.instance.getToken();

// Envoyer au serveur
await apiService.put('/users/fcm-token', {
  'fcmToken': token
});
```

### Gérer les notifications
```dart
// En foreground
FirebaseMessaging.onMessage.listen((message) {
  print('Notification: ${message.notification?.title}');
});

// En background (cliquée)
FirebaseMessaging.onMessageOpenedApp.listen((message) {
  // Naviguer vers l'écran approprié
});
```

## 💡 Exemples d'utilisation

### Notification lors de création d'abonnement
```javascript
const { notifyPaymentDue } = require('./services/pushNotificationService');

// Après création de l'abonnement
const member = await prisma.member.findUnique({
  where: { userId: memberId },
  include: { user: true }
});

if (member.user.fcmToken) {
  await notifyPaymentDue(member.user.fcmToken, firstPayment);
}
```

### Notification groupée aux membres d'une salle
```javascript
const { notifyGymMembers } = require('./services/pushNotificationService');

await notifyGymMembers(gymId, {
  title: "⚠️ Fermeture exceptionnelle",
  body: "La salle sera fermée le 25 décembre",
  data: { type: "gym_announcement" }
});
```

## 🧪 Test rapide

### 1. Démarrer le serveur
```bash
nodemon index.js
```

### 2. Login et obtenir JWT token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"uniqueCode":"OWNER-001","password":"password123"}'
```

### 3. Mettre à jour FCM token
```bash
curl -X PUT http://localhost:3000/api/users/fcm-token \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"fcmToken":"test-token-123"}'
```

## 📝 Types de notifications supportés

| Type | Fonction | Cas d'usage |
|------|----------|-------------|
| Paiement dû | `notifyPaymentDue` | 3 jours avant échéance |
| Paiement en retard | `notifyPaymentOverdue` | Détecté par job quotidien |
| Paiement confirmé | `notifyPaymentConfirmed` | Après acknowledgement |
| Nouveau planning | `notifyNewTrainingPlan` | Création par coach |
| Annonce salle | `notifyGymMembers` | Message admin/owner |
| Custom | `sendPushNotification` | Cas spécifiques |

## 🔄 Workflow recommandé

1. **Login Flutter** → Obtenir FCM token → Envoyer au serveur
2. **Création abonnement** → Générer paiements → Notifier premier paiement
3. **Job quotidien** → Détecter retards → Notifier membres concernés
4. **Acknowledgement paiement** → Confirmer → Notifier membre
5. **Nouveau planning** → Créer → Notifier membre
6. **Logout Flutter** → Supprimer token côté serveur

## 🛡️ Sécurité

- ✅ Tokens chiffrés en transit (HTTPS)
- ✅ Authentification JWT requise
- ✅ Users peuvent seulement modifier leur propre token
- ✅ Service account Firebase ne doit jamais être commitée
- ✅ Validation des données avant envoi

## 📊 Monitoring

Les logs incluent des emojis pour faciliter le suivi:
- 🔔 Mise à jour FCM token
- 🔕 Suppression FCM token  
- 📲 Envoi notification
- ✅ Notification envoyée avec succès
- ❌ Échec envoi notification

## 🔗 Ressources

- [Documentation complète](./docs/PUSH_NOTIFICATIONS.md)
- [Swagger API](http://localhost:3000/api-docs)
- [Firebase Console](https://console.firebase.google.com)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Flutter Firebase Messaging](https://firebase.flutter.dev/docs/messaging/overview/)

## ⚡ Quick Start

1. ✅ Créer projet Firebase
2. ✅ Télécharger service account
3. ✅ Configurer `.env`
4. ✅ Installer `firebase-admin`
5. ✅ Tester avec Postman
6. ✅ Intégrer dans Flutter app
7. ✅ Tester notifications end-to-end

---

**Status**: ✅ Prêt pour intégration
**Date**: 11 novembre 2024
**Version**: 1.0.0
