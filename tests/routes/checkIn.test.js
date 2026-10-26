const request = require('supertest');
const express = require('express');
const checkInRoutes = require('../../routes/checkIn');
const {
  cleanDatabase,
  disconnectDatabase,
  createTestGym,
  createTestAdmin,
  createTestOwner,
  createTestCoach,
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
    await prisma.trainingSessionMember.deleteMany({});
    await prisma.trainingSession.deleteMany({});
    await prisma.gymCheckIn.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.member.deleteMany({});
    await prisma.manager.deleteMany({});
    await prisma.coachGym.deleteMany({});
    await prisma.coach.deleteMany({});
    await prisma.owner.deleteMany({});
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
    it('should create a check-in for member (manager de la salle)', async () => {
      const response = await request(app)
        .post('/check-in')
        .set('Authorization', authHeader(testAdmin))
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
        .set('Authorization', authHeader(testAdmin))
        .send({
          memberId: testMember.id,
          subscriptionId: testSubscription.id,
          gymId: testGym.id
        });

      // Second check-in should fail
      const response = await request(app)
        .post('/check-in')
        .set('Authorization', authHeader(testAdmin))
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
  describe('Rôles V2 : portée des check-ins', () => {
    let otherGym;
    let otherManager;
    let coach;
    let checkIn;

    beforeEach(async () => {
      otherGym = await createTestGym({ name: `Autre ${Date.now()}` });
      otherManager = await createTestAdmin(otherGym.id);
      coach = await createTestCoach([testGym.id]);
      checkIn = await prisma.gymCheckIn.create({
        data: {
          displayId: `CHECKIN${Date.now()}-scope`,
          memberId: testMember.id,
          subscriptionId: testSubscription.id,
          gymId: testGym.id,
          checkInTime: new Date()
        }
      });
    });

    it('réserve le check-in manuel et le scan au staff de la salle', async () => {
      const body = { memberId: testMember.id, subscriptionId: testSubscription.id, gymId: testGym.id };
      for (const user of [testMember, otherManager, coach]) {
        const res = await request(app).post('/check-in').set('Authorization', authHeader(user)).send(body);
        expect(res.status).toBe(403);
      }
      const scan = await request(app).post('/check-in/scan').set('Authorization', authHeader(otherManager))
        .send({ qrCode: testMember.uniqueCode, gymId: testGym.id });
      expect(scan.status).toBe(403);
    });

    it('refuse le checkout au manager d\'une autre salle', async () => {
      const res = await request(app).post(`/check-in/${checkIn.id}/checkout`).set('Authorization', authHeader(otherManager));
      expect(res.status).toBe(403);
    });

    it('historique et quota : le membre, le staff de sa salle et son coach seulement', async () => {
      const other = await createTestMember(testGym.id);
      for (const user of [other, otherManager, coach]) {
        const res = await request(app).get(`/check-in/member/${testMember.id}`).set('Authorization', authHeader(user));
        expect(res.status).toBe(403);
      }
      await prisma.member.update({ where: { userId: testMember.id }, data: { coachId: coach.id } });
      const byCoach = await request(app).get(`/check-in/member/${testMember.id}`).set('Authorization', authHeader(coach));
      expect(byCoach.status).toBe(200);

      const quota = await request(app).get(`/check-in/subscription/${testSubscription.id}/quota`).set('Authorization', authHeader(other));
      expect(quota.status).toBe(403);
      const ownQuota = await request(app).get(`/check-in/subscription/${testSubscription.id}/quota`).set('Authorization', authHeader(testMember));
      expect(ownQuota.status).toBe(200);
    });

    it('/gym/:gymId/today et /stats refusent le manager d\'une autre salle', async () => {
      for (const path of [`/check-in/gym/${testGym.id}/today`, `/check-in/stats/gym/${testGym.id}`]) {
        const res = await request(app).get(path).set('Authorization', authHeader(otherManager));
        expect(res.status).toBe(403);
      }
    });

    describe('GET /check-in/today', () => {
      it('coach : ses salles, avec isMyMember et la prochaine séance du jour', async () => {
        await prisma.member.update({ where: { userId: testMember.id }, data: { coachId: coach.id } });
        const start = new Date(Date.now() + 30 * 60 * 1000);
        const session = await prisma.trainingSession.create({
          data: {
            displayId: `SESSION-${Date.now()}`,
            gymId: testGym.id,
            coachId: coach.id,
            startAt: start,
            endAt: new Date(start.getTime() + 60 * 60 * 1000),
            Members: { create: { memberId: testMember.id } }
          }
        });
        const otherMember = await createTestMember(otherGym.id);
        await prisma.gymCheckIn.create({
          data: { displayId: `CHECKIN${Date.now()}-other`, memberId: otherMember.id, subscriptionId: testSubscription.id, gymId: otherGym.id }
        });

        const res = await request(app).get('/check-in/today').set('Authorization', authHeader(coach));
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toMatchObject({
          id: checkIn.id, memberId: testMember.id, gymId: testGym.id, isMyMember: true, checkOutTime: null
        });
        expect(res.body[0].member.firstName).toBe(testMember.firstName);
        expect(res.body[0].gym.id).toBe(testGym.id);
        expect(res.body[0].nextSessionToday.id).toBe(session.id);

        const outside = await request(app).get(`/check-in/today?gymId=${otherGym.id}`).set('Authorization', authHeader(coach));
        expect(outside.status).toBe(403);
      });

      it('manager : sa salle ; owner : toutes ; membre refusé', async () => {
        const otherMember = await createTestMember(otherGym.id);
        await prisma.gymCheckIn.create({
          data: { displayId: `CHECKIN${Date.now()}-o`, memberId: otherMember.id, subscriptionId: testSubscription.id, gymId: otherGym.id }
        });

        const mgr = await request(app).get('/check-in/today').set('Authorization', authHeader(testAdmin));
        expect(mgr.body.map(c => c.gymId)).toEqual([testGym.id]);
        expect(mgr.body[0].isMyMember).toBe(false);

        const owner = await createTestOwner(testGym.id);
        const all = await request(app).get('/check-in/today').set('Authorization', authHeader(owner));
        expect(all.body).toHaveLength(2);

        const member = await request(app).get('/check-in/today').set('Authorization', authHeader(testMember));
        expect(member.status).toBe(403);
      });
    });
  });
});
