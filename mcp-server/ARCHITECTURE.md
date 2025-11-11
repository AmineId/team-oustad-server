# 🎨 Architecture Multi-Environnements - Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVEUR MCP TEAM FITNESS                     │
│                         Version 1.1.0                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Configuration
                              ▼
                       ┌──────────────┐
                       │  .env File   │
                       │ ACTIVE_ENV   │
                       └──────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │   DEV    │  │ PREPROD  │  │   PROD   │
        │ :3000    │  │  preprod │  │   api    │
        └──────────┘  └──────────┘  └──────────┘
             │             │             │
             │             │             │
        ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
        │ token_1 │   │ token_2 │   │ token_3 │
        │   ✅    │   │   ✅    │   │   ❌    │
        └─────────┘   └─────────┘   └─────────┘
             │             │             │
             │             │             │
        ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
        │  Data   │   │  Data   │   │  Data   │
        │   Dev   │   │ Preprod │   │  Prod   │
        └─────────┘   └─────────┘   └─────────┘
```

---

## 🔄 Flux de Travail

### 1️⃣ Démarrage Initial

```
┌─────────────┐
│   npm start │
│             │
│ ACTIVE_ENV  │
│    = dev    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Serveur MCP     │
│ Environnement:  │
│   → dev ✓       │
│     preprod     │
│     prod        │
└─────────────────┘
```

---

### 2️⃣ Changement d'Environnement

```
État Initial:           Action:              État Final:
┌─────────┐            ┌─────────────┐       ┌─────────┐
│ DEV ✓   │            │ env_switch  │       │ DEV     │
│ token_1 │    ───►    │ environment │  ───► │ token_1 │
└─────────┘            │  = preprod  │       └─────────┘
┌─────────┐            └─────────────┘       ┌─────────┐
│ PREPROD │                                   │PREPROD✓ │
│   null  │                                   │   null  │
└─────────┘                                   └─────────┘
                                              ⚠️ Reconnecter!
```

---

### 3️⃣ Authentification par Environnement

```
┌────────────────────────────────────────────────────┐
│              auth_login (dev)                      │
│  email: admin@dev.com, password: xxx               │
└────────────┬───────────────────────────────────────┘
             │
             ▼
    ┌────────────────┐
    │  API DEV       │
    │  :3000         │
    │  Authentifie   │
    └────────┬───────┘
             │
             ▼
    ┌────────────────┐
    │  token_abc123  │
    │  Stocké en DEV │
    └────────────────┘

┌────────────────────────────────────────────────────┐
│              auth_login (preprod)                  │
│  email: admin@preprod.com, password: yyy           │
└────────────┬───────────────────────────────────────┘
             │
             ▼
    ┌────────────────┐
    │  API PREPROD   │
    │  preprod-api   │
    │  Authentifie   │
    └────────┬───────┘
             │
             ▼
    ┌────────────────┐
    │  token_def456  │
    │  Stocké PREPROD│
    └────────────────┘

Résultat:
┌─────────────────────────────────┐
│ DEV     → token_abc123 ✅       │
│ PREPROD → token_def456 ✅       │
│ PROD    → null         ❌       │
└─────────────────────────────────┘
```

---

## 🎯 Outils par Catégorie

```
┌──────────────────────────────────────────────────────┐
│              ENVIRONNEMENT (3 outils)                │
├──────────────────────────────────────────────────────┤
│ env_get_current    → Quel environnement actif ?     │
│ env_switch         → Changer d'environnement        │
│ env_list_tokens    → État de tous les tokens        │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│           AUTHENTIFICATION (4 outils)                │
├──────────────────────────────────────────────────────┤
│ auth_login         → Se connecter (env actif)       │
│ auth_me            → Mon profil (env actif)         │
│ auth_forgot_pwd    → Code réinitialisation          │
│ auth_reset_pwd     → Nouveau mot de passe           │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│              SALLES DE SPORT (5 outils)              │
├──────────────────────────────────────────────────────┤
│ gyms_list          → Liste salles                   │
│ gyms_get           → Détails salle                  │
│ gyms_create        → Créer salle (owners)           │
│ gyms_update        → Modifier salle                 │
│ gyms_get_hours     → Horaires ouverture             │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│             UTILISATEURS (3 outils)                  │
├──────────────────────────────────────────────────────┤
│ users_list         → Liste utilisateurs             │
│ users_get          → Détails utilisateur            │
│ users_create       → Créer utilisateur              │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│          ABONNEMENTS & PAIEMENTS (5 outils)          │
├──────────────────────────────────────────────────────┤
│ subs_create        → Créer abonnement               │
│ subs_get           → Statut abonnement              │
│ subs_list_member   → Abonnements d'un membre        │
│ subs_types_list    → Types disponibles              │
│ payment_ack        → Acquitter paiement             │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│            PLANNINGS D'ENTRAÎNEMENT (9 outils)       │
├──────────────────────────────────────────────────────┤
│ plannings_list     → Liste plannings                │
│ plannings_member   → Plannings d'un membre          │
│ plannings_next     → Prochain entraînement          │
│ plannings_create   → Créer planning                 │
│ exercises_list     → Liste exercices                │
│ exercises_create   → Créer exercice                 │
│ planning_add_ex    → Ajouter exercice au planning   │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                ASSISTANCE (1 outil)                  │
├──────────────────────────────────────────────────────┤
│ request_help       → Demander aide au coach         │
└──────────────────────────────────────────────────────┘

                     TOTAL: 40 OUTILS
```

---

## 🔐 Matrice des Permissions

```
┌────────────────────┬─────────┬──────────┬──────────┐
│      ACTION        │  OWNER  │  ADMIN   │  MEMBER  │
├────────────────────┼─────────┼──────────┼──────────┤
│ env_switch         │    ✅   │    ✅    │    ✅    │
│ auth_login         │    ✅   │    ✅    │    ✅    │
│ gyms_create        │    ✅   │    ❌    │    ❌    │
│ gyms_update        │    ✅   │    ✅*   │    ❌    │
│ users_create       │    ✅   │    ✅*   │    ❌    │
│ subs_create        │    ✅   │    ✅*   │    ✅**  │
│ plannings_create   │    ❌   │    ✅    │    ❌    │
│ exercises_create   │    ❌   │    ✅    │    ❌    │
│ request_help       │    ❌   │    ❌    │    ✅    │
└────────────────────┴─────────┴──────────┴──────────┘

Légende:
  ✅   = Accès complet
  ✅*  = Accès limité à sa salle
  ✅** = Uniquement pour soi-même
  ❌   = Pas d'accès
```

---

## 📊 Séparation des Données

```
┌───────────────────────────────────────────────────┐
│                  ENVIRONNEMENT DEV                │
├───────────────────────────────────────────────────┤
│ Base de données: localhost:5432/teamfitness_dev  │
│ Utilisateurs:    10 comptes de test              │
│ Salles:          3 salles fictives                │
│ Abonnements:     25 abonnements actifs            │
└───────────────────────────────────────────────────┘
                        │
                        │ TOTALEMENT ISOLÉ
                        ▼
┌───────────────────────────────────────────────────┐
│              ENVIRONNEMENT PREPROD                │
├───────────────────────────────────────────────────┤
│ Base de données: preprod.db.teamfitness.com      │
│ Utilisateurs:    Copie anonymisée de la prod     │
│ Salles:          Données similaires à la prod     │
│ Abonnements:     Tests de validation              │
└───────────────────────────────────────────────────┘
                        │
                        │ TOTALEMENT ISOLÉ
                        ▼
┌───────────────────────────────────────────────────┐
│                ENVIRONNEMENT PROD                 │
├───────────────────────────────────────────────────┤
│ Base de données: prod.db.teamfitness.com         │
│ Utilisateurs:    Données réelles clients         │
│ Salles:          35 salles actives                │
│ Abonnements:     450 abonnements actifs           │
└───────────────────────────────────────────────────┘
```

---

## 🚀 Exemples d'Usage Typiques

### Développeur Full-Stack

```
Matin:
  env: dev
  → Développement nouvelles features
  → Tests unitaires
  → auth_login dev

Après-midi:
  env_switch → preprod
  → auth_login preprod
  → Validation des features
  → Tests d'intégration

Avant merge:
  env_switch → dev
  → Derniers tests
  → Commit & Push
```

### Administrateur Système

```
Déploiement:
  env: preprod
  → Validation finale
  → Tests de charge
  
  env_switch → prod
  → auth_login prod
  → Déploiement
  → Vérifications post-déploiement
  
  env_switch → dev
  → Retour en développement
```

### Support Client

```
Ticket client:
  env: prod
  → auth_login prod
  → Investigation problème
  → users_get <clientId>
  
  Si besoin de reproduire:
    env_switch → dev
    → auth_login dev
    → Reproduction du bug
```

---

## 📈 Métriques de Performance

```
┌───────────────────────────────────────────────┐
│          OPÉRATION         │    TEMPS         │
├────────────────────────────┼──────────────────┤
│ env_get_current            │    < 1ms         │
│ env_switch                 │    < 5ms         │
│ env_list_tokens            │    < 1ms         │
│ auth_login                 │    100-500ms     │
│ API call (après auth)      │    50-200ms      │
└────────────────────────────┴──────────────────┘

Mémoire utilisée par environnement:
  Token:        ~300 bytes
  Config:       ~200 bytes
  TOTAL/env:    ~500 bytes
  
  3 environnements = ~1.5 KB (négligeable)
```

---

## 🎓 Formation Rapide

### Niveau 1 : Basique (5 minutes)
```
✓ Comprendre qu'il y a 3 environnements
✓ Savoir vérifier l'environnement actif
✓ Savoir se connecter
```

### Niveau 2 : Intermédiaire (15 minutes)
```
✓ Changer d'environnement
✓ Gérer plusieurs connexions
✓ Comprendre l'isolation des données
```

### Niveau 3 : Avancé (30 minutes)
```
✓ Workflows multi-environnements
✓ Bonnes pratiques de sécurité
✓ Déploiement et validation
```

---

## 📞 Ressources

- **Guide Rapide**: [`QUICK-START-ENV.md`](./QUICK-START-ENV.md)
- **Configuration Détaillée**: [`MULTI-ENV-CONFIG.md`](./MULTI-ENV-CONFIG.md)
- **Changelog**: [`CHANGELOG-ENV.md`](./CHANGELOG-ENV.md)
- **README Principal**: [`README.md`](./README.md)
