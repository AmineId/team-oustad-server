#!/bin/bash

# Script de démonstration de l'endpoint d'acquittement de paiement
# Ce script montre comment acquitter un paiement et activer automatiquement un abonnement

BASE_URL="http://localhost:3000"

echo "🎯 Démonstration de l'acquittement de paiement"
echo "=============================================="
echo ""

# 1. Connexion
echo "1️⃣  Connexion en tant qu'admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@teamfitness.com",
    "password": "admin123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Erreur de connexion"
  exit 1
fi

echo "✅ Connecté avec succès"
echo ""

# 2. Récupérer les paiements en attente
echo "2️⃣  Récupération des paiements en attente..."
PAYMENTS=$(curl -s -X GET "$BASE_URL/subscriptions/payments/upcoming" \
  -H "Authorization: Bearer $TOKEN")

echo "$PAYMENTS" | jq '.' 2>/dev/null || echo "$PAYMENTS"
echo ""

# 3. Démonstration de l'acquittement
echo "3️⃣  Exemple d'acquittement d'un paiement"
echo ""
echo "Pour acquitter le paiement ID 199 par exemple :"
echo ""
echo "curl -X POST $BASE_URL/subscriptions/payments/199/acknowledge \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"paymentMethod\": \"card\","
echo "    \"transactionId\": \"TXN_$(date +%s)\""
echo "  }'"
echo ""
echo "Résultat attendu :"
echo "- Paiement marqué comme 'completed' ✅"
echo "- Abonnement activé si statut 'pending' ✅"
echo "- Date de paiement enregistrée ✅"
echo ""

# 4. Vérifier un abonnement
echo "4️⃣  Pour vérifier le statut d'un abonnement :"
echo ""
echo "curl -X GET $BASE_URL/subscriptions/31 \\"
echo "  -H \"Authorization: Bearer \$TOKEN\""
echo ""

echo "✨ Fin de la démonstration"
