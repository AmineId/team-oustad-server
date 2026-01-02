const request = require('supertest');
const express = require('express');
const checkInRoutes = require('../../routes/checkIn');
const {
  cleanDatabase,
  disconnectDatabase,
  createTestGym,
  createTestAdmin,
  createTestMember,
  authHeader,
  prisma
} = require('../helpers/testHelpers');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/check-in', checkInRoutes);

describe('Check-In Routes', () => {
  let testGym;
  let testAdmin;
  let testMember;
  let testSubscription;

  beforeAll(async () => {
    await cleanDatabase();
    testGym = await createTestGym();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.gymCheckIn.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.member.deleteMany({});
    await prisma.admin.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.subscriptionType.deleteMany({});
    
    // Create fresh test users
    testAdmin = await createTestAdmin(testGym.id, {
      email: 'admin@test.com',
      password: 'admin123'
    });
    
    testMember = await createTestMember(testGym.id, {
      email: 'member@test.com',
      password: 'member123'
    });

    // Create a subscription type and subscription
    const subscriptionType = await prisma.subscriptionType.create({
      data: {
        displayId: `SUBTYPE${Date.now()}`,
        name: 'Monthly',
        description: 'Monthly membership',
        monthlyPrice: 50.00,
        sessionQuota: 20,
        features: ['Gym Access']
      }
    });

    testSubscription = await prisma.subscription.create({
      data: {
        displayId: `SUB${Date.now()}`,
        Member: { connect: { userId: testMember.id } },
        SubscriptionType: { connect: { id: subscriptionType.id } },
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentFrequency: 1,
        status: 'active'
      }
    });
  });

  describe('POST /check-in', () => {
    it('should create a check-in for member', async () => {
      const response = await request(app)
        .post('/check-in')
        .set('Authorization', authHeader(testMember))
        .send({
          memberId: testMember.id,
          subscriptionId: testSubscription.id,
          gymId: testGym.id
        });

      expect(response.status).toBe(201);
      expect(response.body.memberId).toBe(testMember.id);
      expect(response.body.checkInTime).toBeDefined();
    });

    it('should return 400 if member already checked in', async () => {
      // First check-in
      await request(app)
        .post('/check-in')
        .set('Authorization', authHeader(testMember))
        .send({
          memberId: testMember.id,
          subscriptionId: testSubscription.id,
          gymId: testGym.id
        });

      // Second check-in should fail
      const response = await request(app)
        .post('/check-in')
        .set('Authorization', authHeader(testMember))
        .send({
          memberId: testMember.id,
          subscriptionId: testSubscription.id,
          gymId: testGym.id
        });

      expect(response.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/check-in')
        .send({
          memberId: testMember.id,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /check-in/:id/checkout', () => {
    let checkIn;

    beforeEach(async () => {
      checkIn = await prisma.gymCheckIn.create({
        data: {
          displayId: `CHECKIN${Date.now()}`,
          memberId: testMember.id,
          subscriptionId: testSubscription.id,
          gymId: testGym.id,
          checkInTime: new Date()
        }
      });
    });

    it('should checkout a member', async () => {
      const response = await request(app)
        .post(`/check-in/${checkIn.id}/checkout`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(response.body.checkOutTime).not.toBeNull();
    });

    it('should return 400 if already checked out', async () => {
      // First checkout
      await request(app)
        .post(`/check-in/${checkIn.id}/checkout`)
        .set('Authorization', authHeader(testMember));

      // Second checkout should fail
      const response = await request(app)
        .post(`/check-in/${checkIn.id}/checkout`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent check-in', async () => {
      const response = await request(app)
        .post('/check-in/99999/checkout')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(404);
    });
  });

  describe('GET /check-in/member/:memberId', () => {
    beforeEach(async () => {
      await prisma.gymCheckIn.create({
        data: {
          displayId: `CHECKIN${Date.now()}`,
          memberId: testMember.id,
          subscriptionId: testSubscription.id,
          gymId: testGym.id,
          checkInTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          checkOutTime: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
        }
      });
    });

    it('should get check-in history for member', async () => {
      const response = await request(app)
        .get(`/check-in/member/${testMember.id}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should allow admin to get member check-in history', async () => {
      const response = await request(app)
        .get(`/check-in/member/${testMember.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /check-in/gym/today', () => {
    beforeEach(async () => {
      // Create a check-in for today
      await prisma.gymCheckIn.create({
        data: {
          displayId: `CHECKIN${Date.now()}`,
          memberId: testMember.id,
          subscriptionId: testSubscription.id,
          gymId: testGym.id,
          checkInTime: new Date()
        }
      });
    });

    it('should get today\'s check-ins as admin', async () => {
      const response = await request(app)
        .get(`/check-in/gym/${testGym.id}/today`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .get(`/check-in/gym/${testGym.id}/today`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(403);
    });
  });
});
