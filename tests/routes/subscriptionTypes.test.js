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
          monthlyPrice: 99.99,
          features: ['All access', 'Personal trainer'],
          sessionQuota: 30
        });

      expect(response.status).toBe(201);
      expect(response.body.type.name).toBe('Premium Monthly');
      expect(response.body.type.monthlyPrice).toBe(99.99);
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .post('/subscription-types')
        .set('Authorization', authHeader(testMember))
        .send({
          name: 'Basic Monthly',
          monthlyPrice: 49.99,
          features: ['Basic access']
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
          monthlyPrice: 49.99,
          features: ['Basic access'],
          sessionQuota: 15
        }
      });

      await prisma.subscriptionType.create({
        data: {
          displayId: 'SUB002',
          name: 'Premium',
          description: 'Premium membership',
          monthlyPrice: 99.99,
          features: ['Premium access', 'All equipment'],
          sessionQuota: 30
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
          monthlyPrice: 59.99,
          features: ['Test access'],
          sessionQuota: 20
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
          monthlyPrice: 59.99,
          features: ['Original access'],
          sessionQuota: 20
        }
      });
    });

    it('should update a subscription type as admin', async () => {
      const response = await request(app)
        .put(`/subscription-types/${testSubscriptionType.id}`)
        .set('Authorization', authHeader(testAdmin))
        .send({
          name: 'Updated Name',
          monthlyPrice: 69.99
        });

      expect(response.status).toBe(200);
      expect(response.body.type.name).toBe('Updated Name');
      expect(response.body.type.monthlyPrice).toBe(69.99);
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
          monthlyPrice: 59.99,
          features: ['To delete'],
          sessionQuota: 20
        }
      });
    });

    it('should delete a subscription type as admin', async () => {
      const response = await request(app)
        .delete(`/subscription-types/${testSubscriptionType.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      
      // Verify soft deletion (isActive = false)
      const deletedType = await prisma.subscriptionType.findUnique({
        where: { id: testSubscriptionType.id }
      });
      expect(deletedType).toBeDefined();
      expect(deletedType.isActive).toBe(false);
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .delete(`/subscription-types/${testSubscriptionType.id}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(403);
    });
  });
});
