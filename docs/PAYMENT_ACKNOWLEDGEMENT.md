# Endpoint d'Acquittement de Paiement

## Description

L'endpoint `/subscriptions/payments/:paymentId/acknowledge` permet d'acquitter un paiement et d'activer automatiquement l'abonnement associé s'il est en statut "en attente" (pending).

## Fonctionnalités

- ✅ Marque un paiement comme "complété" (completed)
- ✅ Enregistre la date de paiement
- ✅ Active automatiquement l'abonnement s'il est en statut "pending"
- ✅ Réactive l'abonnement si tous les paiements en retard sont réglés

## Endpoint

```
POST /subscriptions/payments/:paymentId/acknowledge
```

### Headers requis

```
Authorization: Bearer <token>
```

### Paramètres de requête

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `paymentMethod` | string | ✅ | Méthode de paiement utilisée (ex: card, paypal, bank_transfer) |
| `transactionId` | string | ❌ | Identifiant de la transaction (optionnel) |

### Exemple de requête

```bash
curl -X POST http://localhost:3000/subscriptions/payments/199/acknowledge \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "card",
    "transactionId": "TXN_12345"
  }'
```

### Réponse en cas de succès (200)

```json
{
  "message": "Paiement acquitté avec succès",
  "payment": {
    "id": 199,
    "memberId": 41,
    "subscriptionId": 31,
    "amount": 19.99,
    "currency": "EUR",
    "status": "completed",
    "type": "subscription",
    "paymentMethod": "card",
    "transactionId": "TXN_12345",
    "description": "Paiement mensuel 1/12 - Découverte",
    "dueDate": "2025-11-11T00:00:00.000Z",
    "paidAt": "2025-11-11T19:43:22.000Z",
    "monthNumber": 1,
    "createdAt": "2025-11-11T18:30:00.000Z",
    "updatedAt": "2025-11-11T19:43:22.000Z"
  },
  "subscription": {
    "id": 31,
    "status": "active",
    "type": "Découverte",
    "startDate": "2025-11-11T00:00:00.000Z",
    "endDate": "2026-11-11T00:00:00.000Z"
  }
}
```

## Scénarios d'utilisation

### 1. Activation d'un abonnement en attente

Lorsqu'un membre s'inscrit, un abonnement peut être créé avec le statut "pending" en attendant le premier paiement. Une fois le premier paiement acquitté, l'abonnement passe automatiquement au statut "active".

**Exemple :**
```javascript
// État initial
Abonnement: { id: 31, status: 'pending' }
Paiement: { id: 199, status: 'pending' }

// Après l'acquittement
Abonnement: { id: 31, status: 'active' } ✅
Paiement: { id: 199, status: 'completed' } ✅
```

### 2. Réactivation d'un abonnement en pause

Si un abonnement est en pause à cause de paiements en retard, l'acquittement du dernier paiement en retard réactive automatiquement l'abonnement.

**Exemple :**
```javascript
// État initial
Abonnement: { id: 31, status: 'paused' }
Paiement 1: { status: 'completed' }
Paiement 2: { status: 'overdue' } ← À acquitter

// Après l'acquittement
Abonnement: { id: 31, status: 'active' } ✅
Paiement 2: { status: 'completed' } ✅
```

## Permissions

- **Membre** : Peut acquitter uniquement ses propres paiements
- **Admin** : Peut acquitter les paiements des membres de sa salle
- **Owner** : Peut acquitter tous les paiements

## Codes d'erreur

| Code | Description |
|------|-------------|
| 400 | `paymentMethod` manquant dans la requête |
| 401 | Non authentifié |
| 403 | Accès refusé (tentative d'acquitter le paiement d'un autre membre/salle) |
| 404 | Paiement non trouvé |
| 500 | Erreur serveur |

### Exemples d'erreurs

```json
// 400 - Bad Request
{
  "error": "paymentMethod est requis"
}

// 404 - Not Found
{
  "error": "Paiement non trouvé"
}

// Paiement déjà acquitté
{
  "error": "Ce paiement a déjà été acquitté"
}
```

## Différence avec `/payments/:paymentId/complete`

| Endpoint | Fonction |
|----------|----------|
| `/payments/:id/acknowledge` | Acquitte le paiement ET active l'abonnement si nécessaire |
| `/payments/:id/complete` | Marque simplement le paiement comme complété, sans logique d'activation |

**Recommandation** : Utilisez `/acknowledge` pour les paiements liés aux abonnements, et `/complete` pour les paiements ponctuels.

## Logs serveur

Lors de l'acquittement, le serveur génère des logs détaillés :

```
💳 Acquittement du paiement 199
   Membre: Jack Brown
   Montant: 19.99€
✅ Paiement 199 acquitté
✨ Abonnement 31 activé (était en attente)
   Type: Découverte
   Période: 11/11/2025 → 11/11/2026
```

## Exemples d'intégration

### JavaScript (Axios)

```javascript
const axios = require('axios');

async function acknowledgePayment(paymentId, paymentMethod, token) {
  try {
    const response = await axios.post(
      `http://localhost:3000/subscriptions/payments/${paymentId}/acknowledge`,
      {
        paymentMethod: paymentMethod,
        transactionId: `TXN_${Date.now()}`
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('Paiement acquitté:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erreur:', error.response?.data || error.message);
    throw error;
  }
}
```

### Flutter/Dart

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<Map<String, dynamic>> acknowledgePayment(
  int paymentId,
  String paymentMethod,
  String token,
) async {
  final response = await http.post(
    Uri.parse('http://localhost:3000/subscriptions/payments/$paymentId/acknowledge'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'paymentMethod': paymentMethod,
      'transactionId': 'TXN_${DateTime.now().millisecondsSinceEpoch}',
    }),
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception('Erreur: ${response.body}');
  }
}
```

## Tests

Un script de test complet est disponible : `test-acknowledge-payment.js`

```bash
node test-acknowledge-payment.js
```

Ce script :
1. ✅ Crée un abonnement avec statut "pending"
2. ✅ Génère 12 paiements mensuels
3. ✅ Acquitte le premier paiement
4. ✅ Vérifie que l'abonnement passe à "active"
