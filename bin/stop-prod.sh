#!/bin/bash

###############################################################################
# Script d'arrêt PRODUCTION
###############################################################################

echo "🛑 Arrêt environnement PRODUCTION"

# Arrêter PostgreSQL prod
echo "📦 Arrêt PostgreSQL prod..."
docker compose -f config/docker-compose-multi-env.yml stop postgres-prod

echo "✅ Environnement prod arrêté"
