const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/auth');
const {
  cleanDatabase,
  disconnectDatabase,
  createTestGym,
  createTestOwner,
  createTestAdmin,
  createTestMember,
  authHeader,
  prisma
} = require('../helpers/testHelpers');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Authentication Routes', () => {
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
    // Clean up users and related data before each test
    // Delete in proper order to respect foreign key constraints
    await prisma.passwordResetToken.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.subscriptionType.deleteMany({});
    await prisma.member.deleteMany({});
    await prisma.manager.deleteMany({});
    await prisma.owner.deleteMany({});
    await prisma.user.deleteMany({});
    
    // Create fresh test users
    testAdmin = await createTestAdmin(testGym.id, {
      email: 'testadmin@test.com',
      password: 'admin123'
    });
    
    testMember = await createTestMember(testGym.id, {
      email: 'testmember@test.com',
      password: 'member123'
    });
  });

  describe('POST /auth/login', () => {
    it('should login admin with email and password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'testadmin@test.com',
          password: 'admin123'
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.role).toBe('manager');
      expect(response.body.user.email).toBe('testadmin@test.com');
    });

    it('should login member with email and password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'testmember@test.com',
          password: 'member123'
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.role).toBe('member');
      expect(response.body.user.member).toBeDefined();
    });

    it('should login with phone number', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          phoneNumber: testMember.phoneNumber,
          password: 'member123'
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.phoneNumber).toBe(testMember.phoneNumber);
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'testadmin@test.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 400 if credentials are missing', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@test.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should sanitize email with null bytes', async () => {
      // Create user with clean email
      const cleanEmail = 'cleanuser@test.com';
      await createTestMember(testGym.id, {
        email: cleanEmail,
        password: 'password123'
      });

      // Try login with email containing null byte
      const dirtyEmail = 'cleanuser@test.com\x00';
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: dirtyEmail,
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
    });
  });

  describe('GET /auth/me', () => {
    it('should return current admin profile', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testAdmin.id);
      expect(response.body.email).toBe(testAdmin.email);
      expect(response.body.type).toBe('manager');
      expect(response.body.gym).toBeDefined();
    });

    it('should return current member profile with subscriptions', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testMember.id);
      expect(response.body.email).toBe(testMember.email);
      expect(response.body.type).toBe('member');
      expect(response.body.subscriptions).toBeDefined();
      expect(response.body.recentPayments).toBeDefined();
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/auth/me');

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should send reset code for existing email', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: testMember.email });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('code');

      // Verify token was created in database
      const resetToken = await prisma.passwordResetToken.findFirst({
        where: { userId: testMember.id, used: false }
      });
      expect(resetToken).toBeDefined();
      expect(resetToken.token).toHaveLength(6);
    });

    it('should return success message even for non-existent email (security)', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBeDefined();
    });

    it('should work with phone number if user has email', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ phoneNumber: testMember.phoneNumber });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('code');
    });

    it('should return 400 if neither email nor phone number provided', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    let resetToken;

    beforeEach(async () => {
      // Create a reset token
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      await prisma.passwordResetToken.create({
        data: {
          userId: testMember.id,
          token: token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        }
      });
      resetToken = token;
    });

    it('should reset password with valid token', async () => {
      const newPassword = 'newpassword123';
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          email: testMember.email,
          token: resetToken,
          newPassword: newPassword
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('réinitialisé');

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: testMember.email,
          password: newPassword
        });

      expect(loginResponse.status).toBe(200);
    });

    it('should return 400 for invalid token', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          email: testMember.email,
          token: '999999',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('invalide');
    });

    it('should return 400 for expired token', async () => {
      // Create expired token
      const expiredToken = '123456';
      await prisma.passwordResetToken.create({
        data: {
          userId: testMember.id,
          token: expiredToken,
          expiresAt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
        }
      });

      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          email: testMember.email,
          token: expiredToken,
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('expiré');
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          email: testMember.email,
          token: resetToken,
          newPassword: '123' // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('6 caractères');
    });

    it('should mark token as used after successful reset', async () => {
      await request(app)
        .post('/auth/reset-password')
        .send({
          email: testMember.email,
          token: resetToken,
          newPassword: 'newpassword123'
        });

      const usedToken = await prisma.passwordResetToken.findFirst({
        where: { token: resetToken }
      });

      expect(usedToken.used).toBe(true);
    });
  });

  describe('POST /auth/scan-qr', () => {
    it('should allow admin to scan member QR code', async () => {      // Create an active subscription for the member
      const subscriptionType = await prisma.subscriptionType.create({
        data: {
          name: 'Premium Monthly',
          displayId: `SUBT${Date.now()}`,
          monthlyPrice: 49.99,
          durationMonths: 1,
          features: ['Access to all equipment', 'Free classes'],
          sessionQuota: 30,
          sessionType: 'unlimited'
        }
      });

      const subscription = await prisma.subscription.create({
        data: {
          displayId: `SUBS${Date.now()}`,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          status: 'active',
          autoRenew: true,
          paymentFrequency: 12,
          sessionsUsed: 0,
          sessionQuota: 30,
          Member: {
            connect: { userId: testMember.id }
          },
          SubscriptionType: {
            connect: { id: subscriptionType.id }
          }
        }
      });

      // Create a completed payment for the subscription
      await prisma.payment.create({
        data: {
          amount: subscriptionType.monthlyPrice,
          status: 'completed',
          type: 'subscription',
          paymentMethod: 'card',
          displayId: `PAY${Date.now()}`,
          subscriptionId: subscription.id,
          memberId: testMember.id
        }
      });

      const response = await request(app)
        .post('/auth/scan-qr')
        .set('Authorization', authHeader(testAdmin))
        .send({ qrCode: testMember.uniqueCode });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.member).toBeDefined();
      expect(response.body.member.id).toBe(testMember.id);
      expect(response.body.quota).toMatchObject({ sessionQuota: 30, sessionsUsed: 0, sessionsRemaining: 30, canCheckIn: true });

      // Kiosk : `qrData` = contenu JSON du QR de l'app (displayId)
      const kiosk = await request(app)
        .post('/auth/scan-qr')
        .set('Authorization', authHeader(testAdmin))
        .send({ qrData: JSON.stringify({ displayId: testMember.displayId, type: 'member' }) });
      expect(kiosk.status).toBe(200);
      expect(kiosk.body.member.id).toBe(testMember.id);

      // Quota épuisé : accès reconnu mais canCheckIn=false
      await prisma.subscription.update({ where: { id: subscription.id }, data: { sessionsUsed: 30 } });
      const exhausted = await request(app)
        .post('/auth/scan-qr')
        .set('Authorization', authHeader(testAdmin))
        .send({ qrData: { displayId: testMember.displayId } });
      expect(exhausted.body.quota).toMatchObject({ sessionsRemaining: 0, canCheckIn: false });

      const noDisplayId = await request(app)
        .post('/auth/scan-qr')
        .set('Authorization', authHeader(testAdmin))
        .send({ qrData: JSON.stringify({ foo: 'bar' }) });
      expect(noDisplayId.status).toBe(400);
    });

    it('should return 403 if non-admin tries to scan', async () => {
      const response = await request(app)
        .post('/auth/scan-qr')
        .set('Authorization', authHeader(testMember))
        .send({ qrCode: testMember.displayId });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('manager');
    });

    it('should return 404 for non-existent QR code', async () => {
      const response = await request(app)
        .post('/auth/scan-qr')
        .set('Authorization', authHeader(testAdmin))
        .send({ qrCode: 'NONEXISTENT' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should return 403 if member is from different gym', async () => {
      // Create another gym and admin
      const otherGym = await createTestGym({ name: 'Other Gym' });
      const adminFromOtherGym = await createTestAdmin(otherGym.id);

      const response = await request(app)
        .post('/auth/scan-qr')
        .set('Authorization', authHeader(adminFromOtherGym))
        .send({ qrCode: testMember.uniqueCode });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('gym');
    });

    it('should allow owner to scan a member from any gym', async () => {
      const otherGym = await createTestGym({ name: 'Owner Gym' });
      const owner = await createTestOwner(otherGym.id);

      const response = await request(app)
        .post('/auth/scan-qr')
        .set('Authorization', authHeader(owner))
        .send({ qrCode: testMember.uniqueCode });

      // Passe les contrôles de rôle et de salle ; bloqué seulement faute d'abonnement
      expect(response.status).toBe(403);
      expect(response.body.reason).toBe('no_active_subscription');
    });

    it('should return 400 when qrCode is missing', async () => {
      const response = await request(app)
        .post('/auth/scan-qr')
        .set('Authorization', authHeader(testAdmin))
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('qrCode');
    });
  });

  describe('POST /auth/setup-password', () => {
    let setupToken;

    beforeEach(async () => {
      // Create a setup token
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      await prisma.passwordResetToken.create({
        data: {
          userId: testMember.id,
          token: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      });
      setupToken = token;
    });

    it('should setup password with valid token', async () => {
      const newPassword = 'mypassword123';
      const response = await request(app)
        .post('/auth/setup-password')
        .send({
          email: testMember.email,
          token: setupToken,
          password: newPassword
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('créé');

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: testMember.email,
          password: newPassword
        });

      expect(loginResponse.status).toBe(200);
    });

    it('should work with phone number instead of email', async () => {
      const response = await request(app)
        .post('/auth/setup-password')
        .send({
          phoneNumber: testMember.phoneNumber,
          token: setupToken,
          password: 'mypassword123'
        });

      expect(response.status).toBe(200);
    });

    it('should return 400 for invalid token', async () => {
      const response = await request(app)
        .post('/auth/setup-password')
        .send({
          email: testMember.email,
          token: '999999',
          password: 'mypassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('invalide');
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/auth/setup-password')
        .send({
          email: testMember.email,
          token: setupToken,
          password: 'abc' // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('6 caractères');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/auth/setup-password')
        .send({ email: testMember.email });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /auth/send-setup-email', () => {
    it('should allow admin to send setup email to member in their gym', async () => {
      const response = await request(app)
        .post('/auth/send-setup-email')
        .set('Authorization', authHeader(testAdmin))
        .send({ email: testMember.email });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('envoyé');
      expect(response.body.user).toBeDefined();

      // Verify token was created
      const setupToken = await prisma.passwordResetToken.findFirst({
        where: { userId: testMember.id, used: false }
      });
      expect(setupToken).toBeDefined();
    });

    it('should return 403 if admin tries to send to member from different gym', async () => {
      const otherGym = await createTestGym({ name: 'Other Gym' });
      const otherMember = await createTestMember(otherGym.id);

      const response = await request(app)
        .post('/auth/send-setup-email')
        .set('Authorization', authHeader(testAdmin))
        .send({ email: otherMember.email });

      expect(response.status).toBe(403);
    });

    it('should allow member to send setup email to themselves', async () => {
      const response = await request(app)
        .post('/auth/send-setup-email')
        .set('Authorization', authHeader(testMember))
        .send({ email: testMember.email });

      expect(response.status).toBe(200);
    });

    it('should return 403 if member tries to send to another user', async () => {
      const response = await request(app)
        .post('/auth/send-setup-email')
        .set('Authorization', authHeader(testMember))
        .send({ email: testAdmin.email });

      expect(response.status).toBe(403);
    });

    it('should return 400 if email or userId is missing', async () => {
      const response = await request(app)
        .post('/auth/send-setup-email')
        .set('Authorization', authHeader(testAdmin))
        .send({});

      expect(response.status).toBe(400);
    });

    it('should work with userId instead of email', async () => {
      const response = await request(app)
        .post('/auth/send-setup-email')
        .set('Authorization', authHeader(testAdmin))
        .send({ userId: testMember.id });

      expect(response.status).toBe(200);
    });
  });
  describe('Rôles V2 : login kiosk', () => {
    const login = (body) => request(app).post('/auth/login').send(body);
    const me = (token) => request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    it('accepte le manager et renvoie role=manager et client=kiosk', async () => {
      const res = await login({ email: 'testadmin@test.com', password: 'admin123', client: 'kiosk' });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('manager');
      expect(res.body.user.type).toBe('manager');
      expect(res.body.user.client).toBe('kiosk');
    });

    it('accepte l\'owner', async () => {
      await createTestOwner(testGym.id, { email: 'kioskowner@test.com', password: 'owner123' });
      const res = await login({ email: 'kioskowner@test.com', password: 'owner123', client: 'kiosk' });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('owner');
    });

    it('refuse le membre avec 403 kiosk_forbidden_role, sans toucher à sa session', async () => {
      const app1 = await login({ email: 'testmember@test.com', password: 'member123' });
      const res = await login({ email: 'testmember@test.com', password: 'member123', client: 'kiosk' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('kiosk_forbidden_role');
      expect(res.body.token).toBeUndefined();
      expect((await me(app1.body.token)).status).toBe(200);
    });

    it('refuse un mauvais mot de passe avant le contrôle de rôle (401)', async () => {
      const res = await login({ email: 'testmember@test.com', password: 'wrong', client: 'kiosk' });
      expect(res.status).toBe(401);
    });

    it('garde des sessions séparées : la connexion kiosk ne déconnecte pas l\'app', async () => {
      const appLogin = await login({ email: 'testadmin@test.com', password: 'admin123' });
      const kioskLogin = await login({ email: 'testadmin@test.com', password: 'admin123', client: 'kiosk' });
      expect((await me(appLogin.body.token)).status).toBe(200);
      expect((await me(kioskLogin.body.token)).status).toBe(200);

      // Nouvelle connexion app : l'ancien token app expire, le kiosk reste connecté
      const appLogin2 = await login({ email: 'testadmin@test.com', password: 'admin123' });
      expect((await me(appLogin.body.token)).status).toBe(401);
      expect((await me(appLogin2.body.token)).status).toBe(200);
      expect((await me(kioskLogin.body.token)).status).toBe(200);

      // Nouvelle connexion kiosk : l'ancien token kiosk expire
      await login({ email: 'testadmin@test.com', password: 'admin123', client: 'kiosk' });
      expect((await me(kioskLogin.body.token)).status).toBe(401);
      expect((await me(appLogin2.body.token)).status).toBe(200);
    });

    it('/auth/me renvoie role=manager pour un ancien token type=admin', async () => {
      const { generateToken } = require('../helpers/testHelpers');
      const legacy = generateToken({ ...testAdmin, role: 'admin' });
      const res = await me(legacy);
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('manager');
      expect(res.body.type).toBe('manager');
    });
  });
});
