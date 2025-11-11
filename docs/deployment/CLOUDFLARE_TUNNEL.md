# Cloudflare Tunnel - Configuration

## 📋 Présentation

Ce document explique comment utiliser Cloudflare Tunnel pour exposer votre serveur local et tester l'API depuis un appareil physique (téléphone, tablette).

## 🚀 Démarrage rapide

### 1. S'assurer que le serveur tourne

```bash
# Démarrer le serveur en mode développement
nodemon index.js
```

Le serveur devrait tourner sur `http://localhost:3000`

### 2. Démarrer le tunnel Cloudflare

**Option A - Via le script:**
```bash
./start-tunnel.sh
```

**Option B - Commande directe:**
```bash
cloudflared tunnel --url http://localhost:3000
```

### 3. Récupérer l'URL publique

Une fois le tunnel démarré, vous verrez quelque chose comme:

```
2024-11-11T20:00:00Z INF +--------------------------------------------------------------------------------------------+
2024-11-11T20:00:00Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
2024-11-11T20:00:00Z INF |  https://random-words-123.trycloudflare.com                                               |
2024-11-11T20:00:00Z INF +--------------------------------------------------------------------------------------------+
```

**Copiez cette URL** (ex: `https://random-words-123.trycloudflare.com`)

## 📱 Tester depuis votre appareil physique

### Configuration de l'application Flutter

Remplacez l'URL de base dans votre app Flutter:

```dart
// Avant (localhost)
final baseUrl = 'http://10.0.2.2:3000/api';

// Après (tunnel Cloudflare)
final baseUrl = 'https://random-words-123.trycloudflare.com/api';
```

### Endpoints disponibles

Tous les endpoints fonctionnent normalement via le tunnel:

- **Documentation API:** `https://votre-tunnel.trycloudflare.com/api-docs`
- **Health check:** `https://votre-tunnel.trycloudflare.com/health`
- **Auth:** `https://votre-tunnel.trycloudflare.com/api/auth/*`
- **Users:** `https://votre-tunnel.trycloudflare.com/api/users/*`
- **Subscriptions:** `https://votre-tunnel.trycloudflare.com/api/subscriptions/*`
- etc.

## 🧪 Tests rapides

### Test 1: Health check
```bash
curl https://votre-tunnel.trycloudflare.com/health
```

Devrait retourner:
```json
{
  "status": "ok",
  "timestamp": "2024-11-11T20:00:00.000Z",
  "database": "connected"
}
```

### Test 2: Login depuis Postman/Insomnia

```bash
POST https://votre-tunnel.trycloudflare.com/api/auth/login
Content-Type: application/json

{
  "uniqueCode": "OWNER-001",
  "password": "password123"
}
```

### Test 3: Depuis votre téléphone

1. Ouvrez votre navigateur mobile
2. Visitez `https://votre-tunnel.trycloudflare.com/api-docs`
3. Vous devriez voir la documentation Swagger

## ⚠️ Considérations importantes

### Sécurité

- ✅ **Les tunnels temporaires sont gratuits** et ne nécessitent pas de compte Cloudflare
- ⚠️ **L'URL est publique** - n'importe qui avec l'URL peut accéder à votre serveur
- ⚠️ **Ne partagez pas l'URL publiquement**
- ⚠️ **Arrêtez le tunnel après les tests**
- ✅ **Utilisez l'authentification JWT** comme protection

### Performance

- ✅ Latence acceptable pour les tests (<100ms en général)
- ⚠️ Le tunnel peut parfois être instable
- ✅ Parfait pour le développement et les tests
- ❌ Ne pas utiliser en production

### Limitations

- L'URL change à chaque redémarrage du tunnel
- Limite de bande passante (suffisante pour les tests)
- Le tunnel se ferme si vous quittez le terminal

## 🔄 Workflow de développement recommandé

### Scénario 1: Tests locaux (émulateur)
```bash
# Démarrer uniquement le serveur
nodemon index.js

# L'émulateur accède via http://10.0.2.2:3000
```

### Scénario 2: Tests sur appareil physique
```bash
# Terminal 1: Démarrer le serveur
nodemon index.js

# Terminal 2: Démarrer le tunnel
./start-tunnel.sh

# Configurer l'app Flutter avec l'URL du tunnel
# Tester depuis votre téléphone
```

## 🛑 Arrêter le tunnel

Dans le terminal où le tunnel tourne:
```bash
Ctrl + C
```

Le serveur local continuera de fonctionner.

## 📊 Monitoring

Pendant que le tunnel est actif, vous verrez:

```
2024-11-11T20:01:23Z INF Request: GET /health
2024-11-11T20:01:25Z INF Request: POST /api/auth/login
2024-11-11T20:01:28Z INF Request: GET /api/users/14
```

Ces logs s'ajoutent aux logs de votre serveur Express.

## 🔧 Alternative: Tunnel persistant

Si vous voulez une URL stable qui ne change pas:

1. Créer un compte Cloudflare gratuit
2. Installer et configurer `cloudflared`
3. Créer un tunnel nommé

```bash
# Login (une seule fois)
cloudflared tunnel login

# Créer un tunnel nommé
cloudflared tunnel create team-fitness-dev

# Configurer le tunnel avec un sous-domaine
# Plus d'infos: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
```

**Mais pour les tests rapides, le tunnel temporaire suffit largement!**

## 📝 Notes

- Cloudflared installé le: 11 novembre 2024
- Version: 2025.11.1
- Port exposé: 3000
- Protocole: HTTP (Cloudflare gère le HTTPS)

## 🆘 Troubleshooting

### Le tunnel ne démarre pas
```bash
# Vérifier que cloudflared est installé
which cloudflared

# Réinstaller si nécessaire
curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i /tmp/cloudflared.deb
```

### Le serveur n'est pas accessible via le tunnel
```bash
# Vérifier que le serveur tourne
curl http://localhost:3000/health

# Vérifier que le tunnel pointe vers le bon port
# Le tunnel doit utiliser --url http://localhost:3000
```

### L'URL du tunnel ne fonctionne pas
- Attendez 10-30 secondes après le démarrage du tunnel
- L'URL prend un peu de temps à être propagée sur le réseau Cloudflare

### Erreur CORS depuis l'app mobile
Votre serveur doit permettre les requêtes CORS. Vérifiez dans `index.js`:

```javascript
// Si nécessaire, ajouter:
const cors = require('cors');
app.use(cors());
```

## 🎯 Résumé

Pour tester depuis votre téléphone:

1. ✅ Démarrer le serveur: `nodemon index.js`
2. ✅ Démarrer le tunnel: `./start-tunnel.sh`
3. ✅ Copier l'URL `https://xxx.trycloudflare.com`
4. ✅ Configurer l'app Flutter avec cette URL
5. ✅ Tester normalement
6. ✅ Arrêter le tunnel (Ctrl+C) quand vous avez fini
