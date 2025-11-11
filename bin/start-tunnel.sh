#!/bin/bash

# Script pour démarrer un tunnel Cloudflare temporaire
# Usage: ./start-tunnel.sh

set -e

echo "🌐 Démarrage du tunnel Cloudflare..."
echo "📌 Ce tunnel expose localhost:3000 via une URL publique"
echo ""

# Vérifier si cloudflared est installé
if ! command -v cloudflared &> /dev/null; then
    echo "❌ Erreur: cloudflared n'est pas installé"
    echo "📦 Installation: curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i /tmp/cloudflared.deb"
    exit 1
fi

# Vérifier si le serveur tourne sur localhost:3000
echo "🔍 Vérification que le serveur tourne sur localhost:3000..."
if ! curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "⚠️  Attention: Le serveur ne semble pas tourner sur localhost:3000"
    echo "💡 Démarrez le serveur d'abord: nodemon index.js"
    echo ""
    read -p "Continuer quand même? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Serveur détecté sur localhost:3000"
fi

echo ""
echo "🚀 Démarrage du tunnel..."
echo "⏳ Attendez quelques secondes pour l'URL..."
echo "🛑 Appuyez sur Ctrl+C pour arrêter le tunnel"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Démarrer cloudflared tunnel avec extraction d'URL
cloudflared tunnel --url http://localhost:3000 2>&1 | grep --line-buffered -E 'https://.*\.trycloudflare\.com|INF|WRN|ERR' | while read -r line; do
    echo "$line"
    
    # Si la ligne contient l'URL, l'afficher de manière visible
    if echo "$line" | grep -q "https://.*\.trycloudflare\.com"; then
        TUNNEL_URL=$(echo "$line" | grep -o 'https://[^[:space:]]*\.trycloudflare\.com')
        echo ""
        echo "╔════════════════════════════════════════════════════════════════╗"
        echo "║  ✅ TUNNEL ACTIF!                                              ║"
        echo "║                                                                ║"
        echo "║  📋 URL: $TUNNEL_URL"
        echo "║                                                                ║"
        echo "║  📱 API: ${TUNNEL_URL}/api                                     ║"
        echo "║  📚 Docs: ${TUNNEL_URL}/api-docs                               ║"
        echo "╚════════════════════════════════════════════════════════════════╝"
        echo ""
    fi
done

# Note: Le tunnel restera actif tant que cette commande tourne
# Ctrl+C pour arrêter le tunnel
