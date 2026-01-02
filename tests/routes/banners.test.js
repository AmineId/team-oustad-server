const request = require('supertest');
const express = require('express');
const bannersRoutes = require('../../routes/banners');
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
app.use('/banners', bannersRoutes);

describe('Banners Routes', () => {
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
    await prisma.banner.deleteMany({});
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

  describe('POST /banners', () => {
    it('should create a banner as admin', async () => {
      const response = await request(app)
        .post('/banners')
        .set('Authorization', authHeader(testAdmin))
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
        .set('Authorization', authHeader(testAdmin))
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

    it('should update a banner as admin', async () => {
      const response = await request(app)
        .put(`/banners/${testBanner.id}`)
        .set('Authorization', authHeader(testAdmin))
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

    it('should delete a banner as admin', async () => {
      const response = await request(app)
        .delete(`/banners/${testBanner.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      
      // Verify deletion
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
});
