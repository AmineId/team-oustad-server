# Documentation du Seed de la Base de Données

## Vue d'ensemble

Le seed de la base de données crée un jeu de données complet avec **tous les cas possibles** pour tester l'application Team Fitness. Il couvre tous les scénarios d'abonnements, de paiements, d'utilisateurs et de plannings.

## Exécution du Seed

```bash
npm run db:seed
```

## Données Créées

### 📊 Statistiques Globales

- **13 utilisateurs** (1 owner, 2 admins, 10 members)
- **2 salles de sport** (Downtown Fitness Center, Uptown Elite Gym)
- **9 types d'abonnements** (8 actifs, 1 inactif)
- **10 abonnements** (7 actifs, 1 pausé, 1 expiré, 1 annulé)
- **123 paiements** (32 complétés, 77 en attente, 1 en retard, 2 échoués, 11 remboursés)
- **16 exercices** (force, cardio, flexibilité, équilibre, fonctionnel)
- **3 plannings d'entraînement** complets

---

## 🏋️ Salles de Sport

### 1. Downtown Fitness Center
- **Adresse**: 123 Main Street, New York, NY 10001
- **Téléphone**: +1 (555) 123-4567
- **Horaires**: 
  - Lundi-Samedi: 06:00-22:00
  - Dimanche: 09:00-18:00
- **Utilisateurs**: 5 (1 owner, 1 admin, 8 members)

### 2. Uptown Elite Gym
- **Adresse**: 456 Park Avenue, New York, NY 10022
- **Téléphone**: +1 (555) 987-6543
- **Horaires**:
  - Lundi-Vendredi: 05:00-23:00
  - Weekend: 08:00-20:00
- **Utilisateurs**: 3 (1 admin, 2 members)

---

## 👥 Utilisateurs

### Owner

| Email | Mot de passe | Nom | Rôle | Salle |
|-------|--------------|-----|------|-------|
| owner@teamfitness.com | owner123 | Sarah Johnson | owner | Gym 1 |

**Permissions**: Gestion complète (admins, salles, rapports, types d'abonnements)

### Admins

| Email | Mot de passe | Nom | Rôle | Salle |
|-------|--------------|-----|------|-------|
| admin@teamfitness.com | admin123 | Mike Anderson | admin | Gym 1 |
| admin2@teamfitness.com | admin123 | Lisa Martinez | admin | Gym 2 |

**Permissions**: Gestion membres, abonnements, paiements de leur salle

### Members

| Email | Mot de passe | Nom | Abonnement | Statut | Salle |
|-------|--------------|-----|------------|--------|-------|
| bob@example.com | member123 | Bob Williams | Premium | Actif (2 mois) | Gym 1 |
| charlie@example.com | member123 | Charlie Brown | Basic | Actif (10 jours) | Gym 1 |
| alice@example.com | member123 | Alice Smith | VIP | Actif (6 mois) | Gym 1 |
| david@example.com | member123 | David Johnson | Standard | Actif (20 jours) | Gym 2 |
| emma@example.com | member123 | Emma Davis | Corporate | **Pausé** (retard) | Gym 2 |
| frank@example.com | member123 | Frank Martin | Étudiant | Actif (5 jours) | Gym 1 |
| grace@example.com | member123 | Grace Lee | Découverte | Actif (2 jours) | Gym 2 |
| henry@example.com | member123 | Henry Wilson | Senior | **Expiré** | Gym 1 |
| iris@example.com | member123 | Iris Thompson | Basic | **Annulé** | Gym 2 |
| jack@example.com | member123 | Jack Brown | Bronze (ancien) | Actif (4 mois) | Gym 1 |

---

## 🏷️ Types d'Abonnements

### Types Actifs

| ID | Nom | Prix/mois | Fonctionnalités | Abonnements |
|----|-----|-----------|-----------------|-------------|
| 1 | Basic | 29.99€ | Accès salle, Vestiaires, Casiers | 2 |
| 2 | Standard | 49.99€ | Basic + Cours collectifs, Douches, Wi-Fi | 1 |
| 3 | Premium | 79.99€ | Standard + Coach (2/mois), Planning perso, Bilan nutrition | 1 |
| 4 | VIP | 129.99€ | Premium + 24/7, Coach dédié, Spa, Massage, Salle privée, Parking | 1 |
| 5 | Étudiant | 24.99€ | Accès journée, Vestiaires, Cours limités (justificatif requis) | 1 |
| 6 | Senior | 34.99€ | Accès adapté, Cours seniors, Suivi médical | 1 |
| 7 | Corporate | 89.99€ | 24/7, Cours, Coaching, Facturation entreprise, Tarif groupe | 1 |
| 8 | Découverte | 19.99€ | Essai 1 mois, Séance découverte, Sans engagement | 1 |

### Type Inactif

| ID | Nom | Prix/mois | Statut | Note |
|----|-----|-----------|--------|------|
| 9 | Bronze (Ancien) | 39.99€ | ❌ Inactif | Abonnements existants maintenus (Jack) |

---

## 💳 Abonnements Détaillés

### 1. Bob Williams - Premium (Actif)
- **Type**: Premium (79.99€/mois)
- **Durée**: Démarré il y a 2 mois
- **Fin**: Dans 10 mois
- **Auto-renouvellement**: Oui
- **Paiements**: 12 mensuels générés
  - ✅ Mois 1: Complété (carte)
  - ✅ Mois 2: Complété (carte)
  - ⏳ Mois 3: En attente (dû dans quelques jours)
  - ⏳ Mois 4-12: Futurs
- **Extras**: 1 paiement one-time (35€ - séance nutrition)

### 2. Charlie Brown - Basic (Actif)
- **Type**: Basic (29.99€/mois)
- **Durée**: Démarré il y a 10 jours
- **Fin**: Dans ~11 mois
- **Auto-renouvellement**: Oui
- **Paiements**: 12 mensuels générés
  - ✅ Mois 1: Complété (PayPal)
  - ⏳ Mois 2-12: En attente/Futurs

### 3. Alice Smith - VIP (Actif)
- **Type**: VIP (129.99€/mois)
- **Durée**: Démarré il y a 6 mois
- **Fin**: Dans 6 mois
- **Auto-renouvellement**: Oui
- **Paiements**: 12 mensuels générés
  - ✅ Mois 1-6: Tous complétés (carte)
  - ⏳ Mois 7-12: En attente/Futurs
- **Extras**: 1 paiement one-time (50€ - massage supplémentaire)

### 4. David Johnson - Standard (Actif)
- **Type**: Standard (49.99€/mois)
- **Durée**: Démarré il y a 20 jours
- **Fin**: Dans ~11 mois
- **Auto-renouvellement**: Non
- **Paiements**: 12 mensuels générés
  - ✅ Mois 1: Complété (virement bancaire)
  - ⏳ Mois 2-12: En attente/Futurs
- **Extras**: 1 paiement one-time (15€ - boisson énergétique, cash)

### 5. Emma Davis - Corporate (⚠️ PAUSÉ)
- **Type**: Corporate (89.99€/mois)
- **Durée**: Démarré il y a 3 mois
- **Fin**: Dans 9 mois (si réactivé)
- **Auto-renouvellement**: Non
- **Statut**: **PAUSÉ** (paiement en retard > 7 jours)
- **Paiements**: 12 mensuels générés
  - ✅ Mois 1-3: Complétés (PayPal)
  - 🔴 Mois 4: **EN RETARD** (cause de la pause)
  - ⏳ Mois 5-12: En attente (suspension)

> **Cas de test**: Système de pause automatique quand paiement > 7 jours de retard

### 6. Frank Martin - Étudiant (Actif)
- **Type**: Étudiant (24.99€/mois)
- **Durée**: Démarré il y a 5 jours
- **Fin**: Dans ~12 mois
- **Auto-renouvellement**: Oui
- **Paiements**: 12 mensuels générés
  - ✅ Mois 1: Complété (carte)
  - ⏳ Mois 2-12: En attente/Futurs

### 7. Grace Lee - Découverte (Actif)
- **Type**: Découverte (19.99€/mois)
- **Durée**: Démarré il y a 2 jours
- **Fin**: Dans ~12 mois
- **Auto-renouvellement**: Non
- **Paiements**: 12 mensuels générés
  - ⏳ Tous en attente (très récent)

> **Cas de test**: Nouvel abonnement sans paiements complétés

### 8. Henry Wilson - Senior (❌ EXPIRÉ)
- **Type**: Senior (34.99€/mois)
- **Durée**: Commencé il y a 2 ans
- **Fin**: Expiré il y a 1 an
- **Auto-renouvellement**: Non
- **Statut**: **EXPIRÉ**
- **Paiements**: 12 mensuels générés
  - ✅ Mois 1-10: Complétés (carte)
  - ❌ Mois 11-12: Échecs (cause de l'expiration)

> **Cas de test**: Abonnement complètement expiré avec historique

### 9. Iris Thompson - Basic (🚫 ANNULÉ)
- **Type**: Basic (29.99€/mois)
- **Durée**: Commencé il y a 1 mois
- **Fin**: Annulé
- **Auto-renouvellement**: Non
- **Statut**: **ANNULÉ**
- **Paiements**: 12 mensuels générés
  - ✅ Mois 1: Complété puis remboursé (carte)
  - 💸 Mois 2-12: Remboursés (annulation)

> **Cas de test**: Annulation avec remboursement de tous les paiements futurs

### 10. Jack Brown - Bronze/Ancien (Actif avec type inactif)
- **Type**: Bronze (39.99€/mois) - **Type INACTIF**
- **Durée**: Démarré il y a 4 mois
- **Fin**: Dans 8 mois
- **Auto-renouvellement**: Non
- **Paiements**: 12 mensuels générés
  - ✅ Mois 1-4: Complétés (carte)
  - ⏳ Mois 5-12: En attente/Futurs

> **Cas de test**: Abonnement actif sur un type désactivé (grandfathering)

---

## 💪 Exercices (16 au total)

### Force (5)
1. **Push-ups** (débutant) - Poids du corps
2. **Squats** (débutant) - Poids du corps
3. **Barbell Bench Press** (intermédiaire) - Barre + Banc
4. **Deadlift** (avancé) - Barre
5. **Pull-ups** (intermédiaire) - Barre de traction

### Cardio (4)
6. **Running (Treadmill)** (débutant) - Tapis de course
7. **Burpees** (avancé) - Poids du corps
8. **Cycling (Stationary Bike)** (débutant) - Vélo stationnaire
9. **Jump Rope** (intermédiaire) - Corde à sauter

### Flexibilité (2)
10. **Yoga Sun Salutation** (débutant) - Tapis yoga
11. **Static Hamstring Stretch** (débutant) - Aucun

### Équilibre (2)
12. **Single Leg Balance** (débutant) - Aucun
13. **Bosu Ball Squats** (avancé) - Bosu ball

### Fonctionnel (3)
14. **Kettlebell Swings** (intermédiaire) - Kettlebell
15. **Battle Ropes** (intermédiaire) - Battle ropes
16. **Box Jumps** (avancé) - Plyo box

---

## 📅 Plannings d'Entraînement (3 complets)

### 1. Bob Williams - "Programme Force et Masse - 12 Semaines"
**Durée**: 12 semaines (démarré il y a 2 semaines)  
**Objectif**: Développement force et masse musculaire  
**Fréquence**: 4 séances/semaine

**Structure**:
- **Lundi (Push)**: Bench Press (4×8 @ 80kg), Push-ups (3×15)
- **Mercredi (Legs)**: Squats (5×5 @ 100kg), Deadlift (3×8 @ 120kg)
- **Vendredi (Pull)**: Pull-ups (4×10), Deadlift (4×6 @ 110kg)

### 2. Alice Smith - "Programme Cardio-Training et Tonification"
**Durée**: 12 semaines (démarré il y a 1 semaine)  
**Objectif**: Brûlage graisses + tonification  
**Fréquence**: 5 séances/semaine

**Structure**:
- **Lundi (Cardio)**: Running 30min, Burpees (4×10 HIIT)
- **Mercredi (Renfo)**: Squats (4×15 @ 40kg), Push-ups (3×12)
- **Vendredi (Cardio Mix)**: Cycling 45min, Jump Rope (3×5min)

### 3. Charlie Brown - "Programme Débutant - Initiation Fitness"
**Durée**: 8 semaines (démarré il y a 3 jours)  
**Objectif**: Apprentissage bases + technique  
**Fréquence**: 3 séances/semaine

**Structure**:
- **Lundi**: Squats poids du corps (3×10), Push-ups genoux (3×8)
- **Mercredi**: Cycling 20min résistance faible
- **Vendredi**: Running 15min vitesse confortable

---

## 🧪 Cas de Test Couverts

### Types d'Abonnements
- ✅ **8 types actifs** différents avec prix variés (19.99€ à 129.99€)
- ✅ **1 type inactif** avec abonnement existant toujours actif
- ✅ Types avec fonctionnalités multiples (tableaux de features)

### Statuts d'Abonnements
- ✅ **Actif** (7 cas): Bob, Charlie, Alice, David, Frank, Grace, Jack
- ✅ **Pausé** (1 cas): Emma (paiement en retard > 7 jours)
- ✅ **Expiré** (1 cas): Henry (abonnement terminé il y a 1 an)
- ✅ **Annulé** (1 cas): Iris (avec remboursements)

### Durées d'Abonnements
- ✅ Très récent (2 jours): Grace
- ✅ Récent (5-10 jours): Frank, Charlie
- ✅ Moyen terme (20 jours - 2 mois): David, Bob
- ✅ Long terme (3-6 mois): Emma, Alice, Jack
- ✅ Expiré (1 an): Henry

### Statuts de Paiements
- ✅ **Complété** (32): Paiements réussis avec transaction ID
- ✅ **En attente** (77): Paiements futurs non encore dus
- ✅ **En retard** (1): Emma mois 4 (> 7 jours, cause pause)
- ✅ **Échoué** (2): Henry mois 11-12 (cause expiration)
- ✅ **Remboursé** (11): Iris mois 2-12 (annulation)

### Méthodes de Paiement
- ✅ **Carte bancaire**: Bob, Alice, Charlie, Frank, Henry, Jack
- ✅ **PayPal**: Emma
- ✅ **Virement bancaire**: David
- ✅ **Cash**: David (one-time)

### Types de Paiements
- ✅ **Subscription** (121): Paiements mensuels automatiques
- ✅ **One-time** (2): Bob (nutrition 35€), Alice (massage 50€), David (boisson 15€)

### Auto-renouvellement
- ✅ **Activé** (5): Bob, Charlie, Alice, Frank
- ✅ **Désactivé** (5): David, Emma, Grace, Henry, Iris, Jack

### Système de Paiements Mensuels (12 mois)
- ✅ Tous les abonnements ont **12 paiements mensuels** générés
- ✅ Paiements avec `monthNumber` (1-12)
- ✅ Dates d'échéance (`dueDate`) calculées automatiquement
- ✅ Progression visible selon l'ancienneté

### Scénarios Spéciaux
- ✅ **Grandfathering**: Jack utilise un type inactif (Bronze)
- ✅ **Pause automatique**: Emma avec paiement > 7 jours retard
- ✅ **Expiration**: Henry avec historique complet
- ✅ **Annulation avec remboursement**: Iris
- ✅ **Multi-salles**: Données réparties sur 2 salles

---

## 🔧 Utilisation pour les Tests

### Tester les Types d'Abonnements

```bash
# Lister tous les types
curl http://localhost:3000/subscription-types

# Créer un abonnement avec type Premium
curl -X POST http://localhost:3000/subscriptions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberId": 2, "subscriptionTypeId": 3}'
```

### Tester la Pause Automatique

```bash
# Emma devrait être en pause (token admin2)
curl http://localhost:3000/subscriptions/member/8 \
  -H "Authorization: Bearer $TOKEN"
```

### Tester les Paiements

```bash
# Voir les paiements en retard
curl http://localhost:3000/subscriptions/payments/upcoming \
  -H "Authorization: Bearer $TOKEN"

# Marquer un paiement comme complété
curl -X POST http://localhost:3000/subscriptions/payments/1/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod": "card", "transactionId": "txn_test_001"}'
```

### Tester les Permissions

```bash
# Owner peut créer des types
curl -X POST http://localhost:3000/subscription-types \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"name": "Test", "monthlyPrice": 59.99}'

# Admin ne peut PAS créer des types (403)
curl -X POST http://localhost:3000/subscription-types \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name": "Test", "monthlyPrice": 59.99}'
```

---

## 🔄 Réinitialiser les Données

Pour réinitialiser complètement la base de données :

```bash
# Méthode 1: Re-seed
npm run db:seed

# Méthode 2: Reset complet
npx prisma migrate reset --force
npm run db:seed
```

⚠️ **Attention**: Cela supprime TOUTES les données !

---

## 📝 Notes Importantes

1. **Tous les mots de passe** sont hashés avec bcryptjs
2. **Tous les membres** ont des `uniqueCode` UUID générés
3. **Tous les abonnements** génèrent exactement **12 paiements mensuels**
4. **Les dates** sont calculées dynamiquement par rapport à `Date.now()`
5. **Le seed est idempotent**: il supprime et recrée tout à chaque exécution
6. **Les tokens de reset** sont créés pour tester la réinitialisation de mot de passe

---

## 🎯 Scénarios de Test Recommandés

1. **Login**: Tester avec tous les comptes (owner, admins, members)
2. **CRUD Types**: Créer, lire, modifier, désactiver types (owner uniquement)
3. **Créer Abonnement**: Avec chaque type d'abonnement disponible
4. **Paiements Automatiques**: Vérifier la génération des 12 paiements
5. **Pause Automatique**: Simuler retard > 7 jours (voir Emma)
6. **Job Quotidien**: Exécuter `checkOverduePayments()` manuellement
7. **Permissions**: Tester restrictions par rôle (member/admin/owner)
8. **Multi-tenant**: Vérifier isolation entre Gym 1 et Gym 2
9. **Grandfathering**: Créer nouvel abonnement sur type inactif (devrait échouer)
10. **Reporting**: Statistiques par type d'abonnement

---

## 🐛 Dépannage

### Erreur: "unique constraint violation"

Le seed supprime toutes les données au démarrage. Si cette erreur apparaît :

```bash
npx prisma migrate reset --force
npm run db:seed
```

### Erreur: "Cannot find module '@prisma/client'"

Régénérer le client Prisma :

```bash
npx prisma generate
npm run db:seed
```

### Seed lent à s'exécuter

Normal : 123 paiements + relations complexes. Durée moyenne : 5-10 secondes.
