const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function quickAPITest() {
  console.log('🧪 Test rapide de l\'API d\'abonnements\n');
  
  try {
    // 1. Test de santé
    console.log('1️⃣ Test de santé du serveur...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Serveur actif:', health.data.ok);
    
    // 2. Login
    console.log('\n2️⃣ Login admin...');
    const login = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@teamfitness.com',
      password: 'admin123'
    });
    console.log('✅ Login réussi');
    const token = login.data.token;
    
    // 3. Trouver un membre
    console.log('\n3️⃣ Recherche d\'un membre...');
    const users = await axios.get(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const member = users.data.users.find(u => u.role === 'member');
    
    if (!member) {
      console.log('⚠️  Aucun membre trouvé');
      return;
    }
    
    console.log(`✅ Membre trouvé: ${member.fullName} (ID: ${member.id})`);
    
    // 4. Créer un abonnement
    console.log('\n4️⃣ Création d\'un abonnement annuel...');
    const subscription = await axios.post(`${BASE_URL}/subscriptions`, {
      memberId: member.id,
      plan: 'premium',
      monthlyPrice: 49.99
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`✅ Abonnement créé: ID ${subscription.data.subscription.id}`);
    console.log(`✅ ${subscription.data.paymentsGenerated} paiements générés`);
    
    const subscriptionId = subscription.data.subscription.id;
    
    // 5. Vérifier le statut
    console.log('\n5️⃣ Vérification du statut...');
    const status = await axios.get(`${BASE_URL}/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`\n📊 Statut de l'abonnement:`);
    console.log(`   - ID: ${status.data.subscription.id}`);
    console.log(`   - Statut: ${status.data.subscription.status}`);
    console.log(`   - Paiements totaux: ${status.data.stats.totalPayments}`);
    console.log(`   - Complétés: ${status.data.stats.completedPayments}`);
    console.log(`   - En attente: ${status.data.stats.pendingPayments}`);
    console.log(`   - En retard: ${status.data.stats.overduePayments}`);
    console.log(`   - Progression: ${status.data.stats.percentComplete}%`);
    
    if (status.data.nextPayment) {
      console.log(`\n💰 Prochain paiement:`);
      console.log(`   - Montant: ${status.data.nextPayment.amount}€`);
      console.log(`   - Date due: ${new Date(status.data.nextPayment.dueDate).toLocaleDateString()}`);
      console.log(`   - Mois: ${status.data.nextPayment.monthNumber}/12`);
    }
    
    // 6. Marquer le premier paiement comme complété
    console.log('\n6️⃣ Complétion du premier paiement...');
    const firstPaymentId = subscription.data.payments[0].id;
    
    const paymentComplete = await axios.post(
      `${BASE_URL}/subscriptions/payments/${firstPaymentId}/complete`,
      {
        paymentMethod: 'card',
        transactionId: `TEST_TXN_${Date.now()}`
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    console.log(`✅ Paiement ${firstPaymentId} marqué comme complété`);
    
    // 7. Vérifier le statut mis à jour
    console.log('\n7️⃣ Vérification du statut mis à jour...');
    const updatedStatus = await axios.get(`${BASE_URL}/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`   - Paiements complétés: ${updatedStatus.data.stats.completedPayments}`);
    console.log(`   - Progression: ${updatedStatus.data.stats.percentComplete}%`);
    
    console.log('\n🎉 Test API complet réussi!\n');
    console.log('📝 Pour nettoyer les données de test:');
    console.log(`   Abonnement ID: ${subscriptionId}`);
    
  } catch (error) {
    console.error('\n❌ Erreur lors du test:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message:`, error.response.data);
    } else {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

quickAPITest()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
