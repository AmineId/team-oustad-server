/**
 * Script de test pour l'acquittement de paiements
 * Test l'endpoint POST /subscriptions/payments/:paymentId/acknowledge
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Fonction d'aide pour les logs colorés
function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

async function testAcknowledgePayment() {
  try {
    log('🚀', 'Début du test d\'acquittement de paiement...\n');

    // 1. Se connecter en tant qu'admin
    log('🔐', 'Connexion en tant qu\'admin...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@teamfitness.com',
      password: 'admin123'
    });

    const token = loginResponse.data.token;
    log('✅', `Connecté avec succès - Token: ${token.substring(0, 20)}...\n`);

    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };

    // 2. Créer un nouvel abonnement avec statut "pending"
    log('📝', 'Création d\'un abonnement en attente...');
    
    // D'abord, récupérer un membre
    const usersResponse = await axios.get(`${BASE_URL}/users?role=member`, config);
    const members = usersResponse.data.users || usersResponse.data;
    
    if (!members || members.length === 0) {
      log('❌', 'Aucun membre trouvé dans la base de données');
      return;
    }

    const testMember = members[0];
    log('👤', `Membre sélectionné: ${getFullName(testMember)} (ID: ${testMember.id})`);

    // Récupérer les types d'abonnement disponibles
    const typesResponse = await axios.get(`${BASE_URL}/subscription-types`, config);
    const subscriptionTypes = typesResponse.data.types;
    
    if (!subscriptionTypes || subscriptionTypes.length === 0) {
      log('❌', 'Aucun type d\'abonnement disponible');
      return;
    }

    const testType = subscriptionTypes[0];
    log('📋', `Type d'abonnement: ${testType.name} - ${testType.monthlyPrice}€/mois\n`);

    // 3. Créer l'abonnement
    log('🔨', 'Création de l\'abonnement...');
    const subscriptionResponse = await axios.post(
      `${BASE_URL}/subscriptions`,
      {
        memberId: testMember.id,
        subscriptionTypeId: testType.id,
        startDate: new Date().toISOString()
      },
      config
    );

    const subscription = subscriptionResponse.data.subscription;
    const payments = subscriptionResponse.data.payments;
    
    log('✅', `Abonnement créé avec ID: ${subscription.id}`);
    log('💳', `${payments.length} paiements générés`);
    log('📊', `Statut initial de l'abonnement: ${subscription.status}\n`);

    // 4. Modifier le statut de l'abonnement à "pending" pour le test
    const prisma = require('../../utils/prismaClient');
const { getFullName } = require("../../utils/nameUtils");
    
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'pending' }
    });
    
    log('🔄', 'Abonnement mis en statut "pending" pour le test\n');

    // 5. Récupérer le premier paiement
    const firstPayment = payments[0];
    log('💰', `Premier paiement à acquitter:`);
    log('   ', `ID: ${firstPayment.id}`);
    log('   ', `Montant: ${firstPayment.amount}€`);
    log('   ', `Statut: ${firstPayment.status}`);
    log('   ', `Dû le: ${new Date(firstPayment.dueDate).toLocaleDateString()}\n`);

    // 6. Acquitter le paiement
    log('✨', 'Acquittement du paiement...');
    const acknowledgeResponse = await axios.post(
      `${BASE_URL}/subscriptions/payments/${firstPayment.id}/acknowledge`,
      {
        paymentMethod: 'card',
        transactionId: `TEST_${Date.now()}`
      },
      config
    );

    const result = acknowledgeResponse.data;
    
    log('✅', result.message);
    log('💳', `Paiement ${result.payment.id}:`);
    log('   ', `Statut: ${result.payment.status}`);
    log('   ', `Payé le: ${new Date(result.payment.paidAt).toLocaleString()}`);
    log('   ', `Méthode: ${result.payment.paymentMethod}`);
    
    if (result.subscription) {
      log('\n📋', `Abonnement ${result.subscription.id}:`);
      log('   ', `Statut: ${result.subscription.status} ${result.subscription.status === 'active' ? '✅' : ''}`);
      log('   ', `Type: ${result.subscription.type}`);
      log('   ', `Période: ${new Date(result.subscription.startDate).toLocaleDateString()} → ${new Date(result.subscription.endDate).toLocaleDateString()}`);
    }

    // 7. Vérifier le statut de l'abonnement
    log('\n🔍', 'Vérification du statut final de l\'abonnement...');
    const statusResponse = await axios.get(
      `${BASE_URL}/subscriptions/${subscription.id}`,
      config
    );

    const status = statusResponse.data;
    log('📊', `Abonnement ID ${status.subscription.id}:`);
    log('   ', `Statut: ${status.subscription.status}`);
    log('   ', `Paiements complétés: ${status.stats.completedPayments}/${status.stats.totalPayments}`);
    log('   ', `Progression: ${status.stats.percentComplete}%`);

    if (status.subscription.status === 'active') {
      log('\n🎉', 'TEST RÉUSSI ! L\'abonnement a bien été activé après l\'acquittement du paiement');
    } else {
      log('\n⚠️', `ATTENTION ! L'abonnement est toujours en statut "${status.subscription.status}"`);
    }

    // await prisma.$disconnect();

  } catch (error) {
    log('❌', 'Erreur pendant le test:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Exécuter le test
testAcknowledgePayment();
