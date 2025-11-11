# Connexion Flutter Emulator → Serveur - Guide de dépannage

## Problème: L'émulateur Flutter ne peut pas se connecter au serveur

### URLs correctes selon ta plateforme

Le serveur écoute sur **0.0.0.0:3000** ✅ (toutes les interfaces réseau)

#### 1. Android Emulator (AVD)
```dart
const DB_HOST = '10.0.2.2'; // IP spéciale pour accéder à localhost de la machine hôte
const DB_PORT = '3000';
final baseUrl = 'http://10.0.2.2:3000';
```

**Commande flutter run:**
```bash
flutter run -d emulator-5554 --dart-define=DB_HOST=10.0.2.2 --dart-define=DB_PORT=3000
```

#### 2. iOS Simulator
```dart
const DB_HOST = 'localhost';
const DB_PORT = '3000';
final baseUrl = 'http://localhost:3000';
```

**Commande flutter run:**
```bash
flutter run -d <ios-simulator> --dart-define=DB_HOST=localhost --dart-define=DB_PORT=3000
```

#### 3. Appareil physique (même réseau WiFi)
```dart
const DB_HOST = '172.17.84.132'; // IP locale de ta machine (voir ci-dessous)
const DB_PORT = '3000';
final baseUrl = 'http://172.17.84.132:3000';
```

**Commande flutter run:**
```bash
flutter run -d <device> --dart-define=DB_HOST=172.17.84.132 --dart-define=DB_PORT=3000
```

### Ton adresse IP locale actuelle
```
172.17.84.132
```

### Tests de connectivité

#### Depuis ta machine (devrait fonctionner):
```bash
curl http://localhost:3000/health
```

#### Depuis Android Emulator (teste avec adb):
```bash
# Entre dans le shell de l'émulateur
adb shell

# Teste la connexion
curl http://10.0.2.2:3000/health
# ou
ping 10.0.2.2
```

### Checklist de dépannage

- [ ] **Serveur en cours d'exécution?**
  ```bash
  npm run dev
  # ou
  node index.js
  ```

- [ ] **Firewall bloque le port 3000?** (Windows/Linux)
  ```bash
  # Linux: autoriser le port 3000
  sudo ufw allow 3000/tcp
  
  # Windows: vérifier dans Paramètres > Réseau > Pare-feu Windows
  ```

- [ ] **Bonne URL dans Flutter?**
  - Android emulator: `10.0.2.2:3000` ✅
  - iOS simulator: `localhost:3000` ✅
  - Appareil physique: `<IP_LOCALE>:3000` (ex: `172.17.84.132:3000`)

- [ ] **dart-define passé correctement?**
  ```dart
  // Vérifie dans ton code Flutter
  const host = String.fromEnvironment('DB_HOST', defaultValue: '10.0.2.2');
  print('Connecting to: http://$host:3000'); // Log pour debug
  ```

- [ ] **Erreur réseau dans Flutter?**
  ```dart
  try {
    final response = await http.get(Uri.parse('http://10.0.2.2:3000/health'));
    print('Status: ${response.statusCode}');
    print('Body: ${response.body}');
  } catch (e) {
    print('Error: $e'); // Regarde le type d'erreur exact
  }
  ```

### Erreurs communes et solutions

#### `SocketException: Failed host lookup`
- **Cause**: URL incorrecte ou serveur non accessible
- **Solution**: Vérifie que tu utilises `10.0.2.2` pour Android emulator

#### `Connection refused` ou `Connection timeout`
- **Cause**: Serveur arrêté ou firewall bloque
- **Solution**: 
  1. Vérifie que le serveur tourne: `curl http://localhost:3000/health`
  2. Désactive temporairement le firewall pour tester
  3. Sur Linux: `sudo ufw allow 3000`

#### `No address associated with hostname`
- **Cause**: Mauvaise résolution DNS
- **Solution**: Utilise l'IP directement au lieu du hostname

### Test rapide depuis Flutter

Ajoute ce code temporaire pour diagnostiquer:

```dart
import 'package:http/http.dart' as http;

Future<void> testConnection() async {
  const urls = [
    'http://10.0.2.2:3000/health',  // Android emulator
    'http://localhost:3000/health',  // iOS simulator
    'http://172.17.84.132:3000/health', // IP locale
  ];
  
  for (final url in urls) {
    try {
      print('Testing: $url');
      final res = await http.get(Uri.parse(url)).timeout(Duration(seconds: 3));
      print('✅ SUCCESS: ${res.statusCode} - ${res.body}');
      break;
    } catch (e) {
      print('❌ FAILED: $e');
    }
  }
}
```

### Commande complète recommandée

**Android:**
```bash
flutter run -d emulator-5554 \
  --dart-define=DB_HOST=10.0.2.2 \
  --dart-define=DB_PORT=3000
```

**iOS:**
```bash
flutter run -d <simulator-id> \
  --dart-define=DB_HOST=localhost \
  --dart-define=DB_PORT=3000
```

### Vérification serveur

Le serveur doit afficher au démarrage:
```
✅ Server is running
  - Local:    http://localhost:3000
  - Network:  http://0.0.0.0:3000
```

Si tu vois `127.0.0.1` au lieu de `0.0.0.0`, le serveur n'écoute que sur localhost et ne sera pas accessible depuis l'émulateur.
