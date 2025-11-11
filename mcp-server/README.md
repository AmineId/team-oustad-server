# Team Fitness MCP Server

Serveur MCP (Model Context Protocol) pour l'API Team Fitness. Ce serveur expose toutes les fonctionnalités de gestion de salles de sport via le protocole MCP, permettant aux assistants IA d'interagir avec l'API de manière structurée.

## 🎯 Fonctionnalités

Le serveur MCP expose **40 outils** pour interagir avec Team Fitness :

### 🌍 Gestion des Environnements (3 outils)
- `env_get_current` - Obtenir l'environnement actif
- `env_switch` - Changer d'environnement (dev/preprod/prod)
- `env_list_tokens` - Voir l'état de connexion par environnement

### 🔐 Authentification (4 outils)
- `auth_login` - Se connecter et obtenir un token
- `auth_me` - Obtenir le profil de l'utilisateur connecté
- `auth_forgot_password` - Demander un code de réinitialisation
- `auth_reset_password` - Réinitialiser le mot de passe

### 🏢 Gestion des Salles (5 outils)
- `gyms_list` - Lister les salles accessibles
- `gyms_get` - Détails d'une salle
- `gyms_create` - Créer une salle (owners)
- `gyms_update` - Modifier une salle
- `gyms_get_opening_hours` - Horaires d'ouverture

### 👥 Gestion des Utilisateurs (3 outils)
- `users_list` - Lister les utilisateurs
- `users_get` - Détails d'un utilisateur
- `users_create` - Créer un utilisateur

### 💳 Abonnements et Paiements (5 outils)
- `subscriptions_create` - Créer un abonnement
- `subscriptions_get` - Statut d'un abonnement
- `subscriptions_list_member` - Tous les abonnements d'un membre
- `subscriptions_types_list` - Types d'abonnements disponibles
- `payment_acknowledge` - Acquitter un paiement

### 📅 Plannings d'Entraînement (9 outils)
- `plannings_list` - Lister les plannings
- `plannings_get_member` - Tous les plannings d'un membre
- `plannings_get_next_day` - Prochain entraînement
- `plannings_create` - Créer un planning
- `exercises_list` - Lister les exercices
- `exercises_create` - Créer un exercice
- `plannings_add_exercise` - Ajouter un exercice à un planning

### 🆘 Assistance (1 outil)
- `request_help` - Demander de l'aide au coach

## 📦 Installation

### 1. Prérequis

- Node.js 18+
- API Team Fitness en cours d'exécution

### 2. Installation des dépendances

```bash
cd mcp-server
npm install
```

### 3. Configuration

Créer un fichier `.env` :

```bash
cp .env.example .env
```

Modifier le fichier `.env` avec les URLs de vos environnements :

```env
# Environnement actif au démarrage
ACTIVE_ENV=dev

# URLs des différents environnements
DEV_API_BASE_URL=http://localhost:3000
PREPROD_API_BASE_URL=https://preprod-api.teamfitness.com
PROD_API_BASE_URL=https://api.teamfitness.com
```

## 🚀 Utilisation

### Lancement du serveur

**Démarrage simple (environnement par défaut)** :
```bash
npm start
```

**Démarrage avec un environnement spécifique** :
```bash
# Développement
npm run start:dev

# Préproduction
npm run start:preprod

# Production
npm run start:prod
```

**Ou avec le script shell** :
```bash
./start-env.sh dev      # Développement
./start-env.sh preprod  # Préproduction
./start-env.sh prod     # Production
```

### Configuration dans Claude Desktop

Ajouter dans `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) ou `%APPDATA%\Claude\claude_desktop_config.json` (Windows) :

```json
{
  "mcpServers": {
    "teamfitness": {
      "command": "node",
      "args": [
        "/chemin/absolu/vers/team_fitness_server/mcp-server/index.js"
      ],
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

**Important** : 
- Remplacez `/chemin/absolu/vers/` par le chemin réel vers votre projet
- Modifiez `ACTIVE_ENV` pour choisir l'environnement par défaut (dev, preprod, prod)
- Vous pouvez changer d'environnement dynamiquement avec l'outil `env_switch`

### Configuration dans Cline (VS Code)

Dans les paramètres de Cline, ajouter le serveur MCP :

```json
{
  "mcpServers": {
    "teamfitness": {
      "command": "node",
      "args": [
        "/chemin/absolu/vers/team_fitness_server/mcp-server/index.js"
      ],
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

## 📖 Exemples d'utilisation

### 1. Vérifier l'environnement actif

```
Utilise l'outil env_get_current
```

### 2. Changer d'environnement

```
Utilise l'outil env_switch avec :
- environment: preprod
```

### 3. Se connecter

```
Utilise l'outil auth_login avec :
- email: admin@teamfitness.com
- password: admin123
```

**Note** : Chaque environnement a son propre token. Si vous changez d'environnement, vous devez vous reconnecter.

### 4. Lister les salles de sport

```
Utilise l'outil gyms_list
```

### 5. Créer un abonnement

```
Utilise l'outil subscriptions_create avec :
- memberId: 2
- subscriptionTypeId: 1
- paymentFrequency: 12 (mensuel)
```

### 6. Obtenir le prochain entraînement d'un membre

```
Utilise l'outil plannings_get_next_day avec :
- memberId: 2
```

### 7. Créer un planning d'entraînement

```
Utilise l'outil plannings_create avec :
- memberId: 2
- title: "Programme Force"
- startDate: "2025-11-15"
- endDate: "2025-12-15"
```

## 🌍 Gestion Multi-Environnements

Le serveur MCP supporte **3 environnements isolés** :

- **dev** : Développement local (`http://localhost:3000`)
- **preprod** : Préproduction (`https://preprod-api.teamfitness.com`)
- **prod** : Production (`https://api.teamfitness.com`)

### Workflow multi-environnements

1. **Vérifier l'environnement actif** : `env_get_current`
2. **Changer d'environnement** : `env_switch` avec `environment: preprod`
3. **Se connecter** : `auth_login` (token stocké par environnement)
4. **Travailler** sur cet environnement
5. **Changer à nouveau** si besoin (les tokens sont conservés)

### Points importants

- ✅ Chaque environnement a **son propre token**
- ✅ Les tokens sont **conservés** lors du changement d'environnement
- ✅ Pas besoin de se reconnecter si vous revenez à un environnement
- ✅ Les données sont **totalement séparées** par environnement

## 🔒 Authentification

La plupart des outils nécessitent une authentification. Le workflow typique est :

1. **Vérifier l'environnement** avec `env_get_current`
2. **Se connecter** avec `auth_login` → reçoit un token JWT
3. Le token est **automatiquement stocké** pour cet environnement
4. Les appels suivants **utilisent automatiquement** ce token
5. Utiliser `auth_me` pour vérifier la connexion
6. Changer d'environnement avec `env_switch` si nécessaire

## 🎭 Permissions

Les outils respectent les permissions de l'API :

- **Owners** : Accès complet à toutes les salles et fonctionnalités
- **Admins (Coaches)** : Accès à leur salle et ses membres
- **Members** : Accès à leurs propres données uniquement

## 🛠️ Développement

### Structure du projet

```
mcp-server/
├── index.js           # Serveur MCP principal
├── package.json       # Dépendances et scripts
├── .env              # Configuration (ne pas commiter)
├── .env.example      # Template de configuration
└── README.md         # Cette documentation
```

### Logs de débogage

Les logs du serveur MCP sont écrits sur `stderr` :

```bash
npm start 2> mcp-server.log
```

### Ajouter un nouvel outil

1. Ajouter la définition dans `TOOLS`
2. Ajouter le gestionnaire dans `handleToolCall`
3. Tester avec un client MCP

## 🔧 Dépannage

### Le serveur ne démarre pas

- Vérifier que Node.js 18+ est installé : `node --version`
- Vérifier que les dépendances sont installées : `npm install`
- Vérifier le fichier `.env`

### Erreur d'authentification

- Se connecter d'abord avec `auth_login`
- Vérifier que l'API est accessible
- Vérifier les identifiants

### Erreur de connexion à l'API

- Vérifier que l'API Team Fitness est démarrée
- Vérifier l'URL dans `.env`
- Vérifier les logs de l'API

### Erreur dans Claude Desktop

- Vérifier le chemin absolu dans `claude_desktop_config.json`
- Redémarrer Claude Desktop
- Vérifier les logs : Menu Developer → Show Logs

## 📚 Documentation

### Documentation API
- Swagger UI : `http://localhost:3000/api-docs` (dev)
- Documentation principale : `../docs/`

### Documentation Multi-Environnements
- **Guide complet** : [`MULTI-ENV-CONFIG.md`](./MULTI-ENV-CONFIG.md)
- Scénarios d'utilisation détaillés
- Workflows recommandés
- Bonnes pratiques de sécurité

## 🤝 Contribution

Pour ajouter de nouvelles fonctionnalités :

1. Identifier les nouveaux endpoints dans l'API
2. Définir les outils dans `TOOLS`
3. Implémenter les gestionnaires dans `handleToolCall`
4. Mettre à jour cette documentation

## 📝 License

Même licence que le projet Team Fitness principal.

## 🔗 Liens utiles

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Claude Desktop](https://claude.ai/download)
- [Cline VS Code Extension](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev)

## 📞 Support

Pour toute question ou problème :
1. Consulter les logs du serveur MCP
2. Consulter les logs de l'API Team Fitness
3. Vérifier la documentation Swagger
4. Ouvrir une issue sur le dépôt du projet
