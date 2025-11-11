import 'dart:convert';
import 'package:http/http.dart' as http;

class HelpRequestService {
  final String baseUrl;
  
  HelpRequestService({required this.baseUrl});
  
  /// Demander de l'aide au coach pour un exercice
  Future<bool> requestExerciseHelp({
    required String exerciseName,
    required String token,
    String? notes,
    Duration timeout = const Duration(seconds: 8),
  }) async {
    final uri = Uri.parse('$baseUrl/plannings/request-help');
    
    try {
      final requestBody = {
        'exerciseName': exerciseName,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      };

      print('HelpRequestService.requestExerciseHelp -> $uri');
      print('  Exercise: $exerciseName');

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
      
      print('requestExerciseHelp status: ${resp.statusCode}');
      
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        print('✅ Help request sent to coach: ${data['coach']['name']}');
        return true;
      }
      
      return false;
    } catch (e) {
      print('❌ Error requesting exercise help: $e');
      return false;
    }
  }
  
  /// Répondre à une demande d'aide (pour les coachs)
  Future<bool> respondToHelpRequest({
    required int memberId,
    required String response, // 'coming' ou 'busy'
    required String token,
    String? exerciseName,
    Duration timeout = const Duration(seconds: 8),
  }) async {
    final uri = Uri.parse('$baseUrl/plannings/respond-help');
    
    try {
      final requestBody = {
        'memberId': memberId,
        'response': response,
        if (exerciseName != null) 'exerciseName': exerciseName,
      };

      print('HelpRequestService.respondToHelpRequest -> $uri');
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
      
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        print('✅ Response sent to member: ${data['member']['name']}');
        return true;
      }
      
      return false;
    } catch (e) {
      print('❌ Error responding to help request: $e');
      return false;
    }
  }
}

/// Exemple d'utilisation
void main() async {
  final service = HelpRequestService(baseUrl: 'http://localhost:3000');
  
  // Membre demande de l'aide
  final helpRequested = await service.requestExerciseHelp(
    exerciseName: 'Push-ups',
    notes: 'I need help with proper form',
    token: 'MEMBER_JWT_TOKEN',
  );
  
  print('Help requested: $helpRequested');
  
  // Coach répond "J'arrive"
  final responseSent = await service.respondToHelpRequest(
    memberId: 15,
    response: 'coming',
    exerciseName: 'Push-ups',
    token: 'COACH_JWT_TOKEN',
  );
  
  print('Response sent: $responseSent');
}
