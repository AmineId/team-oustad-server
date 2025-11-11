# Team Fitness MCP - Exemples de Configuration Multi-Environnements

Ce document présente différentes configurations pour gérer plusieurs environnements avec le serveur MCP Team Fitness.

## 🎯 Scénarios d'utilisation

### Scénario 1 : Un serveur MCP par environnement

Configuration recommandée si vous travaillez souvent sur plusieurs environnements simultanément.

**Claude Desktop (`claude_desktop_config.json`)** :

```json
{
  "mcpServers": {
    "teamfitness-dev": {
      "command": "node",
      "args": ["/chemin/vers/mcp-server/index.js"],
      "env": {
        "ACTIVE_ENV": "dev",
        "DEV_API_BASE_URL": "http://localhost:3000",
        "PREPROD_API_BASE_URL": "https://preprod-api.teamfitness.com",
        "PROD_API_BASE_URL": "https://api.teamfitness.com"
      }
    },
    "teamfitness-preprod": {
      "command": "node",
      "args": ["/chemin/vers/mcp-server/index.js"],
      "env": {
        "ACTIVE_ENV": "preprod",
        "DEV_API_BASE_URL": "http://localhost:3000",
        "PREPROD_API_BASE_URL": "https://preprod-api.teamfitness.com",
        "PROD_API_BASE_URL": "https://api.teamfitness.com"
      }
    },
    "teamfitness-prod": {
      "command": "node",
      "args": ["/chemin/vers/mcp-server/index.js"],
      "env": {
        "ACTIVE_ENV": "prod",
        "DEV_API_BASE_URL": "http://localhost:3000",
        "PREPROD_API_BASE_URL": "https://preprod-api.teamfitness.com",
        "PROD_API_BASE_URL": "https://api.teamfitness.com"
      }
    }
  }
}
```

**Avantages** :
- ✅ Contextes séparés
- ✅ Pas de risque de mélanger les environnements
- ✅ Tokens isolés par serveur

**Inconvénients** :
- ❌ 3 serveurs à gérer
- ❌ Plus de ressources utilisées

---

### Scénario 2 : Un seul serveur avec changement dynamique

Configuration recommandée pour la plupart des utilisateurs.

**Claude Desktop (`claude_desktop_config.json`)** :

```json
{
  "mcpServers": {
    "teamfitness": {
      "command": "node",
      "args": ["/chemin/vers/mcp-server/index.js"],
      "env": {
        "ACTIVE_ENV": "dev",
        "DEV_API_BASE_URL": "http://localhost:3000",
        "PREPROD_API_BASE_URL": "https://preprod-api.teamfitness.com",
        "PROD_API_BASE_URL": "https://api.teamfitness.com"
      }
    }
  }
}
```

**Workflow** :
1. Démarrer sur `dev` par défaut
2. Utiliser `env_switch` pour passer en preprod ou prod
3. Les tokens sont conservés par environnement

**Avantages** :
- ✅ Simple à configurer
- ✅ Moins de ressources
- ✅ Changement facile avec `env_switch`

**Inconvénients** :
- ❌ Nécessite de penser à changer d'environnement

---

### Scénario 3 : Script de démarrage personnalisé

Pour démarrer directement sur l'environnement souhaité.

**Créer des scripts shell** :

```bash
# start-dev.sh
#!/bin/bash
ACTIVE_ENV=dev node /chemin/vers/mcp-server/index.js

# start-preprod.sh
#!/bin/bash
ACTIVE_ENV=preprod node /chemin/vers/mcp-server/index.js

# start-prod.sh
#!/bin/bash
ACTIVE_ENV=prod node /chemin/vers/mcp-server/index.js
```

**Claude Desktop** :

```json
{
  "mcpServers": {
    "teamfitness-dev": {
      "command": "/chemin/vers/start-dev.sh"
    },
    "teamfitness-preprod": {
      "command": "/chemin/vers/start-preprod.sh"
    },
    "teamfitness-prod": {
      "command": "/chemin/vers/start-prod.sh"
    }
  }
}
```

---

## 📊 Tableau comparatif

| Scénario | Simplicité | Isolation | Ressources | Changement env |
|----------|-----------|-----------|------------|----------------|
| Un serveur par env | ⭐⭐ | ⭐⭐⭐ | ⭐ | N/A |
| Un serveur dynamique | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | `env_switch` |
| Scripts personnalisés | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | Redémarrage |

---

## 🎓 Workflows recommandés

### Développement quotidien
```
1. Démarrer sur dev (défaut)
2. Se connecter : auth_login
3. Travailler normalement
4. Tester en preprod : env_switch (environment: preprod)
5. Se connecter en preprod : auth_login
6. Valider les changements
7. Revenir en dev : env_switch (environment: dev)
```

### Déploiement en production
```
1. Valider en preprod
2. Changer vers prod : env_switch (environment: prod)
3. Se connecter en prod : auth_login
4. Effectuer les actions nécessaires
5. Vérifier : env_get_current
6. Revenir en dev : env_switch (environment: dev)
```

### Debug multi-environnements
```
1. Lister l'état : env_list_tokens
2. Vérifier les connexions actives
3. Changer d'environnement si nécessaire
4. Comparer les données entre environnements
```

---

## ⚠️ Bonnes pratiques

### ✅ À FAIRE
- Toujours vérifier l'environnement actif avec `env_get_current`
- Se connecter après chaque changement d'environnement
- Utiliser des comptes de test dédiés en dev/preprod
- Documenter les actions en production

### ❌ À ÉVITER
- Modifier la production sans vérification
- Oublier de se déconnecter après des tests sensibles
- Mélanger les tokens entre environnements (géré automatiquement)
- Utiliser les mêmes identifiants partout

---

## 🔐 Sécurité

### Variables d'environnement sensibles

Pour la production, utilisez des variables d'environnement système :

```bash
export PROD_API_BASE_URL="https://api.teamfitness.com"
export PROD_API_TOKEN="votre-token-secret"
```

### Fichier .env.local (non commité)

```env
# .env.local (ajouté à .gitignore)
PROD_API_BASE_URL=https://api.teamfitness.com
PROD_ADMIN_EMAIL=admin@prod.com
PROD_ADMIN_PASSWORD=secret-prod-password
```

---

## 📝 Notes

- Les tokens sont conservés en mémoire uniquement (pas de persistance)
- Au redémarrage du serveur MCP, tous les tokens sont perdus
- Les données sont complètement isolées par environnement
- Chaque environnement peut avoir des utilisateurs différents
