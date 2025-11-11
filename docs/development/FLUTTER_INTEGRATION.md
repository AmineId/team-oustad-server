# Connexion Flutter → Team Fitness Server

Ce guide explique comment connecter une application Flutter à l'API Express/Prisma du projet Team Fitness.

## 1) Principe

L'application Flutter n'accède pas directement à la base Postgres. Elle communique avec l'API HTTP que tu as dans ce repo (ex : `http://localhost:3000`). L'API effectue les opérations sur la base.

On va :
- passer l'URL (host/port) depuis Flutter via `--dart-define` au moment du `flutter run` ;
- utiliser le package `http` (ou `dio`) pour faire les requêtes REST ;
- fournir un service Dart réutilisable (ex : `lib/services/gym_service.dart`).

## 2) Remarques importantes pour l'émulateur

- Android emulator (AVD) : l'hôte `localhost` vu depuis l'émulateur n'est pas ton PC. Utilise `10.0.2.2` pour pointer vers `localhost` de la machine hôte.
- iOS simulator : `localhost` fonctionne généralement.
- Si tu utilises un appareil physique, remplace par l'IP locale de la machine (ex: `192.168.x.y`).

Exemples :
- Android emulator : `--dart-define=DB_HOST=10.0.2.2`
- iOS simulator / web : `--dart-define=DB_HOST=localhost`

## 3) Commande flutter run recommandée

Exemple pour l'émulateur Android (recommandé) :

```bash
flutter run -d emulator-5554 --dart-define=DB_HOST=10.0.2.2 --dart-define=DB_PORT=3000
```

Tu peux aussi passer les autres variables si tu veux : `DB_NAME`, `DB_USER`, `DB_PASSWORD` — mais rappelle-toi que Flutter ne doit pas contenir de secrets en clair dans une app distribuée.

## 4) Ajouter la dépendance http

Dans `pubspec.yaml` :

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^0.13.6
  # ou utilisez dio si vous préférez
```

Puis `flutter pub get`.

## 5) Lire les valeurs passées via --dart-define

Dans Dart, on peut récupérer les constantes de compilation avec `String.fromEnvironment` :

```dart
const DB_HOST = String.fromEnvironment('DB_HOST', defaultValue: '10.0.2.2');
const DB_PORT = String.fromEnvironment('DB_PORT', defaultValue: '3000');
final baseUrl = 'http://$DB_HOST:$DB_PORT';
```

Ces valeurs sont intégrées à l'application au moment de la compilation/exécution.

## 6) Exemple de service pour les Gyms (lib/services/gym_service.dart)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

const DB_HOST = String.fromEnvironment('DB_HOST', defaultValue: '10.0.2.2');
const DB_PORT = String.fromEnvironment('DB_PORT', defaultValue: '3000');
final baseUrl = 'http://$DB_HOST:$DB_PORT';

class GymService {
  final client = http.Client();

  Uri _uri(String path) => Uri.parse('$baseUrl$path');

  Future<List<Map<String, dynamic>>> getGyms() async {
    final res = await client.get(_uri('/gyms'));
    if (res.statusCode == 200) {
      final data = json.decode(res.body) as List<dynamic>;
      return data.cast<Map<String, dynamic>>();
    }
    throw Exception('Failed to load gyms: ${res.statusCode} ${res.body}');
  }

  Future<Map<String, dynamic>> createGym(Map<String, dynamic> body) async {
    final res = await client.post(_uri('/gyms'),
        headers: {'Content-Type': 'application/json'}, body: json.encode(body));
    if (res.statusCode == 201) return json.decode(res.body) as Map<String, dynamic>;
    throw Exception('Failed to create gym: ${res.statusCode} ${res.body}');
  }

  Future<Map<String, dynamic>> updateGym(int id, Map<String, dynamic> body) async {
    final res = await client.put(_uri('/gyms/$id'),
        headers: {'Content-Type': 'application/json'}, body: json.encode(body));
    if (res.statusCode == 200) return json.decode(res.body) as Map<String, dynamic>;
    throw Exception('Failed to update gym: ${res.statusCode} ${res.body}');
  }

  Future<void> deleteGym(int id) async {
    final res = await client.delete(_uri('/gyms/$id'));
    if (res.statusCode != 200) throw Exception('Failed to delete gym: ${res.statusCode} ${res.body}');
  }

  void dispose() => client.close();
}
```

Duplique ce patron pour `admins` et `members` en adaptant les chemins et les corps des requêtes.

## 7) Exemple d'utilisation dans un Widget

```dart
import 'package:flutter/material.dart';
import '../services/gym_service.dart';

class GymsPage extends StatefulWidget {
  const GymsPage({super.key});

## 8) Authentification (login + token)

L'API expose `POST /auth/login` qui accepte `{ "email", "password" }` et renvoie `{ token, admin }`.

Exemple d'appel pour récupérer le token :

```dart
final res = await http.post(Uri.parse('$baseUrl/auth/login'),
  headers: {'Content-Type': 'application/json'},
  body: json.encode({'email': 'alice@example.com', 'password': 'admin123'}),
);
if (res.statusCode == 200) {
  final body = json.decode(res.body);
  final token = body['token'];
  // stocker le token (ex: secure_storage) et l'ajouter ensuite aux requêtes
}
```

Pour appeler les endpoints protégés (ex: créer un membre), ajoute l'en-tête Authorization :

```dart
final res = await client.post(_uri('/members'),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  },
  body: json.encode({'fullName': 'New Member', 'email': 'm@example.com', 'membership': 'Silver', 'gymId': 2}),
);
```

Note : `POST /auth/login` renvoie un token JWT valide 30 jours par défaut.

  @override
  State<GymsPage> createState() => _GymsPageState();
}

class _GymsPageState extends State<GymsPage> {
  final gymService = GymService();
  List<Map<String, dynamic>> gyms = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await gymService.getGyms();
      setState(() {
        gyms = list;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur: $e')));
    }
  }

  @override
  void dispose() {
    gymService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    return ListView.builder(
      itemCount: gyms.length,
      itemBuilder: (context, i) => ListTile(
        title: Text(gyms[i]['name'] ?? 'Unnamed'),
        subtitle: Text(gyms[i]['address'] ?? ''),
      ),
    );
  }
}
```

## 8) Sécurité

- Ne mets pas de secrets (mot de passe, clefs API sensibles) en dur dans l'application.
- Pour l'authentification, ajoute un endpoint d'auth sur le serveur (login → JWT) et stocke le token de façon sécurisée sur le client (secure storage).

## 9) Conseils / Debug

- Si tu obtiens `SocketException` avec `localhost`, change pour `10.0.2.2` (Android emulator).
- Vérifie que l'API tourne et accepte des connexions (`curl http://localhost:3000/health` sur ta machine hôte).
- Si tu testes sur un appareil physique, utilise l'IP LAN de ta machine hôte.

## 10) Exemple de commande complète fournie

Ton exemple fonctionnera sur iOS ou sur web, mais pour Android émulateur tu dois remplacer `localhost` par `10.0.2.2` :

```bash
# Android emulator (recommandé)
flutter run -d emulator-5554 --dart-define=DB_HOST=10.0.2.2 --dart-define=DB_PORT=3000

# iOS simulator
flutter run -d <simulator> --dart-define=DB_HOST=localhost --dart-define=DB_PORT=3000
```

---

Si tu veux, je peux aussi :
- ajouter les fichiers `lib/services/admin_service.dart` et `lib/services/member_service.dart` dans le projet Flutter d'exemple ;
- créer un mini-projet Flutter d'exemple minimal qui montre la liste des gyms et la création d'un nouveau gym.

Dis-moi ce que tu préfères que je génère ensuite.