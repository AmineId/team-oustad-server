# Configuration de la détection de première connexion

## Étapes d'installation

### 1. Appliquer la migration de la base de données

```bash
# Option A : Si vous avez Node.js et npm installés
cd /root/team-server/db-server
npx prisma migrate dev --name add_last_login_at

# Option B : Appliquer manuellement le SQL
psql -U votre_utilisateur -d votre_database -f prisma/migrations/add_last_login_at.sql

# Option C : Avec Docker (si vous utilisez PostgreSQL dans Docker)
docker exec -i votre_container_postgres psql -U votre_utilisateur -d votre_database < prisma/migrations/add_last_login_at.sql
```

### 2. Régénérer le client Prisma

```bash
npx prisma generate
```

### 3. (Optionnel) Réinitialiser et reseed la base de données

Si vous voulez repartir de zéro avec les données de test :

```bash
# Réinitialiser la base de données et relancer le seed
npx prisma migrate reset

# Ou seulement relancer le seed
npx prisma db seed
```

### 4. Tester la fonctionnalité

```bash
# Démarrer le serveur
npm run dev

# Ou avec PM2
pm2 start ecosystem.config.js
```

## Test manuel avec curl

### 1. Créer un nouveau membre (en tant qu'admin/owner)

```bash
# D'abord se connecter en tant qu'admin
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@teamfitness.com",
    "password": "admin123"
  }'

# Récupérer le token de la réponse et créer un nouveau membre
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

### 2. Première connexion du nouveau membre

```bash
# Se connecter pour la première fois
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nouveau@example.com",
    "password": "member123"
  }'

# Résultat attendu : isFirstLogin: true
```

### 3. Deuxième connexion

```bash
# Se reconnecter
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nouveau@example.com",
    "password": "member123"
  }'

# Résultat attendu : isFirstLogin: false
```

## Vérification dans la console

Recherchez ces logs dans la console du serveur :

```
🔔 Première connexion: OUI ✨    <- Première fois
🔔 Première connexion: NON       <- Connexions suivantes
```

## État actuel

✅ Schema Prisma modifié (`lastLoginAt` ajouté)
✅ Route `/auth/login` modifiée (détection + mise à jour)
✅ Réponse JSON inclut `isFirstLogin`
✅ Fichier SQL de migration créé
✅ Documentation créée

⏳ À faire :
- Appliquer la migration à la base de données
- Régénérer le client Prisma
- Tester avec un vrai utilisateur

## Utilisateurs de test disponibles (après seed)

Tous ces utilisateurs auront `lastLoginAt: null` au départ :

- `bob@example.com` / `member123` (Gym 1)
- `charlie@example.com` / `member123` (Gym 1)
- `alice@example.com` / `member123` (Gym 1)
- `peter@example.com` / `member123` (Gym 1)
- `mary@example.com` / `member123` (Gym 1)
- `admin@teamfitness.com` / `admin123` (Gym 1)
- `owner@teamfitness.com` / `owner123` (Owner)

## Troubleshooting

### Erreur : "npx: command not found"
- Installez Node.js : `curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs`

### Erreur : "Column does not exist"
- La migration n'a pas été appliquée. Exécutez le SQL manuellement.

### isFirstLogin toujours false
- Vérifiez que `lastLoginAt` est bien `null` en base :
  ```sql
  SELECT email, "lastLoginAt" FROM "User" WHERE email = 'votre@email.com';
  ```
