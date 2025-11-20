const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {
  generateUserIdByRole,
  generateGymId,
  generateSubscriptionId,
  generatePaymentId,
  generatePlanningId,
  generateExerciseId,
  generateSubscriptionTypeId
} = require('../utils/idGenerator');

async function main() {
  console.log('🌱 Début du seed de la base de données...\n');

  // Clear existing data (safe for dev only) - in correct order due to foreign keys
  console.log('🗑️  Suppression des données existantes...');
  // Delete dependent entities first (planning exercises -> planning days -> plannings)
  await prisma.planningExercise.deleteMany();
  await prisma.planningDay.deleteMany();
  await prisma.planning.deleteMany();
  await prisma.exercise.deleteMany();
  // Payment and subscription depend on member
  await prisma.payment.deleteMany();
  await prisma.subscription.deleteMany();
  // SubscriptionType can be deleted after subscriptions
  await prisma.subscriptionType.deleteMany();
  // Members depend on users
  await prisma.member.deleteMany();
  // Admin/Owner also depend on users
  await prisma.admin.deleteMany();
  await prisma.owner.deleteMany();
  // Password reset tokens must be removed before users
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.openingHour.deleteMany();
  await prisma.gym.deleteMany();
  console.log('✅ Données supprimées\n');

  // Hash des mots de passe
  console.log('🔐 Génération des mots de passe...');
  const hashed = await bcrypt.hash('admin123', 10);
  const memberPassword = await bcrypt.hash('member123', 10);
  const ownerPassword = await bcrypt.hash('owner123', 10);
  console.log('✅ Mots de passe générés\n');

  // Créer les salles de sport
  console.log('🏋️ Création des salles de sport...');
  
  const gym1 = await prisma.gym.create({
    data: {
      displayId: generateGymId(),
      name: 'Downtown Fitness Center',
      address: '123 Main Street, New York, NY 10001',
      phone: '+1 (555) 123-4567',
      User: {
        create: [
          {
            displayId: generateUserIdByRole('owner'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'owner@teamfitness.com',
            password: ownerPassword,
            fullName: 'Sarah Johnson',
            role: 'owner',
            notificationsEnabled: true
          },
          {
            displayId: generateUserIdByRole('admin'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'admin@teamfitness.com',
            password: hashed,
            fullName: 'Mike Anderson',
            role: 'admin',
            notificationsEnabled: true
          },
          {
            displayId: generateUserIdByRole('member'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'bob@example.com',
            password: memberPassword,
            fullName: 'Bob Williams',
            role: 'member',
            notificationsEnabled: true
          },
          {
            displayId: generateUserIdByRole('member'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'charlie@example.com',
            password: memberPassword,
            fullName: 'Charlie Brown',
            role: 'member',
            notificationsEnabled: true
          },
          {
            displayId: generateUserIdByRole('member'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'alice@example.com',
            password: memberPassword,
            fullName: 'Alice Smith',
            role: 'member',
            notificationsEnabled: true
          },
        ],
      },
    },
    include: { User: true },
  });
  console.log(`✅ Salle créée: ${gym1.name}`);

  const gym2 = await prisma.gym.create({
    data: {
      displayId: generateGymId(),
      name: 'Uptown Elite Gym',
      address: '456 Park Avenue, New York, NY 10022',
      phone: '+1 (555) 987-6543',
      User: {
        create: [
          {
            displayId: generateUserIdByRole('admin'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'admin2@teamfitness.com',
            password: hashed,
            fullName: 'Lisa Martinez',
            role: 'admin',
            notificationsEnabled: true
          },
          {
            displayId: generateUserIdByRole('member'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'david@example.com',
            password: memberPassword,
            fullName: 'David Johnson',
            role: 'member',
            notificationsEnabled: true
          },
          {
            displayId: generateUserIdByRole('member'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'emma@example.com',
            password: memberPassword,
            fullName: 'Emma Davis',
            role: 'member',
            notificationsEnabled: true
          },
        ],
      },
    },
    include: { User: true },
  });
  console.log(`✅ Salle créée: ${gym2.name}\n`);

  // Créer les horaires d'ouverture pour gym1
  console.log('⏰ Création des horaires d\'ouverture...');
  const openingHoursGym1 = [];
  for (let day = 1; day <= 6; day++) { // Lundi à Samedi
    openingHoursGym1.push({
      gymId: gym1.id,
      dayOfWeek: day,
      openTime: '06:00',
      closeTime: '22:00',
      isClosed: false
    });
  }
  // Dimanche fermé
  openingHoursGym1.push({
    gymId: gym1.id,
    dayOfWeek: 0,
    openTime: '09:00',
    closeTime: '18:00',
    isClosed: false
  });
  await prisma.openingHour.createMany({ data: openingHoursGym1 });

  // Horaires pour gym2
  const openingHoursGym2 = [];
  for (let day = 1; day <= 5; day++) { // Lundi à Vendredi
    openingHoursGym2.push({
      gymId: gym2.id,
      dayOfWeek: day,
      openTime: '05:00',
      closeTime: '23:00',
      isClosed: false
    });
  }
  // Weekend
  openingHoursGym2.push({
    gymId: gym2.id,
    dayOfWeek: 6,
    openTime: '08:00',
    closeTime: '20:00',
    isClosed: false
  });
  openingHoursGym2.push({
    gymId: gym2.id,
    dayOfWeek: 0,
    openTime: '08:00',
    closeTime: '20:00',
    isClosed: false
  });
  await prisma.openingHour.createMany({ data: openingHoursGym2 });
  console.log('✅ Horaires d\'ouverture créés\n');

  // Créer les profils spécifiques
  console.log('👥 Création des profils utilisateurs...');
  
  // GYM 1 Users
  const ownerUser = gym1.User.find(u => u.role === 'owner');
  const adminUser = gym1.User.find(u => u.role === 'admin');
  const bobUser = gym1.User.find(u => u.email === 'bob@example.com');
  const charlieUser = gym1.User.find(u => u.email === 'charlie@example.com');
  const aliceUser = gym1.User.find(u => u.email === 'alice@example.com');

  // GYM 2 Users
  const admin2User = gym2.User.find(u => u.role === 'admin');
  const davidUser = gym2.User.find(u => u.email === 'david@example.com');
  const emmaUser = gym2.User.find(u => u.email === 'emma@example.com');

  // Owner profile
  await prisma.owner.create({
    data: {
      userId: ownerUser.id,
      canManageAdmins: true,
      canManageGyms: true,
      canViewReports: true,
      maxGymsAllowed: 10,
    }
  });
  console.log(`✅ Owner: ${ownerUser.fullName}`);

  // Admin profiles
  await prisma.admin.create({
    data: { userId: adminUser.id }
  });
  console.log(`✅ Admin: ${adminUser.fullName}`);

  await prisma.admin.create({
    data: { userId: admin2User.id }
  });
  console.log(`✅ Admin: ${admin2User.fullName}`);

  // Member profiles
  const bobMember = await prisma.member.create({
    data: {
      userId: bobUser.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: true
    }
  });
  console.log(`✅ Member: ${bobUser.fullName}`);

  const charlieMember = await prisma.member.create({
    data: {
      userId: charlieUser.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: true
    }
  });
  console.log(`✅ Member: ${charlieUser.fullName}`);

  const aliceMember = await prisma.member.create({
    data: {
      userId: aliceUser.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: true
    }
  });
  console.log(`✅ Member: ${aliceUser.fullName}`);

  const davidMember = await prisma.member.create({
    data: {
      userId: davidUser.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: true
    }
  });
  console.log(`✅ Member: ${davidUser.fullName}`);

  const emmaMember = await prisma.member.create({
    data: {
      userId: emmaUser.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: false
    }
  });
  console.log(`✅ Member: ${emmaUser.fullName}\n`);

  // Créer les types d'abonnements
  console.log('🏷️  Création des types d\'abonnements...');
  
  const basicType = await prisma.subscriptionType.create({
    data: {
      displayId: generateSubscriptionTypeId(),
      name: 'Basic',
      description: 'Accès essentiel à la salle de sport',
      monthlyPrice: 29.99,
      features: ['Accès salle 7j/7', 'Vestiaires', 'Casiers'],
      isActive: true
    }
  });
  console.log(`✅ Type créé: ${basicType.name} - ${basicType.monthlyPrice}€/mois`);

  const standardType = await prisma.subscriptionType.create({
    data: {
      displayId: generateSubscriptionTypeId(),
      name: 'Standard',
      description: 'Formule équilibrée avec cours collectifs',
      monthlyPrice: 49.99,
      features: ['Tout Basic +', 'Cours collectifs illimités', 'Douches', 'Accès Wi-Fi'],
      isActive: true
    }
  });
  console.log(`✅ Type créé: ${standardType.name} - ${standardType.monthlyPrice}€/mois`);

  const premiumType = await prisma.subscriptionType.create({
    data: {
      displayId: generateSubscriptionTypeId(),
      name: 'Premium',
      description: 'Formule complète avec coaching personnel',
      monthlyPrice: 79.99,
      features: ['Tout Standard +', '2 séances coach/mois', 'Planning personnalisé', 'Bilan nutritionnel', 'Accès prioritaire'],
      isActive: true
    }
  });
  console.log(`✅ Type créé: ${premiumType.name} - ${premiumType.monthlyPrice}€/mois`);

  const vipType = await prisma.subscriptionType.create({
    data: {
      displayId: generateSubscriptionTypeId(),
      name: 'VIP',
      description: 'Formule exclusive tout compris',
      monthlyPrice: 129.99,
      features: ['Tout Premium +', 'Accès 24/7', 'Coach dédié', 'Spa & Sauna', 'Massage mensuel', 'Salle privée', 'Parking réservé'],
      isActive: true
    }
  });
  console.log(`✅ Type créé: ${vipType.name} - ${vipType.monthlyPrice}€/mois`);

  const studentType = await prisma.subscriptionType.create({
    data: {
      displayId: generateSubscriptionTypeId(),
      name: 'Étudiant',
      description: 'Tarif préférentiel pour étudiants (-25 ans)',
      monthlyPrice: 24.99,
      features: ['Accès salle en journée', 'Vestiaires', 'Cours collectifs limités', 'Justificatif requis'],
      isActive: true
    }
  });
  console.log(`✅ Type créé: ${studentType.name} - ${studentType.monthlyPrice}€/mois`);

  const seniorType = await prisma.subscriptionType.create({
    data: {
      displayId: generateSubscriptionTypeId(),
      name: 'Senior',
      description: 'Formule adaptée aux seniors (+60 ans)',
      monthlyPrice: 34.99,
      features: ['Accès salle adapté', 'Cours seniors', 'Suivi médical', 'Vestiaires adaptés'],
      isActive: true
    }
  });
  console.log(`✅ Type créé: ${seniorType.name} - ${seniorType.monthlyPrice}€/mois`);

  const corporateType = await prisma.subscriptionType.create({
    data: {
      displayId: generateSubscriptionTypeId(),
      name: 'Corporate',
      description: 'Abonnement entreprise pour groupes',
      monthlyPrice: 89.99,
      features: ['Accès 24/7', 'Cours collectifs', 'Coaching', 'Facturation entreprise', 'Tarif dégressif dès 10 personnes'],
      isActive: true
    }
  });
  console.log(`✅ Type créé: ${corporateType.name} - ${corporateType.monthlyPrice}€/mois`);

  const trialType = await prisma.subscriptionType.create({
    data: {
      displayId: generateSubscriptionTypeId(),
      name: 'Découverte',
      description: 'Offre d\'essai 1 mois',
      monthlyPrice: 19.99,
      features: ['Accès salle 1 mois', '1 séance découverte', 'Sans engagement'],
      isActive: true
    }
  });
  console.log(`✅ Type créé: ${trialType.name} - ${trialType.monthlyPrice}€/mois`);

  const inactiveType = await prisma.subscriptionType.create({
    data: {
      displayId: generateSubscriptionTypeId(),
      name: 'Bronze (Ancien)',
      description: 'Ancien type d\'abonnement - plus disponible',
      monthlyPrice: 39.99,
      features: ['Type désactivé'],
      isActive: false
    }
  });
  console.log(`✅ Type créé (inactif): ${inactiveType.name}\n`);

  // Créer des abonnements pour les membres avec les types
  console.log('💳 Création des abonnements...');
  
  // Bob - Premium actif avec 12 paiements (système annuel)
  const bobStartDate = new Date();
  bobStartDate.setMonth(bobStartDate.getMonth() - 2); // Commencé il y a 2 mois
  const bobEndDate = new Date(bobStartDate);
  bobEndDate.setFullYear(bobEndDate.getFullYear() + 1);
  
  const bobSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: bobMember.userId,
      subscriptionTypeId: premiumType.id,
      status: 'active',
      startDate: bobStartDate,
      endDate: bobEndDate,
      autoRenew: true,
    },
  });
  console.log(`✅ Abonnement ${premiumType.name} pour ${bobUser.fullName}`);

  // Charlie - Basic actif récent
  const charlieStartDate = new Date();
  charlieStartDate.setDate(charlieStartDate.getDate() - 10); // Commencé il y a 10 jours
  const charlieEndDate = new Date(charlieStartDate);
  charlieEndDate.setFullYear(charlieEndDate.getFullYear() + 1);
  
  const charlieSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: charlieMember.userId,
      subscriptionTypeId: basicType.id,
      status: 'active',
      startDate: charlieStartDate,
      endDate: charlieEndDate,
      autoRenew: true,
    },
  });
  console.log(`✅ Abonnement ${basicType.name} pour ${charlieUser.fullName}`);

  // Alice - VIP actif de longue date
  const aliceStartDate = new Date();
  aliceStartDate.setMonth(aliceStartDate.getMonth() - 6); // Commencé il y a 6 mois
  const aliceEndDate = new Date(aliceStartDate);
  aliceEndDate.setFullYear(aliceEndDate.getFullYear() + 1);
  
  const aliceSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: aliceMember.userId,
      subscriptionTypeId: vipType.id,
      status: 'active',
      startDate: aliceStartDate,
      endDate: aliceEndDate,
      autoRenew: true,
    },
  });
  console.log(`✅ Abonnement ${vipType.name} pour ${aliceUser.fullName}`);

  // David - Standard actif
  const davidStartDate = new Date();
  davidStartDate.setDate(davidStartDate.getDate() - 20);
  const davidEndDate = new Date(davidStartDate);
  davidEndDate.setFullYear(davidEndDate.getFullYear() + 1);
  
  const davidSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: davidMember.userId,
      subscriptionTypeId: standardType.id,
      status: 'active',
      startDate: davidStartDate,
      endDate: davidEndDate,
      autoRenew: false,
    },
  });
  console.log(`✅ Abonnement ${standardType.name} pour ${davidUser.fullName}`);

  // Emma - Corporate pausé (problème de paiement)
  const emmaStartDate = new Date();
  emmaStartDate.setMonth(emmaStartDate.getMonth() - 3);
  const emmaEndDate = new Date(emmaStartDate);
  emmaEndDate.setFullYear(emmaEndDate.getFullYear() + 1);
  
  const emmaSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: emmaMember.userId,
      subscriptionTypeId: corporateType.id,
      status: 'paused',
      startDate: emmaStartDate,
      endDate: emmaEndDate,
      autoRenew: false,
    },
  });
  console.log(`✅ Abonnement ${corporateType.name} (pausé) pour ${emmaUser.fullName}`);

  // Créer 2 membres supplémentaires pour plus de cas de tests
  const testMember1User = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'frank@example.com',
      password: memberPassword,
      fullName: 'Frank Martin',
      role: 'member',
      gymId: gym1.id,
      notificationsEnabled: true
    }
  });
  const testMember1 = await prisma.member.create({
    data: {
      userId: testMember1User.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: true
    }
  });
  
  // Frank - Étudiant actif
  const frankStartDate = new Date();
  frankStartDate.setDate(frankStartDate.getDate() - 5);
  const frankEndDate = new Date(frankStartDate);
  frankEndDate.setFullYear(frankEndDate.getFullYear() + 1);
  
  const frankSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: testMember1.userId,
      subscriptionTypeId: studentType.id,
      status: 'active',
      startDate: frankStartDate,
      endDate: frankEndDate,
      autoRenew: true,
    },
  });
  console.log(`✅ Abonnement ${studentType.name} pour ${testMember1User.fullName}`);

  const testMember2User = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'grace@example.com',
      password: memberPassword,
      fullName: 'Grace Lee',
      role: 'member',
      gymId: gym2.id,
      notificationsEnabled: true
    }
  });
  const testMember2 = await prisma.member.create({
    data: {
      userId: testMember2User.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: true
    }
  });
  
  // Grace - Découverte (essai) actif
  const graceStartDate = new Date();
  graceStartDate.setDate(graceStartDate.getDate() - 2);
  const graceEndDate = new Date(graceStartDate);
  graceEndDate.setFullYear(graceEndDate.getFullYear() + 1);
  
  const graceSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: testMember2.userId,
      subscriptionTypeId: trialType.id,
      status: 'active',
      startDate: graceStartDate,
      endDate: graceEndDate,
      autoRenew: false,
    },
  });
  console.log(`✅ Abonnement ${trialType.name} pour ${testMember2User.fullName}`);

  // Créer un abonnement expiré pour tester
  const testMember3User = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'henry@example.com',
      password: memberPassword,
      fullName: 'Henry Wilson',
      role: 'member',
      gymId: gym1.id,
      notificationsEnabled: true
    }
  });
  const testMember3 = await prisma.member.create({
    data: {
      userId: testMember3User.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: true
    }
  });
  
  // Henry - Senior expiré
  const henryStartDate = new Date();
  henryStartDate.setFullYear(henryStartDate.getFullYear() - 2); // Commencé il y a 2 ans
  const henryEndDate = new Date(henryStartDate);
  henryEndDate.setFullYear(henryEndDate.getFullYear() + 1); // Expiré il y a 1 an
  
  const henrySubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: testMember3.userId,
      subscriptionTypeId: seniorType.id,
      status: 'expired',
      startDate: henryStartDate,
      endDate: henryEndDate,
      autoRenew: false,
    },
  });
  console.log(`✅ Abonnement ${seniorType.name} (expiré) pour ${testMember3User.fullName}`);

  // Créer un abonnement annulé
  const testMember4User = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'iris@example.com',
      password: memberPassword,
      fullName: 'Iris Thompson',
      role: 'member',
      gymId: gym2.id,
      notificationsEnabled: true
    }
  });
  const testMember4 = await prisma.member.create({
    data: {
      userId: testMember4User.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: true
    }
  });
  
  // Iris - Basic annulé
  const irisStartDate = new Date();
  irisStartDate.setMonth(irisStartDate.getMonth() - 1);
  const irisEndDate = new Date(irisStartDate);
  irisEndDate.setFullYear(irisEndDate.getFullYear() + 1);
  
  const irisSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: testMember4.userId,
      subscriptionTypeId: basicType.id,
      status: 'cancelled',
      startDate: irisStartDate,
      endDate: irisEndDate,
      autoRenew: false,
    },
  });
  console.log(`✅ Abonnement ${basicType.name} (annulé) pour ${testMember4User.fullName}`);

  // Créer un abonnement avec l'ancien type inactif (pour tester la persistance)
  const testMember5User = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'jack@example.com',
      password: memberPassword,
      fullName: 'Jack Brown',
      role: 'member',
      gymId: gym1.id,
      notificationsEnabled: true
    }
  });
  const testMember5 = await prisma.member.create({
    data: {
      userId: testMember5User.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: true
    }
  });
  
  // Jack - Type inactif mais abonnement toujours actif
  const jackStartDate = new Date();
  jackStartDate.setMonth(jackStartDate.getMonth() - 4);
  const jackEndDate = new Date(jackStartDate);
  jackEndDate.setFullYear(jackEndDate.getFullYear() + 1);
  
  const jackSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: testMember5.userId,
      subscriptionTypeId: inactiveType.id,
      status: 'active',
      startDate: jackStartDate,
      endDate: jackEndDate,
      autoRenew: false,
    },
  });
  console.log(`✅ Abonnement ${inactiveType.name} (type inactif, abonnement actif) pour ${testMember5User.fullName}\n`);

  // Abonnement EN ATTENTE - Pour tester l'acquittement de paiement
  // Olivia - Nouvel abonnement Découverte en attente de premier paiement
  const oliviaUser = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'olivia@example.com',
      password: memberPassword,
      fullName: 'Olivia Martinez',
      role: 'member',
      gymId: gym1.id,
      notificationsEnabled: true
    }
  });
  
  const oliviaMember = await prisma.member.create({
    data: {
      userId: oliviaUser.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: true
    }
  });

  const oliviaStartDate = new Date(); // Commence aujourd'hui
  const oliviaEndDate = new Date(oliviaStartDate);
  oliviaEndDate.setFullYear(oliviaEndDate.getFullYear() + 1);

  const oliviaSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: oliviaMember.userId,
      subscriptionTypeId: trialType.id, // Type Découverte
      status: 'pending', // EN ATTENTE du premier paiement
      startDate: oliviaStartDate,
      endDate: oliviaEndDate,
      autoRenew: true,
    },
  });
  console.log(`✅ Abonnement ${trialType.name} (EN ATTENTE) pour ${oliviaUser.fullName} - À activer via /acknowledge\n`);

  // Créer des paiements pour les abonnements
  console.log('💰 Création des paiements...');
  
  const now = new Date();
  const paymentsData = [];

  // Bob - Premium: 12 paiements mensuels (2 complétés, 1 en attente, 9 futurs)
  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(bobStartDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    let status = 'pending';
    let paidAt = null;
    let transactionId = null;
    let paymentMethod = null;
    
    if (i === 0) {
      status = 'completed';
      paidAt = new Date(dueDate);
      paidAt.setDate(paidAt.getDate() + 2);
      transactionId = `txn_bob_${i + 1}`;
      paymentMethod = 'card';
    } else if (i === 1) {
      status = 'completed';
      paidAt = new Date(dueDate);
      paidAt.setDate(paidAt.getDate() + 1);
      transactionId = `txn_bob_${i + 1}`;
      paymentMethod = 'card';
    } else if (dueDate < now && i === 2) {
      // Paiement en retard de quelques jours mais pas encore overdue (< 7 jours)
      status = 'pending';
    } else if (dueDate < now) {
      status = 'pending';
    }
    
    paymentsData.push({
      displayId: generatePaymentId(),
      memberId: bobMember.userId,
      subscriptionId: bobSubscription.id,
      amount: premiumType.monthlyPrice,
      currency: 'EUR',
      status,
      type: 'subscription',
      paymentMethod,
      transactionId,
      description: `Paiement mensuel ${i + 1}/12 - Premium`,
      dueDate,
      paidAt,
      monthNumber: i + 1
    });
  }

  // Charlie - Basic: 12 paiements (1 complété, 11 futurs)
  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(charlieStartDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    let status = 'pending';
    let paidAt = null;
    let transactionId = null;
    let paymentMethod = null;
    
    if (i === 0) {
      status = 'completed';
      paidAt = new Date(dueDate);
      transactionId = `txn_charlie_${i + 1}`;
      paymentMethod = 'paypal';
    }
    
    paymentsData.push({
      displayId: generatePaymentId(),
      memberId: charlieMember.userId,
      subscriptionId: charlieSubscription.id,
      amount: basicType.monthlyPrice,
      currency: 'EUR',
      status,
      type: 'subscription',
      paymentMethod,
      transactionId,
      description: `Paiement mensuel ${i + 1}/12 - Basic`,
      dueDate,
      paidAt,
      monthNumber: i + 1
    });
  }

  // Alice - VIP: 12 paiements (6 complétés, 6 futurs)
  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(aliceStartDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    let status = 'pending';
    let paidAt = null;
    let transactionId = null;
    let paymentMethod = null;
    
    if (i < 6) { // 6 premiers mois payés
      status = 'completed';
      paidAt = new Date(dueDate);
      paidAt.setDate(paidAt.getDate() + Math.floor(Math.random() * 5)); // Payé dans les 5 jours
      transactionId = `txn_alice_${i + 1}`;
      paymentMethod = 'card';
    }
    
    paymentsData.push({
      displayId: generatePaymentId(),
      memberId: aliceMember.userId,
      subscriptionId: aliceSubscription.id,
      amount: vipType.monthlyPrice,
      currency: 'EUR',
      status,
      type: 'subscription',
      paymentMethod,
      transactionId,
      description: `Paiement mensuel ${i + 1}/12 - VIP`,
      dueDate,
      paidAt,
      monthNumber: i + 1
    });
  }

  // Paiement one-time pour Alice (massage supplémentaire)
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: aliceMember.userId,
    amount: 50.00,
    currency: 'EUR',
    status: 'completed',
    type: 'one-time',
    paymentMethod: 'card',
    transactionId: 'txn_alice_extra_001',
    description: 'Massage thérapeutique supplémentaire',
    dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  });

  // David - Standard: 12 paiements (1 complété, 11 futurs)
  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(davidStartDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    let status = 'pending';
    let paidAt = null;
    let transactionId = null;
    let paymentMethod = null;
    
    if (i === 0) {
      status = 'completed';
      paidAt = new Date(dueDate);
      transactionId = `txn_david_${i + 1}`;
      paymentMethod = 'bank_transfer';
    }
    
    paymentsData.push({
      displayId: generatePaymentId(),
      memberId: davidMember.userId,
      subscriptionId: davidSubscription.id,
      amount: standardType.monthlyPrice,
      currency: 'EUR',
      status,
      type: 'subscription',
      paymentMethod,
      transactionId,
      description: `Paiement mensuel ${i + 1}/12 - Standard`,
      dueDate,
      paidAt,
      monthNumber: i + 1
    });
  }

  // Emma - Corporate PAUSÉ: 12 paiements (3 complétés, 1 overdue qui a causé la pause, 8 futurs)
  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(emmaStartDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    let status = 'pending';
    let paidAt = null;
    let transactionId = null;
    let paymentMethod = null;
    
    if (i < 3) {
      status = 'completed';
      paidAt = new Date(dueDate);
      paidAt.setDate(paidAt.getDate() + 3);
      transactionId = `txn_emma_${i + 1}`;
      paymentMethod = 'paypal';
    } else if (i === 3) {
      // Paiement en retard de plus de 7 jours - cause de la pause
      const overdueDate = new Date(dueDate);
      overdueDate.setDate(overdueDate.getDate() - 8);
      if (overdueDate < now) {
        status = 'overdue';
      }
    }
    
    paymentsData.push({
      displayId: generatePaymentId(),
      memberId: emmaMember.userId,
      subscriptionId: emmaSubscription.id,
      amount: corporateType.monthlyPrice,
      currency: 'EUR',
      status,
      type: 'subscription',
      paymentMethod,
      transactionId,
      description: `Paiement mensuel ${i + 1}/12 - Corporate`,
      dueDate,
      paidAt,
      monthNumber: i + 1
    });
  }

  // Frank - Étudiant: 12 paiements (1 complété, 11 futurs)
  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(frankStartDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    let status = 'pending';
    let paidAt = null;
    let transactionId = null;
    let paymentMethod = null;
    
    if (i === 0) {
      status = 'completed';
      paidAt = new Date(dueDate);
      transactionId = `txn_frank_${i + 1}`;
      paymentMethod = 'card';
    }
    
    paymentsData.push({
      displayId: generatePaymentId(),
      memberId: testMember1.userId,
      subscriptionId: frankSubscription.id,
      amount: studentType.monthlyPrice,
      currency: 'EUR',
      status,
      type: 'subscription',
      paymentMethod,
      transactionId,
      description: `Paiement mensuel ${i + 1}/12 - Étudiant`,
      dueDate,
      paidAt,
      monthNumber: i + 1
    });
  }

  // Grace - Découverte: 12 paiements (tous pending car très récent)
  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(graceStartDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    paymentsData.push({
      displayId: generatePaymentId(),
      memberId: testMember2.userId,
      subscriptionId: graceSubscription.id,
      amount: trialType.monthlyPrice,
      currency: 'EUR',
      status: 'pending',
      type: 'subscription',
      paymentMethod: null,
      transactionId: null,
      description: `Paiement mensuel ${i + 1}/12 - Découverte`,
      dueDate,
      paidAt: null,
      monthNumber: i + 1
    });
  }

  // Henry - Senior EXPIRÉ: 12 paiements (10 complétés, 2 failed qui ont causé l'expiration)
  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(henryStartDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    let status = 'completed';
    let paidAt = new Date(dueDate);
    paidAt.setDate(paidAt.getDate() + 2);
    let transactionId = `txn_henry_${i + 1}`;
    let paymentMethod = 'card';
    
    if (i >= 10) {
      status = 'failed';
      paidAt = null;
      transactionId = null;
      paymentMethod = null;
    }
    
    paymentsData.push({
      displayId: generatePaymentId(),
      memberId: testMember3.userId,
      subscriptionId: henrySubscription.id,
      amount: seniorType.monthlyPrice,
      currency: 'EUR',
      status,
      type: 'subscription',
      paymentMethod,
      transactionId,
      description: `Paiement mensuel ${i + 1}/12 - Senior`,
      dueDate,
      paidAt,
      monthNumber: i + 1
    });
  }

  // Iris - Basic ANNULÉ: 12 paiements (1 complété, puis annulation)
  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(irisStartDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    let status = i === 0 ? 'completed' : 'refunded';
    let paidAt = i === 0 ? new Date(dueDate) : null;
    let transactionId = i === 0 ? `txn_iris_${i + 1}` : null;
    let paymentMethod = i === 0 ? 'card' : null;
    
    paymentsData.push({
      displayId: generatePaymentId(),
      memberId: testMember4.userId,
      subscriptionId: irisSubscription.id,
      amount: basicType.monthlyPrice,
      currency: 'EUR',
      status,
      type: 'subscription',
      paymentMethod,
      transactionId,
      description: `Paiement mensuel ${i + 1}/12 - Basic`,
      dueDate,
      paidAt,
      monthNumber: i + 1
    });
  }

  // Jack - Bronze (ancien type): 12 paiements (4 complétés, 8 futurs)
  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(jackStartDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    let status = 'pending';
    let paidAt = null;
    let transactionId = null;
    let paymentMethod = null;
    
    if (i < 4) {
      status = 'completed';
      paidAt = new Date(dueDate);
      transactionId = `txn_jack_${i + 1}`;
      paymentMethod = 'card';
    }
    
    paymentsData.push({
      displayId: generatePaymentId(),
      memberId: testMember5.userId,
      subscriptionId: jackSubscription.id,
      amount: inactiveType.monthlyPrice,
      currency: 'EUR',
      status,
      type: 'subscription',
      paymentMethod,
      transactionId,
      description: `Paiement mensuel ${i + 1}/12 - Bronze (Ancien)`,
      dueDate,
      paidAt,
      monthNumber: i + 1
    });
  }

  // Paiements one-time supplémentaires pour diversité
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: bobMember.userId,
    amount: 35.00,
    currency: 'EUR',
    status: 'completed',
    type: 'one-time',
    paymentMethod: 'card',
    transactionId: 'txn_bob_extra_001',
    description: 'Séance coach nutrition',
    dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    paidAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
  });

  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: davidMember.userId,
    amount: 15.00,
    currency: 'EUR',
    status: 'completed',
    type: 'one-time',
    paymentMethod: 'cash',
    transactionId: 'txn_david_extra_001',
    description: 'Boisson énergétique',
    dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  });

  // Olivia - Découverte EN ATTENTE: 12 paiements (tous pending, en attente d'acquittement)
  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(oliviaStartDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    paymentsData.push({
      displayId: generatePaymentId(),
      memberId: oliviaMember.userId,
      subscriptionId: oliviaSubscription.id,
      amount: trialType.monthlyPrice,
      currency: 'EUR',
      status: 'pending',
      type: 'subscription',
      paymentMethod: null, // Sera rempli lors de l'acquittement
      transactionId: null,
      description: `Paiement mensuel ${i + 1}/12 - Découverte (À acquitter)`,
      dueDate,
      paidAt: null,
      monthNumber: i + 1
    });
  }

  // Peter - Standard NOUVEAU: 12 paiements (TOUS PENDING - Fraîchement créé aujourd'hui)
  const peterUser = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'peter@example.com',
      password: memberPassword,
      fullName: 'Peter Parker',
      role: 'member',
      gymId: gym1.id,
      notificationsEnabled: true
    }
  });
  const peterMember = await prisma.member.create({
    data: {
      userId: peterUser.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: true
    }
  });
  
  const peterStartDate = new Date(); // Aujourd'hui
  const peterEndDate = new Date(peterStartDate);
  peterEndDate.setFullYear(peterEndDate.getFullYear() + 1);
  
  const peterSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: peterMember.userId,
      subscriptionTypeId: standardType.id,
      status: 'active',
      startDate: peterStartDate,
      endDate: peterEndDate,
      autoRenew: true,
    },
  });
  console.log(`✅ Abonnement ${standardType.name} NOUVEAU pour ${peterUser.fullName}`);

  // Tous les paiements en PENDING - C'est le cas idéal d'un abonnement qui vient d'être créé
  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(peterStartDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    paymentsData.push({
      displayId: generatePaymentId(),
      memberId: peterMember.userId,
      subscriptionId: peterSubscription.id,
      amount: standardType.monthlyPrice,
      currency: 'EUR',
      status: 'pending',
      type: 'subscription',
      paymentMethod: null,
      transactionId: null,
      description: `Paiement mensuel ${i + 1}/12 - Standard (NOUVEAU)`,
      dueDate,
      paidAt: null,
      monthNumber: i + 1
    });
  }

  // Mary - Premium NOUVEAU: 3 paiements (trimestriel - TOUS PENDING)
  const maryUser = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'mary@example.com',
      password: memberPassword,
      fullName: 'Mary Jane',
      role: 'member',
      gymId: gym1.id,
      notificationsEnabled: true
    }
  });
  const maryMember = await prisma.member.create({
    data: {
      userId: maryUser.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: true
    }
  });
  
  const maryStartDate = new Date();
  const maryEndDate = new Date(maryStartDate);
  maryEndDate.setFullYear(maryEndDate.getFullYear() + 1);
  
  const marySubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: maryMember.userId,
      subscriptionTypeId: premiumType.id,
      status: 'active',
      startDate: maryStartDate,
      endDate: maryEndDate,
      autoRenew: true,
      paymentFrequency: 3 // Trimestriel
    },
  });
  console.log(`✅ Abonnement ${premiumType.name} TRIMESTRIEL pour ${maryUser.fullName}`);

  // 4 paiements trimestriels (tous les 3 mois) - TOUS PENDING
  for (let i = 0; i < 4; i++) {
    const dueDate = new Date(maryStartDate);
    dueDate.setMonth(dueDate.getMonth() + (i * 3)); // +3 mois à chaque fois
    
    paymentsData.push({
      displayId: generatePaymentId(),
      memberId: maryMember.userId,
      subscriptionId: marySubscription.id,
      amount: premiumType.monthlyPrice * 3, // 3 mois à la fois
      currency: 'EUR',
      status: 'pending',
      type: 'subscription',
      paymentMethod: null,
      transactionId: null,
      description: `Paiement ${i + 1}/4 (trimestre ${i + 1}) - Premium`,
      dueDate,
      paidAt: null,
      monthNumber: (i * 3) + 1
    });
  }

  // Nathan - VIP NOUVEAU: 2 paiements (semestriel - TOUS PENDING)
  const nathanUser = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'nathan@example.com',
      password: memberPassword,
      fullName: 'Nathan Drake',
      role: 'member',
      gymId: gym2.id,
      notificationsEnabled: true
    }
  });
  const nathanMember = await prisma.member.create({
    data: {
      userId: nathanUser.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: true
    }
  });
  
  const nathanStartDate = new Date();
  const nathanEndDate = new Date(nathanStartDate);
  nathanEndDate.setFullYear(nathanEndDate.getFullYear() + 1);
  
  const nathanSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: nathanMember.userId,
      subscriptionTypeId: vipType.id,
      status: 'active',
      startDate: nathanStartDate,
      endDate: nathanEndDate,
      autoRenew: true,
      paymentFrequency: 6 // Semestriel
    },
  });
  console.log(`✅ Abonnement ${vipType.name} SEMESTRIEL pour ${nathanUser.fullName}`);

  // 2 paiements semestriels (tous les 6 mois) - TOUS PENDING
  for (let i = 0; i < 2; i++) {
    const dueDate = new Date(nathanStartDate);
    dueDate.setMonth(dueDate.getMonth() + (i * 6)); // +6 mois à chaque fois
    
    paymentsData.push({
      displayId: generatePaymentId(),
      memberId: nathanMember.userId,
      subscriptionId: nathanSubscription.id,
      amount: vipType.monthlyPrice * 6, // 6 mois à la fois
      currency: 'EUR',
      status: 'pending',
      type: 'subscription',
      paymentMethod: null,
      transactionId: null,
      description: `Paiement ${i + 1}/2 (semestre ${i + 1}) - VIP`,
      dueDate,
      paidAt: null,
      monthNumber: (i * 6) + 1
    });
  }

  // Sarah - Corporate NOUVEAU: 1 paiement (oneshot annuel - PENDING)
  const sarahUser = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'sarah@example.com',
      password: memberPassword,
      fullName: 'Sarah Connor',
      role: 'member',
      gymId: gym2.id,
      notificationsEnabled: true
    }
  });
  const sarahMember = await prisma.member.create({
    data: {
      userId: sarahUser.id,
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      workoutNotificationsEnabled: true
    }
  });
  
  const sarahStartDate = new Date();
  const sarahEndDate = new Date(sarahStartDate);
  sarahEndDate.setFullYear(sarahEndDate.getFullYear() + 1);
  
  const sarahSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: sarahMember.userId,
      subscriptionTypeId: corporateType.id,
      status: 'active',
      startDate: sarahStartDate,
      endDate: sarahEndDate,
      autoRenew: false,
      paymentFrequency: 1 // Oneshot annuel
    },
  });
  console.log(`✅ Abonnement ${corporateType.name} ONESHOT ANNUEL pour ${sarahUser.fullName}`);

  // 1 seul paiement pour toute l'année - PENDING
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: sarahMember.userId,
    subscriptionId: sarahSubscription.id,
    amount: corporateType.monthlyPrice * 12, // Année complète
    currency: 'EUR',
    status: 'pending',
    type: 'subscription',
    paymentMethod: null,
    transactionId: null,
    description: `Paiement annuel - Corporate`,
    dueDate: sarahStartDate,
    paidAt: null,
    monthNumber: 1
  });

  const payments = await prisma.payment.createMany({ data: paymentsData });
  console.log(`✅ ${payments.count} paiements créés (mensuels + one-time + pending)\n`);
  
  console.log('📊 NOUVEAUX ABONNEMENTS (tous paiements PENDING):');
  console.log('   - Peter Parker: Standard, 12 paiements mensuels');
  console.log('   - Mary Jane: Premium, 4 paiements trimestriels');
  console.log('   - Nathan Drake: VIP, 2 paiements semestriels');
  console.log('   - Sarah Connor: Corporate, 1 paiement annuel');
  console.log('   - Olivia Martinez: Découverte, 12 paiements (abonnement PENDING)\n');

  // Ajouter des exercices complets
  console.log('💪 Création des exercices...');
  
  const exercises = await Promise.all([
    // Exercices de force
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Push-ups',
        description: 'Classic bodyweight exercise for chest and triceps',
        category: 'strength',
        muscleGroup: ['chest', 'triceps', 'shoulders'],
        equipment: ['none'],
        difficulty: 'beginner',
        instructions: 'Start in plank position with hands shoulder-width apart. Lower your body until chest nearly touches floor, keeping elbows at 45-degree angle. Push back up to starting position.'
      }
    }),
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Squats',
        description: 'Fundamental lower body strength exercise',
        category: 'strength',
        muscleGroup: ['quadriceps', 'glutes', 'hamstrings', 'core'],
        equipment: ['none'],
        difficulty: 'beginner',
        instructions: 'Stand with feet shoulder-width apart. Lower your body as if sitting back into a chair, keeping chest up and knees behind toes. Push through heels to return to start.'
      }
    }),
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Barbell Bench Press',
        description: 'Compound upper body exercise for chest development',
        category: 'strength',
        muscleGroup: ['chest', 'triceps', 'shoulders'],
        equipment: ['barbell', 'bench'],
        difficulty: 'intermediate',
        instructions: 'Lie on bench, grip barbell slightly wider than shoulders. Lower bar to mid-chest, then press up until arms are fully extended.'
      }
    }),
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Deadlift',
        description: 'Full body compound exercise focusing on posterior chain',
        category: 'strength',
        muscleGroup: ['back', 'glutes', 'hamstrings', 'core', 'forearms'],
        equipment: ['barbell'],
        difficulty: 'advanced',
        instructions: 'Stand with feet hip-width apart, grip barbell. Keep back straight, lift by extending hips and knees. Lower with control.'
      }
    }),
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Pull-ups',
        description: 'Upper body pulling exercise for back and biceps',
        category: 'strength',
        muscleGroup: ['back', 'biceps', 'shoulders'],
        equipment: ['pull-up bar'],
        difficulty: 'intermediate',
        instructions: 'Hang from bar with hands shoulder-width apart. Pull yourself up until chin clears bar. Lower with control.'
      }
    }),
    
    // Exercices cardio
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Running (Treadmill)',
        description: 'Cardiovascular endurance exercise',
        category: 'cardio',
        muscleGroup: ['legs', 'core'],
        equipment: ['treadmill'],
        difficulty: 'beginner',
        instructions: 'Maintain steady pace on treadmill. Keep posture upright, arms swinging naturally. Adjust speed and incline as needed.'
      }
    }),
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Burpees',
        description: 'High-intensity full body exercise',
        category: 'cardio',
        muscleGroup: ['full body', 'core'],
        equipment: ['none'],
        difficulty: 'advanced',
        instructions: 'From standing, drop to squat, kick feet back to plank, do push-up, jump feet to hands, jump up. Repeat quickly.'
      }
    }),
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Cycling (Stationary Bike)',
        description: 'Low-impact cardio exercise',
        category: 'cardio',
        muscleGroup: ['legs', 'glutes'],
        equipment: ['stationary bike'],
        difficulty: 'beginner',
        instructions: 'Adjust seat height so knee is slightly bent at bottom of pedal stroke. Maintain steady pace with controlled resistance.'
      }
    }),
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Jump Rope',
        description: 'High-intensity cardio and coordination exercise',
        category: 'cardio',
        muscleGroup: ['calves', 'shoulders', 'core'],
        equipment: ['jump rope'],
        difficulty: 'intermediate',
        instructions: 'Hold rope handles, swing rope over head and jump as it passes under feet. Keep jumps small and stay on balls of feet.'
      }
    }),
    
    // Exercices de flexibilité
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Yoga Sun Salutation',
        description: 'Flow sequence for flexibility and mobility',
        category: 'flexibility',
        muscleGroup: ['full body'],
        equipment: ['yoga mat'],
        difficulty: 'beginner',
        instructions: 'Follow traditional sun salutation sequence: Mountain pose, forward fold, plank, cobra, downward dog, return to mountain.'
      }
    }),
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Static Hamstring Stretch',
        description: 'Stretch for hamstring flexibility',
        category: 'flexibility',
        muscleGroup: ['hamstrings'],
        equipment: ['none'],
        difficulty: 'beginner',
        instructions: 'Sit with one leg extended, other bent. Reach toward toes of extended leg. Hold 30 seconds each side.'
      }
    }),
    
    // Exercices d'équilibre
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Single Leg Balance',
        description: 'Balance and stability exercise',
        category: 'balance',
        muscleGroup: ['legs', 'core'],
        equipment: ['none'],
        difficulty: 'beginner',
        instructions: 'Stand on one leg, hold for 30-60 seconds. Keep core engaged and focus on a fixed point. Switch legs.'
      }
    }),
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Bosu Ball Squats',
        description: 'Balance and strength combination exercise',
        category: 'balance',
        muscleGroup: ['legs', 'core'],
        equipment: ['bosu ball'],
        difficulty: 'advanced',
        instructions: 'Stand on bosu ball (dome side up). Perform squats while maintaining balance. Keep movements controlled.'
      }
    }),
    
    // Exercices fonctionnels
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Kettlebell Swings',
        description: 'Dynamic posterior chain exercise',
        category: 'functional',
        muscleGroup: ['glutes', 'hamstrings', 'core', 'shoulders'],
        equipment: ['kettlebell'],
        difficulty: 'intermediate',
        instructions: 'Hinge at hips, swing kettlebell between legs, explosively drive hips forward to swing to shoulder height. Control the descent.'
      }
    }),
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Battle Ropes',
        description: 'High-intensity upper body conditioning',
        category: 'functional',
        muscleGroup: ['shoulders', 'arms', 'core'],
        equipment: ['battle ropes'],
        difficulty: 'intermediate',
        instructions: 'Hold rope ends, create waves by alternating arm movements. Maintain athletic stance with core engaged.'
      }
    }),
    prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name: 'Box Jumps',
        description: 'Plyometric power exercise',
        category: 'functional',
        muscleGroup: ['legs', 'glutes', 'core'],
        equipment: ['plyo box'],
        difficulty: 'advanced',
        instructions: 'Stand facing box. Jump explosively onto box, landing softly with both feet. Step down and repeat.'
      }
    }),
  ]);
  
  console.log(`✅ ${exercises.length} exercices créés\n`);
  
  // Références d'exercices pour les plannings
  const [pushups, squats, benchPress, deadlift, pullups, running, burpees, cycling, jumpRope] = exercises;

  // Créer des plannings complets pour les membres
  console.log('📅 Création des plannings d\'entraînement...');
  
  // Planning 1: Bob - Programme Force et Masse
  const bobPlanning = await prisma.planning.create({
    data: {
      displayId: generatePlanningId(),
      memberId: bobMember.userId,
      coachId: adminUser.id,
      title: 'Programme Force et Masse - 12 Semaines',
      description: 'Programme complet axé sur le développement de la force et de la masse musculaire. 4 séances par semaine avec progression progressive.',
      startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // Commencé il y a 2 semaines
      endDate: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000), // 10 semaines restantes
      status: 'active'
    }
  });

  // Lundi - Push (Bob)
  const bobMonday = await prisma.planningDay.create({
    data: { planningId: bobPlanning.id, dayOfWeek: 1 }
  });
  await prisma.planningExercise.createMany({
    data: [
      {
        planningDayId: bobMonday.id,
        exerciseId: benchPress.id,
        sets: 4,
        reps: 8,
        weight: 80,
        restTime: 120,
        order: 1,
        notes: 'Échauffement avec 50% du poids max'
      },
      {
        planningDayId: bobMonday.id,
        exerciseId: pushups.id,
        sets: 3,
        reps: 15,
        restTime: 60,
        order: 2,
        notes: 'Tempo lent, 3 secondes descente'
      },
    ]
  });

  // Mercredi - Legs (Bob)
  const bobWednesday = await prisma.planningDay.create({
    data: { planningId: bobPlanning.id, dayOfWeek: 3 }
  });
  await prisma.planningExercise.createMany({
    data: [
      {
        planningDayId: bobWednesday.id,
        exerciseId: squats.id,
        sets: 5,
        reps: 5,
        weight: 100,
        restTime: 180,
        order: 1,
        notes: 'Squat profond, cuisses parallèles au sol'
      },
      {
        planningDayId: bobWednesday.id,
        exerciseId: deadlift.id,
        sets: 3,
        reps: 8,
        weight: 120,
        restTime: 180,
        order: 2,
        notes: 'Garder le dos droit, soulever avec les jambes'
      },
    ]
  });

  // Vendredi - Pull (Bob)
  const bobFriday = await prisma.planningDay.create({
    data: { planningId: bobPlanning.id, dayOfWeek: 5 }
  });
  await prisma.planningExercise.createMany({
    data: [
      {
        planningDayId: bobFriday.id,
        exerciseId: pullups.id,
        sets: 4,
        reps: 10,
        restTime: 90,
        order: 1,
        notes: 'Si trop difficile, utiliser élastique d\'assistance'
      },
      {
        planningDayId: bobFriday.id,
        exerciseId: deadlift.id,
        sets: 4,
        reps: 6,
        weight: 110,
        restTime: 150,
        order: 2,
        notes: 'Focus sur la technique'
      },
    ]
  });
  console.log(`✅ Planning créé pour ${bobUser.fullName}: ${bobPlanning.title}`);

  // Planning 2: Alice - Programme Cardio et Tonification
  const alicePlanning = await prisma.planning.create({
    data: {
      displayId: generatePlanningId(),
      memberId: aliceMember.userId,
      coachId: adminUser.id,
      title: 'Programme Cardio-Training et Tonification',
      description: 'Programme mixte combinant cardio pour brûler les graisses et renforcement musculaire pour tonifier. 5 séances par semaine.',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 77 * 24 * 60 * 60 * 1000),
      status: 'active'
    }
  });

  // Lundi - Cardio (Alice)
  const aliceMonday = await prisma.planningDay.create({
    data: { planningId: alicePlanning.id, dayOfWeek: 1 }
  });
  await prisma.planningExercise.createMany({
    data: [
      {
        planningDayId: aliceMonday.id,
        exerciseId: running.id,
        duration: 30,
        restTime: 0,
        order: 1,
        notes: 'Vitesse modérée, zone cardio 60-70% FCmax'
      },
      {
        planningDayId: aliceMonday.id,
        exerciseId: burpees.id,
        sets: 4,
        reps: 10,
        restTime: 45,
        order: 2,
        notes: 'HIIT - Intensité maximale'
      },
    ]
  });

  // Mercredi - Renforcement (Alice)
  const aliceWednesday = await prisma.planningDay.create({
    data: { planningId: alicePlanning.id, dayOfWeek: 3 }
  });
  await prisma.planningExercise.createMany({
    data: [
      {
        planningDayId: aliceWednesday.id,
        exerciseId: squats.id,
        sets: 4,
        reps: 15,
        weight: 40,
        restTime: 60,
        order: 1,
        notes: 'Poids modéré, focus sur la forme'
      },
      {
        planningDayId: aliceWednesday.id,
        exerciseId: pushups.id,
        sets: 3,
        reps: 12,
        restTime: 60,
        order: 2,
        notes: 'Sur genoux si nécessaire'
      },
    ]
  });

  // Vendredi - Cardio Mix (Alice)
  const aliceFriday = await prisma.planningDay.create({
    data: { planningId: alicePlanning.id, dayOfWeek: 5 }
  });
  await prisma.planningExercise.createMany({
    data: [
      {
        planningDayId: aliceFriday.id,
        exerciseId: cycling.id,
        duration: 45,
        restTime: 0,
        order: 1,
        notes: 'Résistance progressive toutes les 10 min'
      },
      {
        planningDayId: aliceFriday.id,
        exerciseId: jumpRope.id,
        duration: 15,
        restTime: 60,
        order: 2,
        notes: '3 rounds de 5 minutes avec pauses'
      },
    ]
  });
  console.log(`✅ Planning créé pour ${aliceUser.fullName}: ${alicePlanning.title}`);

  // Planning 3: Charlie - Programme Débutant
  const charliePlanning = await prisma.planning.create({
    data: {
      displayId: generatePlanningId(),
      memberId: charlieMember.userId,
      coachId: adminUser.id,
      title: 'Programme Débutant - Initiation Fitness',
      description: 'Programme d\'initiation pour apprendre les bases du fitness. 3 séances par semaine, focus sur la technique.',
      startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000),
      status: 'active'
    }
  });

  // Lundi (Charlie)
  const charlieMonday = await prisma.planningDay.create({
    data: { planningId: charliePlanning.id, dayOfWeek: 1 }
  });
  await prisma.planningExercise.createMany({
    data: [
      {
        planningDayId: charlieMonday.id,
        exerciseId: squats.id,
        sets: 3,
        reps: 10,
        restTime: 90,
        order: 1,
        notes: 'Apprendre la bonne technique - poids du corps uniquement'
      },
      {
        planningDayId: charlieMonday.id,
        exerciseId: pushups.id,
        sets: 3,
        reps: 8,
        restTime: 90,
        order: 2,
        notes: 'Sur genoux si nécessaire au début'
      },
    ]
  });

  // Mercredi (Charlie)
  const charlieWednesday = await prisma.planningDay.create({
    data: { planningId: charliePlanning.id, dayOfWeek: 3 }
  });
  await prisma.planningExercise.createMany({
    data: [
      {
        planningDayId: charlieWednesday.id,
        exerciseId: cycling.id,
        duration: 20,
        restTime: 0,
        order: 1,
        notes: 'Résistance faible, focus cardio'
      },
    ]
  });

  // Vendredi (Charlie)
  const charlieFriday = await prisma.planningDay.create({
    data: { planningId: charliePlanning.id, dayOfWeek: 5 }
  });
  await prisma.planningExercise.createMany({
    data: [
      {
        planningDayId: charlieFriday.id,
        exerciseId: running.id,
        duration: 15,
        restTime: 0,
        order: 1,
        notes: 'Vitesse confortable pour tenir 15 minutes'
      },
    ]
  });
  console.log(`✅ Planning créé pour ${charlieUser.fullName}: ${charliePlanning.title}\n`);


  // Créer des tokens de réinitialisation de mot de passe pour tests
  console.log('🔑 Création des tokens de test...');
  await prisma.passwordResetToken.create({
    data: {
      userId: adminUser.id,
      token: '123456', // Token de test pour réinitialisation
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Expire dans 1 heure
      used: false,
    },
  });
  console.log('✅ Token de réinitialisation créé pour admin\n');

  // Statistiques finales
  console.log('📊 ====== RÉSUMÉ DU SEED ======\n');
  
  const totalUsers = await prisma.user.count();
  const totalMembers = await prisma.member.count();
  const totalAdmins = await prisma.admin.count();
  const totalOwners = await prisma.owner.count();
  const totalGyms = await prisma.gym.count();
  const totalSubscriptions = await prisma.subscription.count();
  const totalPayments = await prisma.payment.count();
  const totalExercises = await prisma.exercise.count();
  const totalPlannings = await prisma.planning.count();
  const totalPlanningDays = await prisma.planningDay.count();
  const totalPlanningExercises = await prisma.planningExercise.count();
  const totalSubscriptionTypes = await prisma.subscriptionType.count();
  const activeSubscriptionTypes = await prisma.subscriptionType.count({ where: { isActive: true } });
  
  console.log('👥 Utilisateurs:');
  console.log(`   - Total: ${totalUsers}`);
  console.log(`   - Owners: ${totalOwners}`);
  console.log(`   - Admins: ${totalAdmins}`);
  console.log(`   - Members: ${totalMembers}\n`);
  
  console.log('🏋️ Salles de sport:');
  console.log(`   - ${gym1.name}: ${gym1.User.length} utilisateurs`);
  console.log(`   - ${gym2.name}: ${gym2.User.length} utilisateurs\n`);
  
  console.log('🏷️  Types d\'abonnements:');
  console.log(`   - Total: ${totalSubscriptionTypes}`);
  console.log(`   - Actifs: ${activeSubscriptionTypes}`);
  console.log(`   - Inactifs: ${totalSubscriptionTypes - activeSubscriptionTypes}\n`);
  
  console.log('💳 Abonnements et Paiements:');
  console.log(`   - Abonnements total: ${totalSubscriptions}`);
  const activeSubsCount = await prisma.subscription.count({ where: { status: 'active' } });
  const pausedSubsCount = await prisma.subscription.count({ where: { status: 'paused' } });
  const expiredSubsCount = await prisma.subscription.count({ where: { status: 'expired' } });
  const cancelledSubsCount = await prisma.subscription.count({ where: { status: 'cancelled' } });
  console.log(`     └─ Actifs: ${activeSubsCount}`);
  console.log(`     └─ Pausés: ${pausedSubsCount}`);
  console.log(`     └─ Expirés: ${expiredSubsCount}`);
  console.log(`     └─ Annulés: ${cancelledSubsCount}`);
  console.log(`   - Paiements total: ${totalPayments}`);
  const completedPayments = await prisma.payment.count({ where: { status: 'completed' } });
  const pendingPayments = await prisma.payment.count({ where: { status: 'pending' } });
  const overduePayments = await prisma.payment.count({ where: { status: 'overdue' } });
  const failedPayments = await prisma.payment.count({ where: { status: 'failed' } });
  const refundedPayments = await prisma.payment.count({ where: { status: 'refunded' } });
  console.log(`     └─ Complétés: ${completedPayments}`);
  console.log(`     └─ En attente: ${pendingPayments}`);
  console.log(`     └─ En retard: ${overduePayments}`);
  console.log(`     └─ Échoués: ${failedPayments}`);
  console.log(`     └─ Remboursés: ${refundedPayments}\n`);
  
  console.log('💪 Exercices et Plannings:');
  console.log(`   - Exercices disponibles: ${totalExercises}`);
  console.log(`   - Plannings créés: ${totalPlannings}`);
  console.log(`   - Jours planifiés: ${totalPlanningDays}`);
  console.log(`   - Exercices assignés: ${totalPlanningExercises}\n`);
  
  console.log('🔐 Identifiants de test:');
  console.log('   Owner:');
  console.log('     - Email: owner@teamfitness.com');
  console.log('     - Password: owner123\n');
  console.log('   Admin (Gym 1):');
  console.log('     - Email: admin@teamfitness.com');
  console.log('     - Password: admin123\n');
  console.log('   Admin (Gym 2):');
  console.log('     - Email: admin2@teamfitness.com');
  console.log('     - Password: admin123\n');
  console.log('   Members (avec historique):');
  console.log('     - bob@example.com (Premium actif, 2 mois, 2 paiements complétés, Gym 1)');
  console.log('     - charlie@example.com (Basic actif, 10 jours, 1 paiement complété, Gym 1)');
  console.log('     - alice@example.com (VIP actif, 6 mois, 6 paiements complétés, Gym 1)');
  console.log('     - david@example.com (Standard actif, 20 jours, 1 paiement complété, Gym 2)');
  console.log('     - emma@example.com (Corporate PAUSÉ, 3 complétés + 1 overdue, Gym 2)');
  console.log('     - frank@example.com (Étudiant actif, 5 jours, 1 paiement complété, Gym 1)');
  console.log('     - grace@example.com (Découverte actif, 2 jours, tous pending, Gym 2)');
  console.log('     - henry@example.com (Senior EXPIRÉ, 10 complétés + 2 failed, Gym 1)');
  console.log('     - iris@example.com (Basic ANNULÉ, 1 complété + 11 refunded, Gym 2)');
  console.log('     - jack@example.com (Bronze ancien type, 4 complétés + 8 pending, Gym 1)');
  console.log('     - olivia@example.com (Découverte PENDING, tous paiements pending, Gym 1)');
  console.log('   \n   Members NOUVEAUX (tous paiements PENDING):');
  console.log('     - peter@example.com (Standard, 12 mensuels, NOUVEAU, Gym 1)');
  console.log('     - mary@example.com (Premium, 4 trimestriels, NOUVEAU, Gym 1)');
  console.log('     - nathan@example.com (VIP, 2 semestriels, NOUVEAU, Gym 2)');
  console.log('     - sarah@example.com (Corporate, 1 annuel oneshot, NOUVEAU, Gym 2)');
  console.log('     - Password pour tous: member123\n');
  
  console.log('📊 Types d\'abonnements disponibles:');
  console.log('   - Basic (29.99€/mois): Accès essentiel');
  console.log('   - Standard (49.99€/mois): + Cours collectifs');
  console.log('   - Premium (79.99€/mois): + Coaching personnel');
  console.log('   - VIP (129.99€/mois): Formule exclusive tout compris');
  console.log('   - Étudiant (24.99€/mois): Tarif préférentiel -25 ans');
  console.log('   - Senior (34.99€/mois): Formule adaptée +60 ans');
  console.log('   - Corporate (89.99€/mois): Abonnement entreprise');
  console.log('   - Découverte (19.99€/mois): Offre d\'essai');
  console.log('   - Bronze (39.99€/mois): INACTIF - ancien type\n');
  
  console.log('✅ Seed terminé avec succès! 🎉');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
