# Mise à Jour Swagger - Système de Types d'Abonnements

## Date de mise à jour
11 novembre 2025

## Résumé des modifications

Le fichier `swagger.yml` a été mis à jour pour inclure la documentation complète des nouveaux endpoints du système de types d'abonnements et des abonnements annuels avec paiements mensuels.

---

## 🆕 Nouveaux Schemas

### `SubscriptionType`
Nouveau schema pour représenter un type d'abonnement prédéfini.

```yaml
SubscriptionType:
  properties:
    id: integer
    name: string (unique)
    description: string
    monthlyPrice: number (float)
    features: array of strings
    isActive: boolean
    createdAt: datetime
    updatedAt: datetime
```

**Exemple:**
```json
{
  "id": 3,
  "name": "Premium",
  "description": "Formule complète avec coaching personnel",
  "monthlyPrice": 79.99,
  "features": ["Tout Standard +", "2 séances coach/mois", "Planning personnalisé"],
  "isActive": true
}
```

---

## 🔄 Schemas Modifiés

### `Subscription`
Le schema `Subscription` a été mis à jour pour utiliser `subscriptionTypeId` au lieu de `plan` et `price`.

**Avant:**
```yaml
Subscription:
  properties:
    planName: string
    price: number
    status: [active, inactive, expired]
```

**Après:**
```yaml
Subscription:
  properties:
    subscriptionTypeId: integer
    subscriptionType: SubscriptionType
    status: [active, paused, cancelled, expired]
    autoRenew: boolean
```

**Changements clés:**
- ✅ Ajout de `subscriptionTypeId` et `subscriptionType` (relation)
- ✅ Suppression de `planName` et `price` (maintenant dans SubscriptionType)
- ✅ Ajout du statut `paused` (pause automatique)
- ✅ Ajout de `autoRenew`

---

## 🎯 Nouveaux Endpoints

### 1. Gestion des Types d'Abonnements

#### `GET /subscription-types`
Liste tous les types d'abonnements disponibles.

**Query Parameters:**
- `includeInactive` (boolean) - Inclure les types désactivés

**Response 200:**
```json
{
  "types": [
    {
      "id": 1,
      "name": "Basic",
      "monthlyPrice": 29.99,
      "isActive": true
    }
  ]
}
```

**Tags:** `[Subscription Types]`

---

#### `POST /subscription-types` 🔒 Owner only
Créer un nouveau type d'abonnement.

**Request Body:**
```json
{
  "name": "Student",
  "description": "Offre étudiante",
  "monthlyPrice": 24.99,
  "features": ["Accès salle", "Vestiaires", "Horaires limités"]
}
```

**Response 201:**
```json
{
  "message": "Type d'abonnement créé avec succès",
  "type": { /* SubscriptionType */ }
}
```

**Permissions:** Owner uniquement  
**Tags:** `[Subscription Types]`

---

#### `GET /subscription-types/{id}`
Obtenir les détails d'un type avec le nombre d'abonnements associés.

**Response 200:**
```json
{
  "type": {
    "id": 1,
    "name": "Premium",
    "monthlyPrice": 79.99,
    "_count": {
      "subscriptions": 15
    }
  }
}
```

**Tags:** `[Subscription Types]`

---

#### `PUT /subscription-types/{id}` 🔒 Owner only
Mettre à jour un type d'abonnement existant.

**Request Body:**
```json
{
  "name": "Premium Plus",
  "monthlyPrice": 89.99,
  "features": ["Tout Premium +", "Coach dédié"],
  "isActive": true
}
```

**Response 200:**
```json
{
  "message": "Type d'abonnement mis à jour avec succès",
  "type": { /* SubscriptionType */ }
}
```

**Permissions:** Owner uniquement  
**Tags:** `[Subscription Types]`

---

#### `DELETE /subscription-types/{id}` 🔒 Owner only
Désactiver un type d'abonnement (soft delete).

**Comportement:**
- ⚠️ Bloque si des abonnements actifs utilisent ce type
- ✅ Marque `isActive = false` (ne supprime pas physiquement)

**Response 200:**
```json
{
  "message": "Type d'abonnement désactivé avec succès",
  "type": { /* SubscriptionType */ }
}
```

**Response 400:**
```json
{
  "error": "Impossible de supprimer ce type: 5 abonnement(s) actif(s) l'utilisent",
  "activeSubscriptions": 5
}
```

**Permissions:** Owner uniquement  
**Tags:** `[Subscription Types]`

---

#### `GET /subscription-types/{id}/subscriptions` 🔒 Admin/Owner
Lister tous les abonnements d'un type donné.

**Filtrage automatique:**
- Admin : voit uniquement les abonnements de sa salle
- Owner : voit tous les abonnements

**Response 200:**
```json
{
  "count": 15,
  "subscriptions": [
    {
      "id": 1,
      "member": {
        "user": {
          "fullName": "Bob Williams",
          "email": "bob@example.com"
        }
      },
      "status": "active"
    }
  ]
}
```

**Permissions:** Admin/Owner  
**Tags:** `[Subscription Types]`

---

### 2. Gestion des Abonnements (mis à jour)

#### `POST /subscriptions` 🔒 Auth required
Créer un abonnement annuel avec 12 paiements mensuels automatiques.

**Avant:**
```json
{
  "memberId": 5,
  "plan": "premium",
  "monthlyPrice": 79.99
}
```

**Après:**
```json
{
  "memberId": 5,
  "subscriptionTypeId": 3,
  "startDate": "2024-01-01T00:00:00.000Z"
}
```

**Response 201:**
```json
{
  "message": "Abonnement annuel créé avec succès",
  "subscription": { /* Subscription */ },
  "subscriptionType": { /* SubscriptionType */ },
  "paymentsGenerated": 12,
  "payments": [
    {
      "id": 1,
      "monthNumber": 1,
      "amount": 79.99,
      "dueDate": "2024-01-01T00:00:00.000Z",
      "status": "pending"
    }
  ]
}
```

**Changements:**
- ✅ Utilise `subscriptionTypeId` au lieu de `plan` + `monthlyPrice`
- ✅ Génère automatiquement 12 paiements mensuels
- ✅ Retourne le `subscriptionType` complet
- ✅ Indique le nombre de paiements générés

**Permissions:** Admin (même salle), Owner  
**Tags:** `[Subscriptions]`

---

#### `GET /subscriptions/{id}` 🔒 Auth required
Obtenir le statut détaillé d'un abonnement.

**Response 200:**
```json
{
  "subscription": { /* Subscription */ },
  "payments": [ /* Array of Payment */ ],
  "summary": {
    "totalPayments": 12,
    "completedPayments": 3,
    "pendingPayments": 9,
    "overduePayments": 0,
    "totalPaid": 239.97,
    "totalRemaining": 719.91,
    "progressPercentage": 25
  }
}
```

**Tags:** `[Subscriptions]`

---

#### `GET /subscriptions/member/{memberId}` 🔒 Auth required
Obtenir tous les abonnements d'un membre.

**Response 200:**
```json
{
  "subscriptions": [
    {
      "id": 1,
      "subscriptionType": { /* SubscriptionType */ },
      "status": "active",
      "payments": [ /* Array of Payment */ ]
    }
  ]
}
```

**Tags:** `[Subscriptions]`

---

### 3. Gestion des Paiements

#### `POST /subscriptions/payments/{paymentId}/complete` 🔒 Auth required
Marquer un paiement comme complété.

**Request Body:**
```json
{
  "paymentMethod": "card",
  "transactionId": "txn_abc123xyz"
}
```

**Payment Methods:**
- `card` - Carte bancaire
- `cash` - Espèces
- `bank_transfer` - Virement bancaire
- `paypal` - PayPal

**Response 200:**
```json
{
  "message": "Paiement marqué comme complété",
  "payment": { /* Payment */ }
}
```

**Tags:** `[Subscriptions, Payments]`

---

#### `GET /subscriptions/payments/upcoming` 🔒 Admin/Owner
Obtenir les paiements à venir dans les 7 prochains jours.

**Response 200:**
```json
{
  "count": 8,
  "payments": [
    {
      "id": 42,
      "memberId": 5,
      "memberName": "Bob Williams",
      "memberEmail": "bob@example.com",
      "amount": 79.99,
      "dueDate": "2024-11-15T00:00:00.000Z",
      "monthNumber": 3,
      "daysUntilDue": 4
    }
  ]
}
```

**Filtrage:**
- Admin : paiements de sa salle uniquement
- Owner : tous les paiements

**Tags:** `[Subscriptions, Payments]`

---

## 📝 Tags Swagger

Nouveaux tags ajoutés pour l'organisation de la documentation :

- **`Subscription Types`** - Gestion des types d'abonnements
- **`Subscriptions`** - Gestion des abonnements
- **`Payments`** - Gestion des paiements (sous Subscriptions)

---

## 🔒 Permissions

| Endpoint | Member | Admin | Owner |
|----------|--------|-------|-------|
| GET /subscription-types | ✅ | ✅ | ✅ |
| POST /subscription-types | ❌ | ❌ | ✅ |
| PUT /subscription-types/{id} | ❌ | ❌ | ✅ |
| DELETE /subscription-types/{id} | ❌ | ❌ | ✅ |
| GET /subscription-types/{id}/subscriptions | ❌ | ✅* | ✅ |
| POST /subscriptions | ❌** | ✅* | ✅ |
| GET /subscriptions/{id} | ✅*** | ✅* | ✅ |
| GET /subscriptions/member/{memberId} | ✅*** | ✅* | ✅ |
| POST /subscriptions/payments/{id}/complete | ✅*** | ✅* | ✅ |
| GET /subscriptions/payments/upcoming | ❌ | ✅* | ✅ |

**Légende:**
- \* Admin : uniquement pour leur salle
- \*\* Member : ne peut pas créer d'abonnements
- \*\*\* Member : uniquement pour eux-mêmes

---

## 🧪 Exemples de Requêtes

### Créer un type d'abonnement (Owner)
```bash
curl -X POST http://localhost:3000/subscription-types \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Corporate",
    "description": "Abonnement entreprise",
    "monthlyPrice": 89.99,
    "features": ["Accès 24/7", "Coaching", "Facturation entreprise"]
  }'
```

### Créer un abonnement avec type
```bash
curl -X POST http://localhost:3000/subscriptions \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": 5,
    "subscriptionTypeId": 3,
    "startDate": "2024-01-01T00:00:00.000Z"
  }'
```

### Lister les types disponibles
```bash
curl http://localhost:3000/subscription-types
```

### Marquer un paiement comme complété
```bash
curl -X POST http://localhost:3000/subscriptions/payments/42/complete \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "card",
    "transactionId": "txn_abc123"
  }'
```

### Voir les paiements à venir
```bash
curl http://localhost:3000/subscriptions/payments/upcoming \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 📊 Migration API

### Changements Breaking Changes

Si vous utilisiez l'ancienne API, voici comment migrer :

#### Création d'abonnement

**Avant:**
```javascript
POST /subscriptions
{
  "memberId": 5,
  "plan": "premium",
  "monthlyPrice": 79.99,
  "billingCycle": "monthly"
}
```

**Après:**
```javascript
POST /subscriptions
{
  "memberId": 5,
  "subscriptionTypeId": 3  // ID du type Premium
  // startDate est optionnel, par défaut = maintenant
}
```

#### Obtenir les informations d'abonnement

**Avant:**
```javascript
{
  "subscription": {
    "plan": "premium",
    "price": 79.99,
    "billingCycle": "monthly"
  }
}
```

**Après:**
```javascript
{
  "subscription": {
    "subscriptionTypeId": 3,
    "subscriptionType": {
      "name": "Premium",
      "monthlyPrice": 79.99
    },
    "autoRenew": true
  }
}
```

---

## 🌐 Accès à la Documentation

La documentation Swagger mise à jour est accessible à :

```
http://localhost:3000/api-docs
```

### Navigation Swagger

Les nouveaux endpoints sont organisés dans les sections suivantes :

1. **Subscription Types** (nouveau)
   - Liste des types
   - Gestion CRUD
   - Abonnements par type

2. **Subscriptions** (mis à jour)
   - Création avec type
   - Statut détaillé
   - Historique des paiements

3. **Payments** (nouveau tag sous Subscriptions)
   - Complétion de paiement
   - Paiements à venir

---

## ✅ Validation

Pour tester que le Swagger est correctement mis à jour :

```bash
# 1. Vérifier que le serveur démarre sans erreur
npm start

# 2. Accéder à la documentation
open http://localhost:3000/api-docs

# 3. Vérifier les nouveaux endpoints
curl http://localhost:3000/api-docs | grep "subscription-types"

# 4. Tester un endpoint
curl http://localhost:3000/subscription-types
```

---

## 📚 Documentation Complémentaire

Pour plus d'informations sur le système de types d'abonnements, consultez :

- `docs/SUBSCRIPTION_TYPES.md` - Documentation technique complète
- `docs/SEED_DATA.md` - Données de test disponibles
- `routes/subscriptionTypes.js` - Implémentation des routes
- `routes/subscriptions.js` - Routes d'abonnements mises à jour

---

## 🔄 Versions

- **v1.0.0** - API initiale avec `plan` et `price`
- **v2.0.0** - Migration vers `SubscriptionType` + système de paiements mensuels (cette version)

---

**Date de création:** 11 novembre 2025  
**Auteur:** Team Fitness Development Team  
**Status:** ✅ Complet et testé
