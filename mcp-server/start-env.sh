#!/bin/bash

# Script pour démarrer le serveur MCP avec un environnement spécifique
# Usage: ./start-env.sh [dev|preprod|prod]

ENV=${1:-dev}

case $ENV in
  dev|preprod|prod)
    echo "🚀 Démarrage du serveur MCP Team Fitness"
    echo "📍 Environnement: $ENV"
    ACTIVE_ENV=$ENV node index.js
    ;;
  *)
    echo "❌ Environnement invalide: $ENV"
    echo "Usage: ./start-env.sh [dev|preprod|prod]"
    exit 1
    ;;
esac
