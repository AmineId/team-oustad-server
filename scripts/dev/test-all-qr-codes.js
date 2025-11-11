const axios = require('axios');
const fs = require('fs');

// Test script for all user QR codes
async function testAllUserQRCodes() {
  try {
    console.log('🧪 Test de tous les QR codes utilisateurs...\n');

    // Test data for different user types
    const testUsers = [
      { email: 'owner@teamfitness.com', password: 'owner123', role: 'OWNER' },
      { email: 'admin@teamfitness.com', password: 'admin123', role: 'ADMIN' },
      { email: 'bob@example.com', password: 'member123', role: 'MEMBER' },
      { email: 'charlie@example.com', password: 'member123', role: 'MEMBER' }
    ];

    for (const testUser of testUsers) {
      console.log(`\n🔐 Test pour ${testUser.role}: ${testUser.email}`);

      // Login
      const loginResponse = await axios.post('http://localhost:3000/auth/login', {
        email: testUser.email,
        password: testUser.password
      });

      const token = loginResponse.data.token;
      const userId = loginResponse.data.user.id;

      console.log(`✅ Connecté - User ID: ${userId}`);

      // Get user profile to see uniqueCode
      const profileResponse = await axios.get('http://localhost:3000/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log(`📱 Display ID: ${profileResponse.data.displayId}`);

      // Generate QR code
      const qrResponse = await axios.get(`http://localhost:3000/users/${userId}/qr`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'arraybuffer'
      });

      // Save QR code
      const filename = `test-${testUser.role.toLowerCase()}-${profileResponse.data.displayId}-qr.png`;
      fs.writeFileSync(filename, qrResponse.data);

      console.log(`✅ QR Code généré: ${filename}`);
    }

    console.log('\n🎉 Tous les tests de QR codes réussis !');
    console.log('📁 Fichiers générés:');
    console.log('- test-owner-XXXXXXX-qr.png');
    console.log('- test-admin-XXXXXXX-qr.png');
    console.log('- test-member-XXXXXXX-qr.png (x2)');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.response?.data || error.message);
  }
}

// Run test if server is running
testAllUserQRCodes();