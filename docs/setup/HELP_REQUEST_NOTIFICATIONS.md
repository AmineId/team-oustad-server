# Notifications de Demande d'Aide avec Actions

## Vue d'ensemble

Le système de demande d'aide permet aux membres de demander l'assistance d'un coach pour un exercice spécifique. Les coachs et owners reçoivent une notification avec deux boutons d'action : **"J'arrive"** et **"Occupé"**.

## Architecture

### 1. Routes API

#### POST `/plannings/request-help`
Permet à un membre de demander de l'aide pour un exercice.

**Requête:**
```json
{
  "exerciseName": "Push-ups",
  "notes": "I need help with proper form" // optionnel
}
```

**Réponse:**
```json
{
  "success": true,
  "message": "Help request sent to coach",
  "coach": {
    "id": 5,
    "name": "Coach Name"
  }
}
```

#### POST `/plannings/respond-help`
Permet au coach de répondre à une demande d'aide (route protégée par `requireCoach`).

**Requête:**
```json
{
  "memberId": 15,
  "response": "coming", // ou "busy"
  "exerciseName": "Push-ups" // optionnel
}
```

**Réponse:**
```json
{
  "success": true,
  "message": "Response \"coming\" sent to member",
  "member": {
    "id": 15,
    "name": "Member Name"
  }
}
```

---

## Implémentation Flutter

### 1. Configuration des notifications avec actions

#### Android - Canal de notification

Dans votre `MainActivity.kt` ou lors de l'initialisation de l'app :

```dart
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

// Créer le canal de notification pour les demandes d'aide
const AndroidNotificationChannel helpRequestChannel = AndroidNotificationChannel(
  'help_requests', // id
  'Demandes d\'aide', // nom
  description: 'Notifications pour les demandes d\'aide des membres',
  importance: Importance.high,
  enableVibration: true,
  playSound: true,
);

// Initialisation
final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

await flutterLocalNotificationsPlugin
    .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>()
    ?.createNotificationChannel(helpRequestChannel);
```

#### iOS - Catégories d'actions

Dans votre configuration iOS (AppDelegate.swift) :

```swift
let comingAction = UNNotificationAction(
    identifier: "COMING_ACTION",
    title: "J'arrive",
    options: []
)

let busyAction = UNNotificationAction(
    identifier: "BUSY_ACTION",
    title: "Occupé",
    options: []
)

let helpRequestCategory = UNNotificationCategory(
    identifier: "HELP_REQUEST",
    actions: [comingAction, busyAction],
    intentIdentifiers: [],
    options: []
)

UNUserNotificationCenter.current().setNotificationCategories([helpRequestCategory])
```

### 2. Gestion des notifications dans Flutter

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'dart:convert';

class NotificationService {
  final FlutterLocalNotificationsPlugin _localNotifications = 
      FlutterLocalNotificationsPlugin();
  
  Future<void> handleMessage(RemoteMessage message) async {
    final data = message.data;
    
    if (data['type'] == 'help_request') {
      await _showHelpRequestNotification(message);
    } else if (data['type'] == 'help_response') {
      await _showHelpResponseNotification(message);
    }
  }
  
  Future<void> _showHelpRequestNotification(RemoteMessage message) async {
    final data = message.data;
    final actions = data['actions'] != null 
        ? List<Map<String, dynamic>>.from(jsonDecode(data['actions']))
        : [];
    
    // Android
    final androidDetails = AndroidNotificationDetails(
      'help_requests',
      'Demandes d\'aide',
      channelDescription: 'Notifications pour les demandes d\'aide',
      importance: Importance.high,
      priority: Priority.high,
      color: const Color(0xFFFF6B00),
      actions: actions.map((action) => AndroidNotificationAction(
        action['id'],
        action['title'],
        icon: DrawableResourceAndroidBitmap(action['icon']),
        showsUserInterface: true,
      )).toList(),
    );
    
    // iOS
    final iosDetails = DarwinNotificationDetails(
      categoryIdentifier: 'HELP_REQUEST',
    );
    
    await _localNotifications.show(
      message.hashCode,
      message.notification?.title ?? '🆘 Demande d\'aide',
      message.notification?.body,
      NotificationDetails(android: androidDetails, iOS: iosDetails),
      payload: jsonEncode(data),
    );
  }
  
  Future<void> _showHelpResponseNotification(RemoteMessage message) async {
    final data = message.data;
    final response = data['response'];
    
    final color = response == 'coming' 
        ? const Color(0xFF00C853) // Vert
        : const Color(0xFFFFA000); // Orange
    
    final androidDetails = AndroidNotificationDetails(
      'help_responses',
      'Réponses aux demandes',
      channelDescription: 'Réponses des coachs aux demandes d\'aide',
      importance: Importance.high,
      priority: Priority.high,
      color: color,
    );
    
    final iosDetails = const DarwinNotificationDetails();
    
    await _localNotifications.show(
      message.hashCode,
      message.notification?.title ?? 'Réponse du coach',
      message.notification?.body,
      NotificationDetails(android: androidDetails, iOS: iosDetails),
      payload: jsonEncode(data),
    );
  }
}
```

### 3. Gestion des actions de notification

```dart
class NotificationActionHandler {
  final ApiService _apiService;
  
  NotificationActionHandler(this._apiService);
  
  Future<void> handleNotificationAction(
    String actionId,
    Map<String, dynamic> payload,
  ) async {
    if (actionId == 'coming' || actionId == 'COMING_ACTION') {
      await _respondToHelpRequest(
        memberId: int.parse(payload['memberId']),
        response: 'coming',
        exerciseName: payload['exerciseName'],
      );
    } else if (actionId == 'busy' || actionId == 'BUSY_ACTION') {
      await _respondToHelpRequest(
        memberId: int.parse(payload['memberId']),
        response: 'busy',
        exerciseName: payload['exerciseName'],
      );
    }
  }
  
  Future<void> _respondToHelpRequest({
    required int memberId,
    required String response,
    String? exerciseName,
  }) async {
    final token = await _getAuthToken();
    
    final success = await _apiService.respondToHelpRequest(
      memberId: memberId,
      response: response,
      exerciseName: exerciseName,
      token: token,
    );
    
    if (success) {
      print('✅ Réponse envoyée: $response');
    } else {
      print('❌ Erreur lors de l\'envoi de la réponse');
    }
  }
  
  Future<String> _getAuthToken() async {
    // Récupérer le token d'authentification stocké
    return 'your_stored_token';
  }
}
```

### 4. Initialisation dans main.dart

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  
  final notificationService = NotificationService();
  final actionHandler = NotificationActionHandler(ApiService());
  
  // Écouter les messages en foreground
  FirebaseMessaging.onMessage.listen((message) {
    notificationService.handleMessage(message);
  });
  
  // Écouter les actions de notification
  final localNotifications = FlutterLocalNotificationsPlugin();
  
  localNotifications.initialize(
    const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
    ),
    onDidReceiveNotificationResponse: (response) async {
      if (response.actionId != null && response.payload != null) {
        final payload = jsonDecode(response.payload!);
        await actionHandler.handleNotificationAction(
          response.actionId!,
          payload,
        );
      }
    },
  );
  
  runApp(MyApp());
}
```

### 5. Méthode API dans ApiService

```dart
Future<bool> respondToHelpRequest({
  required int memberId,
  required String response,
  String? exerciseName,
  required String token,
  Duration timeout = const Duration(seconds: 8),
}) async {
  final uri = baseUri.resolve('/plannings/respond-help');
  
  try {
    final requestBody = {
      'memberId': memberId,
      'response': response,
      if (exerciseName != null) 'exerciseName': exerciseName,
    };

    print('ApiService.respondToHelpRequest -> $uri');
    print('  Response: $response, Member: $memberId');

    final resp = await http
        .post(
          uri,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode(requestBody),
        )
        .timeout(timeout);
    
    print('respondToHelpRequest status: ${resp.statusCode}');
    
    return resp.statusCode == 200;
  } catch (e) {
    print('Error responding to help request: $e');
    return false;
  }
}
```

---

## Flux de données

### 1. Membre demande de l'aide
```
Membre (App Flutter)
  ↓ POST /plannings/request-help
Serveur
  ↓ FCM Notification avec actions
Coach/Owner (App Flutter)
  ↓ Affiche notification avec boutons "J'arrive" / "Occupé"
```

### 2. Coach répond
```
Coach clique sur bouton
  ↓ Action notification interceptée
App Flutter
  ↓ POST /plannings/respond-help
Serveur
  ↓ FCM Notification
Membre (App Flutter)
  ↓ Reçoit notification avec réponse
```

---

## Structure des données de notification

### Demande d'aide (vers Coach)
```json
{
  "notification": {
    "title": "🆘 Demande d'aide",
    "body": "John Doe demande de l'aide pour \"Push-ups\": I need help with proper form"
  },
  "data": {
    "type": "help_request",
    "memberId": "15",
    "memberName": "John Doe",
    "exerciseName": "Push-ups",
    "notes": "I need help with proper form",
    "planningId": "42",
    "actions": "[{\"id\":\"coming\",\"title\":\"J'arrive\",\"icon\":\"check\"},{\"id\":\"busy\",\"title\":\"Occupé\",\"icon\":\"close\"}]"
  }
}
```

### Réponse (vers Membre)
```json
{
  "notification": {
    "title": "✅ Réponse du coach",
    "body": "Coach Name arrive pour vous aider avec \"Push-ups\" 👍"
  },
  "data": {
    "type": "help_response",
    "coachId": "5",
    "coachName": "Coach Name",
    "response": "coming",
    "exerciseName": "Push-ups"
  }
}
```

---

## Tests

### Test de demande d'aide
```bash
curl -X POST http://localhost:3000/plannings/request-help \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer MEMBER_TOKEN" \
  -d '{
    "exerciseName": "Push-ups",
    "notes": "Need help with form"
  }'
```

### Test de réponse
```bash
curl -X POST http://localhost:3000/plannings/respond-help \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer COACH_TOKEN" \
  -d '{
    "memberId": 15,
    "response": "coming",
    "exerciseName": "Push-ups"
  }'
```

---

## Notes importantes

1. **Autorisations**: Sur iOS, demander l'autorisation pour les notifications interactives
2. **Background**: Les actions fonctionnent même si l'app est en arrière-plan
3. **Sécurité**: Le middleware `requireCoach` vérifie que seuls les coachs/owners peuvent répondre
4. **Salle**: Le système vérifie automatiquement que le coach et le membre sont dans la même salle
5. **Token FCM**: Le membre et le coach doivent avoir un token FCM valide pour recevoir les notifications
