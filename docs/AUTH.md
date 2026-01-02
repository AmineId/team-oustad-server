# Authentification - Login Admin, Owner & Member

## Hiérarchie des rôles

1. **Owner/SuperAdmin** : Propriétaire avec tous les droits
   - Gère les admins et les gyms
   - Accès aux rapports globaux
   - Peut créer des admins et owners

2. **Admin** : Administrateur de gym
   - Gère sa propre gym
   - Gère les membres de sa gym

3. **Member** : Membre d'une gym
   - Accès à ses propres données
   - Abonnements et paiements

## Comptes de test

### Owner (Super Admin)
- **Email** : `owner@teamfitness.com`
- **Password** : `owner123`

### Admin
- **Email** : `admin@teamfitness.com`
- **Password** : `admin123`

### Membres
- **Bob Member**
  - Email : `bob@example.com`
  - Password : `member123`
- **Charlie Member**
  - Email : `charlie@example.com`
  - Password : `member123`

## Architecture

Le système utilise une **table User commune** avec un champ `role` :
- `User` : Table commune avec email, password, fullName, role, gymId
- `Owner` : Profil owner avec permissions étendues
- `Admin` : Profil admin
- `Member` : Profil membre avec subscriptions/payments

## Endpoints

### POST /auth/login
Connexion pour admin et membre.

**Request Body** :
```json
{
  "email": "admin@teamfitness.com",
  "password": "admin123"
}
```

**Response** :
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "admin@teamfitness.com",
    "fullName": "Admin TeamFitness",
    "gymId": 1,
    "type": "admin"
  }
}
```

### GET /auth/me
Récupère les informations de l'utilisateur connecté.

**Headers** :
```
Authorization: Bearer jwt_token_here
```

**Response pour Admin** :
```json
{
  "id": 1,
  "email": "admin@teamfitness.com",
  "fullName": "Admin TeamFitness",
  "gym": { "id": 1, "name": "Downtown Fitness", "address": "123 Main St" },
  "type": "admin"
}
```

**Response pour Owner** :
```json
{
  "id": 1,
  "email": "owner@teamfitness.com",
  "fullName": "Super Owner",
  "gym": { "id": 1, "name": "Downtown Fitness", "address": "123 Main St" },
  "permissions": {
    "canManageAdmins": true,
    "canManageGyms": true,
    "canViewReports": true,
    "maxGymsAllowed": 10
  },
  "type": "owner"
}
```

## Endpoints Owners (Réservés aux propriétaires)

### POST /owners/create
Créer un nouvel owner.

**Headers** :
```
Authorization: Bearer owner_jwt_token
```

**Request Body** :
```json
{
  "email": "newowner@example.com",
  "password": "password123",
  "fullName": "New Owner",
  "gymId": 1,
  "permissions": {
    "canManageAdmins": true,
    "canManageGyms": true,
    "canViewReports": true,
    "maxGymsAllowed": 5
  }
}
```

### POST /owners/create-admin
Créer un nouvel admin.

**Headers** :
```
Authorization: Bearer owner_jwt_token
```

**Request Body** :
```json
{
  "email": "newadmin@example.com",
  "password": "password123",
  "fullName": "New Admin",
  "gymId": 1
}
```

### GET /owners/gyms
Lister tous les gyms avec statistiques.

**Headers** :
```
Authorization: Bearer owner_jwt_token
```

### GET /owners/stats
Statistiques globales de la plateforme.

**Headers** :
```
Authorization: Bearer owner_jwt_token
```

**Response** :
```json
{
  "stats": {
    "totalGyms": 5,
    "totalUsers": 25,
    "totalAdmins": 5,
    "totalMembers": 18,
    "totalOwners": 2,
    "totalPayments": 45,
    "totalRevenue": 12500.50
  }
}
```

### POST /auth/forgot-password (Admin et Member)
Demande de réinitialisation de mot de passe.

**Request Body** :
```json
{
  "email": "admin@teamfitness.com"
}
```

### POST /auth/reset-password (Admin et Member)
Réinitialisation du mot de passe avec code.

**Request Body** :
```json
{
  "email": "admin@teamfitness.com",
  "token": "123456",
  "newPassword": "nouveau123"
}
```