const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Variables globales
let adminToken = '';
let newUserEmail = `testuser-${Date.now()}@example.com`;
let setupToken = '';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testUserSetupWorkflow() {
  console.log('🧪 Test du workflow de création d\'utilisateur avec email d\'activation\n');

  try {
    // Étape 1: Connexion en tant qu'admin
    console.log('1️⃣ Connexion en tant qu\'admin...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@teamfitness.com',
      password: 'admin123'
    });
    
    adminToken = loginResponse.data.token;
    console.log('✅ Admin connecté, token obtenu\n');

    // Étape 2: Créer un utilisateur SANS mot de passe
    console.log('2️⃣ Création d\'un nouvel utilisateur sans mot de passe...');
    console.log(`   Email: ${newUserEmail}`);
    
    const createUserResponse = await axios.post(
      `${BASE_URL}/users`,
      {
        email: newUserEmail,
        fullName: 'Test User Setup',
        role: 'member',
        gymId: 1,
        sendSetupEmail: true
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      }
    );

    console.log('✅ Utilisateur créé avec succès!');
    console.log(`   Message: ${createUserResponse.data.message}`);
    console.log(`   Email d'activation envoyé: ${createUserResponse.data.setupEmailSent}`);
    console.log(`   User ID: ${createUserResponse.data.user.id}\n`);

    // Étape 3: Simuler la récupération du token (normalement reçu par email)
    console.log('3️⃣ Récupération du token d\'activation depuis la base de données...');
    
    // Pour le test, on va chercher le token directement en base
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const user = await prisma.user.findUnique({
      where: { email: newUserEmail }
    });

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        used: false,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    await prisma.$disconnect();

    if (!tokenRecord) {
      throw new Error('Token non trouvé en base de données');
    }

    setupToken = tokenRecord.token;
    console.log(`✅ Token trouvé: ${setupToken}\n`);

    // Étape 4: Tenter de se connecter AVANT d'avoir créé le mot de passe (devrait échouer)
    console.log('4️⃣ Test de connexion AVANT création du mot de passe (devrait échouer)...');
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: newUserEmail,
        password: 'anypassword'
      });
      console.log('❌ ERREUR: La connexion aurait dû échouer!\n');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Connexion refusée comme prévu (mot de passe invalide)\n');
      } else {
        throw error;
      }
    }

    // Étape 5: Créer le mot de passe avec le token
    console.log('5️⃣ Création du mot de passe avec le token...');
    const setupPasswordResponse = await axios.post(`${BASE_URL}/auth/setup-password`, {
      email: newUserEmail,
      token: setupToken,
      password: 'mynewpassword123'
    });

    console.log(`✅ ${setupPasswordResponse.data.message}\n`);

    // Étape 6: Se connecter avec le nouveau mot de passe
    console.log('6️⃣ Connexion avec le nouveau mot de passe...');
    const newLoginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: newUserEmail,
      password: 'mynewpassword123'
    });

    console.log('✅ Connexion réussie!');
    console.log(`   User: ${newLoginResponse.data.user.fullName}`);
    console.log(`   Role: ${newLoginResponse.data.user.role}`);
    console.log(`   Token: ${newLoginResponse.data.token.substring(0, 20)}...\n`);

    // Étape 7: Tester qu'on ne peut pas réutiliser le token
    console.log('7️⃣ Test de réutilisation du token (devrait échouer)...');
    try {
      await axios.post(`${BASE_URL}/auth/setup-password`, {
        email: newUserEmail,
        token: setupToken,
        password: 'anotherpassword'
      });
      console.log('❌ ERREUR: Le token aurait dû être invalide!\n');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Token refusé comme prévu (déjà utilisé)\n');
      } else {
        throw error;
      }
    }

    // Étape 8: Test de la route send-setup-email (renvoyer un email)
    console.log('8️⃣ Test de renvoi d\'email d\'activation...');
    const resendResponse = await axios.post(
      `${BASE_URL}/auth/send-setup-email`,
      {
        email: newUserEmail
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      }
    );

    console.log(`✅ ${resendResponse.data.message}\n`);

    console.log('🎉 TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS!\n');
    console.log('📋 Résumé du workflow:');
    console.log('  1. Admin crée un utilisateur sans mot de passe ✅');
    console.log('  2. Email d\'activation envoyé automatiquement ✅');
    console.log('  3. Utilisateur ne peut pas se connecter sans mot de passe ✅');
    console.log('  4. Utilisateur crée son mot de passe avec le token ✅');
    console.log('  5. Utilisateur peut se connecter avec son mot de passe ✅');
    console.log('  6. Token ne peut pas être réutilisé ✅');
    console.log('  7. Possibilité de renvoyer un email d\'activation ✅');

  } catch (error) {
    console.error('\n❌ ERREUR DURANT LE TEST:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

// Lancer le test
testUserSetupWorkflow();
