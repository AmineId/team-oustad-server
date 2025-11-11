/**
 * Test rapide de l'endpoint d'acquittement avec Olivia (abonnement pending dans le seed)
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testAcknowledgeOlivia() {
  try {
    console.log('🎯 Test d\'acquittement pour Olivia (abonnement pending du seed)\n');

    // 1. Connexion admin
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@teamfitness.com',
      password: 'admin123'
    });

    const token = loginResponse.data.token;
    const config = { headers: { Authorization: `Bearer ${token}` } };

    // 2. Trouver Olivia
    const usersResponse = await axios.get(`${BASE_URL}/users?role=member`, config);
    const members = usersResponse.data.users || usersResponse.data;
    const olivia = members.find(m => m.email === 'olivia@example.com');

    if (!olivia) {
      console.log('❌ Olivia non trouvée dans la base de données');
      return;
    }

    console.log(`✅ Olivia trouvée: ${olivia.fullName} (ID: ${olivia.id})`);

    // 3. Récupérer ses abonnements
    const subsResponse = await axios.get(
      `${BASE_URL}/subscriptions/member/${olivia.id}`,
      config
    );

    const subscription = subsResponse.data.subscriptions[0];
    console.log(`\n📋 Abonnement:`);
    console.log(`   ID: ${subscription.id}`);
    console.log(`   Type: ${subscription.subscriptionType.name}`);
    console.log(`   Statut: ${subscription.status} ${subscription.status === 'pending' ? '⏳' : ''}`);
    console.log(`   Prix: ${subscription.subscriptionType.monthlyPrice}€/mois`);

    // 4. Récupérer le premier paiement
    const firstPayment = subscription.payments[0];
    console.log(`\n💰 Premier paiement:`);
    console.log(`   ID: ${firstPayment.id}`);
    console.log(`   Statut: ${firstPayment.status}`);
    console.log(`   Montant: ${firstPayment.amount}€`);
    console.log(`   Dû le: ${new Date(firstPayment.dueDate).toLocaleDateString()}`);

    if (firstPayment.status === 'completed') {
      console.log('\n⚠️  Le paiement est déjà acquitté, réinitialiser la base si besoin');
      return;
    }

    // 5. Acquitter le paiement
    console.log(`\n✨ Acquittement du paiement ${firstPayment.id}...`);
    
    const acknowledgeResponse = await axios.post(
      `${BASE_URL}/subscriptions/payments/${firstPayment.id}/acknowledge`,
      {
        paymentMethod: 'card',
        transactionId: `TEST_OLIVIA_${Date.now()}`
      },
      config
    );

    const result = acknowledgeResponse.data;
    
    console.log(`\n✅ ${result.message}`);
    console.log(`\n💳 Paiement mis à jour:`);
    console.log(`   Statut: ${result.payment.status} ✅`);
    console.log(`   Payé le: ${new Date(result.payment.paidAt).toLocaleString()}`);
    console.log(`   Méthode: ${result.payment.paymentMethod}`);
    
    if (result.subscription) {
      console.log(`\n📋 Abonnement mis à jour:`);
      console.log(`   ID: ${result.subscription.id}`);
      console.log(`   Statut: ${result.subscription.status} ${result.subscription.status === 'active' ? '✅ ACTIVÉ!' : ''}`);
      console.log(`   Type: ${result.subscription.type}`);
    }

    if (result.subscription && result.subscription.status === 'active') {
      console.log(`\n🎉 SUCCÈS ! L'abonnement d'Olivia a été activé automatiquement !`);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

testAcknowledgeOlivia();
