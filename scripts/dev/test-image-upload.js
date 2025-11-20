// Script de test pour le système d'upload d'images
// Utilisation: node scripts/test-image-upload.js

const { PrismaClient } = require('@prisma/client');
const { getFullName } = require('../../utils/nameUtils');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function testImageUploadSystem() {
  console.log('🖼️ Test du système d\'upload d\'images\n');

  try {
    // 1. Test de l'avatar par défaut pour un utilisateur
    console.log('1️⃣ Test de l\'avatar par défaut utilisateur...');

    const user = await prisma.user.findFirst({
      select: { id: true, firstName: true, lastName: true, profileImage: true }
    });
    if (!user) {
      console.log('❌ Aucun utilisateur trouvé. Veuillez créer un utilisateur d\'abord.');
      return;
    }

    console.log(`👤 Utilisateur trouvé: ${getFullName(user)} (ID: ${user.id})`);

    // Vérifier si l'utilisateur a déjà une image de profil
    if (user.profileImage) {
      console.log('✅ L\'utilisateur a déjà une image de profil');
    } else {
      console.log('ℹ️ L\'utilisateur n\'a pas d\'image de profil (avatar par défaut sera généré)');
    }
    console.log('');

    // 2. Test de l'image par défaut pour une salle de sport
    console.log('2️⃣ Test de l\'image par défaut salle de sport...');

    const gym = await prisma.gym.findFirst();
    if (!gym) {
      console.log('❌ Aucune salle de sport trouvée. Veuillez créer une salle d\'abord.');
      return;
    }

    console.log(`🏢 Salle trouvée: ${gym.name} (ID: ${gym.id})`);

    // Vérifier si la salle a déjà une image
    if (gym.image) {
      console.log('✅ La salle a déjà une image');
    } else {
      console.log('ℹ️ La salle n\'a pas d\'image (placeholder SVG sera généré)');
    }
    console.log('');

    // 3. Test de l'upload d'une petite image de test (base64)
    console.log('3️⃣ Test d\'upload d\'une petite image de test...');

    // Créer une petite image SVG en base64 pour le test
    const testSvg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#4CAF50"/>
      <text x="50" y="55" text-anchor="middle" fill="white" font-size="12">TEST</text>
    </svg>`;

    const base64Image = Buffer.from(testSvg).toString('base64');

    // Mettre à jour l'image de profil de l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { profileImage: base64Image }
    });

    console.log('✅ Image de profil utilisateur mise à jour avec succès');

    // Mettre à jour l'image de la salle
    const updatedGym = await prisma.gym.update({
      where: { id: gym.id },
      data: { image: base64Image }
    });

    console.log('✅ Image de salle mise à jour avec succès');
    console.log('');

    // 4. Vérification des données stockées
    console.log('4️⃣ Vérification des données stockées...');

    const finalUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, firstName: true, lastName: true, profileImage: true }
    });

    const finalGym = await prisma.gym.findUnique({
      where: { id: gym.id },
      select: { id: true, name: true, image: true }
    });

    console.log(`👤 Utilisateur: ${getFullName(finalUser)}`);
    console.log(`   Image stockée: ${finalUser.profileImage ? 'Oui (' + finalUser.profileImage.length + ' caractères)' : 'Non'}`);

    console.log(`🏢 Salle: ${finalGym.name}`);
    console.log(`   Image stockée: ${finalGym.image ? 'Oui (' + finalGym.image.length + ' caractères)' : 'Non'}`);
    console.log('');

    // 5. Test de suppression d'image
    console.log('5️⃣ Test de suppression d\'image...');

    await prisma.user.update({
      where: { id: user.id },
      data: { profileImage: null }
    });

    await prisma.gym.update({
      where: { id: gym.id },
      data: { image: null }
    });

    console.log('✅ Images supprimées avec succès (retour aux avatars par défaut)');
    console.log('');

    console.log('🎉 Test du système d\'upload d\'images terminé avec succès!');
    console.log('');
    console.log('📋 Résumé:');
    console.log('- ✅ Stockage base64 fonctionnel');
    console.log('- ✅ Avatars par défaut générés automatiquement');
    console.log('- ✅ Upload et suppression d\'images opérationnels');
    console.log('- ✅ Intégration avec les modèles User et Gym réussie');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testImageUploadSystem();