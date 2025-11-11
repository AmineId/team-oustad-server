/**
 * Job Batch - Vérification quotidienne des paiements
 * Ce script doit être exécuté tous les soirs (ex: à 23h00)
 * 
 * Fonctions:
 * 1. Vérifie les paiements en retard (J-7) et met les abonnements en pause
 * 2. Identifie les paiements à venir pour les rappels
 */

const cron = require('node-cron');
const { 
  checkOverduePayments, 
  checkUpcomingPayments 
} = require('../services/subscriptionService');

/**
 * Exécute la vérification quotidienne des paiements
 */
async function runDailyPaymentCheck() {
  const startTime = new Date();
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`🤖 JOB BATCH - Vérification quotidienne des paiements`);
  console.log(`   Démarré à: ${startTime.toLocaleString('fr-FR')}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    // 1. Vérifier les paiements en retard
    const overdueResult = await checkOverduePayments();
    
    // 2. Vérifier les paiements à venir
    const upcomingPayments = await checkUpcomingPayments();
    
    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ JOB BATCH TERMINÉ');
    console.log(`   Durée: ${duration}s`);
    console.log(`   Paiements en retard: ${overdueResult.overduePayments}`);
    console.log(`   Abonnements pausés: ${overdueResult.pausedSubscriptions}`);
    console.log(`   Paiements à venir (7j): ${upcomingPayments.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    return {
      success: true,
      timestamp: endTime,
      duration: duration,
      results: {
        overduePayments: overdueResult.overduePayments,
        pausedSubscriptions: overdueResult.pausedSubscriptions,
        upcomingPayments: upcomingPayments.length
      }
    };
    
  } catch (error) {
    console.error('\n❌ ERREUR LORS DU JOB BATCH:', error);
    console.error(error.stack);
    
    return {
      success: false,
      error: error.message,
      timestamp: new Date()
    };
  }
}

/**
 * Configure et démarre le cron job
 * Par défaut: tous les jours à 23h00
 */
function startDailyPaymentCheckCron(cronSchedule = '0 23 * * *') {
  console.log('⏰ Configuration du cron job pour la vérification des paiements');
  console.log(`   Planning: ${cronSchedule} (tous les jours à 23h00)`);
  
  // Planifier le job
  const job = cron.schedule(cronSchedule, async () => {
    await runDailyPaymentCheck();
  }, {
    scheduled: true,
    timezone: "Europe/Paris"
  });
  
  console.log('✅ Cron job démarré avec succès\n');
  
  return job;
}

/**
 * Exécute immédiatement la vérification (pour les tests)
 */
async function runNow() {
  console.log('🚀 Exécution immédiate du job de vérification...\n');
  return await runDailyPaymentCheck();
}

// Si ce script est exécuté directement (node jobs/dailyPaymentCheck.js)
if (require.main === module) {
  runNow()
    .then(() => {
      console.log('✅ Vérification terminée');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur:', error);
      process.exit(1);
    });
}

module.exports = {
  runDailyPaymentCheck,
  startDailyPaymentCheckCron,
  runNow
};
