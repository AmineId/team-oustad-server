const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Utilisateur owner pour les tests
const OWNER_EMAIL = 'owner@gym.com';
const OWNER_PASSWORD = 'ownerpass123';

let ownerToken = '';

async function login() {
  console.log('\n🔐 Login en tant que owner...');
  const response = await axios.post(`${BASE_URL}/auth/login`, {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD
  });
  ownerToken = response.data.token;
  console.log('✅ Login réussi');
  return response.data;
}

async function listSubscriptionTypes() {
  console.log('\n📋 Liste des types d\'abonnements...');
  const response = await axios.get(`${BASE_URL}/subscription-types`);
  console.log(`✅ ${response.data.types.length} types trouvés:`);
  response.data.types.forEach(type => {
    console.log(`   - ${type.name}: ${type.monthlyPrice}€/mois (ID: ${type.id})`);
    if (type.description) console.log(`     ${type.description}`);
  });
  return response.data.types;
}

async function getSubscriptionTypeDetails(typeId) {
  console.log(`\n🔍 Détails du type d'abonnement ${typeId}...`);
  const response = await axios.get(`${BASE_URL}/subscription-types/${typeId}`);
  console.log('✅ Détails récupérés:');
  console.log(`   Nom: ${response.data.type.name}`);
  console.log(`   Prix: ${response.data.type.monthlyPrice}€/mois`);
  console.log(`   Actif: ${response.data.type.isActive ? 'Oui' : 'Non'}`);
  console.log(`   Nombre d'abonnements: ${response.data.type._count.subscriptions}`);
  return response.data.type;
}

async function createSubscriptionType() {
  console.log('\n➕ Création d\'un nouveau type d\'abonnement...');
  try {
    const response = await axios.post(
      `${BASE_URL}/subscription-types`,
      {
        name: 'Test Type',
        description: 'Type de test créé automatiquement',
        monthlyPrice: 39.99,
        features: ['Accès salle', 'Planning personnalisé', 'Support 24/7']
      },
      {
        headers: { Authorization: `Bearer ${ownerToken}` }
      }
    );
    console.log('✅ Type créé:', response.data.type.name, `(ID: ${response.data.type.id})`);
    return response.data.type;
  } catch (error) {
    if (error.response?.data?.error.includes('existe déjà')) {
      console.log('⚠️ Type existe déjà, on continue...');
      return null;
    }
    throw error;
  }
}

async function updateSubscriptionType(typeId) {
  console.log(`\n✏️ Mise à jour du type ${typeId}...`);
  const response = await axios.put(
    `${BASE_URL}/subscription-types/${typeId}`,
    {
      monthlyPrice: 44.99,
      description: 'Type mis à jour par le test'
    },
    {
      headers: { Authorization: `Bearer ${ownerToken}` }
    }
  );
  console.log('✅ Type mis à jour:', response.data.type.name);
  console.log(`   Nouveau prix: ${response.data.type.monthlyPrice}€/mois`);
  return response.data.type;
}

async function createSubscriptionWithType(memberId, typeId) {
  console.log(`\n🎫 Création d'un abonnement avec le type ${typeId}...`);
  const response = await axios.post(
    `${BASE_URL}/subscriptions`,
    {
      memberId,
      subscriptionTypeId: typeId,
      startDate: new Date().toISOString()
    },
    {
      headers: { Authorization: `Bearer ${ownerToken}` }
    }
  );
  console.log('✅ Abonnement créé:');
  console.log(`   ID: ${response.data.subscription.id}`);
  console.log(`   Type: ${response.data.subscriptionType.name}`);
  console.log(`   Prix mensuel: ${response.data.subscriptionType.monthlyPrice}€`);
  console.log(`   Paiements générés: ${response.data.paymentsGenerated}`);
  
  // Afficher les 3 premiers paiements
  console.log('   Premiers paiements:');
  response.data.payments.slice(0, 3).forEach(p => {
    console.log(`     - Mois ${p.monthNumber}: ${p.amount}€ dû le ${new Date(p.dueDate).toLocaleDateString()}`);
  });
  
  return response.data;
}

async function getMemberSubscriptions(memberId) {
  console.log(`\n📊 Récupération des abonnements du membre ${memberId}...`);
  const response = await axios.get(
    `${BASE_URL}/subscriptions/member/${memberId}`,
    {
      headers: { Authorization: `Bearer ${ownerToken}` }
    }
  );
  console.log(`✅ ${response.data.subscriptions.length} abonnement(s) trouvé(s):`);
  response.data.subscriptions.forEach(sub => {
    console.log(`   - ID ${sub.id}: ${sub.subscriptionType.name} (${sub.status})`);
    console.log(`     ${sub.payments.filter(p => p.status === 'completed').length}/${sub.payments.length} paiements complétés`);
  });
  return response.data.subscriptions;
}

async function deactivateSubscriptionType(typeId) {
  console.log(`\n❌ Désactivation du type ${typeId}...`);
  try {
    const response = await axios.delete(
      `${BASE_URL}/subscription-types/${typeId}`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` }
      }
    );
    console.log('✅ Type désactivé:', response.data.type.name);
    return response.data.type;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('⚠️ Impossible de désactiver: des abonnements actifs utilisent ce type');
      return null;
    }
    throw error;
  }
}

async function runTests() {
  console.log('🧪 === TEST DU SYSTÈME DE TYPES D\'ABONNEMENTS ===\n');
  
  try {
    // 1. Login
    const user = await login();
    
    // 2. Lister les types existants
    const types = await listSubscriptionTypes();
    const basicType = types.find(t => t.name === 'Basic');
    const premiumType = types.find(t => t.name === 'Premium');
    
    if (!basicType || !premiumType) {
      console.error('❌ Types Basic ou Premium non trouvés dans la DB');
      return;
    }
    
    // 3. Détails d'un type
    await getSubscriptionTypeDetails(basicType.id);
    
    // 4. Créer un nouveau type (owner uniquement)
    const newType = await createSubscriptionType();
    
    // 5. Mettre à jour un type (si créé)
    if (newType) {
      await updateSubscriptionType(newType.id);
    }
    
    // 6. Créer un abonnement avec un type existant
    // Supposons qu'il y a un membre avec ID 2
    const memberId = 2;
    const subscription = await createSubscriptionWithType(memberId, premiumType.id);
    
    // 7. Récupérer les abonnements du membre
    await getMemberSubscriptions(memberId);
    
    // 8. Vérifier qu'on ne peut pas supprimer un type avec abonnements actifs
    await deactivateSubscriptionType(premiumType.id);
    
    // 9. Désactiver le type de test (sans abonnements actifs)
    if (newType) {
      await deactivateSubscriptionType(newType.id);
    }
    
    console.log('\n✅ === TOUS LES TESTS RÉUSSIS ===');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Détails:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

runTests();
