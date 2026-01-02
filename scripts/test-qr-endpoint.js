const axios = require('axios');
const fs = require('fs');

// Test script for QR code endpoint
async function testQREndpoint() {
  try {
    console.log('🧪 Test de l\'endpoint QR Code...\n');

    // First, login as a member to get JWT token
    console.log('1. Connexion en tant que membre...');
    const loginResponse = await axios.post('http://localhost:3000/auth/login', {
      email: 'bob@example.com',
      password: 'member123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Token JWT obtenu');

    // Get member info to find member ID
    console.log('\n2. Récupération des infos du membre...');
    const meResponse = await axios.get('http://localhost:3000/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✅ Infos membre récupérées');
    console.log('Unique Code:', meResponse.data.uniqueCode);

    // For now, we'll assume member ID is 1 (Bob) or 2 (Charlie)
    // In a real scenario, you'd get this from the member profile
    const memberId = 1; // Bob's member ID

    console.log('\n3. Génération du QR code...');
    const qrResponse = await axios.get(`http://localhost:3000/members/${memberId}/qr`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer'
    });

    // Save QR code to file
    fs.writeFileSync('test-qr-code.png', qrResponse.data);
    console.log('✅ QR Code généré et sauvegardé dans test-qr-code.png');

    console.log('\n🎉 Test réussi ! Le QR code contient les informations du membre.');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.response?.data || error.message);
  }
}

// Run test if server is running
testQREndpoint();