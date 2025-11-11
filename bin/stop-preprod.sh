#!/bin/bash

###############################################################################
# Script d'arrêt PRÉPRODUCTION
###############################################################################

echo "🛑 Arrêt environnement PRÉPRODUCTION"

# Arrêter PostgreSQL preprod
echo "📦 Arrêt PostgreSQL preprod..."
docker compose -f config/docker-compose-multi-env.yml stop postgres-preprod

echo "✅ Environnement preprod arrêté"
