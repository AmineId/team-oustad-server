# Team Fitness Server - Contexte Projet

## 📋 Informations Générales

| Élément | Valeur |
|---------|--------|
| **Nom du projet** | Team Fitness Server |
| **Repository** | TeamFitness/db-server |
| **Branche principale** | `feat/db-server-initial` |
| **Branche par défaut** | `main` |
| **Framework** | Node.js + Express |
| **ORM** | Prisma |
| **Base de données** | PostgreSQL |
| **Process Manager** | PM2 |

---

## 🏗️ Architecture

### Structure des dossiers
```
team_fitness_server/
├── index.js                 # Point d'entrée Express
├── prisma/
│   ├── schema.prisma        # Schéma Prisma (source de vérité)
│   ├── seed.js              # Seed principal
│   └── migrations/
│       └── 0_baseline/      # Migration consolidée unique
├── routes/                  # Routes API
│   ├── auth.js
│   ├── banners.js
│   ├── checkIn.js
│   ├── gyms.js
│   ├── members.js
│   ├── plannings.js
│   ├── store.js
│   ├── subscriptions.js
│   └── users.js
├── services/                # Logique métier
│   ├── bannerService.js
│   ├── checkInService.js
│   ├── emailService.js
│   └── ...
├── middleware/
│   ├── auth.js
│   ├── bannerAuth.js
│   └── rateLimiter.js
├── scripts/
│   ├── deploy.sh            # Script de déploiement
│   ├── init-server.sh       # Initialisation nouveau serveur
│   └── seed-subscription-quotas.js
└── config/
    └── docker-compose.yml
```

---

## 🗄️ Modèles de données (Prisma)

### Tables principales
| Table | Description |
|-------|-------------|
| `User` | Utilisateurs (owner, admin, member) |
| `Member` | Profil membre (lié à User) |
| `Gym` | Salles de sport |
| `Subscription` | Abonnements des membres |
| `SubscriptionType` | Types d'abonnement (quotas, durée) |
| `Payment` | Paiements |
| `Planning` | Programmes d'entraînement |
| `Exercise` | Exercices |
| `GymCheckIn` | Check-ins des membres |

### Tables bannières/événements
| Table | Description |
|-------|-------------|
| `Banner` | Bannières/événements |
| `BannerVariant` | Variantes A/B testing |
| `BannerStats` | Statistiques (views, clicks) |

### Tables boutique
| Table | Description |
|-------|-------------|
| `StoreProduct` | Produits en vente |
| `StoreReservation` | Réservations de produits |

### Colonnes importantes User
- `firstName`, `lastName` (pas `fullName`)
- `displayId` (ID public)
- `uniqueCode` (code unique)
- `fcmToken` (notifications push)
- `gymId` (salle associée)

### Colonnes importantes Banner
- `title`, `titleEn`, `titleAr` (multilingue)
- `description`, `descriptionEn`, `descriptionAr`
- `imageBase64` (image en base64)
- `eventType` dans BannerStats (view, click)

---

## 🔧 Configuration

### Variables d'environnement
```bash
# .env.preprod
DATABASE_URL="postgresql://admin:admin@localhost:5433/fitness_preprod?schema=public"
JWT_SECRET="..."
PORT=3000
NODE_ENV=preprod
```

### Trust Proxy
Le serveur est configuré avec `app.set('trust proxy', 1)` pour fonctionner derrière nginx.

---

## 🚀 Déploiement

### Nouveau serveur
```bash
git clone <repo>
cd db-server
./scripts/init-server.sh
```

### Mise à jour
```bash
git pull origin feat/db-server-initial
./scripts/deploy.sh --fresh --seed
```

### Options deploy.sh
| Option | Description |
|--------|-------------|
| `--fresh` | Reset complet de la base |
| `--seed` | Exécute les seeds |
| `--prod` | Mode production (confirmation) |
| `--env FILE` | Fichier env à utiliser |

---

## 🌱 Seeds

### Comptes par défaut (seed.js)
| Role | Email | Password |
|------|-------|----------|
| Owner | owner@teamfitness.com | owner123 |
| Admin | admin@teamfitness.com | admin123 |
| Member | bob@example.com | member123 |

### Types d'abonnement (seed-subscription-quotas.js)
- 12 Séances (150 MAD)
- 18 Séances (200 MAD)
- 36 Séances (350 MAD)
- Illimité mensuel
- Illimité annuel

---

## ⚠️ Points d'attention

### Migrations consolidées
- **Une seule migration** : `0_baseline`
- Générée avec `prisma migrate diff --from-empty --to-schema-datamodel`
- Contient le schéma complet

### Foreign Keys importantes
- `Member.userId` → `User.id` (pas `Member.id`)
- `GymCheckIn.memberId` → `Member.userId`
- `StoreReservation.memberId` → `Member.userId`

### Colonnes multilingues (Banner)
```
title (fr par défaut)
titleEn (anglais)
titleAr (arabe)
```

---

## 📝 Commandes utiles

```bash
# Prisma
npx prisma generate          # Générer le client
npx prisma studio            # Interface visuelle
npx prisma migrate status    # Statut des migrations
npx prisma migrate reset --force  # Reset complet

# PM2
pm2 logs                     # Voir les logs
pm2 restart teamfitness-preprod
pm2 status

# PostgreSQL
psql -U admin -h localhost -p 5433 -d fitness_preprod
```

---

## 🔄 Historique des corrections (Décembre 2025)

1. **Migration `Member.id` → `Member.userId`** : La table Member utilise `userId` comme PK
2. **Banner JSONB → colonnes séparées** : `titleEn`, `titleAr`, `imageBase64`, etc.
3. **BannerStats eventType** : Ajout de la colonne `eventType`
4. **StoreProduct/StoreReservation** : Tables ajoutées à la baseline
5. **Trust proxy** : Activé pour nginx
6. **Consolidation migrations** : 36 → 1 baseline

---

## 📱 Endpoints principaux

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /auth/login | Connexion |
| GET | /members | Liste des membres |
| GET | /gyms | Liste des salles |
| GET | /banners | Bannières actives |
| POST | /banners/:id/click | Tracker un clic |
| GET | /store/products | Produits boutique |
| POST | /checkin | Enregistrer un check-in |
| GET | /subscriptions | Abonnements |

---

## 🔮 Prochaines étapes suggérées

1. [ ] Merge sur `main` après validation
2. [ ] Configuration du pipeline CI/CD
3. [ ] Tests automatisés
4. [ ] Documentation API Swagger complète
5. [ ] Monitoring et alertes

---

*Dernière mise à jour : 1er janvier 2026*
