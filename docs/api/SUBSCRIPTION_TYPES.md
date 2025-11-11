# Système de Types d'Abonnements

## Vue d'ensemble

Le système de types d'abonnements permet de définir des plans d'abonnement réutilisables avec des prix et des fonctionnalités standardisés. Au lieu de spécifier manuellement le prix et le plan à chaque création d'abonnement, vous sélectionnez simplement un type prédéfini.

## Architecture

### Modèle de données

```
SubscriptionType (1) ←──→ (N) Subscription
```

Un type d'abonnement peut être lié à plusieurs abonnements, mais chaque abonnement ne peut avoir qu'un seul type.

### SubscriptionType

| Champ | Type | Description |
|-------|------|-------------|
| id | Int | Identifiant unique |
| name | String | Nom du type (unique) - ex: "Premium", "Basic" |
| description | String? | Description optionnelle |
| monthlyPrice | Float | Prix mensuel en euros |
| features | String[] | Liste des fonctionnalités incluses |
| isActive | Boolean | Si false, le type n'est plus disponible |
| subscriptions | Subscription[] | Abonnements liés à ce type |

### Types prédéfinis

La base de données est préchargée avec 4 types :

| Type | Prix/mois | Fonctionnalités |
|------|-----------|----------------|
| Basic | 29.99€ | Accès salle, Vestiaires |
| Standard | 49.99€ | + Cours collectifs, Douches |
| Premium | 79.99€ | + Coach personnel, Planning sur mesure |
| VIP | 129.99€ | + Accès 24/7, Spa, Sauna |

## API Endpoints

### 1. Lister les types disponibles

```http
GET /subscription-types
```

**Query params:**
- `includeInactive=true` : Inclure les types désactivés (par défaut: false)

**Réponse:**
```json
{
  "types": [
    {
      "id": 1,
      "name": "Basic",
      "description": "Accès essentiel à la salle",
      "monthlyPrice": 29.99,
      "features": ["Accès salle", "Vestiaires"],
      "isActive": true
    }
  ]
}
```

### 2. Détails d'un type

```http
GET /subscription-types/:id
```

**Réponse:**
```json
{
  "type": {
    "id": 1,
    "name": "Basic",
    "monthlyPrice": 29.99,
    "_count": {
      "subscriptions": 15
    }
  }
}
```

### 3. Créer un type (Owner uniquement)

```http
POST /subscription-types
Authorization: Bearer {token}
```

**Body:**
```json
{
  "name": "Student",
  "description": "Offre étudiante",
  "monthlyPrice": 24.99,
  "features": ["Accès salle", "Vestiaires", "Horaires limités"]
}
```

**Réponse:**
```json
{
  "message": "Type d'abonnement créé avec succès",
  "type": { ... }
}
```

### 4. Mettre à jour un type (Owner uniquement)

```http
PUT /subscription-types/:id
Authorization: Bearer {token}
```

**Body (tous les champs sont optionnels):**
```json
{
  "monthlyPrice": 34.99,
  "description": "Description mise à jour",
  "features": ["Nouvelle fonctionnalité"],
  "isActive": false
}
```

### 5. Désactiver un type (Owner uniquement)

```http
DELETE /subscription-types/:id
Authorization: Bearer {token}
```

**Comportement:**
- Soft delete : met `isActive` à `false`
- Bloque si des abonnements actifs utilisent ce type
- Les abonnements existants conservent leur référence

**Réponse (si bloqué):**
```json
{
  "error": "Impossible de supprimer ce type: 5 abonnement(s) actif(s) l'utilisent",
  "activeSubscriptions": 5
}
```

### 6. Lister les abonnements d'un type (Admin/Owner)

```http
GET /subscription-types/:id/subscriptions
Authorization: Bearer {token}
```

**Filtrage automatique:**
- Admin : voit uniquement les abonnements de sa salle
- Owner : voit tous les abonnements

## Création d'abonnement avec type

### Ancienne méthode (dépréciée)

```http
POST /subscriptions
{
  "memberId": 5,
  "plan": "premium",
  "monthlyPrice": 79.99
}
```

### Nouvelle méthode (recommandée)

```http
POST /subscriptions
{
  "memberId": 5,
  "subscriptionTypeId": 3,
  "startDate": "2024-01-01"
}
```

**Avantages:**
- ✅ Prix centralisé (une seule source de vérité)
- ✅ Cohérence des données
- ✅ Facilité de modification des tarifs
- ✅ Historique des types préservé
- ✅ Reporting simplifié par type

## Flux de travail

### Pour un Owner

1. **Créer des types personnalisés**
   ```bash
   POST /subscription-types
   {
     "name": "Corporate",
     "monthlyPrice": 99.99
   }
   ```

2. **Les admins créent des abonnements**
   ```bash
   POST /subscriptions
   {
     "memberId": 10,
     "subscriptionTypeId": 5
   }
   ```

3. **Ajuster les prix globalement**
   ```bash
   PUT /subscription-types/5
   {
     "monthlyPrice": 109.99
   }
   ```
   > Note: N'affecte que les nouveaux abonnements

### Pour un Admin

1. **Consulter les types disponibles**
   ```bash
   GET /subscription-types
   ```

2. **Créer un abonnement avec un type**
   ```bash
   POST /subscriptions
   {
     "memberId": 8,
     "subscriptionTypeId": 2
   }
   ```

3. **Voir les abonnements par type**
   ```bash
   GET /subscription-types/2/subscriptions
   ```

## Sécurité et permissions

| Action | Member | Admin | Owner |
|--------|--------|-------|-------|
| Lire types | ✅ | ✅ | ✅ |
| Créer type | ❌ | ❌ | ✅ |
| Modifier type | ❌ | ❌ | ✅ |
| Supprimer type | ❌ | ❌ | ✅ |
| Voir abonnements du type | ❌ | ✅* | ✅ |

*Admin : uniquement pour sa salle

## Migration des données existantes

La migration `20251111181224_add_subscription_types` a :

1. ✅ Créé la table `SubscriptionType`
2. ✅ Inséré les 4 types par défaut
3. ✅ Migré les 7 abonnements existants :
   - `plan: "basic"` → Type "Basic" (ID: 1)
   - `plan: "premium"` → Type "Premium" (ID: 3)
   - `plan: "vip"` → Type "VIP" (ID: 4)
4. ✅ Supprimé les colonnes obsolètes (`plan`, `price`, `billingCycle`, `membership`)

## Exemples de code

### Créer un abonnement avec type (Node.js)

```javascript
const axios = require('axios');

async function createSubscription(memberId, typeId) {
  const response = await axios.post(
    'http://localhost:3000/subscriptions',
    {
      memberId,
      subscriptionTypeId: typeId,
      startDate: new Date().toISOString()
    },
    {
      headers: {
        Authorization: `Bearer ${ownerToken}`
      }
    }
  );
  
  console.log('Abonnement créé:', response.data.subscription);
  console.log('Type:', response.data.subscriptionType.name);
  console.log('12 paiements générés');
}
```

### Lister et afficher les types (Flutter)

```dart
Future<List<SubscriptionType>> getSubscriptionTypes() async {
  final response = await http.get(
    Uri.parse('$baseUrl/subscription-types'),
  );
  
  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return (data['types'] as List)
        .map((json) => SubscriptionType.fromJson(json))
        .toList();
  }
  throw Exception('Failed to load subscription types');
}
```

## Reporting

### Stats par type d'abonnement

```sql
SELECT 
  st.name,
  COUNT(s.id) as total_subscriptions,
  COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active,
  SUM(st.monthlyPrice * 12) as annual_revenue
FROM "SubscriptionType" st
LEFT JOIN "Subscription" s ON s."subscriptionTypeId" = st.id
GROUP BY st.id, st.name
ORDER BY active DESC;
```

### Revenus prévus par type

```sql
SELECT 
  st.name,
  st.monthlyPrice,
  COUNT(s.id) as subscriptions,
  COUNT(s.id) * st.monthlyPrice as monthly_revenue
FROM "SubscriptionType" st
LEFT JOIN "Subscription" s ON s."subscriptionTypeId" = st.id
WHERE s.status = 'active'
GROUP BY st.id;
```

## Tests

Exécuter le script de test complet :

```bash
node test-subscription-types.js
```

**Scénarios testés :**
1. ✅ Login owner
2. ✅ Liste des types
3. ✅ Détails d'un type
4. ✅ Création de type
5. ✅ Mise à jour de type
6. ✅ Création d'abonnement avec type
7. ✅ Récupération des abonnements d'un membre
8. ✅ Protection contre suppression de type actif
9. ✅ Désactivation de type sans abonnements

## Troubleshooting

### Erreur: "Type d'abonnement avec ID X non trouvé"

**Cause:** L'ID spécifié n'existe pas ou le type a été supprimé.

**Solution:**
```bash
GET /subscription-types  # Lister les types disponibles
```

### Erreur: "Le type X n'est plus disponible"

**Cause:** Le type existe mais `isActive = false`.

**Solution:**
```bash
PUT /subscription-types/:id
{ "isActive": true }
```

### Erreur: "Un type avec ce nom existe déjà"

**Cause:** Les noms de types doivent être uniques.

**Solution:** Choisir un nom différent ou mettre à jour le type existant.

### Erreur: "Impossible de supprimer ce type: N abonnement(s) actif(s)"

**Cause:** Protection contre la suppression de types en cours d'utilisation.

**Solution:**
1. Attendre l'expiration des abonnements actifs, OU
2. Les migrer vers un autre type manuellement

## Bonnes pratiques

1. **Ne jamais modifier le prix d'un type existant** si des abonnements actifs l'utilisent
   - Créer plutôt un nouveau type avec le nouveau prix
   - Désactiver l'ancien type

2. **Utiliser des noms explicites** : "Premium 2024", "Basic Promo"

3. **Toujours tester** les modifications de prix avant de les appliquer en production

4. **Documenter les fonctionnalités** dans le champ `features[]`

5. **Soft delete uniquement** : ne jamais supprimer physiquement un type pour préserver l'historique

## Évolutions futures

- [ ] Historique des modifications de prix
- [ ] Support multi-devises
- [ ] Promotions temporaires par type
- [ ] Upgrade/downgrade automatique entre types
- [ ] Types personnalisés par salle (multi-tenant)
