# 🎯 Guide Rapide - Environnements Multiples

## Commandes Essentielles

### 🔍 Vérifier l'environnement actuel
```
Outil: env_get_current
```

**Résultat** :
```json
{
  "activeEnvironment": "dev",
  "apiUrl": "http://localhost:3000",
  "isAuthenticated": true,
  "availableEnvironments": ["dev", "preprod", "prod"]
}
```

---

### 🔄 Changer d'environnement
```
Outil: env_switch
Paramètres:
  - environment: preprod  (ou dev, prod)
```

**Résultat** :
```json
{
  "success": true,
  "message": "Environnement changé vers: preprod",
  "previousEnvironment": "dev",
  "newEnvironment": "preprod",
  "newApiUrl": "https://preprod-api.teamfitness.com",
  "isAuthenticated": false,
  "warning": "Vous devez vous reconnecter avec auth_login"
}
```

---

### 📊 Voir tous les tokens
```
Outil: env_list_tokens
```

**Résultat** :
```json
{
  "activeEnvironment": "dev",
  "environments": {
    "dev": {
      "url": "http://localhost:3000",
      "isAuthenticated": true,
      "isActive": true
    },
    "preprod": {
      "url": "https://preprod-api.teamfitness.com",
      "isAuthenticated": true,
      "isActive": false
    },
    "prod": {
      "url": "https://api.teamfitness.com",
      "isAuthenticated": false,
      "isActive": false
    }
  }
}
```

---

## 🚦 Workflow Type

### Scénario 1 : Test en préproduction

```
1. env_get_current
   → Confirme que je suis en dev

2. env_switch (environment: preprod)
   → Change vers preprod

3. auth_login (email: admin@preprod.com, password: xxx)
   → Se connecte en preprod

4. users_list
   → Liste les utilisateurs de preprod

5. [Faire les tests nécessaires]

6. env_switch (environment: dev)
   → Retour en dev
```

---

### Scénario 2 : Déploiement production

```
1. env_list_tokens
   → Vérifie l'état de tous les environnements

2. env_switch (environment: preprod)
   → Va en preprod

3. [Validation finale en preprod]

4. env_switch (environment: prod)
   → Passe en production

5. auth_login (email: admin@prod.com, password: xxx)
   → Connexion production

6. [Actions de déploiement]

7. auth_me
   → Confirme l'identité en prod

8. env_switch (environment: dev)
   → Retour en développement
```

---

### Scénario 3 : Comparaison multi-environnements

```
1. env_switch (environment: dev)
2. auth_login (...)
3. gyms_list
   → Note les résultats dev

4. env_switch (environment: preprod)
5. auth_login (...)
6. gyms_list
   → Compare avec preprod

7. env_switch (environment: prod)
8. auth_login (...)
9. gyms_list
   → Compare avec prod
```

---

## ⚡ Raccourcis NPM

```bash
# Démarrer directement sur l'environnement voulu
npm run start:dev      # http://localhost:3000
npm run start:preprod  # https://preprod-api.teamfitness.com
npm run start:prod     # https://api.teamfitness.com
```

---

## 🔐 Tokens et Sécurité

### État des tokens
- ✅ **Conservés** : Lors du changement d'environnement
- ❌ **Perdus** : Au redémarrage du serveur MCP
- 🔒 **Isolés** : Chaque environnement a son token

### Exemple
```
dev:     token_abc123 → Valide
preprod: token_def456 → Valide
prod:    null         → Pas encore connecté
```

Après `env_switch` vers prod → Le token de dev est toujours là !

---

## 💡 Astuces

### ✅ Bonnes Pratiques

1. **Toujours vérifier** l'environnement actif avant une action sensible
   ```
   env_get_current → Confirme que je suis où je pense être
   ```

2. **Se connecter après le switch** (si pas déjà fait)
   ```
   env_switch → auth_login → Prêt à travailler
   ```

3. **Utiliser env_list_tokens** pour avoir une vue d'ensemble
   ```
   env_list_tokens → Je vois tous mes contextes
   ```

### ⚠️ Pièges à Éviter

1. ❌ Oublier qu'on est en prod
   → Toujours faire `env_get_current` avant des modifications

2. ❌ Utiliser les mêmes identifiants partout
   → Avoir des comptes dédiés par environnement

3. ❌ Ne pas vérifier après un switch
   → Confirmer avec `env_get_current` ou `auth_me`

---

## 📖 Documentation Complète

Pour plus de détails, voir [`MULTI-ENV-CONFIG.md`](./MULTI-ENV-CONFIG.md)
