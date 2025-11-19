# Détection de la première connexion d'un membre

## Vue d'ensemble

Le système peut maintenant détecter si un utilisateur (membre, admin, owner) se connecte pour la première fois. Cette fonctionnalité est utile pour :
- Afficher un écran de bienvenue ou un tutoriel
- Demander des informations complémentaires lors de la première connexion
- Déclencher des actions spécifiques (email de bienvenue, configuration initiale, etc.)

## Comment ça fonctionne

### 1. Champ `lastLoginAt` dans le modèle User

Un nouveau champ `lastLoginAt` a été ajouté au modèle `User` dans le schéma Prisma :

```prisma
model User {
  // ... autres champs
  lastLoginAt DateTime? // Date de la dernière connexion (null = jamais connecté)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

- `null` = l'utilisateur ne s'est jamais connecté
- Date = date/heure de la dernière connexion

### 2. Détection lors du login

Lors d'une connexion via `/auth/login`, le système :

1. **Vérifie** si `lastLoginAt` est `null` → c'est la première connexion
2. **Met à jour** `lastLoginAt` avec la date/heure actuelle
3. **Retourne** `isFirstLogin: true/false` dans la réponse

## API Response

### Réponse de `/auth/login`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "isFirstLogin": true,
  "user": {
    "id": 5,
    "email": "member@example.com",
    "fullName": "John Doe",
    "gymId": 1,
    "gym": {
      "id": 1,
      "name": "Gym Central",
      "address": "123 Main St"
    },
    "type": "member"
  }
}
```

### Propriété `isFirstLogin`

- `true` : L'utilisateur se connecte pour la **première fois**
- `false` : L'utilisateur s'est déjà connecté auparavant

## Utilisation côté client (Flutter/Frontend)

### Exemple 1 : Afficher un écran de bienvenue

```dart
// Dans votre service d'authentification
Future<LoginResponse> login(String email, String password) async {
  final response = await http.post(
    Uri.parse('$baseUrl/auth/login'),
    body: jsonEncode({'email': email, 'password': password}),
    headers: {'Content-Type': 'application/json'},
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    
    // Vérifier si c'est la première connexion
    if (data['isFirstLogin'] == true) {
      // Naviguer vers l'écran de bienvenue/tutoriel
      navigateToWelcomeScreen();
    } else {
      // Naviguer vers l'écran principal
      navigateToHomeScreen();
    }
    
    return LoginResponse.fromJson(data);
  }
  
  throw Exception('Login failed');
}
```

### Exemple 2 : Demander des informations complémentaires

```dart
if (loginResponse.isFirstLogin) {
  // Afficher un dialogue pour compléter le profil
  await showDialog(
    context: context,
    barrierDismissible: false,
    builder: (context) => CompleteProfileDialog(),
  );
}
```

### Exemple 3 : Déclencher une action backend

```dart
if (loginResponse.isFirstLogin) {
  // Envoyer une requête pour déclencher des actions côté serveur
  await apiClient.post('/users/first-login-setup', {
    'preferences': userPreferences,
  });
}
```

## Actions côté backend lors de la première connexion

Vous pouvez ajouter une logique supplémentaire dans la route `/auth/login` :

```javascript
// Dans routes/auth.js
if (isFirstLogin) {
  // Envoyer un email de bienvenue
  await sendWelcomeEmail(user.email, user.fullName);
  
  // Créer des données par défaut pour le membre
  if (user.role === 'member') {
    await createDefaultMemberSettings(user.id);
  }
  
  // Logger l'événement
  console.log(`🎉 Première connexion pour ${user.fullName}`);
}
```

## Migration de la base de données

Pour ajouter le champ `lastLoginAt` à votre base de données existante :

```bash
# Créer et appliquer la migration
npx prisma migrate dev --name add_last_login_at

# Ou en production
npx prisma migrate deploy
```

## Remarques importantes

### 1. Utilisateurs existants
Pour les utilisateurs créés avant cette fonctionnalité, `lastLoginAt` sera `null` jusqu'à leur prochaine connexion. **Ils seront considérés comme se connectant pour la première fois** lors de leur prochaine connexion après le déploiement.

### 2. Initialisation manuelle (optionnel)
Si vous souhaitez que les utilisateurs existants ne soient pas considérés comme nouveaux, exécutez cette commande SQL :

```sql
-- Initialiser lastLoginAt avec la date de création pour tous les utilisateurs existants
UPDATE "User" 
SET "lastLoginAt" = "createdAt" 
WHERE "lastLoginAt" IS NULL;
```

### 3. Test de la fonctionnalité
Pour tester :
1. Créez un nouveau membre via `/users` (admin/owner uniquement)
2. Connectez-vous avec ce nouveau membre → `isFirstLogin: true`
3. Déconnectez-vous et reconnectez-vous → `isFirstLogin: false`

## Cas d'usage avancés

### Compter le nombre de connexions
Vous pouvez ajouter un compteur :

```prisma
model User {
  loginCount Int @default(0)
  lastLoginAt DateTime?
}
```

```javascript
// Dans la route login
await prisma.user.update({
  where: { id: user.id },
  data: { 
    lastLoginAt: new Date(),
    loginCount: { increment: 1 }
  }
});
```

### Tracker la date de la première connexion
Ajoutez un champ séparé :

```prisma
model User {
  firstLoginAt DateTime?
  lastLoginAt DateTime?
}
```

```javascript
if (isFirstLogin) {
  await prisma.user.update({
    where: { id: user.id },
    data: { 
      firstLoginAt: new Date(),
      lastLoginAt: new Date()
    }
  });
}
```

## Questions fréquentes

**Q: Est-ce que `isFirstLogin` est conservé dans le token JWT ?**  
R: Non, `isFirstLogin` est calculé à chaque connexion et retourné uniquement dans la réponse de login.

**Q: Que se passe-t-il si je me connecte sur plusieurs appareils ?**  
R: Seule la première connexion sur **n'importe quel appareil** retournera `isFirstLogin: true`.

**Q: Puis-je réinitialiser le statut de première connexion ?**  
R: Oui, en mettant `lastLoginAt` à `null` dans la base de données :
```sql
UPDATE "User" SET "lastLoginAt" = NULL WHERE id = 5;
```

**Q: Est-ce que le setup-password compte comme une connexion ?**  
R: Non, seul `/auth/login` met à jour `lastLoginAt`. La création du mot de passe initial via `/auth/setup-password` ne compte pas.
