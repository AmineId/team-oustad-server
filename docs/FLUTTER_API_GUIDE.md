# Guide API Team Fitness pour Flutter

Ce document décrit toutes les routes API disponibles pour l'application Flutter, avec corrections apportées aux problèmes de création de membres, admins et abonnements.

## 📋 Table des matières

1. [Authentification](#authentification)
2. [Utilisateurs](#utilisateurs)
3. [Salles de sport](#salles-de-sport)
4. [Abonnements](#abonnements)
5. [Types d'abonnements](#types-dabonnements)
6. [Plannings d'entraînement](#plannings-dentraînement)
7. [Exercices](#exercices)

---

## 🔑 Authentification

### Base URL
```
http://your-server:3000
```

### Headers requis pour les routes protégées
```
Authorization: Bearer {token}
Content-Type: application/json
```

---

## 1. Authentification

### POST /auth/login
Connexion d'un utilisateur (membre, admin, owner)

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "fullName": "John Doe",
    "gymId": 1,
    "gym": {
      "id": 1,
      "name": "Fitness Center A"
    },
    "type": "member"
  }
}
```

### GET /auth/me
Récupérer les informations de l'utilisateur connecté

**Headers:** Authorization required

**Response 200 (Member):**
```json
{
  "id": 1,
  "email": "member@example.com",
  "fullName": "Bob Member",
  "uniqueCode": "clq123abc456",
  "gym": {
    "id": 1,
    "name": "Fitness Center A"
  },
  "activeSubscription": {
    "id": 1,
    "status": "active",
    "endDate": "2025-12-31T00:00:00.000Z",
    "subscriptionType": {
      "name": "Premium",
      "monthlyPrice": 49.99
    }
  },
  "recentPayments": [...],
  "type": "member"
}
```

### POST /auth/scan-qr
Scanner le QR code d'un membre (admin uniquement)

**Headers:** Authorization required (admin)

**Request:**
```json
{
  "qrCode": "clq123abc456"
}
```

**Response 200:**
```json
{
  "success": true,
  "member": {
    "id": 1,
    "fullName": "Bob Member",
    "email": "bob@example.com",
    "uniqueCode": "clq123abc456",
    "subscription": {
      "id": 1,
      "status": "active",
      "endDate": "2025-12-31T00:00:00.000Z",
      "isActive": true
    }
  },
  "message": "Access granted"
}
```

**Response 403 (Pas d'abonnement actif):**
```json
{
  "error": "Accès refusé - Aucun abonnement actif",
  "reason": "no_active_subscription",
  "member": {
    "id": 1,
    "fullName": "Bob Member",
    "email": "bob@example.com"
  }
}
```

### POST /auth/forgot-password
Demander un code de réinitialisation de mot de passe

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response 200:**
```json
{
  "message": "Code de réinitialisation envoyé par email"
}
```

### POST /auth/reset-password
Réinitialiser le mot de passe avec le code reçu par email

**Request:**
```json
{
  "email": "user@example.com",
  "token": "123456",
  "newPassword": "newpassword123"
}
```

**Response 200:**
```json
{
  "message": "Mot de passe réinitialisé avec succès"
}
```

---

## 2. Utilisateurs

### POST /users
**Créer un utilisateur** (membre ou admin)

**⚠️ CORRECTION:** Cette route a été corrigée pour inclure automatiquement les données du gym lors de la création, ce qui permet la génération du QR code sans erreur.

**Headers:** Authorization required (admin ou owner)

**Request:**
```json
{
  "email": "newmember@example.com",
  "password": "optional_password",
  "fullName": "Jane Doe",
  "role": "member",
  "gymId": 1,
  "sendSetupEmail": true
}
```

**Notes importantes:**
- Si `password` n'est pas fourni, un mot de passe temporaire est généré et un email d'activation est envoyé
- `role` peut être "member" ou "admin" (admin peut créer des membres, owner peut créer des admins et membres)
- Le QR code est généré automatiquement lors de la création
- Si `sendSetupEmail` est true ou omis, un email d'activation sera envoyé

**Response 201:**
```json
{
  "message": "Utilisateur créé avec succès. Un email d'activation a été envoyé.",
  "user": {
    "id": 5,
    "email": "newmember@example.com",
    "fullName": "Jane Doe",
    "role": "member",
    "gymId": 1,
    "uniqueCode": "clq789xyz123",
    "createdAt": "2025-01-02T10:00:00.000Z"
  },
  "setupEmailSent": true
}
```

### GET /users
Lister les utilisateurs (filtrés selon les permissions)

**Headers:** Authorization required

**Response 200:**
```json
{
  "users": [
    {
      "id": 1,
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "member",
      "gymId": 1,
      "gym": {
        "id": 1,
        "name": "Fitness Center A"
      },
      "uniqueCode": "clq123abc456",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET /users/:id
Obtenir les détails d'un utilisateur

**Headers:** Authorization required

**Response 200:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "fullName": "John Doe",
  "role": "member",
  "uniqueCode": "clq123abc456",
  "gym": {
    "id": 1,
    "name": "Fitness Center A"
  },
  "activeSubscription": {...},
  "recentPayments": [...]
}
```

### PUT /users/:id
Mettre à jour un utilisateur

**Headers:** Authorization required

**Request:**
```json
{
  "email": "newemail@example.com",
  "fullName": "Jane Updated",
  "password": "newpassword123"
}
```

**Response 200:**
```json
{
  "message": "Utilisateur mis à jour avec succès",
  "user": {...}
}
```

### DELETE /users/:id
Supprimer un utilisateur

**Headers:** Authorization required (admin ou owner)

**Response 200:**
```json
{
  "message": "Utilisateur supprimé avec succès",
  "deletedId": 5
}
```

### GET /users/:id/qr
Obtenir le QR code d'un utilisateur (image PNG)

**Headers:** Authorization required

**Response 200:** Image PNG (binary)

### PUT /users/:id/profile-image
Uploader ou mettre à jour la photo de profil

**Headers:** Authorization required

**Request:**
```json
{
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

**Response 200:**
```json
{
  "message": "Photo de profil mise à jour avec succès"
}
```

### GET /users/:id/profile-image
Récupérer la photo de profil (image)

**Headers:** Authorization required

**Response 200:** Image (binary) ou SVG avec initiales

### POST /users/create-owner
Créer un nouveau propriétaire (owner uniquement)

**⚠️ CORRECTION:** Cette route a été corrigée pour inclure les données du gym automatiquement.

**Headers:** Authorization required (owner)

**Request:**
```json
{
  "email": "owner@example.com",
  "password": "password123",
  "fullName": "John Owner",
  "gymId": 1,
  "permissions": {
    "canManageAdmins": true,
    "canManageGyms": true,
    "canViewReports": true,
    "maxGymsAllowed": 5
  }
}
```

**Response 201:**
```json
{
  "message": "Propriétaire créé avec succès",
  "owner": {
    "id": 10,
    "email": "owner@example.com",
    "fullName": "John Owner",
    "permissions": {...}
  }
}
```

### POST /users/create-admin
Créer un nouvel administrateur (owner uniquement)

**⚠️ CORRECTION:** Cette route a été corrigée pour inclure les données du gym automatiquement.

**Headers:** Authorization required (owner)

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "password123",
  "fullName": "Jane Admin",
  "gymId": 1
}
```

**Response 201:**
```json
{
  "message": "Admin créé avec succès",
  "admin": {
    "id": 8,
    "email": "admin@example.com",
    "fullName": "Jane Admin"
  }
}
```

---

## 3. Salles de sport

### POST /gyms
Créer une salle de sport (owner uniquement)

**Headers:** Authorization required (owner)

**Request:**
```json
{
  "name": "Fitness Center B",
  "address": "456 Main Street, City",
  "phone": "+1234567890"
}
```

**Response 201:**
```json
{
  "message": "Salle de sport créée avec succès",
  "gym": {
    "id": 2,
    "name": "Fitness Center B",
    "address": "456 Main Street, City",
    "phone": "+1234567890",
    "createdAt": "2025-01-02T10:00:00.000Z"
  }
}
```

### GET /gyms
Lister les salles de sport (filtrées selon les permissions)

**Headers:** Authorization required

**Response 200:**
```json
{
  "gyms": [
    {
      "id": 1,
      "name": "Fitness Center A",
      "address": "123 Main Street",
      "phone": "+1234567890",
      "openingHours": [...],
      "_count": {
        "users": 25
      }
    }
  ]
}
```

### GET /gyms/:id
Obtenir les détails d'une salle

**Headers:** Authorization required

**Response 200:**
```json
{
  "gym": {
    "id": 1,
    "name": "Fitness Center A",
    "address": "123 Main Street",
    "phone": "+1234567890",
    "openingHours": [
      {
        "id": 1,
        "dayOfWeek": 1,
        "openTime": "09:00",
        "closeTime": "18:00",
        "isClosed": false
      }
    ],
    "users": [...],
    "_count": {
      "users": 25
    }
  }
}
```

### PUT /gyms/:id
Mettre à jour une salle

**Headers:** Authorization required (owner ou admin de la salle)

**Request:**
```json
{
  "name": "Updated Fitness Center",
  "address": "789 New Street",
  "phone": "+9876543210"
}
```

**Response 200:**
```json
{
  "message": "Salle de sport mise à jour avec succès",
  "gym": {...}
}
```

### DELETE /gyms/:id
Supprimer une salle (owner uniquement)

**Headers:** Authorization required (owner)

**Response 200:**
```json
{
  "message": "Salle de sport supprimée avec succès",
  "deletedId": 2
}
```

### POST /gyms/:id/opening-hours
Définir les horaires d'ouverture

**Headers:** Authorization required (owner ou admin de la salle)

**Request:**
```json
[
  {
    "dayOfWeek": 1,
    "openTime": "09:00",
    "closeTime": "18:00",
    "isClosed": false
  },
  {
    "dayOfWeek": 0,
    "isClosed": true
  }
]
```

**Response 200:**
```json
{
  "message": "Horaires d'ouverture mis à jour avec succès",
  "openingHours": [...]
}
```

### GET /gyms/:id/opening-hours
Récupérer les horaires d'ouverture

**Headers:** Authorization required

**Response 200:**
```json
{
  "openingHours": [
    {
      "id": 1,
      "dayOfWeek": 1,
      "openTime": "09:00",
      "closeTime": "18:00",
      "isClosed": false
    }
  ]
}
```

### PUT /gyms/:id/image
Uploader une image de la salle

**Headers:** Authorization required (owner ou admin de la salle)

**Request:**
```json
{
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

**Response 200:**
```json
{
  "message": "Image de salle mise à jour avec succès"
}
```

### GET /gyms/:id/image
Récupérer l'image de la salle

**Headers:** Authorization required

**Response 200:** Image (binary) ou SVG avec initiales

---

## 4. Abonnements

### POST /subscriptions
**Créer un abonnement annuel** (génère automatiquement 12 paiements mensuels)

**⚠️ CORRECTION:** Cette route a été corrigée pour récupérer correctement les informations du requester depuis la base de données au lieu d'utiliser les données du token.

**Headers:** Authorization required (admin, owner ou le membre lui-même)

**Request:**
```json
{
  "memberId": 1,
  "subscriptionTypeId": 1,
  "startDate": "2025-01-01"
}
```

**Notes importantes:**
- `memberId` est l'ID de l'utilisateur membre
- Un abonnement annuel génère automatiquement 12 paiements mensuels
- Seuls les admins de la même salle, owners, ou le membre lui-même peuvent créer un abonnement
- La date de début par défaut est aujourd'hui si non spécifiée

**Response 201:**
```json
{
  "message": "Abonnement annuel créé avec succès",
  "subscription": {
    "id": 1,
    "memberId": 1,
    "subscriptionTypeId": 1,
    "status": "active",
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2026-01-01T00:00:00.000Z",
    "autoRenew": true
  },
  "subscriptionType": {
    "id": 1,
    "name": "Premium",
    "monthlyPrice": 49.99
  },
  "paymentsGenerated": 12,
  "payments": [
    {
      "id": 1,
      "monthNumber": 1,
      "amount": 49.99,
      "dueDate": "2025-01-01T00:00:00.000Z",
      "status": "pending"
    },
    ...
  ]
}
```

### GET /subscriptions/:id
Obtenir le statut détaillé d'un abonnement

**⚠️ CORRECTION:** Cette route a été corrigée pour gérer les permissions correctement.

**Headers:** Authorization required

**Response 200:**
```json
{
  "subscription": {
    "id": 1,
    "memberId": 1,
    "status": "active",
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2026-01-01T00:00:00.000Z",
    "payments": [...]
  },
  "stats": {
    "totalPayments": 12,
    "completedPayments": 3,
    "overduePayments": 0,
    "pendingPayments": 9,
    "percentComplete": 25
  },
  "nextPayment": {
    "id": 4,
    "amount": 49.99,
    "dueDate": "2025-04-01T00:00:00.000Z",
    "monthNumber": 4
  }
}
```

### GET /subscriptions/member/:memberId
Obtenir tous les abonnements d'un membre

**⚠️ CORRECTION:** Cette route a été corrigée pour gérer les permissions correctement.

**Headers:** Authorization required

**Response 200:**
```json
{
  "subscriptions": [
    {
      "id": 1,
      "memberId": 1,
      "subscriptionTypeId": 1,
      "status": "active",
      "startDate": "2025-01-01T00:00:00.000Z",
      "endDate": "2026-01-01T00:00:00.000Z",
      "subscriptionType": {
        "name": "Premium",
        "monthlyPrice": 49.99
      },
      "payments": [...]
    }
  ]
}
```

### POST /subscriptions/payments/:paymentId/acknowledge
Acquitter un paiement (le marquer comme payé et activer l'abonnement si nécessaire)

**Headers:** Authorization required

**Request:**
```json
{
  "paymentMethod": "card",
  "transactionId": "TRX123456"
}
```

**Response 200:**
```json
{
  "message": "Paiement acquitté avec succès",
  "payment": {
    "id": 1,
    "status": "completed",
    "amount": 49.99,
    "paidAt": "2025-01-02T10:00:00.000Z"
  },
  "subscription": {
    "id": 1,
    "status": "active",
    "type": "Premium"
  }
}
```

### POST /subscriptions/payments/:paymentId/complete
Marquer un paiement comme complété

**Headers:** Authorization required

**Request:**
```json
{
  "paymentMethod": "card",
  "transactionId": "TRX123456"
}
```

**Response 200:**
```json
{
  "message": "Paiement marqué comme complété",
  "payment": {
    "id": 1,
    "status": "completed",
    "amount": 49.99
  }
}
```

### GET /subscriptions/payments/upcoming
Obtenir les paiements à venir dans les 7 prochains jours (admin/owner)

**⚠️ CORRECTION:** Cette route a été corrigée pour gérer les permissions correctement.

**Headers:** Authorization required (admin ou owner)

**Response 200:**
```json
{
  "count": 5,
  "payments": [
    {
      "id": 10,
      "memberId": 1,
      "memberName": "Bob Member",
      "memberEmail": "bob@example.com",
      "amount": 49.99,
      "dueDate": "2025-01-05T00:00:00.000Z",
      "monthNumber": 2,
      "daysUntilDue": 3
    }
  ]
}
```

---

## 5. Types d'abonnements

### GET /subscription-types
Lister tous les types d'abonnements disponibles

**Query params:**
- `includeInactive` (optional): "true" pour inclure les types inactifs

**Response 200:**
```json
{
  "types": [
    {
      "id": 1,
      "name": "Basic",
      "description": "Abonnement de base",
      "monthlyPrice": 29.99,
      "features": ["Accès salle", "Vestiaires"],
      "isActive": true
    },
    {
      "id": 2,
      "name": "Premium",
      "description": "Abonnement premium",
      "monthlyPrice": 49.99,
      "features": ["Accès salle", "Vestiaires", "Cours collectifs", "Coach personnel"],
      "isActive": true
    }
  ]
}
```

### GET /subscription-types/:id
Obtenir les détails d'un type d'abonnement

**Response 200:**
```json
{
  "type": {
    "id": 1,
    "name": "Premium",
    "description": "Abonnement premium avec tous les avantages",
    "monthlyPrice": 49.99,
    "features": ["Accès salle", "Vestiaires", "Cours collectifs", "Coach personnel"],
    "isActive": true,
    "_count": {
      "subscriptions": 15
    }
  }
}
```

### POST /subscription-types
Créer un type d'abonnement (owner uniquement)

**⚠️ CORRECTION:** Cette route a été corrigée pour gérer les permissions correctement.

**Headers:** Authorization required (owner)

**Request:**
```json
{
  "name": "VIP",
  "description": "Abonnement VIP exclusif",
  "monthlyPrice": 99.99,
  "features": ["Tous les avantages Premium", "Spa", "Sauna", "Nutrition personnalisée"]
}
```

**Response 201:**
```json
{
  "message": "Type d'abonnement créé avec succès",
  "type": {
    "id": 3,
    "name": "VIP",
    "monthlyPrice": 99.99,
    "features": [...]
  }
}
```

### PUT /subscription-types/:id
Mettre à jour un type d'abonnement (owner uniquement)

**⚠️ CORRECTION:** Cette route a été corrigée pour gérer les permissions correctement.

**Headers:** Authorization required (owner)

**Request:**
```json
{
  "monthlyPrice": 89.99,
  "description": "Description mise à jour"
}
```

**Response 200:**
```json
{
  "message": "Type d'abonnement mis à jour avec succès",
  "type": {...}
}
```

### DELETE /subscription-types/:id
Désactiver un type d'abonnement (owner uniquement)

**⚠️ CORRECTION:** Cette route a été corrigée pour gérer les permissions correctement.

**Headers:** Authorization required (owner)

**Response 200:**
```json
{
  "message": "Type d'abonnement désactivé avec succès",
  "type": {...}
}
```

**Response 400 (si des abonnements actifs existent):**
```json
{
  "error": "Impossible de supprimer ce type: 5 abonnement(s) actif(s) l'utilisent",
  "activeSubscriptions": 5
}
```

### GET /subscription-types/:id/subscriptions
Obtenir tous les abonnements d'un type donné (owner/admin)

**⚠️ CORRECTION:** Cette route a été corrigée pour gérer les permissions correctement.

**Headers:** Authorization required (owner ou admin)

**Response 200:**
```json
{
  "count": 15,
  "subscriptions": [
    {
      "id": 1,
      "memberId": 1,
      "status": "active",
      "member": {
        "user": {
          "fullName": "Bob Member",
          "email": "bob@example.com"
        }
      },
      "subscriptionType": {...}
    }
  ]
}
```

---

## 6. Plannings d'entraînement

### POST /plannings
Créer un planning d'entraînement (coach/admin uniquement)

**Headers:** Authorization required (admin)

**Request:**
```json
{
  "memberId": 1,
  "title": "Programme Upper Body",
  "description": "Focus sur le haut du corps",
  "startDate": "2025-01-15",
  "endDate": "2025-02-15"
}
```

**Response 201:**
```json
{
  "message": "Planning créé avec succès",
  "planning": {
    "id": 1,
    "memberId": 1,
    "coachId": 2,
    "title": "Programme Upper Body",
    "description": "Focus sur le haut du corps",
    "startDate": "2025-01-15T00:00:00.000Z",
    "endDate": "2025-02-15T00:00:00.000Z",
    "status": "active",
    "member": {...},
    "coach": {...},
    "days": []
  }
}
```

### GET /plannings
Lister les plannings (coach voit ses plannings, membre voit les siens)

**Headers:** Authorization required

**Query params:**
- `memberId` (optional, coaches only): Filter by member
- `status` (optional): Filter by status
- `dayOfWeek` (optional): Filter by day

**Response 200:**
```json
{
  "plannings": [
    {
      "id": 1,
      "title": "Programme Upper Body",
      "member": {...},
      "coach": {...},
      "days": [...],
      "status": "active"
    }
  ]
}
```

### GET /plannings/member/:memberId
Obtenir tous les plannings d'un membre

**Headers:** Authorization required

**Query params:**
- `status` (optional): Filter by status (active, completed, cancelled)

**Response 200:**
```json
{
  "member": {
    "id": 1,
    "user": {
      "fullName": "Bob Member",
      "email": "bob@example.com"
    }
  },
  "plannings": [
    {
      "id": 1,
      "title": "Programme Upper Body",
      "startDate": "2025-01-15T00:00:00.000Z",
      "endDate": "2025-02-15T00:00:00.000Z",
      "status": "active",
      "coach": {
        "fullName": "Jane Coach"
      },
      "days": [
        {
          "dayOfWeek": 1,
          "exercises": [...]
        }
      ]
    }
  ]
}
```

### GET /plannings/next-day/:memberId
Obtenir le prochain jour d'entraînement pour demain

**Headers:** Authorization required

**Response 200:**
```json
{
  "member": {
    "id": 1,
    "user": {
      "fullName": "Bob Member"
    }
  },
  "planning": {
    "id": 1,
    "title": "Programme Upper Body"
  },
  "day": {
    "dayOfWeek": 1,
    "dayName": "Lundi",
    "date": "2025-01-03",
    "exercises": [
      {
        "exercise": {
          "id": 1,
          "name": "Push-ups",
          "category": "strength",
          "instructions": "..."
        },
        "sets": 3,
        "reps": 12,
        "weight": 0,
        "notes": "Focus on form"
      }
    ]
  }
}
```

**Response 204 (Aucun entraînement prévu):**
```json
{
  "message": "Aucun entraînement prévu pour demain",
  "member": {...}
}
```

### POST /plannings/:planningId/days/:dayOfWeek/exercises
Ajouter un exercice à un jour du planning (coach uniquement)

**Headers:** Authorization required (admin/coach)

**Path params:**
- `planningId`: ID du planning
- `dayOfWeek`: Jour de la semaine (0=Dimanche, 1=Lundi, ..., 6=Samedi)

**Request:**
```json
{
  "exerciseId": 1,
  "sets": 3,
  "reps": 12,
  "weight": 20.5,
  "restTime": 60,
  "notes": "Focus on proper form",
  "order": 1
}
```

**Response 201:**
```json
{
  "message": "Exercice ajouté au jour du planning avec succès",
  "planningExercise": {
    "id": 1,
    "planningDayId": 1,
    "exerciseId": 1,
    "sets": 3,
    "reps": 12,
    "weight": 20.5,
    "restTime": 60,
    "notes": "Focus on proper form",
    "order": 1,
    "exercise": {...}
  }
}
```

### DELETE /plannings/:planningId/days/:dayOfWeek/exercises/:exerciseId
Supprimer un exercice d'un jour du planning (coach uniquement)

**Headers:** Authorization required (admin/coach)

**Response 200:**
```json
{
  "message": "Exercice supprimé du jour du planning avec succès"
}
```

---

## 7. Exercices

### POST /plannings/exercises
Créer un exercice (coach uniquement)

**Headers:** Authorization required (admin/coach)

**Request:**
```json
{
  "name": "Push-ups",
  "description": "Classic bodyweight exercise",
  "category": "strength",
  "muscleGroup": ["chest", "triceps"],
  "equipment": ["none"],
  "difficulty": "beginner",
  "instructions": "Start in plank position, lower body, push back up"
}
```

**Response 201:**
```json
{
  "message": "Exercice créé avec succès",
  "exercise": {
    "id": 1,
    "name": "Push-ups",
    "category": "strength",
    "difficulty": "beginner",
    ...
  }
}
```

### GET /plannings/exercises
Lister tous les exercices

**Headers:** Authorization required

**Query params:**
- `category` (optional): Filter by category
- `difficulty` (optional): Filter by difficulty
- `muscleGroup` (optional): Filter by muscle group

**Response 200:**
```json
{
  "exercises": [
    {
      "id": 1,
      "name": "Push-ups",
      "description": "Classic bodyweight exercise",
      "category": "strength",
      "muscleGroup": ["chest", "triceps"],
      "equipment": ["none"],
      "difficulty": "beginner",
      "instructions": "..."
    }
  ]
}
```

### GET /plannings/exercises/:id
Obtenir les détails d'un exercice

**Headers:** Authorization required

**Response 200:**
```json
{
  "exercise": {
    "id": 1,
    "name": "Push-ups",
    "description": "Classic bodyweight exercise",
    "category": "strength",
    "muscleGroup": ["chest", "triceps"],
    "equipment": ["none"],
    "difficulty": "beginner",
    "instructions": "Start in plank position..."
  }
}
```

---

## 📝 Notes importantes pour l'intégration Flutter

### Gestion des erreurs
Toutes les routes retournent des codes HTTP standards:
- `200`: Succès
- `201`: Créé avec succès
- `204`: Succès mais pas de contenu
- `400`: Erreur de validation
- `401`: Non authentifié (token manquant ou invalide)
- `403`: Accès refusé (permissions insuffisantes)
- `404`: Ressource non trouvée
- `500`: Erreur serveur

### Token JWT
- Le token est retourné lors du login
- Il doit être stocké de manière sécurisée (flutter_secure_storage)
- Il doit être inclus dans le header `Authorization: Bearer {token}` pour toutes les routes protégées
- Le token contient: `sub` (userId), `email`, `type` (role)
- Le token expire après 30 jours

### Images
- Format accepté pour l'upload: Base64 avec ou sans préfixe `data:image/...;base64,`
- Formats supportés: JPEG, PNG, GIF
- Le serveur génère automatiquement des avatars/placeholders SVG si pas d'image

### IDs des utilisateurs
- `userId` (dans User table) = ID principal de l'utilisateur
- `memberId` (dans Member table) = même que userId pour les membres
- Toujours utiliser `userId` pour identifier un membre dans les requêtes

### Corrections appliquées
1. ✅ Création d'utilisateur: Gym automatiquement inclus pour QR code
2. ✅ Scan QR: Récupération correcte du gymId de l'admin
3. ✅ Abonnements: Permissions vérifiées depuis la base de données
4. ✅ Types d'abonnements: Permissions vérifiées correctement
5. ✅ Toutes les routes: Token JWT utilisé correctement avec `req.user.sub`

### Workflow recommandé pour Flutter

1. **Login**: `POST /auth/login` → Stocker token
2. **Vérifier session**: `GET /auth/me` → Obtenir infos utilisateur
3. **Membre**: 
   - Voir son abonnement: `GET /auth/me` (inclut activeSubscription)
   - Voir ses plannings: `GET /plannings/member/:memberId`
   - Voir prochain entraînement: `GET /plannings/next-day/:memberId`
   - Obtenir QR code: `GET /users/:id/qr`
4. **Admin**:
   - Scanner QR: `POST /auth/scan-qr`
   - Créer membre: `POST /users`
   - Créer planning: `POST /plannings`
   - Voir paiements à venir: `GET /subscriptions/payments/upcoming`
5. **Owner**:
   - Créer admin: `POST /users/create-admin`
   - Créer types d'abonnement: `POST /subscription-types`
   - Voir toutes les salles: `GET /gyms`
   - Statistiques: `GET /users/stats`

---

## 🔄 Changelog des corrections

### 2025-01-02
- ✅ Correction: User creation includes gym data for QR generation
- ✅ Correction: scan-qr fetches admin's gymId from database
- ✅ Correction: Subscription routes fetch requester data properly
- ✅ Correction: SubscriptionType routes fetch requester data properly
- ✅ Correction: All permission checks use proper database queries

---

## 📞 Support

Pour toute question sur l'API, contactez l'équipe backend ou consultez le code source dans `/routes`.
