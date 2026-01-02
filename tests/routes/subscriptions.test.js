const request = require('supertest');
const express = require('express');
const subscriptionsRoutes = require('../../routes/subscriptions');
const {
  cleanDatabase,
  disconnectDatabase,
  createTestGym,
  createTestAdmin,
  createTestMember,
  createTestSubscriptionType,
  createTestSubscription,
  createTestPayment,
  authHeader,
  prisma
} = require('../helpers/testHelpers');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/subscriptions', subscriptionsRoutes);

describe('Subscriptions Routes', () => {
  let testGym;
  let testAdmin;
  let testMember;
  let testSubscriptionType;

  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    
    testGym = await createTestGym({ name: 'Test Gym' });
    
    testAdmin = await createTestAdmin(testGym.id, {
      email: 'admin@test.com',
      password: 'admin123'
    });
    
    testMember = await createTestMember(testGym.id, {
      email: 'member@test.com',
      password: 'member123'
    });

    testSubscriptionType = await createTestSubscriptionType({
      name: 'Basic Monthly',
      monthlyPrice: 50.00,
      durationMonths: 1,
      sessionType: 'unlimited'
    });
  });

  describe('POST /subscriptions', () => {
    it('should allow admin to create subscription for member', async () => {
      const subscriptionData = {
        memberId: testMember.id,
        subscriptionTypeId: testSubscriptionType.id,
        paymentFrequency: 12 // monthly
      };

      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', authHeader(testAdmin))
        .send(subscriptionData);

      expect([200, 201]).toContain(response.status);
      expect(response.body.subscription).toBeDefined();
      expect(response.body.subscription.memberId).toBe(testMember.id);
      expect(response.body.paymentsGenerated).toBe(12);
      expect(response.body.Payment).toHaveLength(12);
    });

    it('should create subscription with quarterly payments', async () => {
      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', authHeader(testAdmin))
        .send({
          memberId: testMember.id,
          subscriptionTypeId: testSubscriptionType.id,
          paymentFrequency: 3 // quarterly
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body.paymentsGenerated).toBe(12);
    });

    it('should create subscription with one-shot payment', async () => {
      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', authHeader(testAdmin))
        .send({
          memberId: testMember.id,
          subscriptionTypeId: testSubscriptionType.id,
          paymentFrequency: 1 // one-shot
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body.paymentsGenerated).toBe(12);
    });

    it('should default to monthly (12 payments) if frequency not specified', async () => {
      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', authHeader(testAdmin))
        .send({
          memberId: testMember.id,
          subscriptionTypeId: testSubscriptionType.id
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body.paymentsGenerated).toBe(12);
    });

    it('should return 400 if memberId is missing', async () => {
      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', authHeader(testAdmin))
        .send({
          subscriptionTypeId: testSubscriptionType.id
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 if subscriptionTypeId is missing', async () => {
      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', authHeader(testAdmin))
        .send({
          memberId: testMember.id
        });

      expect(response.status).toBe(400);
    });

    it('should return 403 if member tries to create subscription for another member', async () => {
      const otherMember = await createTestMember(testGym.id, {
        email: 'other@test.com'
      });

      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', authHeader(testMember))
        .send({
          memberId: otherMember.id,
          subscriptionTypeId: testSubscriptionType.id
        });

      expect(response.status).toBe(403);
    });

    it('should allow member to create subscription for themselves', async () => {
      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', authHeader(testMember))
        .send({
          memberId: testMember.id,
          subscriptionTypeId: testSubscriptionType.id
        });

      expect([200, 201]).toContain(response.status);
    });

    it('should return 403 if admin tries to create subscription for member from different gym', async () => {
      const otherGym = await createTestGym({ name: 'Other Gym' });
      const otherMember = await createTestMember(otherGym.id);

      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', authHeader(testAdmin))
        .send({
          memberId: otherMember.id,
          subscriptionTypeId: testSubscriptionType.id
        });

      expect(response.status).toBe(403);
    });

    it('should allow custom start date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', authHeader(testAdmin))
        .send({
          memberId: testMember.id,
          subscriptionTypeId: testSubscriptionType.id,
          startDate: futureDate.toISOString()
        });

      expect([200, 201]).toContain(response.status);
      const startDate = new Date(response.body.subscription.startDate);
      expect(startDate.toDateString()).toBe(futureDate.toDateString());
    });
  });

  describe('GET /subscriptions/member/:memberId', () => {
    beforeEach(async () => {
      // Create subscription with payments
      await createTestSubscription(testMember.id, testSubscriptionType.id);
    });

    it('should allow admin to view member subscriptions', async () => {
      const response = await request(app)
        .get(`/subscriptions/member/${testMember.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect([200, 201]).toContain(response.status);
      expect(response.body.subscriptions).toBeDefined();
      expect(response.body.subscriptions.length).toBeGreaterThan(0);
    });

    it('should allow member to view their own subscriptions', async () => {
      const response = await request(app)
        .get(`/subscriptions/member/${testMember.id}`)
        .set('Authorization', authHeader(testMember));

      expect([200, 201]).toContain(response.status);
      expect(response.body.subscriptions).toBeDefined();
    });

    it('should return 403 if member tries to view other member subscriptions', async () => {
      const otherMember = await createTestMember(testGym.id);

      const response = await request(app)
        .get(`/subscriptions/member/${otherMember.id}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(403);
    });

    it('should return empty array if member has no subscriptions', async () => {
      const newMember = await createTestMember(testGym.id);

      const response = await request(app)
        .get(`/subscriptions/member/${newMember.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect([200, 201]).toContain(response.status);
      expect(response.body.subscriptions).toHaveLength(0);
    });
  });

  describe('POST /subscriptions/:id/renew', () => {
    let subscription;

    beforeEach(async () => {
      subscription = await createTestSubscription(testMember.id, testSubscriptionType.id, {
        status: 'expired',
        endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      });
    });

    it('should allow admin to renew subscription', async () => {
      const response = await request(app)
        .post(`/subscriptions/${subscription.id}/renew`)
        .set('Authorization', authHeader(testAdmin))
        .send({ paymentFrequency: 12 });

      expect([200, 201]).toContain(response.status);
      expect(response.body.message).toContain('renouvelé');
      expect(response.body.newSubscription).toBeDefined();
    });

    it('should allow member to renew their own subscription', async () => {
      const response = await request(app)
        .post(`/subscriptions/${subscription.id}/renew`)
        .set('Authorization', authHeader(testMember))
        .send({ paymentFrequency: 6 });

      expect([200, 201]).toContain(response.status);
    });

    it('should return 404 for non-existent subscription', async () => {
      const response = await request(app)
        .post('/subscriptions/99999/renew')
        .set('Authorization', authHeader(testAdmin))
        .send({ paymentFrequency: 12 });

      expect(response.status).toBe(404);
    });
  });

  describe('Subscription Status', () => {
    it('should correctly identify active subscription', async () => {
      const subscription = await createTestSubscription(testMember.id, testSubscriptionType.id, {
        status: 'active',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      const response = await request(app)
        .get(`/subscriptions/member/${testMember.id}`)
        .set('Authorization', authHeader(testMember));

      expect([200, 201]).toContain(response.status);
      const sub = response.body.subscriptions.find(s => s.id === subscription.id);
      expect(sub.status).toBe('active');
    });

    it('should correctly identify expired subscription', async () => {
      const subscription = await createTestSubscription(testMember.id, testSubscriptionType.id, {
        status: 'expired',
        endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      });

      const response = await request(app)
        .get(`/subscriptions/member/${testMember.id}`)
        .set('Authorization', authHeader(testMember));

      expect([200, 201]).toContain(response.status);
      const sub = response.body.subscriptions.find(s => s.id === subscription.id);
      expect(sub.status).toBe('expired');
    });
  });
});
