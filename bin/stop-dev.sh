#!/bin/bash

###############################################################################
# Script d'arrêt DÉVELOPPEMENT
###############################################################################

echo "🛑 Arrêt environnement DÉVELOPPEMENT"

# Arrêter PostgreSQL dev
echo "📦 Arrêt PostgreSQL dev..."
docker compose -f config/docker-compose-multi-env.yml stop postgres-dev

echo "✅ Environnement dev arrêté"
