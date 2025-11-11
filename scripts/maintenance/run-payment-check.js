#!/usr/bin/env node

/**
 * Script manuel pour exécuter le job de vérification des paiements
 * Usage: node scripts/run-payment-check.js
 */

const { runDailyPaymentCheck } = require('../jobs/dailyPaymentCheck');

console.log('🚀 Exécution manuelle du job de vérification des paiements\n');

runDailyPaymentCheck()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ Job exécuté avec succès!');
      console.log(`📊 Résumé:`);
      console.log(`   - Paiements en retard: ${result.results.overduePayments}`);
      console.log(`   - Abonnements pausés: ${result.results.pausedSubscriptions}`);
      console.log(`   - Paiements à venir (7j): ${result.results.upcomingPayments}`);
      console.log(`   - Durée: ${result.duration}s\n`);
      process.exit(0);
    } else {
      console.error('\n❌ Le job a échoué:', result.error);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    console.error(error.stack);
    process.exit(1);
  });
