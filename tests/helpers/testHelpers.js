const prisma = require('../../utils/prismaClient');
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_purposes';

/**
 * Clean database - Remove all test data
 */
async function cleanDatabase() {
  // Delete in order to respect foreign key constraints
  await prisma.passwordResetToken.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.planningExercise.deleteMany({});
  await prisma.planningDay.deleteMany({});
  await prisma.exercise.deleteMany({});
  await prisma.planning.deleteMany({});
  await prisma.memberMeasurement.deleteMany({});
  await prisma.memberGoal.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.member.deleteMany({});
  await prisma.admin.deleteMany({});
  await prisma.owner.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.openingHour.deleteMany({});
  await prisma.subscriptionType.deleteMany({});
  await prisma.gym.deleteMany({});
}

/**
 * Disconnect from database
 */
async function disconnectDatabase() {
  // await prisma.$disconnect();
}

/**
 * Create a test gym
 */
async function createTestGym(data = {}) {
  return await prisma.gym.create({
    data: {
      displayId: data.displayId || `GYM${Date.now()}`,
      name: data.name || 'Test Gym',
      address: data.address || '123 Test Street',
      phone: data.phone || '+1234567890',
      ...data
    }
  });
}

/**
 * Create a test owner
 */
async function createTestOwner(gymId, data = {}) {
  const password = await bcrypt.hash(data.password || 'password123', 10);
  
  const user = await prisma.user.create({
    data: {
      displayId: data.displayId || `OWN${Date.now()}`,
      email: data.email || `owner${Date.now()}@test.com`,
      phoneNumber: data.phoneNumber || `+33${Date.now().toString().slice(-9)}`,
      password: password,
      firstName: data.firstName || 'Test',
      lastName: data.lastName || 'Owner',
      role: 'owner',
      gymId: gymId,
      Owner: {
        create: {
          canManageAdmins: data.canManageAdmins !== undefined ? data.canManageAdmins : true,
          canManageGyms: data.canManageGyms !== undefined ? data.canManageGyms : true,
          canViewReports: data.canViewReports !== undefined ? data.canViewReports : true,
          maxGymsAllowed: data.maxGymsAllowed || 10
        }
      }
    },
    include: {
      Owner: true,
      Gym: true
    }
  });

  return user;
}

/**
 * Create a test admin
 */
async function createTestAdmin(gymId, data = {}) {
  const password = await bcrypt.hash(data.password || 'password123', 10);
  
  const user = await prisma.user.create({
    data: {
      displayId: data.displayId || `ADM${Date.now()}`,
      email: data.email || `admin${Date.now()}@test.com`,
      phoneNumber: data.phoneNumber || `+33${Date.now().toString().slice(-9)}`,
      password: password,
      firstName: data.firstName || 'Test',
      lastName: data.lastName || 'Admin',
      role: 'admin',
      gymId: gymId,
      Admin: {
        create: {
          position: data.position || 'Coach'
        }
      }
    },
    include: {
      Admin: true,
      Gym: true
    }
  });

  return user;
}

/**
 * Create a test member
 */
async function createTestMember(gymId, data = {}) {
  const password = await bcrypt.hash(data.password || 'password123', 10);
  
  const user = await prisma.user.create({
    data: {
      displayId: data.displayId || `MEM${Date.now()}`,
      email: data.email || `member${Date.now()}@test.com`,
      phoneNumber: data.phoneNumber || `+33${Date.now().toString().slice(-9)}`,
      password: password,
      firstName: data.firstName || 'Test',
      lastName: data.lastName || 'Member',
      role: 'member',
      gymId: gymId,
      Member: {
        create: {
          onboarding: data.onboarding !== undefined ? data.onboarding : false,
          birthDate: data.birthDate || new Date('1990-01-01'),
          phone: data.phone || '+1234567890',
          profession: data.profession || 'Actif',
          fitnessLevel: data.fitnessLevel || 'intermediaire',
          preferredTrainingDays: data.preferredTrainingDays || ['monday', 'wednesday', 'friday'],
          joinedAt: data.joinedAt || new Date()
        }
      }
    },
    include: {
      Member: true,
      Gym: true
    }
  });

  return user;
}

/**
 * Create a test subscription type
 */
async function createTestSubscriptionType(gymId, data = {}) {
  return await prisma.subscriptionType.create({
    data: {
      displayId: data.displayId || `SUB${Date.now()}`,
      name: data.name || 'Test Subscription',
      description: data.description || 'Test subscription description',
      duration: data.duration || 30,
      price: data.price || 50.00,
      plan: data.plan || 'basic',
      membership: data.membership || 'individual',
      advantages: data.advantages || ['Access to gym', 'Locker'],
      gymId: gymId,
      ...data
    }
  });
}

/**
 * Create a test subscription for a member
 */
async function createTestSubscription(memberId, subscriptionTypeId, data = {}) {
  const startDate = data.startDate || new Date();
  const endDate = data.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  return await prisma.subscription.create({
    data: {
      displayId: data.displayId || `SUB${Date.now()}`,
      memberId: memberId,
      subscriptionTypeId: subscriptionTypeId,
      plan: data.plan || 'basic',
      membership: data.membership || 'individual',
      startDate: startDate,
      endDate: endDate,
      status: data.status || 'active',
      ...data
    },
    include: {
      SubscriptionType: true,
      Member: true
    }
  });
}

/**
 * Create a test payment
 */
async function createTestPayment(memberId, subscriptionId, data = {}) {
  return await prisma.payment.create({
    data: {
      displayId: data.displayId || `PAY${Date.now()}`,
      memberId: memberId,
      subscriptionId: subscriptionId,
      amount: data.amount || 50.00,
      method: data.method || 'cash',
      status: data.status || 'completed',
      paidAt: data.paidAt || new Date(),
      isAcknowledged: data.isAcknowledged !== undefined ? data.isAcknowledged : false,
      ...data
    }
  });
}

/**
 * Create a test planning
 */
async function createTestPlanning(coachId, memberId, data = {}) {
  return await prisma.planning.create({
    data: {
      displayId: data.displayId || `PLN${Date.now()}`,
      coachId: coachId,
      memberId: memberId,
      title: data.title || 'Test Planning',
      description: data.description || 'Test planning description',
      startDate: data.startDate || new Date(),
      endDate: data.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      frequency: data.frequency || 'weekly',
      status: data.status || 'active',
      ...data
    }
  });
}

/**
 * Create a test exercise
 */
async function createTestExercise(gymId, data = {}) {
  return await prisma.exercise.create({
    data: {
      displayId: data.displayId || `EXE${Date.now()}`,
      name: data.name || 'Test Exercise',
      description: data.description || 'Test exercise description',
      category: data.category || 'strength',
      muscleGroup: data.muscleGroup || ['chest', 'arms'],
      difficulty: data.difficulty || 'beginner',
      equipmentNeeded: data.equipmentNeeded || ['none'],
      gymId: gymId,
      ...data
    }
  });
}

/**
 * Generate JWT token for a user
 */
function generateToken(user) {
  return jwt.sign({
    sub: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    type: user.role
  }, JWT_SECRET, { expiresIn: '30d' });
}

/**
 * Generate authorization header
 */
function authHeader(user) {
  const token = generateToken(user);
  return `Bearer ${token}`;
}

module.exports = {
  prisma,
  cleanDatabase,
  disconnectDatabase,
  createTestGym,
  createTestOwner,
  createTestAdmin,
  createTestMember,
  createTestSubscriptionType,
  createTestSubscription,
  createTestPayment,
  createTestPlanning,
  createTestExercise,
  generateToken,
  authHeader
};
