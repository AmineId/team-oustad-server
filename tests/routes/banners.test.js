const request = require('supertest');
const express = require('express');
const bannersRoutes = require('../../routes/banners');
const {
  cleanDatabase,
  disconnectDatabase,
  createTestGym,
  createTestAdmin,
  createTestOwner,
  createTestMember,
  authHeader,
  prisma
} = require('../helpers/testHelpers');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/banners', bannersRoutes);

describe('Banners Routes', () => {
  let testGym;
  let testAdmin;
  let testOwner;
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
    await prisma.banner.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.member.deleteMany({});
    await prisma.manager.deleteMany({});
    await prisma.owner.deleteMany({});
    await prisma.user.deleteMany({});
    
    // Create fresh test users
    testOwner = await createTestOwner(testGym.id);
    testAdmin = await createTestAdmin(testGym.id, {
      email: 'admin@test.com',
      password: 'admin123'
    });
    
    testMember = await createTestMember(testGym.id, {
      email: 'member@test.com',
      password: 'member123'
    });
  });

  describe('POST /banners', () => {
    it('should create a banner as owner', async () => {
      const response = await request(app)
        .post('/banners')
        .set('Authorization', authHeader(testOwner))
        .send({
          title: 'Summer Promotion',
          message: 'Get 20% off on all memberships',
          type: 'promotion',
          priority: 'high'
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Summer Promotion');
      expect(response.body.type).toBe('promotion');
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .post('/banners')
        .set('Authorization', authHeader(testMember))
        .send({
          title: 'Test Banner',
          message: 'Test message',
          type: 'info'
        });

      expect(response.status).toBe(403);
    });

    it('should return 400 with missing required fields', async () => {
      const response = await request(app)
        .post('/banners')
        .set('Authorization', authHeader(testOwner))
        .send({
          title: 'Test Banner'
          // Missing message and type
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /banners', () => {
    beforeEach(async () => {
      await prisma.banner.create({
        data: {
          displayId: `BANNER-${Date.now()}-1`,
          title: 'Active Banner',
          description: 'This is active',
          type: 'info',
          priority: 1,
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gymId: testGym.id
        }
      });

      await prisma.banner.create({
        data: {
          displayId: `BANNER-${Date.now()}-2`,
          title: 'Inactive Banner',
          description: 'This is inactive',
          type: 'warning',
          priority: 0,
          isActive: false,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gymId: testGym.id
        }
      });
    });

    it('should get all active banners', async () => {
      const response = await request(app)
        .get('/banners')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      // Should only return active banners
      expect(response.body.every(b => b.isActive)).toBe(true);
    });

    it('should work for members and admins', async () => {
      const memberResponse = await request(app)
        .get('/banners')
        .set('Authorization', authHeader(testMember));

      const adminResponse = await request(app)
        .get('/banners')
        .set('Authorization', authHeader(testAdmin));

      expect(memberResponse.status).toBe(200);
      expect(adminResponse.status).toBe(200);
    });
  });

  describe('GET /banners/:id', () => {
    let testBanner;

    beforeEach(async () => {
      testBanner = await prisma.banner.create({
        data: {
          displayId: `BANNER-${Date.now()}-get`,
          title: 'Test Banner',
          description: 'Test message',
          type: 'info',
          priority: 1,
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gymId: testGym.id
        }
      });
    });

    it('should get a specific banner', async () => {
      const response = await request(app)
        .get(`/banners/${testBanner.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testBanner.id);
      expect(response.body.title).toBe('Test Banner');
    });

    it('should return 404 for non-existent banner', async () => {
      const response = await request(app)
        .get('/banners/99999')
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /banners/:id', () => {
    let testBanner;

    beforeEach(async () => {
      testBanner = await prisma.banner.create({
        data: {
          displayId: `BANNER-${Date.now()}-put`,
          title: 'Original Title',
          description: 'Original message',
          type: 'info',
          priority: 1,
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gymId: testGym.id
        }
      });
    });

    it('should update a banner as owner', async () => {
      const response = await request(app)
        .put(`/banners/${testBanner.id}`)
        .set('Authorization', authHeader(testOwner))
        .send({
          title: 'Updated Title',
          description: 'Updated message'
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.description).toBe('Updated message');
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .put(`/banners/${testBanner.id}`)
        .set('Authorization', authHeader(testMember))
        .send({
          title: 'Updated Title'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /banners/:id', () => {
    let testBanner;

    beforeEach(async () => {
      testBanner = await prisma.banner.create({
        data: {
          displayId: `BANNER-${Date.now()}-del`,
          title: 'To Delete',
          description: 'Will be deleted',
          type: 'info',
          priority: 1,
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gymId: testGym.id
        }
      });
    });

    it('should delete a banner as owner', async () => {
      const response = await request(app)
        .delete(`/banners/${testBanner.id}`)
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(200);

      const deletedBanner = await prisma.banner.findUnique({
        where: { id: testBanner.id }
      });
      expect(deletedBanner).toBeNull();
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .delete(`/banners/${testBanner.id}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(403);
    });
  });

  describe('GET /banners - filters', () => {
    beforeEach(async () => {
      await prisma.banner.create({
        data: {
          displayId: `BANNER-${Date.now()}-filtered`,
          title: 'Filtered Banner',
          description: 'desc',
          type: 'promotion',
          priority: 1,
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gymId: testGym.id
        }
      });
    });

    it('should filter banners by type', async () => {
      const response = await request(app)
        .get('/banners?type=promotion')
        .set('Authorization', authHeader(testMember));
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter banners with activeOnly=true', async () => {
      const response = await request(app)
        .get('/banners?activeOnly=true')
        .set('Authorization', authHeader(testMember));
      expect(response.status).toBe(200);
    });

    it('should return banners with locale=en', async () => {
      const response = await request(app)
        .get('/banners?locale=en')
        .set('Authorization', authHeader(testMember));
      expect(response.status).toBe(200);
    });
  });

  describe('POST /banners/:id/track/view', () => {
    let trackBanner;

    beforeEach(async () => {
      trackBanner = await prisma.banner.create({
        data: {
          displayId: `BANNER-${Date.now()}-track`,
          title: 'Track Banner',
          description: 'desc',
          type: 'info',
          priority: 1,
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gymId: testGym.id
        }
      });
    });

    it('should track a view without limit', async () => {
      const response = await request(app)
        .post(`/banners/${trackBanner.id}/track/view`);
      expect(response.status).toBe(200);
      expect(response.body.tracked).toBe(true);
    });

    it('should track a view with userId query param', async () => {
      const response = await request(app)
        .post(`/banners/${trackBanner.id}/track/view?userId=${testMember.id}`);
      expect(response.status).toBe(200);
    });
  });

  describe('POST /banners/:id/track/click', () => {
    let clickBanner;

    beforeEach(async () => {
      clickBanner = await prisma.banner.create({
        data: {
          displayId: `BANNER-${Date.now()}-click`,
          title: 'Click Banner',
          description: 'desc',
          type: 'info',
          priority: 1,
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gymId: testGym.id
        }
      });
    });

    it('should track a click', async () => {
      const response = await request(app)
        .post(`/banners/${clickBanner.id}/track/click`);
      expect(response.status).toBe(200);
      expect(response.body.tracked).toBe(true);
    });
  });

  describe('GET /banners/:id/stats', () => {
    let statsBanner;

    beforeEach(async () => {
      statsBanner = await prisma.banner.create({
        data: {
          displayId: `BANNER-${Date.now()}-stats`,
          title: 'Stats Banner',
          description: 'desc',
          type: 'info',
          priority: 1,
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gymId: testGym.id
        }
      });
    });

    it('should get stats for a banner', async () => {
      const response = await request(app)
        .get(`/banners/${statsBanner.id}/stats`)
        .set('Authorization', authHeader(testAdmin));
      expect(response.status).toBe(200);
      expect(response.body.bannerId).toBe(statsBanner.id);
      expect(response.body.viewCount).toBeDefined();
    });

    it('should return 404 for non-existent banner stats', async () => {
      const response = await request(app)
        .get('/banners/99999/stats')
        .set('Authorization', authHeader(testAdmin));
      expect(response.status).toBe(404);
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .get(`/banners/${statsBanner.id}/stats`)
        .set('Authorization', authHeader(testMember));
      expect(response.status).toBe(403);
    });
  });

  describe('GET /banners/stats/summary', () => {
    it('should get stats summary as admin', async () => {
      const response = await request(app)
        .get('/banners/stats/summary')
        .set('Authorization', authHeader(testAdmin));
      expect(response.status).toBe(200);
      expect(response.body.totalBanners).toBeDefined();
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .get('/banners/stats/summary')
        .set('Authorization', authHeader(testMember));
      expect(response.status).toBe(403);
    });
  });

  describe('Banner Variants CRUD', () => {
    let variantBanner;

    beforeEach(async () => {
      variantBanner = await prisma.banner.create({
        data: {
          displayId: `BANNER-${Date.now()}-var`,
          title: 'Variant Banner',
          description: 'desc',
          type: 'info',
          priority: 1,
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gymId: testGym.id
        }
      });
    });

    it('should create a variant', async () => {
      const response = await request(app)
        .post(`/banners/${variantBanner.id}/variants`)
        .set('Authorization', authHeader(testOwner))
        .send({ variantName: 'A', title: 'Variant A', weight: 50 });
      expect(response.status).toBe(201);
      expect(response.body.variantName).toBe('A');
    });

    it('should list variants', async () => {
      const response = await request(app)
        .get(`/banners/${variantBanner.id}/variants`)
        .set('Authorization', authHeader(testAdmin));
      expect(response.status).toBe(200);
      expect(response.body.variants).toBeDefined();
    });

    it('should update a variant', async () => {
      const variant = await prisma.bannerVariant.create({
        data: {
          displayId: `VARIANT-${Date.now()}`,
          bannerId: variantBanner.id,
          variantName: 'B',
          title: 'Variant B',
          weight: 50,
          isActive: true
        }
      });
      const response = await request(app)
        .put(`/banners/${variantBanner.id}/variants/${variant.id}`)
        .set('Authorization', authHeader(testOwner))
        .send({ title: 'Updated Variant B' });
      expect(response.status).toBe(200);
    });

    it('should delete a variant', async () => {
      const variant = await prisma.bannerVariant.create({
        data: {
          displayId: `VARIANT-${Date.now()}-del`,
          bannerId: variantBanner.id,
          variantName: 'C',
          title: 'Variant C',
          weight: 50,
          isActive: true
        }
      });
      const response = await request(app)
        .delete(`/banners/${variantBanner.id}/variants/${variant.id}`)
        .set('Authorization', authHeader(testOwner));
      expect(response.status).toBe(200);
    });
  });
  describe('Rôles V2 : banners réservés à l\'owner en écriture', () => {
    let banner;

    beforeEach(async () => {
      banner = await prisma.banner.create({
        data: {
          displayId: `BANNER-${Date.now()}-mgr`,
          title: 'Manager Banner',
          type: 'promotion',
          startDate: new Date(),
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          gymId: testGym.id
        }
      });
    });

    it('refuse la création au manager (403)', async () => {
      const response = await request(app)
        .post('/banners')
        .set('Authorization', authHeader(testAdmin))
        .send({ title: 'Promo', type: 'promotion' });
      expect(response.status).toBe(403);
    });

    it('refuse la modification et la suppression au manager (403)', async () => {
      const put = await request(app)
        .put(`/banners/${banner.id}`)
        .set('Authorization', authHeader(testAdmin))
        .send({ title: 'Changed' });
      expect(put.status).toBe(403);

      const del = await request(app)
        .delete(`/banners/${banner.id}`)
        .set('Authorization', authHeader(testAdmin));
      expect(del.status).toBe(403);
    });

    it('refuse la création de variante au manager (403)', async () => {
      const response = await request(app)
        .post(`/banners/${banner.id}/variants`)
        .set('Authorization', authHeader(testAdmin))
        .send({ variantName: 'A', title: 'A' });
      expect(response.status).toBe(403);
    });

    it('laisse le manager lire les stats', async () => {
      const response = await request(app)
        .get('/banners/stats/summary')
        .set('Authorization', authHeader(testAdmin));
      expect(response.status).toBe(200);
    });

    it('normalise un ancien token type=admin en manager', async () => {
      const { generateToken } = require('../helpers/testHelpers');
      const legacy = generateToken({ ...testAdmin, role: 'admin' });
      const response = await request(app)
        .get('/banners/stats/summary')
        .set('Authorization', `Bearer ${legacy}`);
      expect(response.status).toBe(200);
    });
  });

  describe('Banner push to members', () => {
    const { sendMulticastPushNotification } = require('../../services/pushNotificationService');

    // L'envoi part après la réponse : attendre qu'il soit terminé
    const waitForPush = async () => {
      for (let i = 0; i < 50 && sendMulticastPushNotification.mock.calls.length === 0; i++) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    };

    beforeEach(async () => {
      sendMulticastPushNotification.mockResolvedValue({ success: true, successCount: 1, failureCount: 0 });
      await prisma.user.update({ where: { id: testMember.id }, data: { fcmToken: 'member-token' } });
      await prisma.user.update({ where: { id: testAdmin.id }, data: { fcmToken: 'admin-token' } });
    });

    const bannerBody = {
      title: 'Tournoi',
      description: 'Inscrivez-vous',
      type: 'event',
      imageUrl: 'https://cdn.example.com/tournoi.jpg',
      notifyMembers: true
    };

    it('should push the banner to the gym members only, once', async () => {
      const created = await request(app)
        .post('/banners')
        .set('Authorization', authHeader(testOwner))
        .send(bannerBody);
      expect(created.status).toBe(201);
      expect(created.body.notifyMembers).toBe(true);

      await waitForPush();
      expect(sendMulticastPushNotification).toHaveBeenCalledWith(['member-token'], expect.objectContaining({
        title: 'Tournoi',
        imageUrl: 'https://cdn.example.com/tournoi.jpg',
        data: expect.objectContaining({ type: 'banner', bannerId: created.body.displayId })
      }));
      const stored = await prisma.banner.findUnique({ where: { id: created.body.id } });
      expect(stored.notifiedAt).not.toBeNull();

      sendMulticastPushNotification.mockClear();
      const updated = await request(app)
        .put(`/banners/${created.body.id}`)
        .set('Authorization', authHeader(testOwner))
        .send({ title: 'Tournoi (modifié)' });
      expect(updated.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(sendMulticastPushNotification).not.toHaveBeenCalled();
    });

    it('should push when notifyMembers is turned on later', async () => {
      const created = await request(app)
        .post('/banners')
        .set('Authorization', authHeader(testOwner))
        .send({ ...bannerBody, notifyMembers: false });
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(sendMulticastPushNotification).not.toHaveBeenCalled();

      await request(app)
        .put(`/banners/${created.body.id}`)
        .set('Authorization', authHeader(testOwner))
        .send({ notifyMembers: true });

      await waitForPush();
      expect(sendMulticastPushNotification).toHaveBeenCalledTimes(1);
    });

    it('should wait for the start date of a scheduled banner', async () => {
      await request(app)
        .post('/banners')
        .set('Authorization', authHeader(testOwner))
        .send({ ...bannerBody, startDate: new Date(Date.now() + 86400000).toISOString() });

      await new Promise(resolve => setTimeout(resolve, 200));
      expect(sendMulticastPushNotification).not.toHaveBeenCalled();
    });
  });
});
