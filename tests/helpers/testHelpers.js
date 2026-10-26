const { randomUUID } = require('crypto');
const prisma = require('../../utils/prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_purposes';

const uid = () => randomUUID().replace(/-/g, '').slice(0, 10);

/**
 * Clean database - Remove all test data
 */
async function cleanDatabase() {
  // Delete in order to respect foreign key constraints
  await prisma.passwordResetToken.deleteMany({});
  await prisma.bannerStats.deleteMany({});
  await prisma.bannerVariant.deleteMany({});
  await prisma.banner.deleteMany({});
  await prisma.quotaNotification.deleteMany({});
  await prisma.storeReservation.deleteMany({});
  await prisma.storeProduct.deleteMany({});
  await prisma.incidentMessage.deleteMany({});
  await prisma.incident.deleteMany({});
  await prisma.trainingSessionMember.deleteMany({});
  await prisma.trainingSession.deleteMany({});
  await prisma.gymCheckIn.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.planningExercise.deleteMany({});
  await prisma.planningDay.deleteMany({});
  await prisma.planning.deleteMany({});
  await prisma.programAssignment.deleteMany({});
  await prisma.program.deleteMany({});
  await prisma.exercise.deleteMany({});
  await prisma.memberMeasurement.deleteMany({});
  await prisma.memberGoal.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.member.deleteMany({});
  await prisma.manager.deleteMany({});
  await prisma.coachGym.deleteMany({});
  await prisma.coach.deleteMany({});
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
      displayId: data.displayId || `GYM${uid()}`,
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
  const uniqueCode = data.uniqueCode || `OWN${uid()}`;

  const user = await prisma.user.create({
    data: {
      displayId: data.displayId || `OWN${uid()}`,
      email: data.email || `owner${uid()}@test.com`,
      phoneNumber: data.phoneNumber || `+336${uid().slice(0, 8)}`,
      password: password,
      uniqueCode: uniqueCode,
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
 * Create a test coach (Rôles V2) rattaché aux salles `gymIds`
 */
async function createTestCoach(gymIds, data = {}) {
  const ids = Array.isArray(gymIds) ? gymIds : [gymIds];
  const password = await bcrypt.hash(data.password || 'password123', 10);

  return prisma.user.create({
    data: {
      displayId: data.displayId || `COACH${uid()}`,
      email: data.email || `coach${uid()}@test.com`,
      phoneNumber: data.phoneNumber || `+337${uid().slice(0, 8)}`,
      password,
      uniqueCode: data.uniqueCode || `COA${uid()}`,
      firstName: data.firstName || 'Test',
      lastName: data.lastName || 'Coach',
      role: 'coach',
      gymId: ids[0],
      Coach: { create: { CoachGym: { create: ids.map(gymId => ({ gymId })) } } }
    },
    include: { Coach: { include: { CoachGym: true } }, Gym: true }
  });
}

/**
 * Create a test manager (ancien rôle admin)
 */
async function createTestAdmin(gymId, data = {}) {
  const password = await bcrypt.hash(data.password || 'password123', 10);
  const uniqueCode = data.uniqueCode || `ADM${uid()}`;

  const user = await prisma.user.create({
    data: {
      displayId: data.displayId || `ADM${uid()}`,
      email: data.email || `admin${uid()}@test.com`,
      phoneNumber: data.phoneNumber || `+336${uid().slice(0, 8)}`,
      password: password,
      uniqueCode: uniqueCode,
      firstName: data.firstName || 'Test',
      lastName: data.lastName || 'Admin',
      role: 'manager',
      gymId: gymId,
      Manager: {
        create: {}
      }
    },
    include: {
      Manager: true,
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
  const uniqueCode = data.uniqueCode || `MEM${uid()}`;

  const user = await prisma.user.create({
    data: {
      displayId: data.displayId || `MEM${uid()}`,
      email: data.email || `member${uid()}@test.com`,
      phoneNumber: data.phoneNumber || `+336${uid().slice(0, 8)}`,
      password: password,
      uniqueCode: uniqueCode,
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
          preferredTrainingDays: data.preferredTrainingDays || [1, 3, 5], // 1=Monday, 3=Wednesday, 5=Friday
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
async function createTestSubscriptionType(data = {}) {
  return await prisma.subscriptionType.create({
    data: {
      displayId: data.displayId || `SUBT${uid()}`,
      name: data.name || `Test Subscription ${uid()}`,
      description: data.description || 'Test subscription description',
      monthlyPrice: data.monthlyPrice || data.price || 50.00,
      features: data.features || ['Access to gym', 'Locker'],
      isActive: data.isActive !== undefined ? data.isActive : true,
      sessionQuota: data.sessionQuota || null,
      sessionType: data.sessionType || 'unlimited',
      durationMonths: data.durationMonths || 1,
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
      displayId: data.displayId || `SUBS${uid()}`,
      memberId: memberId,
      subscriptionTypeId: subscriptionTypeId,
      startDate: startDate,
      endDate: endDate,
      status: data.status || 'active',
      autoRenew: data.autoRenew !== undefined ? data.autoRenew : true,
      paymentFrequency: data.paymentFrequency || 12,
      sessionsUsed: data.sessionsUsed || 0,
      sessionQuota: data.sessionQuota || null,
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
      displayId: data.displayId || `PAY${uid()}`,
      memberId: memberId,
      subscriptionId: subscriptionId,
      amount: data.amount || 50.00,
      currency: data.currency || 'MAD',
      status: data.status || 'completed',
      type: data.type || 'subscription',
      paymentMethod: data.paymentMethod || data.method || 'cash',
      transactionId: data.transactionId || `TXN${uid()}`,
      description: data.description || null,
      dueDate: data.dueDate || new Date(),
      monthNumber: data.monthNumber || null,
      paidAt: data.paidAt || (data.status === 'completed' ? new Date() : null),
      ...data
    }
  });
}

/**
 * Create a test planning
 */
async function createTestPlanning(coachId, memberId, data = {}) {
  // Rôles V2 : un « planning » est une affectation de programme
  const program = await createTestProgram(coachId, { title: data.title || 'Test Planning' });
  return createTestAssignment(program.id, memberId, coachId, data);
}

/**
 * Create a test program (Rôles V2). `days` : [{ dayOfWeek, exercises: [{ exerciseId, sets, reps }] }]
 */
async function createTestProgram(creatorId, data = {}) {
  return prisma.program.create({
    data: {
      displayId: data.displayId || `PROGRAM-${uid()}`,
      title: data.title || 'Test Program',
      description: data.description || 'Test program description',
      level: data.level || null,
      durationWeeks: data.durationWeeks || null,
      createdBy: creatorId,
      ProgramDay: {
        create: (data.days || []).map(day => ({
          dayOfWeek: day.dayOfWeek,
          ProgramExercise: { create: (day.exercises || []).map((e, i) => ({ order: i, ...e })) }
        }))
      }
    },
    include: { ProgramDay: { include: { ProgramExercise: true } } }
  });
}

/**
 * Create a test program assignment (Rôles V2)
 */
async function createTestAssignment(programId, memberId, assignedBy, data = {}) {
  return prisma.programAssignment.create({
    data: {
      displayId: data.displayId || `ASSIGN-${uid()}`,
      programId,
      memberId,
      assignedBy,
      startDate: data.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: data.endDate === undefined ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : data.endDate,
      status: data.status || 'active'
    }
  });
}

/**
 * Create a test exercise
 */
async function createTestExercise(data = {}) {
  return await prisma.exercise.create({
    data: {
      displayId: data.displayId || `EXE${uid()}`,
      name: data.name || 'Test Exercise',
      description: data.description || 'Test exercise description',
      category: data.category || 'strength',
      muscleGroup: data.muscleGroup || ['chest', 'arms'],
      equipment: data.equipment || ['none'],
      difficulty: data.difficulty || 'beginner',
      instructions: data.instructions || null,
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
  createTestManager: createTestAdmin,
  createTestCoach,
  createTestMember,
  createTestSubscriptionType,
  createTestSubscription,
  createTestPayment,
  createTestPlanning,
  createTestProgram,
  createTestAssignment,
  createTestExercise,
  generateToken,
  authHeader
};
