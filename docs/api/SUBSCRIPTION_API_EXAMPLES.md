# Exemples de requêtes API - Système d'abonnements

## 1. Créer un abonnement annuel

### cURL
```bash
curl -X POST http://localhost:3000/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "memberId": 23,
    "plan": "premium",
    "monthlyPrice": 49.99,
    "startDate": "2025-11-11T00:00:00.000Z"
  }'
```

### JavaScript (fetch)
```javascript
const response = await fetch('http://localhost:3000/subscriptions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    memberId: 23,
    plan: 'premium',
    monthlyPrice: 49.99
  })
});

const data = await response.json();
console.log(`Abonnement créé: ${data.subscription.id}`);
console.log(`${data.paymentsGenerated} paiements générés`);
```

## 2. Obtenir le statut d'un abonnement

### cURL
```bash
curl -X GET http://localhost:3000/subscriptions/18 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### JavaScript
```javascript
const response = await fetch('http://localhost:3000/subscriptions/18', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const status = await response.json();
console.log(`Statut: ${status.subscription.status}`);
console.log(`Progression: ${status.stats.percentComplete}%`);
console.log(`Paiements en retard: ${status.stats.overduePayments}`);
```

## 3. Obtenir tous les abonnements d'un membre

### cURL
```bash
curl -X GET http://localhost:3000/subscriptions/member/23 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### JavaScript
```javascript
const response = await fetch('http://localhost:3000/subscriptions/member/23', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { subscriptions } = await response.json();
console.log(`${subscriptions.length} abonnement(s) trouvé(s)`);
```

## 4. Marquer un paiement comme complété

### cURL
```bash
curl -X POST http://localhost:3000/subscriptions/payments/40/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "paymentMethod": "card",
    "transactionId": "TXN_123456789"
  }'
```

### JavaScript
```javascript
const response = await fetch('http://localhost:3000/subscriptions/payments/40/complete', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    paymentMethod: 'card',
    transactionId: 'TXN_123456789'
  })
});

const data = await response.json();
console.log('Paiement complété:', data.payment.status);
```

## 5. Obtenir les paiements à venir (Admin/Owner)

### cURL
```bash
curl -X GET http://localhost:3000/subscriptions/payments/upcoming \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### JavaScript
```javascript
const response = await fetch('http://localhost:3000/subscriptions/payments/upcoming', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { payments, count } = await response.json();
console.log(`${count} paiement(s) à venir dans les 7 prochains jours`);

payments.forEach(p => {
  console.log(`${p.memberName}: ${p.amount}€ - Dû dans ${p.daysUntilDue} jour(s)`);
});
```

## 6. Workflow complet d'exemple

### Scénario: Créer un abonnement et marquer le premier paiement comme payé

```javascript
async function createAndPaySubscription(memberId, token) {
  // 1. Créer l'abonnement
  const createResponse = await fetch('http://localhost:3000/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      memberId: memberId,
      plan: 'premium',
      monthlyPrice: 49.99
    })
  });
  
  const { subscription, payments } = await createResponse.json();
  console.log(`✅ Abonnement créé: ${subscription.id}`);
  
  // 2. Marquer le premier paiement comme payé
  const firstPayment = payments[0];
  const payResponse = await fetch(
    `http://localhost:3000/subscriptions/payments/${firstPayment.id}/complete`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        paymentMethod: 'card',
        transactionId: `TXN_${Date.now()}`
      })
    }
  );
  
  const payResult = await payResponse.json();
  console.log(`✅ Premier paiement complété: ${payResult.payment.id}`);
  
  // 3. Vérifier le statut
  const statusResponse = await fetch(
    `http://localhost:3000/subscriptions/${subscription.id}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  const status = await statusResponse.json();
  console.log(`📊 Statut: ${status.subscription.status}`);
  console.log(`📊 Progression: ${status.stats.percentComplete}%`);
  
  return { subscription, status };
}

// Utilisation
const result = await createAndPaySubscription(23, 'YOUR_JWT_TOKEN');
```

## 7. Postman Collection

Importer cette collection JSON dans Postman:

```json
{
  "info": {
    "name": "Team Fitness - Subscriptions",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create Subscription",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"memberId\": 23,\n  \"plan\": \"premium\",\n  \"monthlyPrice\": 49.99\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/subscriptions",
          "host": ["{{baseUrl}}"],
          "path": ["subscriptions"]
        }
      }
    },
    {
      "name": "Get Subscription Status",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/subscriptions/:id",
          "host": ["{{baseUrl}}"],
          "path": ["subscriptions", ":id"],
          "variable": [
            {
              "key": "id",
              "value": "18"
            }
          ]
        }
      }
    },
    {
      "name": "Complete Payment",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"paymentMethod\": \"card\",\n  \"transactionId\": \"TXN_123456\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/subscriptions/payments/:paymentId/complete",
          "host": ["{{baseUrl}}"],
          "path": ["subscriptions", "payments", ":paymentId", "complete"],
          "variable": [
            {
              "key": "paymentId",
              "value": "40"
            }
          ]
        }
      }
    },
    {
      "name": "Get Upcoming Payments",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/subscriptions/payments/upcoming",
          "host": ["{{baseUrl}}"],
          "path": ["subscriptions", "payments", "upcoming"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "token",
      "value": "YOUR_JWT_TOKEN"
    }
  ]
}
```

## 8. Tests automatisés (Jest)

```javascript
// tests/subscriptions.test.js
const request = require('supertest');
const app = require('../index');

describe('Subscription System', () => {
  let token;
  let memberId = 23;
  
  beforeAll(async () => {
    // Login pour obtenir le token
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'password123'
      });
    token = response.body.token;
  });
  
  test('Should create yearly subscription with 12 payments', async () => {
    const response = await request(app)
      .post('/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        memberId,
        plan: 'premium',
        monthlyPrice: 49.99
      });
    
    expect(response.status).toBe(201);
    expect(response.body.paymentsGenerated).toBe(12);
    expect(response.body.subscription.status).toBe('active');
  });
  
  test('Should get subscription status', async () => {
    const response = await request(app)
      .get('/subscriptions/18')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('stats');
    expect(response.body.stats.totalPayments).toBe(12);
  });
  
  test('Should complete payment', async () => {
    const response = await request(app)
      .post('/subscriptions/payments/40/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'card',
        transactionId: 'TEST_TXN'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.payment.status).toBe('completed');
  });
});
```

## 9. Scripts utiles

### Obtenir un token JWT
```bash
# Login et extraire le token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' \
  | jq -r '.token')

echo "Token: $TOKEN"
```

### Créer un abonnement en une ligne
```bash
curl -X POST http://localhost:3000/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"memberId":23,"plan":"premium","monthlyPrice":49.99}' \
  | jq '.'
```

### Vérifier les paiements en retard
```bash
node scripts/run-payment-check.js
```
