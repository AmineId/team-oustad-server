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

    testSubscriptionType = await createTestSubscriptionType(testGym.id, {
      name: 'Basic Monthly',
      price: 50.00,
      duration: 30,
      plan: 'basic',
      membership: 'individual'
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

      expect(response.status).toBe(200);
      expect(response.body.subscription).toBeDefined();
      expect(response.body.subscription.memberId).toBe(testMember.id);
      expect(response.body.paymentFrequency).toBe(12);
      expect(response.body.paymentsGenerated).toBe(12);
      expect(response.body.payments).toHaveLength(12);
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

      expect(response.status).toBe(200);
      expect(response.body.paymentFrequency).toBe(3);
      expect(response.body.paymentsGenerated).toBe(3);
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

      expect(response.status).toBe(200);
      expect(response.body.paymentFrequency).toBe(1);
      expect(response.body.paymentsGenerated).toBe(1);
    });

    it('should default to monthly (12 payments) if frequency not specified', async () => {
      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', authHeader(testAdmin))
        .send({
          memberId: testMember.id,
          subscriptionTypeId: testSubscriptionType.id
        });

      expect(response.status).toBe(200);
      expect(response.body.paymentFrequency).toBe(12);
    });

    it('should return 400 for invalid payment frequency', async () => {
      const response = await request(app)
        .post('/subscriptions')
        .set('Authorization', authHeader(testAdmin))
        .send({
          memberId: testMember.id,
          subscriptionTypeId: testSubscriptionType.id,
          paymentFrequency: 5 // invalid
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('paymentFrequency');
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

      expect(response.status).toBe(200);
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

      expect(response.status).toBe(200);
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

      expect(response.status).toBe(200);
      expect(response.body.subscriptions).toBeDefined();
      expect(response.body.subscriptions.length).toBeGreaterThan(0);
    });

    it('should allow member to view their own subscriptions', async () => {
      const response = await request(app)
        .get(`/subscriptions/member/${testMember.id}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
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

      expect(response.status).toBe(200);
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

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('renouvelé');
      expect(response.body.newSubscription).toBeDefined();
    });

    it('should allow member to renew their own subscription', async () => {
      const response = await request(app)
        .post(`/subscriptions/${subscription.id}/renew`)
        .set('Authorization', authHeader(testMember))
        .send({ paymentFrequency: 6 });

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent subscription', async () => {
      const response = await request(app)
        .post('/subscriptions/99999/renew')
        .set('Authorization', authHeader(testAdmin))
        .send({ paymentFrequency: 12 });

      expect(response.status).toBe(404);
    });
  });

  describe('Payment Acknowledgement', () => {
    let subscription;
    let payment;

    beforeEach(async () => {
      subscription = await createTestSubscription(testMember.id, testSubscriptionType.id);
      payment = await createTestPayment(testMember.id, subscription.id, {
        status: 'completed',
        isAcknowledged: false
      });
    });

    describe('POST /subscriptions/payments/:paymentId/acknowledge', () => {
      it('should allow admin to acknowledge payment', async () => {
        const response = await request(app)
          .post(`/subscriptions/payments/${payment.id}/acknowledge`)
          .set('Authorization', authHeader(testAdmin));

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('acknowledgé');
        expect(response.body.payment.isAcknowledged).toBe(true);
      });

      it('should update acknowledgedAt timestamp', async () => {
        const response = await request(app)
          .post(`/subscriptions/payments/${payment.id}/acknowledge`)
          .set('Authorization', authHeader(testAdmin));

        expect(response.status).toBe(200);
        expect(response.body.payment.acknowledgedAt).toBeDefined();
      });

      it('should return 404 for non-existent payment', async () => {
        const response = await request(app)
          .post('/subscriptions/payments/99999/acknowledge')
          .set('Authorization', authHeader(testAdmin));

        expect(response.status).toBe(404);
      });

      it('should return 403 if member tries to acknowledge payment', async () => {
        const response = await request(app)
          .post(`/subscriptions/payments/${payment.id}/acknowledge`)
          .set('Authorization', authHeader(testMember));

        expect(response.status).toBe(403);
      });

      it('should return 400 if payment already acknowledged', async () => {
        // Acknowledge first time
        await request(app)
          .post(`/subscriptions/payments/${payment.id}/acknowledge`)
          .set('Authorization', authHeader(testAdmin));

        // Try to acknowledge again
        const response = await request(app)
          .post(`/subscriptions/payments/${payment.id}/acknowledge`)
          .set('Authorization', authHeader(testAdmin));

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('déjà acknowledgé');
      });
    });

    describe('GET /subscriptions/payments/unacknowledged', () => {
      it('should return unacknowledged payments for admin', async () => {
        const response = await request(app)
          .get('/subscriptions/payments/unacknowledged')
          .set('Authorization', authHeader(testAdmin));

        expect(response.status).toBe(200);
        expect(response.body.payments).toBeDefined();
        expect(response.body.payments.length).toBeGreaterThan(0);
      });

      it('should return empty array if all payments acknowledged', async () => {
        // Acknowledge the payment
        await prisma.payment.update({
          where: { id: payment.id },
          data: { isAcknowledged: true }
        });

        const response = await request(app)
          .get('/subscriptions/payments/unacknowledged')
          .set('Authorization', authHeader(testAdmin));

        expect(response.status).toBe(200);
        expect(response.body.payments).toHaveLength(0);
      });

      it('should return 403 if member tries to access unacknowledged payments', async () => {
        const response = await request(app)
          .get('/subscriptions/payments/unacknowledged')
          .set('Authorization', authHeader(testMember));

        expect(response.status).toBe(403);
      });

      it('should only show payments from admin gym', async () => {
        // Create another gym with member and payment
        const otherGym = await createTestGym({ name: 'Other Gym' });
        const otherMember = await createTestMember(otherGym.id);
        const otherSubType = await createTestSubscriptionType(otherGym.id);
        const otherSub = await createTestSubscription(otherMember.id, otherSubType.id);
        await createTestPayment(otherMember.id, otherSub.id, {
          status: 'completed',
          isAcknowledged: false
        });

        const response = await request(app)
          .get('/subscriptions/payments/unacknowledged')
          .set('Authorization', authHeader(testAdmin));

        expect(response.status).toBe(200);
        // Should only see payment from their gym
        const memberIds = response.body.payments.map(p => p.memberId);
        expect(memberIds).toContain(testMember.id);
        expect(memberIds).not.toContain(otherMember.id);
      });
    });
  });

  describe('POST /subscriptions/payments/:paymentId/complete', () => {
    let subscription;
    let payment;

    beforeEach(async () => {
      subscription = await createTestSubscription(testMember.id, testSubscriptionType.id);
      payment = await createTestPayment(testMember.id, subscription.id, {
        status: 'pending'
      });
    });

    it('should allow admin to mark payment as completed', async () => {
      const response = await request(app)
        .post(`/subscriptions/payments/${payment.id}/complete`)
        .set('Authorization', authHeader(testAdmin))
        .send({ method: 'cash' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('marqué');
      expect(response.body.payment.status).toBe('completed');
      expect(response.body.payment.method).toBe('cash');
      expect(response.body.payment.paidAt).toBeDefined();
    });

    it('should support different payment methods', async () => {
      const methods = ['cash', 'card', 'transfer', 'check'];
      
      for (const method of methods) {
        const newPayment = await createTestPayment(testMember.id, subscription.id, {
          status: 'pending'
        });

        const response = await request(app)
          .post(`/subscriptions/payments/${newPayment.id}/complete`)
          .set('Authorization', authHeader(testAdmin))
          .send({ method });

        expect(response.status).toBe(200);
        expect(response.body.payment.method).toBe(method);
      }
    });

    it('should return 400 if payment method is missing', async () => {
      const response = await request(app)
        .post(`/subscriptions/payments/${payment.id}/complete`)
        .set('Authorization', authHeader(testAdmin))
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent payment', async () => {
      const response = await request(app)
        .post('/subscriptions/payments/99999/complete')
        .set('Authorization', authHeader(testAdmin))
        .send({ method: 'cash' });

      expect(response.status).toBe(404);
    });

    it('should return 403 if member tries to complete payment', async () => {
      const response = await request(app)
        .post(`/subscriptions/payments/${payment.id}/complete`)
        .set('Authorization', authHeader(testMember))
        .send({ method: 'cash' });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /subscriptions/payments/pending', () => {
    beforeEach(async () => {
      const subscription = await createTestSubscription(testMember.id, testSubscriptionType.id);
      await createTestPayment(testMember.id, subscription.id, {
        status: 'pending',
        dueDate: new Date()
      });
    });

    it('should return pending payments for admin', async () => {
      const response = await request(app)
        .get('/subscriptions/payments/pending')
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(response.body.payments).toBeDefined();
      expect(response.body.payments.length).toBeGreaterThan(0);
      expect(response.body.payments[0].status).toBe('pending');
    });

    it('should allow member to view their pending payments', async () => {
      const response = await request(app)
        .get('/subscriptions/payments/pending')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(response.body.payments).toBeDefined();
    });

    it('should only show payments from correct gym for admin', async () => {
      const otherGym = await createTestGym({ name: 'Other Gym' });
      const otherMember = await createTestMember(otherGym.id);
      const otherSubType = await createTestSubscriptionType(otherGym.id);
      const otherSub = await createTestSubscription(otherMember.id, otherSubType.id);
      await createTestPayment(otherMember.id, otherSub.id, { status: 'pending' });

      const response = await request(app)
        .get('/subscriptions/payments/pending')
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      const memberIds = response.body.payments.map(p => p.memberId);
      expect(memberIds).not.toContain(otherMember.id);
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

      expect(response.status).toBe(200);
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

      expect(response.status).toBe(200);
      const sub = response.body.subscriptions.find(s => s.id === subscription.id);
      expect(sub.status).toBe('expired');
    });
  });
});
