# Script de Correction des Abonnements et Paiements

## 🎯 Objectif

Ce script corrige les incohérences dans les abonnements et paiements sans supprimer de données. Idéal pour les environnements de test/production.

## ✅ Ce que le script fait

1. **Vérifie tous les abonnements actifs** :
   - Expire automatiquement les abonnements dont la date de fin est dépassée
   - Expire automatiquement les abonnements dont le quota est épuisé
   - Crée les paiements manquants pour les abonnements actifs
   - Corrige les statuts de paiements incohérents

2. **Active les abonnements pending** :
   - Si un abonnement est en "pending" mais a un paiement "completed", il est activé automatiquement

3. **Affiche des statistiques** :
   - Nombre d'abonnements par statut après correction

## 🚀 Utilisation

### Sur le serveur local :
```bash
node scripts/maintenance/fix-subscriptions-payments.js
```

### Sur le VPS (preprod/prod) :
```bash
cd /var/www/team_fitness_server  # ou ton chemin
node scripts/maintenance/fix-subscriptions-payments.js
```

## ⚠️ Important

- **Mode non-destructif** : Ne supprime AUCUNE donnée
- **Idempotent** : Peut être exécuté plusieurs fois sans risque
- **Production-safe** : Conçu pour être utilisé en prod/preprod

## 📝 Exemple de sortie

```
🔧 Début de la correction des abonnements et paiements...

📊 8 abonnements actifs trouvés

👤 Traitement: Bob Williams
   Abonnement: 36 Séances
   Statut actuel: active
   Sessions: 10/36
   💰 1 paiement(s) trouvé(s)
   ✅ Paiement OK
   ✅ Traitement terminé

📊 Statistiques après correction:
   active: 6
   pending: 1
   expired: 2
   paused: 1

✅ Correction terminée avec succès!
```

## 🔍 Cas traités

| Problème | Action |
|----------|--------|
| Abonnement actif sans paiement | Crée un paiement "completed" |
| Abonnement expiré (date) | Change le statut en "expired" |
| Abonnement expiré (quota) | Change le statut en "expired" |
| Paiement pending mais abonnement actif | Marque le paiement comme "completed" |
| Abonnement pending avec paiement completed | Active l'abonnement |

## 🛠️ Maintenance

Ce script peut être exécuté :
- Après une migration de base de données
- Après un import de données
- Pour nettoyer des incohérences
- Avant une mise en production
