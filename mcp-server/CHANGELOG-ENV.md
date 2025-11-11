# 📝 Changelog - Support Multi-Environnements

## Version 1.1.0 - Support Multi-Environnements

### 🎉 Nouvelles Fonctionnalités

#### 3 Nouveaux Outils MCP

1. **`env_get_current`** - Obtenir l'environnement actif
   - Retourne l'environnement actuel (dev/preprod/prod)
   - Affiche l'URL de l'API
   - Indique si l'utilisateur est authentifié
   - Liste tous les environnements disponibles

2. **`env_switch`** - Changer d'environnement
   - Permet de basculer entre dev, preprod et prod
   - Conserve les tokens de chaque environnement
   - Met à jour automatiquement l'URL de base de l'API
   - Avertit si une reconnexion est nécessaire

3. **`env_list_tokens`** - Vue d'ensemble des connexions
   - Affiche l'état de connexion pour chaque environnement
   - Montre les URLs configurées
   - Indique quel environnement est actif

#### Configuration Multi-Environnements

**Fichier `.env` enrichi** :
```env
# Choix de l'environnement au démarrage
ACTIVE_ENV=dev

# URLs séparées par environnement
DEV_API_BASE_URL=http://localhost:3000
PREPROD_API_BASE_URL=https://preprod-api.teamfitness.com
PROD_API_BASE_URL=https://api.teamfitness.com
```

#### Scripts NPM

Nouveaux scripts pour démarrer directement sur l'environnement voulu :
```json
"start:dev": "ACTIVE_ENV=dev node index.js",
"start:preprod": "ACTIVE_ENV=preprod node index.js",
"start:prod": "ACTIVE_ENV=prod node index.js"
```

#### Script Shell

`start-env.sh` pour démarrage facile :
```bash
./start-env.sh dev      # Lance en développement
./start-env.sh preprod  # Lance en préproduction
./start-env.sh prod     # Lance en production
```

---

### 🔧 Modifications Techniques

#### Gestion des Tokens par Environnement

**Avant** :
```javascript
let AUTH_TOKEN = null;  // Token global unique
```

**Après** :
```javascript
const AUTH_TOKENS = {
  dev: null,
  preprod: null,
  prod: null,
};
// Tokens isolés par environnement
```

#### Configuration Dynamique de l'API

**Avant** :
```javascript
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
```

**Après** :
```javascript
const ACTIVE_ENV = process.env.ACTIVE_ENV || 'dev';
const API_URLS = {
  dev: process.env.DEV_API_BASE_URL,
  preprod: process.env.PREPROD_API_BASE_URL,
  prod: process.env.PROD_API_BASE_URL,
};
const API_BASE_URL = API_URLS[ACTIVE_ENV];
```

#### Intercepteur Axios Amélioré

L'intercepteur utilise maintenant le token de l'environnement actif :
```javascript
apiClient.interceptors.request.use((config) => {
  const token = AUTH_TOKENS[ACTIVE_ENV] || AUTH_TOKEN;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

### 📚 Nouvelle Documentation

1. **README.md** - Mis à jour avec :
   - Section "Gestion Multi-Environnements"
   - Nouveaux exemples d'utilisation
   - Instructions de configuration pour Claude Desktop et Cline

2. **MULTI-ENV-CONFIG.md** - Guide complet :
   - 3 scénarios d'utilisation détaillés
   - Tableau comparatif
   - Workflows recommandés
   - Bonnes pratiques de sécurité

3. **QUICK-START-ENV.md** - Guide rapide :
   - Commandes essentielles
   - 3 workflows types
   - Astuces et pièges à éviter

---

### 🎯 Cas d'Usage

#### Avant cette mise à jour
```
Problème : Un seul environnement possible
→ Besoin de redémarrer pour changer d'environnement
→ Perte des tokens à chaque redémarrage
→ Risque de confusion entre les environnements
```

#### Après cette mise à jour
```
Solution : 3 environnements isolés
→ Changement dynamique sans redémarrage
→ Tokens conservés par environnement
→ Vérification facile de l'environnement actif
→ Données complètement séparées
```

---

### 🔄 Migration

#### Pour les utilisateurs existants

1. **Mettre à jour `.env`** :
   ```bash
   cd mcp-server
   cp .env.example .env
   # Éditer .env avec vos URLs
   ```

2. **Mettre à jour la configuration Claude Desktop** :
   ```json
   {
     "env": {
       "ACTIVE_ENV": "dev",
       "DEV_API_BASE_URL": "http://localhost:3000",
       "PREPROD_API_BASE_URL": "...",
       "PROD_API_BASE_URL": "..."
     }
   }
   ```

3. **Installer les dépendances** (si nouvelles) :
   ```bash
   npm install
   ```

4. **Redémarrer le serveur MCP** dans Claude Desktop

---

### ⚡ Performances

- **Pas d'impact** : Le changement d'environnement est instantané
- **Mémoire** : Les 3 tokens en mémoire (~300 bytes chacun)
- **Connexion** : Une seule connexion API active à la fois

---

### 🔐 Sécurité

#### Améliorations

1. **Isolation des tokens** : Chaque environnement a son propre token
2. **Vérification explicite** : Outils pour confirmer l'environnement actif
3. **Pas de persistance** : Tokens en mémoire uniquement (perdus au redémarrage)

#### Points d'attention

- ⚠️ Les URLs sont visibles dans `.env`
- ⚠️ Les tokens sont en mémoire (pas de chiffrement)
- ⚠️ Toujours vérifier l'environnement avant des actions sensibles

---

### 📊 Statistiques

**Avant** :
- 37 outils MCP
- 1 environnement
- Configuration simple

**Après** :
- 40 outils MCP (+3)
- 3 environnements
- Configuration avancée
- 3 nouveaux fichiers de documentation

---

### 🐛 Bugs Corrigés

Aucun bug identifié, c'est une nouvelle fonctionnalité.

---

### 🚀 Prochaines Étapes Possibles

- [ ] Support de plus de 3 environnements (configurable)
- [ ] Persistance optionnelle des tokens (fichier chiffré)
- [ ] Interface CLI interactive pour gérer les environnements
- [ ] Logs d'audit des changements d'environnement
- [ ] Alertes avant actions sensibles en production

---

### 📞 Support

Pour toute question sur cette mise à jour :
1. Consulter [`QUICK-START-ENV.md`](./QUICK-START-ENV.md)
2. Consulter [`MULTI-ENV-CONFIG.md`](./MULTI-ENV-CONFIG.md)
3. Vérifier les exemples dans [`README.md`](./README.md)

---

**Date** : 15 novembre 2025  
**Version** : 1.1.0  
**Auteur** : Team Fitness Development Team
