/**
 * Script de test pour le système d'abonnements automatiques
 * 
 * Ce script teste:
 * 1. La création d'un abonnement annuel avec 12 paiements
 * 2. La vérification des paiements en retard
 * 3. La mise en pause automatique des abonnements
 */

const { PrismaClient } = require('@prisma/client');
const { getFullName } = require("../../utils/nameUtils");
const prisma = new PrismaClient();
const { 
  createYearlySubscriptionWithPayments,
  checkOverduePayments,
  getSubscriptionStatus,
  markPaymentAsCompleted
} = require('./services/subscriptionService');

async function testSubscriptionSystem() {
  console.log('🧪 === TEST DU SYSTÈME D\'ABONNEMENTS AUTOMATIQUES ===\n');
  
  try {
    // 1. Trouver un membre de test
    console.log('1️⃣ Recherche d\'un membre de test...');
    const member = await prisma.member.findFirst({
      include: {
        User: true
      }
    });
    
    if (!member) {
      console.error('❌ Aucun membre trouvé dans la base de données');
      return;
    }
    
    console.log(`✅ Membre trouvé: ${getFullName(member.User)} (ID: ${member.userId})\n`);
    
    // 2. Créer un abonnement annuel
    console.log('2️⃣ Création d\'un abonnement annuel avec 12 paiements...');
    const result = await createYearlySubscriptionWithPayments(
      member.userId,
      'premium',
      49.99
    );
    
    console.log(`\n✅ Abonnement créé avec ID: ${result.subscription.id}`);
    console.log(`   ${result.payments.length} paiements générés\n`);
    
    // 3. Afficher le statut de l'abonnement
    console.log('3️⃣ Vérification du statut de l\'abonnement...');
    const status = await getSubscriptionStatus(result.subscription.id);
    
    console.log(`\n📊 Statut de l'abonnement:`);
    console.log(`   - Statut: ${status.subscription.status}`);
    console.log(`   - Paiements totaux: ${status.stats.totalPayments}`);
    console.log(`   - Paiements complétés: ${status.stats.completedPayments}`);
    console.log(`   - Paiements en attente: ${status.stats.pendingPayments}`);
    console.log(`   - Paiements en retard: ${status.stats.overduePayments}`);
    console.log(`   - Progression: ${status.stats.percentComplete}%`);
    
    if (status.nextPayment) {
      console.log(`\n💰 Prochain paiement:`);
      console.log(`   - Montant: ${status.nextPayment.amount}€`);
      console.log(`   - Date due: ${new Date(status.nextPayment.dueDate).toLocaleDateString()}`);
      console.log(`   - Mois: ${status.nextPayment.monthNumber}/12`);
    }
    
    // 4. Simuler un paiement complété
    console.log('\n4️⃣ Simulation d\'un paiement complété...');
    const firstPayment = result.payments[0];
    await markPaymentAsCompleted(firstPayment.id, 'card', 'TEST_TRANSACTION_001');
    console.log(`✅ Premier paiement marqué comme complété\n`);
    
    // 5. Simuler un paiement en retard
    console.log('5️⃣ Simulation d\'un paiement en retard...');
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10); // Il y a 10 jours
    
    await prisma.payment.update({
      where: { id: result.payments[1].id },
      data: { dueDate: oldDate }
    });
    console.log(`⏰ Date due du 2ème paiement modifiée à ${oldDate.toLocaleDateString()}\n`);
    
    // 6. Exécuter la vérification des paiements en retard
    console.log('6️⃣ Exécution du job de vérification...');
    const checkResult = await checkOverduePayments();
    
    console.log(`\n📊 Résultats de la vérification:`);
    console.log(`   - Paiements en retard: ${checkResult.overduePayments}`);
    console.log(`   - Abonnements pausés: ${checkResult.pausedSubscriptions}`);
    
    // 7. Vérifier le nouveau statut
    console.log('\n7️⃣ Vérification du nouveau statut...');
    const updatedStatus = await getSubscriptionStatus(result.subscription.id);
    console.log(`   - Statut de l'abonnement: ${updatedStatus.subscription.status}`);
    console.log(`   - Paiements en retard: ${updatedStatus.stats.overduePayments}`);
    
    // 8. Nettoyer (optionnel - supprimer les données de test)
    console.log('\n8️⃣ Nettoyage des données de test...');
    const shouldCleanup = process.argv.includes('--cleanup');
    
    if (shouldCleanup) {
      await prisma.payment.deleteMany({
        where: { subscriptionId: result.subscription.id }
      });
      await prisma.subscription.delete({
        where: { id: result.subscription.id }
      });
      console.log('✅ Données de test supprimées');
    } else {
      console.log('⏭️  Données conservées (utilisez --cleanup pour supprimer)');
      console.log(`   Abonnement ID: ${result.subscription.id}`);
    }
    
    console.log('\n🎉 === TEST TERMINÉ AVEC SUCCÈS ===\n');
    
  } catch (error) {
    console.error('\n❌ ERREUR LORS DU TEST:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter les tests
testSubscriptionSystem()
  .then(() => {
    console.log('✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
