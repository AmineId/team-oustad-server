const axios = require('axios');

// Test script for QR scan endpoint
async function testQRScan() {
  try {
    console.log('🧪 Test de l\'endpoint scan QR...\n');

    // Test different user types
    const testCases = [
      {
        email: 'owner@teamfitness.com',
        password: 'owner123',
        role: 'OWNER',
        expectedAccess: true,
        description: 'Owner - accès toujours autorisé'
      },
      {
        email: 'admin@teamfitness.com',
        password: 'admin123',
        role: 'ADMIN',
        expectedAccess: true,
        description: 'Admin - accès à sa salle'
      },
      {
        email: 'bob@example.com',
        password: 'member123',
        role: 'MEMBER',
        expectedAccess: true,
        description: 'Member avec abonnement actif'
      },
      {
        email: 'charlie@example.com',
        password: 'member123',
        role: 'MEMBER',
        expectedAccess: false,
        description: 'Member avec abonnement expiré (test)'
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n🔐 Test: ${testCase.description}`);
      console.log(`👤 Utilisateur: ${testCase.email}`);

      // Login to get token
      const loginResponse = await axios.post('http://localhost:3000/auth/login', {
        email: testCase.email,
        password: testCase.password
      });

      const token = loginResponse.data.token;
      const userUniqueCode = loginResponse.data.user.uniqueCode || 'UNKNOWN';

      console.log(`📱 Unique Code: ${userUniqueCode}`);

      // Scan the QR code
      const scanResponse = await axios.post('http://localhost:3000/auth/scan-qr', {
        uniqueCode: userUniqueCode
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const result = scanResponse.data;

      console.log(`🎯 Résultat: ${result.access ? '✅ ACCÈS AUTORISÉ' : '❌ ACCÈS REFUSÉ'}`);
      console.log(`📝 Raison: ${result.reason}`);

      if (result.access !== testCase.expectedAccess) {
        console.log(`⚠️  ATTENTION: Résultat inattendu!`);
      }

      if (result.subscription) {
        console.log(`💳 Abonnement: ${result.subscription.plan} (${result.subscription.membership})`);
        if (result.subscription.daysRemaining) {
          console.log(`📅 Jours restants: ${result.subscription.daysRemaining}`);
        }
      }
    }

    console.log('\n🎉 Tests de scan QR terminés !');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.response?.data || error.message);
  }
}

// Run test
testQRScan();