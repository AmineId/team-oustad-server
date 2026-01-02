const request = require('supertest');
const express = require('express');
const subscriptionTypesRoutes = require('../../routes/subscriptionTypes');
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
app.use('/subscription-types', subscriptionTypesRoutes);

describe('Subscription Types Routes', () => {
  let testGym;
  let testAdmin;
  let testMember;

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
    await prisma.subscriptionType.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.member.deleteMany({});
    await prisma.admin.deleteMany({});
    await prisma.user.deleteMany({});
    
    // Create fresh test users
    testAdmin = await createTestAdmin(testGym.id, {
      email: 'admin@test.com',
      password: 'admin123'
    });
    
    testMember = await createTestMember(testGym.id, {
      email: 'member@test.com',
      password: 'member123'
    });
  });

  describe('POST /subscription-types', () => {
    it('should create a subscription type as admin', async () => {
      const response = await request(app)
        .post('/subscription-types')
        .set('Authorization', authHeader(testAdmin))
        .send({
          name: 'Premium Monthly',
          description: 'Premium membership with all access',
          price: 99.99,
          durationDays: 30,
          sessionQuota: 30
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Premium Monthly');
      expect(response.body.price).toBe(99.99);
      expect(response.body.durationDays).toBe(30);
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .post('/subscription-types')
        .set('Authorization', authHeader(testMember))
        .send({
          name: 'Basic Monthly',
          price: 49.99,
          durationDays: 30
        });

      expect(response.status).toBe(403);
    });

    it('should return 400 with missing required fields', async () => {
      const response = await request(app)
        .post('/subscription-types')
        .set('Authorization', authHeader(testAdmin))
        .send({
          name: 'Incomplete Subscription'
          // Missing price and durationDays
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /subscription-types', () => {
    beforeEach(async () => {
      await prisma.subscriptionType.create({
        data: {
          displayId: 'SUB001',
          name: 'Basic',
          description: 'Basic membership',
          price: 49.99,
          durationDays: 30,
          sessionQuota: 15,
          gymId: testGym.id
        }
      });

      await prisma.subscriptionType.create({
        data: {
          displayId: 'SUB002',
          name: 'Premium',
          description: 'Premium membership',
          price: 99.99,
          durationDays: 30,
          sessionQuota: 30,
          gymId: testGym.id
        }
      });
    });

    it('should get all subscription types', async () => {
      const response = await request(app)
        .get('/subscription-types')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    it('should work for both members and admins', async () => {
      const memberResponse = await request(app)
        .get('/subscription-types')
        .set('Authorization', authHeader(testMember));

      const adminResponse = await request(app)
        .get('/subscription-types')
        .set('Authorization', authHeader(testAdmin));

      expect(memberResponse.status).toBe(200);
      expect(adminResponse.status).toBe(200);
    });
  });

  describe('GET /subscription-types/:id', () => {
    let testSubscriptionType;

    beforeEach(async () => {
      testSubscriptionType = await prisma.subscriptionType.create({
        data: {
          displayId: 'SUB001',
          name: 'Test Subscription',
          description: 'Test description',
          price: 59.99,
          durationDays: 30,
          sessionQuota: 20,
          gymId: testGym.id
        }
      });
    });

    it('should get a specific subscription type', async () => {
      const response = await request(app)
        .get(`/subscription-types/${testSubscriptionType.id}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testSubscriptionType.id);
      expect(response.body.name).toBe('Test Subscription');
    });

    it('should return 404 for non-existent subscription type', async () => {
      const response = await request(app)
        .get('/subscription-types/99999')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /subscription-types/:id', () => {
    let testSubscriptionType;

    beforeEach(async () => {
      testSubscriptionType = await prisma.subscriptionType.create({
        data: {
          displayId: 'SUB001',
          name: 'Original Name',
          description: 'Original description',
          price: 59.99,
          durationDays: 30,
          sessionQuota: 20,
          gymId: testGym.id
        }
      });
    });

    it('should update a subscription type as admin', async () => {
      const response = await request(app)
        .put(`/subscription-types/${testSubscriptionType.id}`)
        .set('Authorization', authHeader(testAdmin))
        .send({
          name: 'Updated Name',
          price: 69.99
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.price).toBe(69.99);
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .put(`/subscription-types/${testSubscriptionType.id}`)
        .set('Authorization', authHeader(testMember))
        .send({
          name: 'Updated Name'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /subscription-types/:id', () => {
    let testSubscriptionType;

    beforeEach(async () => {
      testSubscriptionType = await prisma.subscriptionType.create({
        data: {
          displayId: 'SUB001',
          name: 'To Delete',
          description: 'Will be deleted',
          price: 59.99,
          durationDays: 30,
          sessionQuota: 20,
          gymId: testGym.id
        }
      });
    });

    it('should delete a subscription type as admin', async () => {
      const response = await request(app)
        .delete(`/subscription-types/${testSubscriptionType.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      
      // Verify deletion
      const deletedType = await prisma.subscriptionType.findUnique({
        where: { id: testSubscriptionType.id }
      });
      expect(deletedType).toBeNull();
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .delete(`/subscription-types/${testSubscriptionType.id}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(403);
    });
  });
});
