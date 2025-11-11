#!/bin/bash

# Version simple du tunnel - affiche juste l'URL clairement
# Usage: ./start-tunnel-simple.sh

echo "🚀 Démarrage du tunnel Cloudflare..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏳ Regardez les logs ci-dessous pour l'URL qui commence par:"
echo "   https://...trycloudflare.com"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Lancer cloudflared directement - l'URL apparaîtra dans les logs
cloudflared tunnel --url http://localhost:3000
