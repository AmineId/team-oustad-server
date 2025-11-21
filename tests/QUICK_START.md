# 🚀 Guide de Démarrage Rapide - Tests

## Première Installation

### 1. Configurer la Base de Données de Test

**Option A: Script automatique (recommandé)**
```bash
# Définir les variables d'environnement
export POSTGRES_USER=teamfitness
export POSTGRES_PASSWORD=your_password
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432

# Exécuter le script de setup
./tests/setup-test-db.sh
```

**Option B: Configuration manuelle**
```bash
# 1. Créer la base de données
createdb teamfitness_test

# 2. Appliquer les migrations
DATABASE_URL="postgresql://teamfitness:password@localhost:5432/teamfitness_test?schema=public" npx prisma migrate deploy

# 3. Générer le client Prisma
npx prisma generate
```

### 2. Vérifier le Fichier .env.test

Assurez-vous que `.env.test` contient:
```env
NODE_ENV=test
DATABASE_URL="postgresql://teamfitness:password@localhost:5432/teamfitness_test?schema=public"
JWT_SECRET=test_jwt_secret_key_for_testing_purposes
FIREBASE_SERVICE_ACCOUNT_PATH=""
```

### 3. Exécuter les Tests

```bash
# Tous les tests
npm test

# Tests avec couverture
npm run test:coverage

# Mode watch (développement)
npm run test:watch
```

## 📊 Résultats Attendus

Si tout est bien configuré, vous devriez voir:

```
PASS  tests/routes/auth.test.js (12.5 s)
PASS  tests/routes/gyms.test.js (10.2 s)
PASS  tests/routes/subscriptions.test.js (11.8 s)
PASS  tests/routes/members.test.js (9.5 s)

Test Suites: 4 passed, 4 total
Tests:       135 passed, 135 total
Snapshots:   0 total
Time:        44.123 s

Coverage summary:
  Lines        : 85.2% (1234/1448)
  Branches     : 78.5% (456/581)
  Functions    : 82.1% (234/285)
  Statements   : 85.2% (1234/1448)
```

## ⚠️ Problèmes Courants

### Erreur: Cannot connect to PostgreSQL
**Solution**: Vérifiez que PostgreSQL est démarré:
```bash
# Vérifier le statut
sudo systemctl status postgresql

# Démarrer si nécessaire
sudo systemctl start postgresql

# Ou avec Docker
docker start postgres_container
```

### Erreur: Database does not exist
**Solution**: Réexécutez le script de setup:
```bash
./tests/setup-test-db.sh
```

### Erreur: Prisma migrations not applied
**Solution**: Appliquez manuellement les migrations:
```bash
DATABASE_URL="postgresql://teamfitness:password@localhost:5432/teamfitness_test?schema=public" npx prisma migrate deploy
```

### Tests qui échouent de manière aléatoire
**Cause**: Isolation insuffisante entre les tests
**Solution**: Les tests s'exécutent déjà avec `--runInBand` pour éviter ce problème. Si le problème persiste:
```bash
# Nettoyer complètement la BDD de test
./tests/setup-test-db.sh

# Réexécuter les tests
npm test
```

### Erreur: JWT_SECRET not defined
**Solution**: Vérifiez que `.env.test` est présent et contient `JWT_SECRET`

## 🔄 Workflow Développement

### Avant de Commiter
```bash
# 1. Exécuter tous les tests
npm test

# 2. Vérifier la couverture
npm run test:coverage

# 3. Vérifier qu'il n'y a pas d'erreurs
npm run test:verbose
```

### Pendant le Développement
```bash
# Mode watch pour auto-refresh
npm run test:watch

# Ou tester un fichier spécifique
npm run test:auth
npm run test:gyms
```

### Tester une Fonctionnalité Spécifique
```bash
# Par nom de test
npm test -- -t "should login admin"

# Par fichier
npm test tests/routes/auth.test.js
```

## 📈 Objectifs de Couverture

Avant chaque merge:
- ✅ Tous les tests doivent passer
- ✅ Couverture > 70% (lignes, branches, fonctions)
- ✅ Aucun test skip ou only

## 🎯 Commandes Rapides

```bash
# Tests rapides (sans couverture)
npm test

# Tests complets avec rapport
npm run test:coverage

# Tests en mode développement
npm run test:watch

# Tests par route
npm run test:auth
npm run test:gyms
npm run test:subscriptions
npm run test:members

# Tests pour CI/CD
npm run test:ci
```

## 📚 Documentation Complète

Voir [tests/README.md](./README.md) pour:
- Structure complète des tests
- Guide d'écriture de nouveaux tests
- Helpers disponibles
- Bonnes pratiques
- Debugging avancé

## ✅ Checklist Avant Premier Lancement

- [ ] PostgreSQL est installé et démarré
- [ ] La base de données `teamfitness_test` est créée
- [ ] Les migrations Prisma sont appliquées
- [ ] Le fichier `.env.test` existe avec les bonnes variables
- [ ] Les dépendances npm sont installées (`npm install`)
- [ ] Le script `setup-test-db.sh` a été exécuté avec succès

Si tous les points sont cochés, lancez:
```bash
npm test
```

Vous devriez voir tous les tests passer ! 🎉
