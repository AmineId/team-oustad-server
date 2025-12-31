#!/bin/bash
# Script de résolution de la migration échouée

echo "🔧 Résolution de la migration échouée..."

# 1. Marquer la migration comme résolue
echo "📝 Étape 1: Marquer la migration comme résolue"
npx prisma migrate resolve --applied 20251231170011_add_checkin_and_session_quotas

# 2. Vérifier le statut
echo ""
echo "📊 Statut des migrations:"
npx prisma migrate status

echo ""
echo "✅ Migration marquée comme résolue"
echo ""
echo "⚠️  Maintenant, il faut appliquer les changements manuellement"
echo "    Exécute: node scripts/apply-schema-changes.js"
