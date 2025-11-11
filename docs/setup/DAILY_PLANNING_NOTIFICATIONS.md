# Notifications Quotidiennes de Planning

## Vue d'ensemble

Le système envoie automatiquement une notification push à tous les membres qui ont un planning d'entraînement prévu pour la journée.

## Fonctionnement

### Job Planifié

- **Fichier**: `jobs/dailyPlanningNotification.js`
- **Horaire**: Tous les jours à **6h00** (Europe/Paris)
- **Technologie**: node-cron

### Processus

1. Le job s'exécute automatiquement chaque matin à 6h00
2. Il récupère tous les plannings actifs pour la date du jour
3. Il filtre les plannings qui ont des exercices prévus pour le jour actuel
4. Il envoie une notification push à chaque membre concerné

### Format de la Notification

**Titre**: `🏋️ Entraînement du jour - [Jour de la semaine]`

**Corps du message**:
- Si 1 exercice: `1 exercice prévu aujourd'hui : [Nom exercice]`
- Si plusieurs: `X exercices prévus aujourd'hui : [Exercice 1], [Exercice 2], [Exercice 3] et X autres`

**Données supplémentaires**:
```json
{
  "type": "daily_planning",
  "planningId": "123",
  "memberId": "456",
  "dayOfWeek": "1",
  "exerciseCount": "5",
  "planningTitle": "Programme Force"
}
```

## Configuration

### Variables d'environnement

Aucune variable spécifique requise. Le job utilise:
- La connexion Prisma configurée
- Firebase Admin SDK pour les notifications push

### Timezone

Le job utilise le timezone **Europe/Paris**. Pour changer:

```javascript
{
  scheduled: false,
  timezone: "America/New_York" // Modifier ici
}
```

## Démarrage

Le job démarre automatiquement au lancement du serveur dans `index.js`:

```javascript
const { dailyPlanningNotification } = require('./jobs/dailyPlanningNotification');
dailyPlanningNotification.start();
```

## Logs

Le job produit des logs détaillés:

```
📅 [DAILY PLANNING NOTIFICATION] Démarrage du job à 2025-11-12T06:00:00.000Z
📅 Date: 2025-11-12, Jour de la semaine: 2
✅ 15 planning(s) actif(s) trouvé(s)
✅ 8 planning(s) avec exercices aujourd'hui
📤 Envoi notification à Jean Dupont - 5 exercice(s)
✅ Notification envoyée à Jean Dupont
...
✅ [DAILY PLANNING NOTIFICATION] Job terminé - 8 succès, 0 échecs
```

## Conditions d'envoi

Une notification est envoyée si **toutes** ces conditions sont remplies:

1. ✅ Le membre a un planning actif
2. ✅ Le planning couvre la date d'aujourd'hui (`startDate <= today <= endDate`)
3. ✅ Le planning a des exercices définis pour le jour actuel
4. ✅ Le membre a un token FCM valide

## Gestion des erreurs

- Si un membre n'a pas de token FCM: log d'avertissement, pas d'erreur
- Si l'envoi échoue: log d'erreur mais continue pour les autres membres
- Le job affiche un résumé: nombre de succès et d'échecs

## Tests manuels

Pour tester le job sans attendre 6h00, vous pouvez l'exécuter manuellement:

```javascript
// Ajouter temporairement dans index.js ou créer un script de test
const { dailyPlanningNotification } = require('./jobs/dailyPlanningNotification');

// Exécuter immédiatement (ignorer le schedule)
const testJob = async () => {
  // Copier le code du job ici pour test immédiat
};
testJob();
```

## Intégration avec Flutter

### Réception côté Flutter

```dart
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  if (message.data['type'] == 'daily_planning') {
    // Afficher la notification
    // Possibilité de rediriger vers l'écran des exercices du jour
    final planningId = message.data['planningId'];
    final exerciseCount = message.data['exerciseCount'];
    
    // Navigation ou affichage personnalisé
  }
});
```

## Personnalisation

### Changer l'horaire

Modifier la cron expression dans `dailyPlanningNotification.js`:

```javascript
// Actuel: 6h00 tous les jours
const dailyPlanningNotification = cron.schedule('0 6 * * *', ...);

// Exemples:
// 7h30 tous les jours: '30 7 * * *'
// 8h00 seulement en semaine (lundi-vendredi): '0 8 * * 1-5'
```

### Modifier le contenu

Le message est généré dans le job:

```javascript
const notificationBody = exerciseCount === 1
  ? `1 exercice prévu aujourd'hui : ${exercisesList}`
  : `${exerciseCount} exercices prévus aujourd'hui : ${exercisesList}${moreExercises}`;
```

## Performance

- **Optimisé**: Une seule requête Prisma avec tous les includes nécessaires
- **Filtrage DB**: Le jour de la semaine est filtré côté base de données
- **Asynchrone**: Les notifications sont envoyées en série pour gérer les erreurs individuellement

## Désactivation

Pour désactiver temporairement le job, commenter dans `index.js`:

```javascript
// const { dailyPlanningNotification } = require('./jobs/dailyPlanningNotification');
// dailyPlanningNotification.start();
```

## Monitoring

Recommandations pour la production:

1. **Logs**: Centraliser les logs (Winston, Papertrail, etc.)
2. **Alertes**: Configurer des alertes si le job échoue
3. **Métriques**: Tracker le nombre de notifications envoyées
4. **Health Check**: Vérifier régulièrement que le cron fonctionne

## Dépendances

- `node-cron`: Planification des tâches
- `@prisma/client`: Accès à la base de données
- `pushNotificationService`: Envoi des notifications Firebase

## Voir aussi

- [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md) - Configuration Firebase
- [NOTIFICATIONS_IMPLEMENTATION.md](./NOTIFICATIONS_IMPLEMENTATION.md) - Détails techniques
- [dailyPaymentCheck.js](../jobs/dailyPaymentCheck.js) - Job similaire pour les paiements
