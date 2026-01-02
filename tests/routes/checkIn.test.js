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
    await prisma.checkIn.deleteMany({});
    await prisma.subscription.deleteMany({});
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
        displayId: 'SUB001',
        name: 'Monthly',
        description: 'Monthly membership',
        price: 50.00,
        durationDays: 30,
        sessionQuota: 20,
        gymId: testGym.id
      }
    });

    testSubscription = await prisma.subscription.create({
      data: {
        displayId: 'MEMBERSHIP001',
        memberId: testMember.Member.id,
        subscriptionTypeId: subscriptionType.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        remainingSessionQuota: 20,
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
          memberId: testMember.Member.id
        });

      expect(response.status).toBe(201);
      expect(response.body.memberId).toBe(testMember.Member.id);
      expect(response.body.checkInTime).toBeDefined();
      expect(response.body.checkOutTime).toBeNull();
    });

    it('should return 400 if member already checked in', async () => {
      // First check-in
      await request(app)
        .post('/check-in')
        .set('Authorization', authHeader(testMember))
        .send({
          memberId: testMember.Member.id
        });

      // Second check-in should fail
      const response = await request(app)
        .post('/check-in')
        .set('Authorization', authHeader(testMember))
        .send({
          memberId: testMember.Member.id
        });

      expect(response.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/check-in')
        .send({
          memberId: testMember.Member.id
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /check-in/:id/checkout', () => {
    let checkIn;

    beforeEach(async () => {
      checkIn = await prisma.checkIn.create({
        data: {
          memberId: testMember.Member.id,
          gymId: testGym.id,
          checkInTime: new Date(),
          checkOutTime: null
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
      await prisma.checkIn.create({
        data: {
          memberId: testMember.Member.id,
          gymId: testGym.id,
          checkInTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          checkOutTime: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
        }
      });
    });

    it('should get check-in history for member', async () => {
      const response = await request(app)
        .get(`/check-in/member/${testMember.Member.id}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should allow admin to get member check-in history', async () => {
      const response = await request(app)
        .get(`/check-in/member/${testMember.Member.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /check-in/gym/today', () => {
    beforeEach(async () => {
      // Create a check-in for today
      await prisma.checkIn.create({
        data: {
          memberId: testMember.Member.id,
          gymId: testGym.id,
          checkInTime: new Date(),
          checkOutTime: null
        }
      });
    });

    it('should get today\'s check-ins as admin', async () => {
      const response = await request(app)
        .get('/check-in/gym/today')
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .get('/check-in/gym/today')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(403);
    });
  });
});
