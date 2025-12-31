# Système de Vérification FCM et Gestion des Notifications

## Vue d'ensemble

Le système vérifie automatiquement la disponibilité de Firebase Cloud Messaging (FCM) et la validité des tokens FCM des utilisateurs. Si FCM n'est pas disponible ou si un token est invalide, le flag `notificationsEnabled` de l'utilisateur est automatiquement mis à `false`.

## Architecture

### 1. Vérification à l'enregistrement du token

Lorsqu'un utilisateur met à jour son FCM token via `PUT /api/users/fcm-token` :

1. **Vérification de la disponibilité de FCM** : Le système vérifie si Firebase est configuré et disponible
2. **Validation du token** : Si FCM est disponible, le token est validé via un appel dry-run à Firebase
3. **Mise à jour du flag** :
   - ✅ Token valide → `notificationsEnabled = true`
   - ❌ Token invalide ou FCM indisponible → `notificationsEnabled = false`

```javascript
// Route: PUT /api/users/fcm-token
{
  "fcmToken": "eCf_xxx..."
}

// Réponse si token valide:
{
  "message": "FCM token mis à jour avec succès",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "fcmToken": "eCf_xxx...",
    "notificationsEnabled": true
  },
  "fcmAvailable": true,
  "tokenValid": true
}

// Réponse si token invalide:
{
  "error": "Token FCM invalide",
  "message": "Le token a été enregistré mais les notifications sont désactivées",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "fcmToken": "eCf_xxx...",
    "notificationsEnabled": false
  },
  "fcmAvailable": true,
  "tokenValid": false
}
```

### 2. Vérification lors de l'envoi de notifications

Lorsqu'une notification est envoyée et que le token est invalide :

1. **Détection automatique** : Firebase retourne une erreur `registration-token-not-registered` ou `invalid-registration-token`
2. **Désactivation automatique** : Le système met automatiquement `notificationsEnabled = false` pour cet utilisateur
3. **Logging** : L'opération est loggée pour traçabilité

```javascript
// Codes d'erreur Firebase gérés:
- messaging/registration-token-not-registered
- messaging/invalid-registration-token
```

### 3. Filtrage des notifications

Tous les mécanismes d'envoi de notifications filtrent maintenant les utilisateurs :

- ✅ `fcmToken IS NOT NULL`
- ✅ `notificationsEnabled = true`

## Fonctions ajoutées au service

### `isFCMAvailable()`

Vérifie si Firebase est configuré et disponible.

```javascript
const { isFCMAvailable } = require('./services/pushNotificationService');

if (isFCMAvailable()) {
  console.log('✅ FCM disponible');
} else {
  console.log('❌ FCM non configuré');
}
```

### `validateFCMToken(fcmToken)`

Valide un token FCM sans envoyer de notification réelle.

```javascript
const { validateFCMToken } = require('./services/pushNotificationService');

const result = await validateFCMToken(token);
if (result.valid) {
  console.log('✅ Token valide');
} else {
  console.log('❌ Token invalide:', result.error);
}
```

### `disableNotificationsForInvalidToken(fcmToken)`

Désactive automatiquement les notifications pour un token invalide (appelée en interne).

## Jobs modifiés

### Daily Planning Notification

Vérifie maintenant :
- `workoutNotificationsEnabled = true` (spécifique aux entraînements)
- `notificationsEnabled = true` (global)
- `fcmToken IS NOT NULL`

### Daily Payment Check

Vérifie maintenant :
- `notificationsEnabled = true`
- `fcmToken IS NOT NULL`

## Flux de données

```
1. User met à jour FCM token
   ↓
2. Vérification FCM disponible
   ↓
3. Validation du token (dry-run Firebase)
   ↓
4. Mise à jour notificationsEnabled
   ├─ true si token valide
   └─ false si token invalide ou FCM indisponible
   ↓
5. Lors des envois futurs:
   - Filtre automatique par notificationsEnabled
   - Si erreur token invalide → désactivation auto
```

## Gestion des erreurs

### Scénario 1: FCM non configuré

```javascript
// Résultat:
{
  "message": "FCM token enregistré mais notifications désactivées (FCM non configuré)",
  "user": { "notificationsEnabled": false },
  "fcmAvailable": false
}
```

### Scénario 2: Token invalide lors de la mise à jour

```javascript
// Résultat:
{
  "error": "Token FCM invalide",
  "user": { "notificationsEnabled": false },
  "fcmAvailable": true,
  "tokenValid": false
}
```

### Scénario 3: Token devient invalide après utilisation

```javascript
// Le système:
1. Tente d'envoyer la notification
2. Reçoit erreur "token-not-registered"
3. Désactive automatiquement notificationsEnabled
4. Log: "🔕 Notifications désactivées pour user@example.com (token invalide)"
```

## Tests

### Tester la validation de token

```bash
# Token valide
curl -X PUT http://localhost:3000/api/users/fcm-token \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fcmToken": "VALID_FCM_TOKEN"}'

# Token invalide
curl -X PUT http://localhost:3000/api/users/fcm-token \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fcmToken": "INVALID_TOKEN"}'
```

### Vérifier l'état des notifications

```sql
-- Voir les utilisateurs avec notifications désactivées
SELECT id, email, "fcmToken", "notificationsEnabled" 
FROM "User" 
WHERE "fcmToken" IS NOT NULL 
  AND "notificationsEnabled" = false;

-- Réactiver manuellement si besoin
UPDATE "User" 
SET "notificationsEnabled" = true 
WHERE id = 1;
```

## Migration

Aucune migration nécessaire - le champ `notificationsEnabled` existe déjà dans le schéma avec `@default(true)`.

## Logs

Les logs suivent le format suivant :

- ✅ Succès : `✅ FCM token mis à jour et validé pour John Doe`
- ⚠️ Avertissement : `⚠️ Token FCM invalide - Désactivation des notifications`
- 🔕 Désactivation : `🔕 Notifications désactivées pour user@example.com (token invalide)`
- ❌ Erreur : `❌ Erreur validation token FCM: ...`

## Recommandations

1. **Application mobile** : Gérer le cas `notificationsEnabled = false` dans la réponse de l'API
2. **Réessais** : L'app mobile devrait permettre à l'utilisateur de réessayer l'enregistrement du token
3. **UI/UX** : Afficher un message clair si les notifications ne peuvent pas être activées
4. **Monitoring** : Surveiller le nombre d'utilisateurs avec `notificationsEnabled = false`

## Sécurité

- Les tokens FCM sont validés côté serveur uniquement
- Pas d'envoi de notification réelle lors de la validation (dry-run)
- Désactivation automatique pour éviter les tentatives d'envoi inutiles
- Logs détaillés pour audit et débogage
