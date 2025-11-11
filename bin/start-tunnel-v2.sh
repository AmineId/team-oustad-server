#!/bin/bash

# Script simple pour démarrer un tunnel Cloudflare
# L'URL sera affichée dans les logs après quelques secondes

set -e

echo "🌐 Démarrage du tunnel Cloudflare..."
echo ""

# Vérifier si cloudflared est installé
if ! command -v cloudflared &> /dev/null; then
    echo "❌ Erreur: cloudflared n'est pas installé"
    echo "📦 Installation:"
    echo "curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb"
    echo "sudo dpkg -i /tmp/cloudflared.deb"
    exit 1
fi

# Vérifier si le serveur tourne
echo "🔍 Vérification du serveur sur localhost:3000..."
if ! curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "⚠️  Le serveur ne répond pas sur localhost:3000"
    echo "💡 Démarrez le serveur: nodemon index.js"
    echo ""
    read -p "Continuer quand même? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Serveur détecté"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 Démarrage du tunnel..."
echo ""
echo "⏳ L'URL publique s'affichera ci-dessous dans ~5 secondes"
echo "   Cherchez une ligne contenant 'https://...trycloudflare.com'"
echo ""
echo "🛑 Ctrl+C pour arrêter"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Lancer cloudflared - l'URL apparaîtra dans les logs
cloudflared tunnel --url http://localhost:3000
