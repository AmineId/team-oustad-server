require('dotenv').config();
const prisma = require('../utils/prismaClient');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {
  generateUserIdByRole,
  generateGymId,
  generateSubscriptionId,
  generatePaymentId,
  generatePlanningId,
  generateExerciseId,
  generateSubscriptionTypeId,
  generateBannerId,
  generateBannerVariantId
} = require('../utils/idGenerator');
const { HOME_KEY, gymKey, validatePage } = require('../utils/showcasePages');

/**
 * SEED DATABASE - Données de test cohérentes
 * 
 * ⚠️ RÈGLES DE COHÉRENCE :
 * - Tout abonnement ACTIF doit avoir AU MOINS 1 paiement COMPLETED
 * - Les abonnements PENDING peuvent avoir des paiements PENDING
 * - Les abonnements EXPIRED/CANCELLED peuvent avoir divers statuts de paiement
 * - Les dates doivent être cohérentes (startDate < endDate, paiement ≤ startDate)
 * 
 * 📊 STATUTS D'ABONNEMENTS :
 * - active: Abonnement en cours avec paiement completed
 * - pending: En attente du premier paiement
 * - paused: Suspendu (problème paiement, congés, etc.)
 * - expired: Date de fin dépassée ou quota épuisé
 * - cancelled: Annulé par le membre ou l'admin
 */

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
  await prisma.manager.deleteMany();
  await prisma.owner.deleteMany();
  // Password reset tokens must be removed before users
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.bannerStats.deleteMany();
  await prisma.bannerVariant.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.openingHour.deleteMany();
  // La page d'accueil vitrine n'est rattachée à aucune salle (pas de cascade)
  await prisma.showcasePage.deleteMany();
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
            email: 'owner@team-oustad.com',
            password: ownerPassword,
            firstName: 'Sarah',
            lastName: 'Johnson',
            role: 'owner',
            notificationsEnabled: true
          },
          {
            displayId: generateUserIdByRole('manager'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'admin@team-oustad.com',
            password: hashed,
            firstName: 'Mike',
            lastName: 'Anderson',
            role: 'manager',
            notificationsEnabled: true
          },
          {
            displayId: generateUserIdByRole('member'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'bob@example.com',
            password: memberPassword,
            firstName: 'Bob',
            lastName: 'Williams',
            role: 'member',
            notificationsEnabled: true
          },
          {
            displayId: generateUserIdByRole('member'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'charlie@example.com',
            password: memberPassword,
            firstName: 'Charlie',
            lastName: 'Brown',
            role: 'member',
            notificationsEnabled: true
          },
          {
            displayId: generateUserIdByRole('member'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'alice@example.com',
            password: memberPassword,
            firstName: 'Alice',
            lastName: 'Smith',
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
            displayId: generateUserIdByRole('manager'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'admin2@team-oustad.com',
            password: hashed,
            firstName: 'Lisa',
            lastName: 'Martinez',
            role: 'manager',
            notificationsEnabled: true
          },
          {
            displayId: generateUserIdByRole('member'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'david@example.com',
            password: memberPassword,
            firstName: 'David',
            lastName: 'Johnson',
            role: 'member',
            notificationsEnabled: true
          },
          {
            displayId: generateUserIdByRole('member'),
            uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
            email: 'emma@example.com',
            password: memberPassword,
            firstName: 'Emma',
            lastName: 'Davis',
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
  const adminUser = gym1.User.find(u => u.role === 'manager');
  const bobUser = gym1.User.find(u => u.email === 'bob@example.com');
  const charlieUser = gym1.User.find(u => u.email === 'charlie@example.com');
  const aliceUser = gym1.User.find(u => u.email === 'alice@example.com');

  // GYM 2 Users
  const admin2User = gym2.User.find(u => u.role === 'manager');
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
  console.log(`✅ Owner: ${ownerUser.firstName} ${ownerUser.lastName}`);

  // Manager profiles
  await prisma.manager.create({
    data: { userId: adminUser.id }
  });
  console.log(`✅ Manager: ${adminUser.firstName} ${adminUser.lastName}`);

  await prisma.manager.create({
    data: { userId: admin2User.id }
  });
  console.log(`✅ Manager: ${admin2User.firstName} ${admin2User.lastName}`);

  // Member profiles
  const bobMember = await prisma.member.create({
    data: {
      userId: bobUser.id,
      workoutNotificationsEnabled: true
    }
  });
  console.log(`✅ Member: ${bobUser.firstName} ${bobUser.lastName}`);

  const charlieMember = await prisma.member.create({
    data: {
      userId: charlieUser.id,
      workoutNotificationsEnabled: true
    }
  });
  console.log(`✅ Member: ${charlieUser.firstName} ${charlieUser.lastName}`);

  const aliceMember = await prisma.member.create({
    data: {
      userId: aliceUser.id,
      workoutNotificationsEnabled: true
    }
  });
  console.log(`✅ Member: ${aliceUser.firstName} ${aliceUser.lastName}`);

  const davidMember = await prisma.member.create({
    data: {
      userId: davidUser.id,
      workoutNotificationsEnabled: true
    }
  });
  console.log(`✅ Member: ${davidUser.firstName} ${davidUser.lastName}`);

  const emmaMember = await prisma.member.create({
    data: {
      userId: emmaUser.id,
      workoutNotificationsEnabled: false
    }
  });
  console.log(`✅ Member: ${emmaUser.firstName} ${emmaUser.lastName}\n`);

  // Créer les types d'abonnements avec quotas de séances
  console.log('🏷️  Création des types d\'abonnements avec quotas...');
  
  const type12Seances = await prisma.subscriptionType.create({
    data: {
      displayId: generateSubscriptionTypeId(),
      name: '12 Séances',
      description: 'Abonnement de 12 séances valable 1 mois',
      monthlyPrice: 150,
      sessionQuota: 12,
      sessionType: 'limited',
      durationMonths: 1,
      features: [
        '12 séances de fitness',
        'Accès à tous les équipements',
        'Valable 1 mois',
        'Suivi de progression'
      ],
      isActive: true
    }
  });
  console.log(`✅ Type créé: ${type12Seances.name} - ${type12Seances.monthlyPrice} MAD (${type12Seances.sessionQuota} séances)`);

  const type18Seances = await prisma.subscriptionType.create({
    data: {
      displayId: generateSubscriptionTypeId(),
      name: '18 Séances',
      description: 'Abonnement de 18 séances valable 1 mois',
      monthlyPrice: 200,
      sessionQuota: 18,
      sessionType: 'limited',
      durationMonths: 1,
      features: [
        '18 séances de fitness',
        'Accès à tous les équipements',
        'Valable 1 mois',
        'Suivi de progression',
        '1 séance de coaching offerte'
      ],
      isActive: true
    }
  });
  console.log(`✅ Type créé: ${type18Seances.name} - ${type18Seances.monthlyPrice} MAD (${type18Seances.sessionQuota} séances)`);

  const type36Seances = await prisma.subscriptionType.create({
    data: {
      displayId: generateSubscriptionTypeId(),
      name: '36 Séances',
      description: 'Abonnement de 36 séances valable 2 mois',
      monthlyPrice: 350,
      sessionQuota: 36,
      sessionType: 'limited',
      durationMonths: 2,
      features: [
        '36 séances de fitness',
        'Accès à tous les équipements',
        'Valable 2 mois',
        'Suivi de progression personnalisé',
        '2 séances de coaching offertes',
        'Programme d\'entraînement personnalisé'
      ],
      isActive: true
    }
  });
  console.log(`✅ Type créé: ${type36Seances.name} - ${type36Seances.monthlyPrice} MAD (${type36Seances.sessionQuota} séances)`);

  const typeAnnuelIllimite = await prisma.subscriptionType.create({
    data: {
      displayId: generateSubscriptionTypeId(),
      name: 'Annuel Illimité',
      description: 'Abonnement annuel avec accès illimité',
      monthlyPrice: 1500,
      sessionQuota: null, // null = illimité
      sessionType: 'unlimited',
      durationMonths: 12,
      features: [
        'Accès illimité 7j/7',
        'Tous les équipements',
        'Valable 1 an',
        'Coaching personnalisé mensuel',
        'Suivi nutritionnel',
        'Programme d\'entraînement sur mesure',
        'Accès aux cours collectifs',
        'Priorité sur les réservations'
      ],
      isActive: true
    }
  });
  console.log(`✅ Type créé: ${typeAnnuelIllimite.name} - ${typeAnnuelIllimite.monthlyPrice} MAD (illimité)\n`);

  // Créer des abonnements pour les membres avec les types
  console.log('💳 Création des abonnements...');
  
  // Bob - 36 Séances actif (a déjà utilisé 10 séances)
  const bobStartDate = new Date();
  bobStartDate.setMonth(bobStartDate.getMonth() - 1); // Commencé il y a 1 mois
  const bobEndDate = new Date(bobStartDate);
  bobEndDate.setMonth(bobEndDate.getMonth() + 2); // Valable 2 mois
  
  const bobSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: bobMember.userId,
      subscriptionTypeId: type36Seances.id,
      status: 'active',
      startDate: bobStartDate,
      endDate: bobEndDate,
      autoRenew: true,
      sessionsUsed: 10, // 10 séances utilisées sur 36
    },
  });
  console.log(`✅ Abonnement ${type36Seances.name} pour ${bobUser.firstName} ${bobUser.lastName} (10/${type36Seances.sessionQuota} séances utilisées)`);

  // Charlie - 12 Séances actif récent (3 séances utilisées)
  const charlieStartDate = new Date();
  charlieStartDate.setDate(charlieStartDate.getDate() - 10); // Commencé il y a 10 jours
  const charlieEndDate = new Date(charlieStartDate);
  charlieEndDate.setMonth(charlieEndDate.getMonth() + 1); // Valable 1 mois
  
  const charlieSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: charlieMember.userId,
      subscriptionTypeId: type12Seances.id,
      status: 'active',
      startDate: charlieStartDate,
      endDate: charlieEndDate,
      autoRenew: true,
      sessionsUsed: 3, // 3 séances utilisées sur 12
    },
  });
  console.log(`✅ Abonnement ${type12Seances.name} pour ${charlieUser.firstName} ${charlieUser.lastName} (3/${type12Seances.sessionQuota} séances utilisées)`);

  // Alice - Annuel Illimité actif de longue date
  const aliceStartDate = new Date();
  aliceStartDate.setMonth(aliceStartDate.getMonth() - 6); // Commencé il y a 6 mois
  const aliceEndDate = new Date(aliceStartDate);
  aliceEndDate.setFullYear(aliceEndDate.getFullYear() + 1); // Valable 1 an
  
  const aliceSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: aliceMember.userId,
      subscriptionTypeId: typeAnnuelIllimite.id,
      status: 'active',
      startDate: aliceStartDate,
      endDate: aliceEndDate,
      autoRenew: true,
      sessionsUsed: 45, // 45 séances (illimité donc pas de limite)
    },
  });
  console.log(`✅ Abonnement ${typeAnnuelIllimite.name} pour ${aliceUser.firstName} ${aliceUser.lastName} (illimité)`);

  // David - 18 Séances actif (quota presque épuisé)
  const davidStartDate = new Date();
  davidStartDate.setDate(davidStartDate.getDate() - 20);
  const davidEndDate = new Date(davidStartDate);
  davidEndDate.setMonth(davidEndDate.getMonth() + 1); // Valable 1 mois
  
  const davidSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: davidMember.userId,
      subscriptionTypeId: type18Seances.id,
      status: 'active',
      startDate: davidStartDate,
      endDate: davidEndDate,
      autoRenew: false,
      sessionsUsed: 16, // 16 séances utilisées sur 18 (presque épuisé!)
    },
  });
  console.log(`✅ Abonnement ${type18Seances.name} pour ${davidUser.firstName} ${davidUser.lastName} (16/${type18Seances.sessionQuota} séances utilisées - quota bas!)`);

  // Emma - 36 Séances pausé (problème de paiement)
  const emmaStartDate = new Date();
  emmaStartDate.setMonth(emmaStartDate.getMonth() - 1);
  const emmaEndDate = new Date(emmaStartDate);
  emmaEndDate.setMonth(emmaEndDate.getMonth() + 2); // Valable 2 mois
  
  const emmaSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: emmaMember.userId,
      subscriptionTypeId: type36Seances.id,
      status: 'paused',
      startDate: emmaStartDate,
      endDate: emmaEndDate,
      autoRenew: false,
      sessionsUsed: 5, // 5 séances avant la pause
    },
  });
  console.log(`✅ Abonnement ${type36Seances.name} (pausé) pour ${emmaUser.firstName} ${emmaUser.lastName}`);

  // Créer 2 membres supplémentaires pour plus de cas de tests
  const testMember1User = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'frank@example.com',
      password: memberPassword,
      firstName: 'Frank',
      lastName: 'Martin',
      role: 'member',
      gymId: gym1.id,
      notificationsEnabled: true
    }
  });
  const testMember1 = await prisma.member.create({
    data: {
      userId: testMember1User.id,
      workoutNotificationsEnabled: true
    }
  });
  
  // Frank - 12 Séances actif nouveau
  const frankStartDate = new Date();
  frankStartDate.setDate(frankStartDate.getDate() - 5);
  const frankEndDate = new Date(frankStartDate);
  frankEndDate.setMonth(frankEndDate.getMonth() + 1); // Valable 1 mois
  
  const frankSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: testMember1.userId,
      subscriptionTypeId: type12Seances.id,
      status: 'active',
      startDate: frankStartDate,
      endDate: frankEndDate,
      autoRenew: true,
      sessionsUsed: 2, // 2 séances utilisées
    },
  });
  console.log(`✅ Abonnement ${type12Seances.name} pour ${testMember1User.firstName} ${testMember1User.lastName} (2/${type12Seances.sessionQuota} séances utilisées)`);

  const testMember2User = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'grace@example.com',
      password: memberPassword,
      firstName: 'Grace',
      lastName: 'Lee',
      role: 'member',
      gymId: gym2.id,
      notificationsEnabled: true
    }
  });
  const testMember2 = await prisma.member.create({
    data: {
      userId: testMember2User.id,
      workoutNotificationsEnabled: true
    }
  });
  
  // Grace - 18 Séances actif tout neuf
  const graceStartDate = new Date();
  graceStartDate.setDate(graceStartDate.getDate() - 2);
  const graceEndDate = new Date(graceStartDate);
  graceEndDate.setMonth(graceEndDate.getMonth() + 1); // Valable 1 mois
  
  const graceSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: testMember2.userId,
      subscriptionTypeId: type18Seances.id,
      status: 'active',
      startDate: graceStartDate,
      endDate: graceEndDate,
      autoRenew: false,
      sessionsUsed: 1, // 1 séance utilisée
    },
  });
  console.log(`✅ Abonnement ${type18Seances.name} pour ${testMember2User.firstName} ${testMember2User.lastName} (1/${type18Seances.sessionQuota} séances utilisées)`);

  // Créer un abonnement expiré pour tester
  const testMember3User = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'henry@example.com',
      password: memberPassword,
      firstName: 'Henry',
      lastName: 'Wilson',
      role: 'member',
      gymId: gym1.id,
      notificationsEnabled: true
    }
  });
  const testMember3 = await prisma.member.create({
    data: {
      userId: testMember3User.id,
      workoutNotificationsEnabled: true
    }
  });
  
  // Henry - 12 Séances expiré (quota épuisé)
  const henryStartDate = new Date();
  henryStartDate.setMonth(henryStartDate.getMonth() - 2); // Commencé il y a 2 mois
  const henryEndDate = new Date(henryStartDate);
  henryEndDate.setMonth(henryEndDate.getMonth() + 1); // Expiré il y a 1 mois
  
  const henrySubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: testMember3.userId,
      subscriptionTypeId: type12Seances.id,
      status: 'expired',
      startDate: henryStartDate,
      endDate: henryEndDate,
      autoRenew: false,
      sessionsUsed: 12, // Quota complètement épuisé
    },
  });
  console.log(`✅ Abonnement ${type12Seances.name} (expiré - quota épuisé) pour ${testMember3User.firstName} ${testMember3User.lastName}`);

  // Créer un abonnement annulé
  const testMember4User = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'iris@example.com',
      password: memberPassword,
      firstName: 'Iris',
      lastName: 'Thompson',
      role: 'member',
      gymId: gym2.id,
      notificationsEnabled: true
    }
  });
  const testMember4 = await prisma.member.create({
    data: {
      userId: testMember4User.id,
      workoutNotificationsEnabled: true
    }
  });
  
  // Iris - 18 Séances annulé
  const irisStartDate = new Date();
  irisStartDate.setMonth(irisStartDate.getMonth() - 1);
  const irisEndDate = new Date(irisStartDate);
  irisEndDate.setMonth(irisEndDate.getMonth() + 1);
  
  const irisSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: testMember4.userId,
      subscriptionTypeId: type18Seances.id,
      status: 'cancelled',
      startDate: irisStartDate,
      endDate: irisEndDate,
      autoRenew: false,
      sessionsUsed: 7, // 7 séances avant annulation
    },
  });
  console.log(`✅ Abonnement ${type18Seances.name} (annulé) pour ${testMember4User.firstName} ${testMember4User.lastName}`);

  // Créer un abonnement avec l'ancien type inactif (pour tester la persistance)
  const testMember5User = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'jack@example.com',
      password: memberPassword,
      firstName: 'Jack',
      lastName: 'Brown',
      role: 'member',
      gymId: gym1.id,
      notificationsEnabled: true
    }
  });
  const testMember5 = await prisma.member.create({
    data: {
      userId: testMember5User.id,
      workoutNotificationsEnabled: true
    }
  });
  
  // Jack - Annuel Illimité mais en attente (ancien membre qui renouvelle)
  const jackStartDate = new Date();
  jackStartDate.setMonth(jackStartDate.getMonth() - 4);
  const jackEndDate = new Date(jackStartDate);
  jackEndDate.setFullYear(jackEndDate.getFullYear() + 1);
  
  const jackSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: testMember5.userId,
      subscriptionTypeId: typeAnnuelIllimite.id,
      status: 'active',
      startDate: jackStartDate,
      endDate: jackEndDate,
      autoRenew: false,
      sessionsUsed: 30, // 30 séances (illimité)
    },
  });
  console.log(`✅ Abonnement ${typeAnnuelIllimite.name} pour ${testMember5User.firstName} ${testMember5User.lastName} (illimité)\n`);

  // Abonnement EN ATTENTE - Pour tester l'acquittement de paiement
  // Olivia - Nouvel abonnement Découverte en attente de premier paiement
  const oliviaUser = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'olivia@example.com',
      password: memberPassword,
      firstName: 'Olivia',
      lastName: 'Martinez',
      role: 'member',
      gymId: gym1.id,
      notificationsEnabled: true
    }
  });
  
  const oliviaMember = await prisma.member.create({
    data: {
      userId: oliviaUser.id,
      workoutNotificationsEnabled: true
    }
  });

  const oliviaStartDate = new Date(); // Commence aujourd'hui
  const oliviaEndDate = new Date(oliviaStartDate);
  oliviaEndDate.setMonth(oliviaEndDate.getMonth() + 1); // Valable 1 mois

  const oliviaSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: oliviaMember.userId,
      subscriptionTypeId: type12Seances.id, // Type 12 Séances
      status: 'pending', // EN ATTENTE du premier paiement
      startDate: oliviaStartDate,
      endDate: oliviaEndDate,
      autoRenew: true,
      sessionsUsed: 0,
    },
  });
  console.log(`✅ Abonnement ${type12Seances.name} (EN ATTENTE) pour ${oliviaUser.firstName} ${oliviaUser.lastName} - À activer via /acknowledge\n`);

  // Créer des paiements pour les abonnements
  console.log('💰 Création des paiements...');
  
  const now = new Date();
  const paymentsData = [];

  // Bob - 36 Séances: paiement unique
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: bobMember.userId,
    subscriptionId: bobSubscription.id,
    amount: type36Seances.monthlyPrice,
    currency: 'MAD',
    status: 'completed',
    type: 'subscription',
    paymentMethod: 'card',
    transactionId: 'txn_bob_1',
    description: `Paiement - 36 Séances`,
    dueDate: bobStartDate,
    paidAt: bobStartDate,
    monthNumber: 1
  });

  // Charlie - 12 Séances: paiement unique
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: charlieMember.userId,
    subscriptionId: charlieSubscription.id,
    amount: type12Seances.monthlyPrice,
    currency: 'MAD',
    status: 'completed',
    type: 'subscription',
    paymentMethod: 'paypal',
    transactionId: 'txn_charlie_1',
    description: `Paiement - 12 Séances`,
    dueDate: charlieStartDate,
    paidAt: charlieStartDate,
    monthNumber: 1
  });

  // Alice - Annuel Illimité: paiement unique annuel
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: aliceMember.userId,
    subscriptionId: aliceSubscription.id,
    amount: typeAnnuelIllimite.monthlyPrice,
    currency: 'MAD',
    status: 'completed',
    type: 'subscription',
    paymentMethod: 'card',
    transactionId: 'txn_alice_1',
    description: `Paiement - Annuel Illimité`,
    dueDate: aliceStartDate,
    paidAt: aliceStartDate,
    monthNumber: 1
  });

  // Paiement one-time pour Alice (massage supplémentaire)
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: aliceMember.userId,
    amount: 500,
    currency: 'MAD',
    status: 'completed',
    type: 'one-time',
    paymentMethod: 'card',
    transactionId: 'txn_alice_extra_001',
    description: 'Massage thérapeutique supplémentaire',
    dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  });

  // David - 18 Séances: paiement unique
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: davidMember.userId,
    subscriptionId: davidSubscription.id,
    amount: type18Seances.monthlyPrice,
    currency: 'MAD',
    status: 'completed',
    type: 'subscription',
    paymentMethod: 'bank_transfer',
    transactionId: 'txn_david_1',
    description: `Paiement - 18 Séances`,
    dueDate: davidStartDate,
    paidAt: davidStartDate,
    monthNumber: 1
  });

  // Emma - 36 Séances PAUSÉ: paiement initial completed, puis problème
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: emmaMember.userId,
    subscriptionId: emmaSubscription.id,
    amount: type36Seances.monthlyPrice,
    currency: 'MAD',
    status: 'completed', // Premier paiement complété avant la pause
    type: 'subscription',
    paymentMethod: 'card',
    transactionId: 'txn_emma_1',
    description: `Paiement - 36 Séances (initial avant pause)`,
    dueDate: emmaStartDate,
    paidAt: emmaStartDate,
    monthNumber: 1
  });

  // Frank - 12 Séances: paiement unique
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: testMember1.userId,
    subscriptionId: frankSubscription.id,
    amount: type12Seances.monthlyPrice,
    currency: 'MAD',
    status: 'completed',
    type: 'subscription',
    paymentMethod: 'card',
    transactionId: 'txn_frank_1',
    description: `Paiement - 12 Séances`,
    dueDate: frankStartDate,
    paidAt: frankStartDate,
    monthNumber: 1
  });

  // Grace - 18 Séances: paiement unique
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: testMember2.userId,
    subscriptionId: graceSubscription.id,
    amount: type18Seances.monthlyPrice,
    currency: 'MAD',
    status: 'completed',
    type: 'subscription',
    paymentMethod: 'cash',
    transactionId: 'txn_grace_1',
    description: `Paiement - 18 Séances`,
    dueDate: graceStartDate,
    paidAt: graceStartDate,
    monthNumber: 1
  });

  // Henry - 12 Séances EXPIRÉ: quota épuisé
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: testMember3.userId,
    subscriptionId: henrySubscription.id,
    amount: type12Seances.monthlyPrice,
    currency: 'MAD',
    status: 'completed',
    type: 'subscription',
    paymentMethod: 'card',
    transactionId: 'txn_henry_1',
    description: `Paiement - 12 Séances (expiré - quota épuisé)`,
    dueDate: henryStartDate,
    paidAt: henryStartDate,
    monthNumber: 1
  });

  // Iris - 18 Séances ANNULÉ: remboursé
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: testMember4.userId,
    subscriptionId: irisSubscription.id,
    amount: type18Seances.monthlyPrice,
    currency: 'MAD',
    status: 'refunded',
    type: 'subscription',
    paymentMethod: 'card',
    transactionId: 'txn_iris_1',
    description: `Paiement - 18 Séances (remboursé)`,
    dueDate: irisStartDate,
    paidAt: irisStartDate,
    monthNumber: 1
  });

  // Jack - Annuel Illimité: paiement unique
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: testMember5.userId,
    subscriptionId: jackSubscription.id,
    amount: typeAnnuelIllimite.monthlyPrice,
    currency: 'MAD',
    status: 'completed',
    type: 'subscription',
    paymentMethod: 'card',
    transactionId: 'txn_jack_1',
    description: `Paiement - Annuel Illimité`,
    dueDate: jackStartDate,
    paidAt: jackStartDate,
    monthNumber: 1
  });

  // Paiements one-time supplémentaires pour diversité
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: bobMember.userId,
    amount: 350,
    currency: 'MAD',
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
    amount: 150,
    currency: 'MAD',
    status: 'completed',
    type: 'one-time',
    paymentMethod: 'cash',
    transactionId: 'txn_david_extra_001',
    description: 'Boisson énergétique',
    dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  });

  // Olivia - 12 Séances EN ATTENTE: paiement pending
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: oliviaMember.userId,
    subscriptionId: oliviaSubscription.id,
    amount: type12Seances.monthlyPrice,
    currency: 'MAD',
    status: 'pending',
    type: 'subscription',
    paymentMethod: null, // Sera rempli lors de l'acquittement
    transactionId: null,
    description: `Paiement - 12 Séances (À acquitter)`,
    dueDate: oliviaStartDate,
    paidAt: null,
    monthNumber: 1
  });

  // Peter - Standard NOUVEAU: 12 paiements (TOUS PENDING - Fraîchement créé aujourd'hui)
  const peterUser = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'peter@example.com',
      password: memberPassword,
      firstName: 'Peter',
      lastName: 'Parker',
      role: 'member',
      gymId: gym1.id,
      notificationsEnabled: true
    }
  });
  const peterMember = await prisma.member.create({
    data: {
      userId: peterUser.id,
      workoutNotificationsEnabled: true
    }
  });
  
  const peterStartDate = new Date(); // Aujourd'hui
  const peterEndDate = new Date(peterStartDate);
  peterEndDate.setMonth(peterEndDate.getMonth() + 1); // Valable 1 mois
  
  const peterSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: peterMember.userId,
      subscriptionTypeId: type18Seances.id,
      status: 'active',
      startDate: peterStartDate,
      endDate: peterEndDate,
      autoRenew: true,
      sessionsUsed: 0,
    },
  });
  console.log(`✅ Abonnement ${type18Seances.name} NOUVEAU pour ${peterUser.firstName} ${peterUser.lastName}`);

  // Paiement unique - PENDING
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: peterMember.userId,
    subscriptionId: peterSubscription.id,
    amount: type18Seances.monthlyPrice,
    currency: 'MAD',
    status: 'pending',
    type: 'subscription',
    paymentMethod: null,
    transactionId: null,
    description: `Paiement - 18 Séances (NOUVEAU)`,
    dueDate: peterStartDate,
    paidAt: null,
    monthNumber: 1
  });

  // Mary - Premium NOUVEAU: 3 paiements (trimestriel - TOUS PENDING)
  const maryUser = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'mary@example.com',
      password: memberPassword,
      firstName: 'Mary',
      lastName: 'Jane',
      role: 'member',
      gymId: gym1.id,
      notificationsEnabled: true
    }
  });
  const maryMember = await prisma.member.create({
    data: {
      userId: maryUser.id,
      workoutNotificationsEnabled: true
    }
  });
  
  const maryStartDate = new Date();
  const maryEndDate = new Date(maryStartDate);
  maryEndDate.setMonth(maryEndDate.getMonth() + 2); // Valable 2 mois
  
  const marySubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: maryMember.userId,
      subscriptionTypeId: type36Seances.id,
      status: 'active',
      startDate: maryStartDate,
      endDate: maryEndDate,
      autoRenew: true,
      sessionsUsed: 0,
    },
  });
  console.log(`✅ Abonnement ${type36Seances.name} NOUVEAU pour ${maryUser.firstName} ${maryUser.lastName}`);

  // Paiement unique - PENDING
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: maryMember.userId,
    subscriptionId: marySubscription.id,
    amount: type36Seances.monthlyPrice,
    currency: 'MAD',
    status: 'pending',
    type: 'subscription',
    paymentMethod: null,
    transactionId: null,
    description: `Paiement - 36 Séances (NOUVEAU)`,
    dueDate: maryStartDate,
    paidAt: null,
    monthNumber: 1
  });

  // Nathan - VIP NOUVEAU: 2 paiements (semestriel - TOUS PENDING)
  const nathanUser = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'nathan@example.com',
      password: memberPassword,
      firstName: 'Nathan',
      lastName: 'Drake',
      role: 'member',
      gymId: gym2.id,
      notificationsEnabled: true
    }
  });
  const nathanMember = await prisma.member.create({
    data: {
      userId: nathanUser.id,
      workoutNotificationsEnabled: true
    }
  });
  
  const nathanStartDate = new Date();
  const nathanEndDate = new Date(nathanStartDate);
  nathanEndDate.setFullYear(nathanEndDate.getFullYear() + 1); // Valable 1 an
  
  const nathanSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: nathanMember.userId,
      subscriptionTypeId: typeAnnuelIllimite.id,
      status: 'active',
      startDate: nathanStartDate,
      endDate: nathanEndDate,
      autoRenew: true,
      sessionsUsed: 0,
    },
  });
  console.log(`✅ Abonnement ${typeAnnuelIllimite.name} NOUVEAU pour ${nathanUser.firstName} ${nathanUser.lastName}`);

  // Paiement unique annuel - PENDING
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: nathanMember.userId,
    subscriptionId: nathanSubscription.id,
    amount: typeAnnuelIllimite.monthlyPrice,
    currency: 'MAD',
    status: 'pending',
    type: 'subscription',
    paymentMethod: null,
    transactionId: null,
    description: `Paiement - Annuel Illimité (NOUVEAU)`,
    dueDate: nathanStartDate,
    paidAt: null,
    monthNumber: 1
  });

  // Sarah - Corporate NOUVEAU: 1 paiement (oneshot annuel - PENDING)
  const sarahUser = await prisma.user.create({
    data: {
      displayId: generateUserIdByRole('member'),
      uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      email: 'sarah@example.com',
      password: memberPassword,
      firstName: 'Sarah',
      lastName: 'Connor',
      role: 'member',
      gymId: gym2.id,
      notificationsEnabled: true
    }
  });
  const sarahMember = await prisma.member.create({
    data: {
      userId: sarahUser.id,
      workoutNotificationsEnabled: true
    }
  });
  
  const sarahStartDate = new Date();
  const sarahEndDate = new Date(sarahStartDate);
  sarahEndDate.setFullYear(sarahEndDate.getFullYear() + 1); // Valable 1 an
  
  const sarahSubscription = await prisma.subscription.create({
    data: {
      displayId: generateSubscriptionId(),
      memberId: sarahMember.userId,
      subscriptionTypeId: typeAnnuelIllimite.id,
      status: 'active',
      startDate: sarahStartDate,
      endDate: sarahEndDate,
      autoRenew: false,
      sessionsUsed: 0,
    },
  });
  console.log(`✅ Abonnement ${typeAnnuelIllimite.name} ANNUEL pour ${sarahUser.firstName} ${sarahUser.lastName}`);

  // 1 seul paiement pour toute l'année - PENDING
  paymentsData.push({
    displayId: generatePaymentId(),
    memberId: sarahMember.userId,
    subscriptionId: sarahSubscription.id,
    amount: typeAnnuelIllimite.monthlyPrice,
    currency: 'MAD',
    status: 'pending',
    type: 'subscription',
    paymentMethod: null,
    transactionId: null,
    description: `Paiement - Annuel Illimité`,
    dueDate: sarahStartDate,
    paidAt: null,
    monthNumber: 1
  });

  const payments = await prisma.payment.createMany({ data: paymentsData });
  console.log(`✅ ${payments.count} paiements créés\n`);
  
  console.log('📊 NOUVEAUX ABONNEMENTS (tous paiements PENDING):');
  console.log('   - Peter Parker: 18 Séances');
  console.log('   - Mary Jane: 36 Séances');
  console.log('   - Nathan Drake: Annuel Illimité');
  console.log('   - Sarah Connor: Annuel Illimité');
  console.log('   - Olivia Martinez: 12 Séances (abonnement PENDING)\n');

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
  console.log(`✅ Planning créé pour ${bobUser.firstName} ${bobUser.lastName}: ${bobPlanning.title}`);

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
  console.log(`✅ Planning créé pour ${aliceUser.firstName} ${aliceUser.lastName}: ${alicePlanning.title}`);

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
  console.log(`✅ Planning créé pour ${charlieUser.firstName} ${charlieUser.lastName}: ${charliePlanning.title}\n`);


  // Créer des banners event et promotion
  console.log('🎯 Création des banners...');

  const bannerNow = new Date();

  // Banner 1 — EVENT: Tournoi mensuel (actif maintenant)
  const bannerEvent1 = await prisma.banner.create({
    data: {
      displayId: generateBannerId(),
      gymId: gym1.id,
      type: 'event',
      title: 'Tournoi Mensuel de Fitness',
      titleEn: 'Monthly Fitness Tournament',
      titleAr: 'البطولة الشهرية للياقة البدنية',
      description: 'Participez à notre tournoi mensuel et remportez des prix incroyables ! Inscrivez-vous avant le 30 octobre.',
      descriptionEn: 'Join our monthly tournament and win amazing prizes! Register before October 30th.',
      descriptionAr: 'شارك في بطولتنا الشهرية واربح جوائز رائعة! سجّل قبل 30 أكتوبر.',
      imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800',
      mediaType: 'image',
      backgroundColor: '#1A1A2E',
      textColor: '#E94560',
      startDate: new Date(bannerNow.getFullYear(), bannerNow.getMonth(), 1),
      endDate: new Date(bannerNow.getFullYear(), bannerNow.getMonth() + 1, 0),
      actionType: 'showDetails',
      actionData: 'Inscriptions ouvertes — présentation obligatoire à l\'accueil.',
      priority: 10,
      isActive: true,
      isScheduled: true,
      maxViewsPerUser: 5,
    }
  });

  // Variant A — version avec challenge
  await prisma.bannerVariant.create({
    data: {
      displayId: generateBannerVariantId(),
      bannerId: bannerEvent1.id,
      variantName: 'A',
      title: '🏆 Tournoi Mensuel',
      description: 'Testez vos limites. Gagnez des récompenses.',
      backgroundColor: '#1A1A2E',
      textColor: '#E94560',
      weight: 50,
      isActive: true,
    }
  });

  // Variant B — version axée communauté
  await prisma.bannerVariant.create({
    data: {
      displayId: generateBannerVariantId(),
      bannerId: bannerEvent1.id,
      variantName: 'B',
      title: '💪 Rejoins le Tournoi !',
      description: 'Sois dans le top 3 et remporte ton mois gratuit.',
      backgroundColor: '#0F3460',
      textColor: '#FFFFFF',
      weight: 50,
      isActive: true,
    }
  });

  console.log(`✅ Banner event créé: ${bannerEvent1.title} (2 variants A/B)`);

  // Banner 2 — EVENT: Cours collectifs spéciaux (gym2, commence dans 2 semaines)
  const bannerEvent2 = await prisma.banner.create({
    data: {
      displayId: generateBannerId(),
      gymId: gym2.id,
      type: 'event',
      title: 'Semaine Spéciale Yoga & Pilates',
      titleEn: 'Special Yoga & Pilates Week',
      titleAr: 'أسبوع اليوغا والبيلاتس الخاص',
      description: 'Du 4 au 8 novembre, profitez de cours collectifs gratuits animés par nos coachs certifiés.',
      descriptionEn: 'From Nov 4–8, enjoy free group classes led by our certified coaches.',
      imageUrl: 'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=800',
      mediaType: 'image',
      backgroundColor: '#2D6A4F',
      textColor: '#D8F3DC',
      startDate: new Date(bannerNow.getFullYear(), bannerNow.getMonth(), bannerNow.getDate() + 14),
      endDate: new Date(bannerNow.getFullYear(), bannerNow.getMonth(), bannerNow.getDate() + 21),
      actionType: 'externalUrl',
      actionData: 'https://app.team-oustad.com/events/yoga-week',
      priority: 8,
      isActive: false, // Pas encore actif — sera activé par le cron
      isScheduled: true,
    }
  });

  console.log(`✅ Banner event créé: ${bannerEvent2.title} (planifié, actif dans 2 semaines)`);

  // Banner 3 — PROMOTION: Offre de bienvenue (toutes les salles)
  const bannerPromo1 = await prisma.banner.create({
    data: {
      displayId: generateBannerId(),
      type: 'promotion',
      title: '-20% sur votre 1er mois',
      titleEn: '20% off your 1st month',
      titleAr: 'خصم 20% على شهرك الأول',
      description: 'Inscrivez-vous ce mois-ci et bénéficiez de 20% de réduction sur votre premier abonnement. Offre valable jusqu\'au 31 octobre.',
      descriptionEn: 'Sign up this month and get 20% off your first subscription. Valid until Oct 31.',
      imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800',
      mediaType: 'image',
      backgroundColor: '#FF6B35',
      textColor: '#FFFFFF',
      startDate: new Date(bannerNow.getFullYear(), bannerNow.getMonth(), 1),
      endDate: new Date(bannerNow.getFullYear(), bannerNow.getMonth(), 31),
      actionType: 'navigate',
      actionData: '/subscriptions/new',
      actionParams: { discount: 20, code: 'WELCOME20' },
      priority: 15,
      isActive: true,
      isScheduled: true,
      maxViewsPerUser: 3,
      subscriptionTypes: [], // Tous les types d'abonnement
    }
  });

  console.log(`✅ Banner promotion créé: ${bannerPromo1.title} (global, toutes les salles)`);

  // Banner 4 — PROMOTION: Parrainage (gym1, ciblé abonnés actifs)
  const bannerPromo2 = await prisma.banner.create({
    data: {
      displayId: generateBannerId(),
      gymId: gym1.id,
      type: 'promotion',
      title: 'Parrainez un ami, gagnez 1 mois offert',
      titleEn: 'Refer a friend, get 1 month free',
      titleAr: 'قدّم صديقاً واحصل على شهر مجاني',
      description: 'Partagez votre code unique avec un ami. Dès qu\'il s\'inscrit, vous recevez tous les deux 1 mois gratuit !',
      descriptionEn: 'Share your unique code with a friend. Once they sign up, you both get 1 free month!',
      imageUrl: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800',
      mediaType: 'image',
      backgroundColor: '#6A0572',
      textColor: '#F8EDFF',
      startDate: new Date(bannerNow.getFullYear(), bannerNow.getMonth(), 1),
      endDate: new Date(bannerNow.getFullYear(), bannerNow.getMonth() + 2, 0),
      actionType: 'showDetails',
      actionData: 'Retrouvez votre code de parrainage dans votre profil. Chaque parrainage réussi = 1 mois offert pour vous et votre filleul.',
      priority: 12,
      isActive: true,
      isScheduled: true,
      maxViewsPerUser: 10,
    }
  });

  console.log(`✅ Banner promotion créé: ${bannerPromo2.title} (gym1, parrainage)\n`);

  // ==================== SITE VITRINE (CMS) ====================
  console.log('🖥️  Création des pages du site vitrine...');

  await prisma.gym.update({
    where: { id: gym1.id },
    data: {
      description: 'Au cœur de Downtown, une salle de 1 200 m² pensée pour la musculation et le cross-training. Matériel renouvelé chaque année, coachs diplômés présents tous les jours.'
    }
  });
  await prisma.gym.update({
    where: { id: gym2.id },
    data: {
      description: 'Un espace premium à Uptown : cardio panoramique, studio de cours collectifs et zone récupération avec sauna.'
    }
  });

  // validatePage garantit que le seed respecte le même format que PUT /showcase/*
  const homePage = validatePage({
    hero: { eyebrow: 'VITRINE TEAM OUSTAD', tagline: 'Choisis ta salle. Dépasse tes limites.' },
    sections: [
      { id: 'marquee', type: 'marquee', visible: true, data: { words: ['MUSCULATION', 'CARDIO', 'CROSS-TRAINING', 'COURS COLLECTIFS', 'COACHING'] } },
      { id: 'gyms', type: 'gyms', visible: true },
      {
        id: 'categories', type: 'categories', visible: true,
        data: {
          items: [
            { label: 'Musculation', icon: 'fitness' },
            { label: 'Cardio', icon: 'run' },
            { label: 'Cours collectifs', icon: 'groups' },
            { label: 'Nutrition', icon: 'food' },
            { label: 'Récupération', icon: 'zen' }
          ]
        }
      },
      {
        id: 'feature-coaching', type: 'feature', visible: true,
        data: {
          eyebrow: 'COACHING',
          title: 'Un programme qui te ressemble',
          body: 'Nos coachs construisent ton planning et le suivent séance après séance dans l\'app.',
          points: ['Bilan de forme offert', 'Planning personnalisé', 'Suivi de progression'],
          icon: 'target',
          tag: 'Inclus'
        }
      },
      { id: 'promos', type: 'promos', visible: true },
      {
        id: 'testimonials', type: 'testimonials', visible: true,
        data: {
          eyebrow: 'ILS EN PARLENT',
          title: 'Nos membres',
          items: [
            { name: 'Bob W.', meta: 'Membre depuis 2 ans', quote: 'Ambiance au top et coachs toujours dispo.' },
            { name: 'Alice S.', meta: 'Abonnement illimité', quote: 'Le planning dans l\'app change tout, je ne rate plus une séance.' }
          ]
        }
      },
      {
        id: 'news', type: 'markdown', visible: false,
        data: { title: 'Nouveau', body: '**Ouverture** d\'une troisième salle au printemps.' }
      },
      {
        id: 'cta', type: 'cta', visible: true,
        data: { eyebrow: 'PRÊT ?', text: 'Ta première séance est offerte.', buttonLabel: 'Réserver', url: 'https://app.team-oustad.com/' }
      }
    ]
  }, { allowHero: true });

  const gym1Page = validatePage({
    sections: [
      { id: 'about', type: 'gymAbout', visible: true },
      {
        id: 'equipment', type: 'feature', visible: true,
        data: {
          eyebrow: 'ÉQUIPEMENT',
          title: 'Plateau musculation complet',
          body: 'Racks, haltères jusqu\'à 60 kg et zone fonctionnelle.',
          points: ['6 racks à squat', 'Zone cross-training', 'Vestiaires avec casiers'],
          icon: 'bolt'
        }
      },
      { id: 'promos', type: 'gymPromos', visible: true },
      { id: 'hours', type: 'gymHours', visible: true },
      { id: 'team', type: 'gymTeam', visible: true },
      { id: 'subscriptions', type: 'gymSubscriptions', visible: true },
      { id: 'info', type: 'gymInfo', visible: true }
    ]
  }, { allowHero: false });

  const gym2Page = validatePage({
    sections: [
      { id: 'about', type: 'gymAbout', visible: true },
      {
        id: 'classes', type: 'markdown', visible: true,
        data: { title: 'Cours collectifs', body: 'Yoga, HIIT et spinning **tous les soirs** à partir de 18h.' }
      },
      { id: 'hours', type: 'gymHours', visible: true },
      { id: 'subscriptions', type: 'gymSubscriptions', visible: true },
      { id: 'info', type: 'gymInfo', visible: true },
      { id: 'team', type: 'gymTeam', visible: false },
      { id: 'promos', type: 'gymPromos', visible: true }
    ]
  }, { allowHero: false });

  await prisma.showcasePage.createMany({
    data: [
      { key: HOME_KEY, content: homePage, updatedBy: ownerUser.id },
      { key: gymKey(gym1.id), gymId: gym1.id, content: gym1Page, updatedBy: ownerUser.id },
      { key: gymKey(gym2.id), gymId: gym2.id, content: gym2Page, updatedBy: ownerUser.id }
    ]
  });
  console.log(`✅ Pages vitrine créées: accueil (${homePage.sections.length} sections), ${gym1.name}, ${gym2.name}\n`);

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
  const totalAdmins = await prisma.manager.count();
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
  console.log(`   - Managers: ${totalAdmins}`);
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
  
  const totalBanners = await prisma.banner.count();
  const activeBanners = await prisma.banner.count({ where: { isActive: true } });
  const totalVariants = await prisma.bannerVariant.count();
  console.log('🎯 Banners:');
  console.log(`   - Total: ${totalBanners}`);
  console.log(`   - Actifs: ${activeBanners}`);
  console.log(`   - Planifiés (inactifs): ${totalBanners - activeBanners}`);
  console.log(`   - Variants A/B: ${totalVariants}\n`);

  console.log('💪 Exercices et Plannings:');
  console.log(`   - Exercices disponibles: ${totalExercises}`);
  console.log(`   - Plannings créés: ${totalPlannings}`);
  console.log(`   - Jours planifiés: ${totalPlanningDays}`);
  console.log(`   - Exercices assignés: ${totalPlanningExercises}\n`);
  
  console.log('🔐 Identifiants de test:');
  console.log('   Owner:');
  console.log('     - Email: owner@team-oustad.com');
  console.log('     - Password: owner123\n');
  console.log('   Manager (Gym 1):');
  console.log('     - Email: admin@team-oustad.com');
  console.log('     - Password: admin123\n');
  console.log('   Manager (Gym 2):');
  console.log('     - Email: admin2@team-oustad.com');
  console.log('     - Password: admin123\n');
  console.log('   Members (avec historique):');
  console.log('     - bob@example.com (36 Séances actif, 10/36 utilisées, Gym 1)');
  console.log('     - charlie@example.com (12 Séances actif, 3/12 utilisées, Gym 1)');
  console.log('     - alice@example.com (Annuel Illimité actif, 45 séances, Gym 1)');
  console.log('     - david@example.com (18 Séances actif, 16/18 utilisées - quota bas!, Gym 2)');
  console.log('     - emma@example.com (36 Séances PAUSÉ, 5/36, Gym 2)');
  console.log('     - frank@example.com (12 Séances actif, 2/12, Gym 1)');
  console.log('     - grace@example.com (18 Séances actif, 1/18, Gym 2)');
  console.log('     - henry@example.com (12 Séances EXPIRÉ, 12/12 quota épuisé, Gym 1)');
  console.log('     - iris@example.com (18 Séances ANNULÉ, remboursé, Gym 2)');
  console.log('     - jack@example.com (Annuel Illimité actif, 30 séances, Gym 1)');
  console.log('     - olivia@example.com (12 Séances PENDING, 0/12, Gym 1)');
  console.log('   \n   Members NOUVEAUX (tous paiements PENDING):');
  console.log('     - peter@example.com (18 Séances, NOUVEAU, Gym 1)');
  console.log('     - mary@example.com (36 Séances, NOUVEAU, Gym 1)');
  console.log('     - nathan@example.com (Annuel Illimité, NOUVEAU, Gym 2)');
  console.log('     - sarah@example.com (Annuel Illimité, NOUVEAU, Gym 2)');
  console.log('     - Password pour tous: member123\n');
  
  console.log('📊 Types d\'abonnements disponibles:');
  console.log('   - 12 Séances (150 MAD): 12 séances valable 1 mois');
  console.log('   - 18 Séances (200 MAD): 18 séances valable 1 mois');
  console.log('   - 36 Séances (350 MAD): 36 séances valable 2 mois');
  console.log('   - Annuel Illimité (1500 MAD): Accès illimité 7j/7 pendant 1 an\n');
  
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
