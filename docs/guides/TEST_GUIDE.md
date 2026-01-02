# 🏋️ Team Fitness Server - Guide de Test Complet

## 🎯 Vue d'ensemble
Votre serveur de fitness est maintenant complètement opérationnel avec :
- ✅ Système d'upload d'images (utilisateurs + salles)
- ✅ Système de planning d'entraînement complet
- ✅ Authentification JWT avec rôles
- ✅ Base de données PostgreSQL avec Prisma

## 🖼️ Test du Système d'Images

### Avatars Utilisateur
```bash
# Upload d'une image de profil (remplacer TOKEN par un token JWT valide)
curl -X PUT http://localhost:3000/api/users/profile-image \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzRDQUY1MCIvPgogIDx0ZXh0IHg9IjUwIiB5PSI1NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTIiPkFVU0VSPC90ZXh0Pgo8L3N2Zz4="}'

# Récupération de l'image de profil
curl -X GET http://localhost:3000/api/users/profile-image \
  -H "Authorization: Bearer TOKEN"

# Suppression de l'image (retour à l'avatar par défaut)
curl -X DELETE http://localhost:3000/api/users/profile-image \
  -H "Authorization: Bearer TOKEN"
```

### Images de Salle de Sport
```bash
# Upload d'une image de salle (nécessite rôle admin/owner)
curl -X PUT http://localhost:3000/api/gyms/6/image \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzIyOUIzNyIvPgogIDx0ZXh0IHg9IjUwIiB5PSI1NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTIiPkdZTTwvdGV4dD4KPC9zdmc+"}'

# Récupération de l'image de salle
curl -X GET http://localhost:3000/api/gyms/6/image \
  -H "Authorization: Bearer TOKEN"

# Suppression de l'image (retour au placeholder par défaut)
curl -X DELETE http://localhost:3000/api/gyms/6/image \
  -H "Authorization: Bearer TOKEN"
```

## 📅 Test du Système de Planning

### Gestion des Exercices
```bash
# Créer un nouvel exercice (admin/coach seulement)
curl -X POST http://localhost:3000/api/plannings/exercises \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Squats",
    "description": "Lower body strength exercise",
    "category": "strength",
    "muscleGroup": ["quadriceps", "glutes", "hamstrings"],
    "equipment": ["barbell"],
    "difficulty": "intermediate",
    "instructions": "Stand with feet shoulder-width apart, lower your body as if sitting back into a chair, then stand back up."
  }'

# Lister tous les exercices
curl -X GET http://localhost:3000/api/plannings/exercises \
  -H "Authorization: Bearer TOKEN"

# Récupérer un exercice spécifique
curl -X GET http://localhost:3000/api/plannings/exercises/1 \
  -H "Authorization: Bearer TOKEN"
```

### Gestion des Plannings
```bash
# Créer un planning pour un membre (coach seulement)
curl -X POST http://localhost:3000/api/plannings \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": 1,
    "title": "Beginner Strength Program",
    "description": "4-week strength building program",
    "startDate": "2025-11-15",
    "endDate": "2025-12-15",
    "status": "active"
  }'

# Lister les plannings (filtré par rôle)
curl -X GET http://localhost:3000/api/plannings \
  -H "Authorization: Bearer TOKEN"

 # Récupérer un planning spécifique avec exercices
curl -X GET http://localhost:3000/api/plannings/1 \
  -H "Authorization: Bearer TOKEN"

# Récupérer les plannings d'un membre
# Note: The endpoint accepts either a Member.userId or a User.id in the path for compatibility
# En seed, Bob est créé avec une Member.userId (qui est la même que User.id). Vous pouvez passer l'ID utilisateur selon la sortie du seed.
curl -X GET http://localhost:3000/api/plannings/member/13 \
  -H "Authorization: Bearer TOKEN"

# Exemple: Le seed crée également des exercices et un planning pour Bob (Upper Body Strength Training).
# Utiliser l'endpoint next-day pour obtenir le prochain jour de planning pour ce membre:
curl -X GET http://localhost:3000/api/plannings/next-day/13 \
  -H "Authorization: Bearer TOKEN"
```

### Gestion des Exercices dans un Planning
```bash
# Ajouter un exercice à un planning pour un jour spécifique
curl -X POST http://localhost:3000/api/plannings/1/exercises \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exerciseId": 1,
    "dayOfWeek": 1,
    "sets": 3,
    "reps": 12,
    "notes": "Focus on proper form",
    "order": 1
  }'

# Ajouter un deuxième exercice le même jour (démonstration de plusieurs exercices par jour)
curl -X POST http://localhost:3000/api/plannings/1/exercises \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exerciseId": 2,
    "dayOfWeek": 1,
    "sets": 3,
    "reps": 10,
    "notes": "Rest 60 seconds between sets",
    "order": 2
  }'

# Modifier un exercice dans un planning
curl -X PUT http://localhost:3000/api/plannings/1/exercises/1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sets": 4,
    "reps": 15,
    "notes": "Updated: Increase weight if possible"
  }'

# Supprimer un exercice d'un planning
curl -X DELETE http://localhost:3000/api/plannings/1/exercises/1 \
  -H "Authorization: Bearer TOKEN"
```

## 🔐 Authentification et Autorisations

### Rôles et Permissions
- **owner**: Accès complet à tout
- **admin/coach**: Gestion des membres, plannings, exercices
- **member**: Accès limité à ses propres données

### Obtenir un Token JWT
```bash
# Connexion pour obtenir un token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@teamfitness.com", "password": "password123"}'
```

## 📊 Points d'API Disponibles

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription

### Utilisateurs
- `GET /api/users/profile` - Profil utilisateur
- `PUT /api/users/profile-image` - Upload avatar
- `GET /api/users/profile-image` - Récupérer avatar
- `DELETE /api/users/profile-image` - Supprimer avatar

### Salles de Sport
- `GET /api/gyms` - Lister les salles
- `PUT /api/gyms/:id/image` - Upload image salle
- `GET /api/gyms/:id/image` - Récupérer image salle
- `DELETE /api/gyms/:id/image` - Supprimer image salle

### Plannings d'Entraînement
- `GET /api/plannings/exercises` - Lister exercices
- `POST /api/plannings/exercises` - Créer exercice
- `GET /api/plannings/exercises/:id` - Détails exercice
- `POST /api/plannings` - Créer planning
- `GET /api/plannings` - Lister plannings
- `GET /api/plannings/:id` - Détails planning
- `POST /api/plannings/:id/exercises` - Ajouter exercice au planning
- `PUT /api/plannings/:id/exercises/:exerciseId` - Modifier exercice
- `DELETE /api/plannings/:id/exercises/:exerciseId` - Supprimer exercice

## 🧪 Scripts de Test Automatisés

Des scripts de test ont été créés dans le dossier `scripts/` :
- `test-planning-system.js` - Test complet du système de planning
- `test-image-upload.js` - Test complet du système d'images

Exécution :
```bash
node scripts/test-planning-system.js
node scripts/test-image-upload.js
```

## 📝 Notes Importantes

1. **Images**: Stockées en base64, avatars SVG générés automatiquement
2. **Planning**: Un planning peut avoir plusieurs exercices par jour
3. **Permissions**: Vérifiées automatiquement selon le rôle de l'utilisateur
4. **Base de données**: PostgreSQL avec Prisma ORM
5. **Logs**: Logging détaillé avec emojis pour faciliter le debugging

## 🚀 Prochaines Étapes Suggérées

1. **Validation d'images**: Ajouter des limites de taille et formats acceptés
2. **Templates de planning**: Créer des plannings prédéfinis
3. **Suivi de progression**: Enregistrer les performances des membres
4. **Notifications**: Alertes pour nouveaux plannings
5. **API mobile**: Optimiser pour les applications Flutter/React Native

Votre serveur de fitness est maintenant prêt pour la production ! 🎉