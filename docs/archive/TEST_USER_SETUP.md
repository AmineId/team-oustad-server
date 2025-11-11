# Test du Workflow de Création d'Utilisateur avec Email d'Activation

## Vue d'ensemble
Ce document décrit comment tester le nouveau système de création d'utilisateur avec email d'activation.

## Prérequis
1. Serveur démarré : `node index.js`
2. Base de données avec seed : `npm run db:seed`

## Test Automatique
Exécutez le script de test complet :
```bash
node scripts/test-user-setup.js
```

Ce script teste automatiquement :
- ✅ Création d'utilisateur sans mot de passe
- ✅ Envoi automatique de l'email d'activation
- ✅ Blocage de connexion avant création du mot de passe
- ✅ Création du mot de passe avec token
- ✅ Connexion avec le nouveau mot de passe
- ✅ Protection contre la réutilisation du token
- ✅ Renvoi d'email d'activation

## Test Manuel avec cURL

### 1. Connexion Admin
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@teamfitness.com",
    "password": "admin123"
  }'
```
**Récupérez le token** de la réponse.

### 2. Créer un utilisateur SANS mot de passe
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI" \
  -d '{
    "email": "nouveau@example.com",
    "fullName": "Nouveau Membre",
    "role": "member",
    "gymId": 1
  }'
```

**Réponse attendue :**
```json
{
  "message": "Utilisateur créé avec succès. Un email d'activation a été envoyé.",
  "user": {
    "id": 5,
    "email": "nouveau@example.com",
    "fullName": "Nouveau Membre",
    "role": "member",
    ...
  },
  "setupEmailSent": true
}
```

### 3. Vérifier le token en base (pour test)
```bash
# Connexion à PostgreSQL
docker exec -it team_fitness_server-postgres-1 psql -U postgres -d teamfitness

# Récupérer le token
SELECT token, "expiresAt", used 
FROM "PasswordResetToken" 
WHERE "userId" = (SELECT id FROM "User" WHERE email = 'nouveau@example.com')
ORDER BY "createdAt" DESC 
LIMIT 1;
```

### 4. Créer le mot de passe avec le token
```bash
curl -X POST http://localhost:3000/auth/setup-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nouveau@example.com",
    "token": "VOTRE_TOKEN_6_CHIFFRES",
    "password": "monmotdepasse123"
  }'
```

**Réponse attendue :**
```json
{
  "message": "Mot de passe créé avec succès"
}
```

### 5. Se connecter avec le nouveau mot de passe
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nouveau@example.com",
    "password": "monmotdepasse123"
  }'
```

**Réponse attendue :**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 5,
    "email": "nouveau@example.com",
    "fullName": "Nouveau Membre",
    "role": "member",
    ...
  }
}
```

### 6. Renvoyer un email d'activation (optionnel)
```bash
curl -X POST http://localhost:3000/auth/send-setup-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_TOKEN_ADMIN" \
  -d '{
    "email": "nouveau@example.com"
  }'
```

## Nouveaux Endpoints

### POST /auth/send-setup-email
- **Auth requise** : Oui (Bearer token)
- **Body** : `{ "email": "user@example.com" }`
- **Usage** : Renvoyer un email d'activation à un utilisateur

### POST /auth/setup-password
- **Auth requise** : Non
- **Body** : `{ "email": "user@example.com", "token": "123456", "password": "newpassword" }`
- **Usage** : Créer le mot de passe initial avec le token

### POST /users (modifié)
- **Auth requise** : Oui (Bearer token)
- **Body** : 
  ```json
  {
    "email": "user@example.com",
    "fullName": "Full Name",
    "role": "member",
    "gymId": 1,
    "password": "optionnel",
    "sendSetupEmail": true
  }
  ```
- **Changement** : Le champ `password` est maintenant **optionnel**
- **Nouveau** : Si pas de password, un email d'activation est envoyé automatiquement

## Configuration Email (optionnel)

Pour tester l'envoi réel d'emails, configurez `.env` :
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre.email@gmail.com
SMTP_PASS=votre_app_password
FRONTEND_URL=http://localhost:3001
```

## Workflow Complet

```
1. Admin/Owner crée utilisateur
   ↓
2. Système génère token + email automatique
   ↓
3. Utilisateur reçoit email avec token
   ↓
4. Utilisateur clique lien ou entre token
   ↓
5. Utilisateur crée son mot de passe
   ↓
6. Utilisateur peut se connecter
```

## Documentation Swagger

Toutes les routes sont documentées dans Swagger UI :
- URL : http://localhost:3000/api-docs
- Section : **Authentication**
  - POST /auth/send-setup-email
  - POST /auth/setup-password
- Section : **Users**
  - POST /users (mis à jour)

## Troubleshooting

### L'email n'est pas envoyé
- Vérifiez la configuration SMTP dans `.env`
- Consultez les logs du serveur
- L'erreur d'email ne bloque pas la création d'utilisateur

### Token invalide ou expiré
- Le token expire après 24 heures
- Le token ne peut être utilisé qu'une seule fois
- Utilisez `POST /auth/send-setup-email` pour renvoyer un nouveau token

### Impossible de se connecter
- Vérifiez que le mot de passe a bien été créé avec `/auth/setup-password`
- Le mot de passe doit contenir au moins 6 caractères
