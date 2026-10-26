const request = require('supertest');
const express = require('express');
const usersRoutes = require('../../routes/users');
const {
  cleanDatabase,
  disconnectDatabase,
  createTestGym,
  createTestAdmin,
  createTestMember,
  createTestOwner,
  authHeader,
  prisma
} = require('../helpers/testHelpers');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/users', usersRoutes);

describe('Users Routes', () => {
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
    await prisma.passwordResetToken.deleteMany({});
    await prisma.member.deleteMany({});
    await prisma.manager.deleteMany({});
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

  describe('GET /users/me', () => {
    it('should get current user profile', async () => {
      const response = await request(app)
        .get('/users/me')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('member@test.com');
      expect(response.body.role).toBe('member');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/users/me');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /users/:id', () => {
    it('should get user by id as admin', async () => {
      const response = await request(app)
        .get(`/users/${testMember.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testMember.id);
      expect(response.body.email).toBe('member@test.com');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/users/99999')
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /users/:id', () => {
    it('should update own profile', async () => {
      const response = await request(app)
        .put(`/users/${testMember.id}`)
        .set('Authorization', authHeader(testMember))
        .send({
          firstName: 'Updated',
          lastName: 'Name'
        });

      expect(response.status).toBe(200);
      expect(response.body.firstName).toBe('Updated');
      expect(response.body.lastName).toBe('Name');
    });

    it('should allow admin to update any user', async () => {
      const response = await request(app)
        .put(`/users/${testMember.id}`)
        .set('Authorization', authHeader(testAdmin))
        .send({
          firstName: 'Admin Updated'
        });

      expect(response.status).toBe(200);
      expect(response.body.firstName).toBe('Admin Updated');
    });

    it('should return 403 when updating other user as member', async () => {
      const response = await request(app)
        .put(`/users/${testAdmin.id}`)
        .set('Authorization', authHeader(testMember))
        .send({
          firstName: 'Hacker'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /users', () => {
    it('should get all users as admin', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(403);
    });
  });

  describe('POST /users/:id/change-password', () => {
    it('should change own password', async () => {
      const response = await request(app)
        .post(`/users/${testMember.id}/change-password`)
        .set('Authorization', authHeader(testMember))
        .send({
          currentPassword: 'member123',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('password');
    });

    it('should return 400 with wrong current password', async () => {
      const response = await request(app)
        .post(`/users/${testMember.id}/change-password`)
        .set('Authorization', authHeader(testMember))
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 with missing fields', async () => {
      const response = await request(app)
        .post(`/users/${testMember.id}/change-password`)
        .set('Authorization', authHeader(testMember))
        .send({
          currentPassword: 'member123'
          // Missing newPassword
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete user as admin', async () => {
      const response = await request(app)
        .delete(`/users/${testMember.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);

      const deletedUser = await prisma.user.findUnique({
        where: { id: testMember.id }
      });
      expect(deletedUser).toBeNull();
    });

    it('should return 403 for members trying to delete others', async () => {
      const response = await request(app)
        .delete(`/users/${testAdmin.id}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /users/fcm-token', () => {
    it('should update FCM token', async () => {
      const response = await request(app)
        .put('/users/fcm-token')
        .set('Authorization', authHeader(testMember))
        .send({ fcmToken: 'new-fcm-token-xyz' });
      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
    });

    it('should return 400 when fcmToken is missing', async () => {
      const response = await request(app)
        .put('/users/fcm-token')
        .set('Authorization', authHeader(testMember))
        .send({});
      expect(response.status).toBe(400);
    });

    it('should return 401 without auth', async () => {
      const response = await request(app)
        .put('/users/fcm-token')
        .send({ fcmToken: 'token' });
      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /users/fcm-token', () => {
    it('should remove FCM token', async () => {
      const response = await request(app)
        .delete('/users/fcm-token')
        .set('Authorization', authHeader(testMember));
      expect(response.status).toBe(200);
    });

    it('should return 401 without auth', async () => {
      const response = await request(app).delete('/users/fcm-token');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /users/:id/qr', () => {
    it('should generate QR code for own user', async () => {
      const response = await request(app)
        .get(`/users/${testMember.id}/qr`)
        .set('Authorization', authHeader(testMember));
      expect([200, 403]).toContain(response.status);
    });

    it('should return QR as admin for gym member', async () => {
      const response = await request(app)
        .get(`/users/${testMember.id}/qr`)
        .set('Authorization', authHeader(testAdmin));
      expect(response.status).toBe(200);
    });

    it('should return 403 for member accessing other user QR', async () => {
      const otherMember = await createTestMember(testGym.id);
      const response = await request(app)
        .get(`/users/${otherMember.id}/qr`)
        .set('Authorization', authHeader(testMember));
      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/users/99999/qr')
        .set('Authorization', authHeader(testAdmin));
      expect(response.status).toBe(404);
    });
  });

  describe('POST /users - create user', () => {
    it('should return 400 when required fields missing', async () => {
      const response = await request(app)
        .post('/users')
        .set('Authorization', authHeader(testAdmin))
        .send({ email: 'new@test.com' });
      expect(response.status).toBe(400);
    });

    it('should allow admin to create member in same gym', async () => {
      const response = await request(app)
        .post('/users')
        .set('Authorization', authHeader(testAdmin))
        .send({
          email: 'newmember@test.com',
          firstName: 'New',
          lastName: 'Member',
          role: 'member',
          gymId: testGym.id,
          sendSetupEmail: false
        });
      expect([200, 201]).toContain(response.status);
    });

    it('should return 403 when admin creates member in different gym', async () => {
      const otherGym = await createTestGym({ name: 'Other Gym' });
      const response = await request(app)
        .post('/users')
        .set('Authorization', authHeader(testAdmin))
        .send({
          email: 'othergym@test.com',
          firstName: 'Other',
          lastName: 'Gym',
          role: 'member',
          gymId: otherGym.id,
          sendSetupEmail: false
        });
      expect(response.status).toBe(403);
    });

    it('should return 400 for duplicate email', async () => {
      const response = await request(app)
        .post('/users')
        .set('Authorization', authHeader(testAdmin))
        .send({
          email: 'member@test.com', // already exists
          firstName: 'Dup',
          lastName: 'Email',
          role: 'member',
          gymId: testGym.id,
          sendSetupEmail: false
        });
      expect(response.status).toBe(400);
    });

    it('should return 403 for member trying to create user', async () => {
      const response = await request(app)
        .post('/users')
        .set('Authorization', authHeader(testMember))
        .send({
          email: 'hack@test.com',
          firstName: 'H',
          lastName: 'K',
          role: 'member',
          gymId: testGym.id,
          sendSetupEmail: false
        });
      expect(response.status).toBe(403);
    });
  });

  describe('GET /users/gym/:gymId/members', () => {
    it('should return members of gym as admin', async () => {
      const response = await request(app)
        .get(`/users/gym/${testGym.id}/members`)
        .set('Authorization', authHeader(testAdmin));
      expect([200, 201]).toContain(response.status);
    });

    it('should return 404 for non-existent gym', async () => {
      const response = await request(app)
        .get('/users/gym/99999/members')
        .set('Authorization', authHeader(testAdmin));
      expect(response.status).toBe(404);
    });
  });

  describe('Owner Routes', () => {
    let testOwner;

    beforeEach(async () => {
      testOwner = await createTestOwner(testGym.id, {
        email: 'owner@test.com'
      });
    });

    afterEach(async () => {
      await prisma.owner.deleteMany({});
      await prisma.user.deleteMany({ where: { role: 'owner' } });
    });

    describe('GET /users/stats', () => {
      it('should return 401 without auth', async () => {
        const res = await request(app).get('/users/stats');
        expect(res.status).toBe(401);
      });

      it('should return 403 for admin', async () => {
        const res = await request(app)
          .get('/users/stats')
          .set('Authorization', authHeader(testAdmin));
        expect(res.status).toBe(403);
      });

      it('should return stats for owner', async () => {
        const res = await request(app)
          .get('/users/stats')
          .set('Authorization', authHeader(testOwner));
        expect(res.status).toBe(200);
        expect(res.body.stats).toBeDefined();
        expect(res.body.stats.totalGyms).toBeDefined();
        expect(res.body.stats.totalUsers).toBeDefined();
      });
    });

    describe('GET /users/gyms/all', () => {
      it('should return 401 without auth', async () => {
        const res = await request(app).get('/users/gyms/all');
        expect(res.status).toBe(401);
      });

      it('should return 403 for admin', async () => {
        const res = await request(app)
          .get('/users/gyms/all')
          .set('Authorization', authHeader(testAdmin));
        expect(res.status).toBe(403);
      });

      it('should return all gyms for owner', async () => {
        const res = await request(app)
          .get('/users/gyms/all')
          .set('Authorization', authHeader(testOwner));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.gyms)).toBe(true);
      });
    });

    describe('POST /users/create-owner', () => {
      it('should return 400 with missing required fields', async () => {
        const res = await request(app)
          .post('/users/create-owner')
          .set('Authorization', authHeader(testOwner))
          .send({ email: 'new@test.com' });
        expect(res.status).toBe(400);
      });

      it('should return 403 for non-owner', async () => {
        const res = await request(app)
          .post('/users/create-owner')
          .set('Authorization', authHeader(testAdmin))
          .send({ email: 'new@test.com', password: 'pass123', firstName: 'New', lastName: 'Owner', gymId: testGym.id });
        expect(res.status).toBe(403);
      });

      it('should create a new owner', async () => {
        const res = await request(app)
          .post('/users/create-owner')
          .set('Authorization', authHeader(testOwner))
          .send({ email: 'newowner@test.com', password: 'pass123', firstName: 'New', lastName: 'Owner', gymId: testGym.id });
        expect(res.status).toBe(201);
        expect(res.body.owner).toBeDefined();
        await prisma.owner.deleteMany({ where: { User: { email: 'newowner@test.com' } } });
        await prisma.user.deleteMany({ where: { email: 'newowner@test.com' } });
      });

      it('should return 400 for duplicate email', async () => {
        const res = await request(app)
          .post('/users/create-owner')
          .set('Authorization', authHeader(testOwner))
          .send({ email: 'owner@test.com', password: 'pass123', firstName: 'Dup', lastName: 'Owner', gymId: testGym.id });
        expect(res.status).toBe(400);
      });
    });

    describe('POST /users/create-admin', () => {
      it('should return 400 with missing required fields', async () => {
        const res = await request(app)
          .post('/users/create-admin')
          .set('Authorization', authHeader(testOwner))
          .send({ email: 'admin@new.com' });
        expect(res.status).toBe(400);
      });

      it('should return 403 for non-owner', async () => {
        const res = await request(app)
          .post('/users/create-admin')
          .set('Authorization', authHeader(testAdmin))
          .send({ email: 'admin@new.com', firstName: 'New', lastName: 'Admin', gymId: testGym.id });
        expect(res.status).toBe(403);
      });

      it('should create a new admin', async () => {
        const res = await request(app)
          .post('/users/create-admin')
          .set('Authorization', authHeader(testOwner))
          .send({ email: 'newadmin@test.com', firstName: 'New', lastName: 'Admin', gymId: testGym.id, password: 'admin123', sendSetupEmail: false });
        expect(res.status).toBe(201);
        expect(res.body.admin).toBeDefined();
        await prisma.manager.deleteMany({ where: { User: { email: 'newadmin@test.com' } } });
        await prisma.user.deleteMany({ where: { email: 'newadmin@test.com' } });
      });

      it('should return 400 for duplicate email', async () => {
        const res = await request(app)
          .post('/users/create-admin')
          .set('Authorization', authHeader(testOwner))
          .send({ email: 'admin@test.com', firstName: 'Dup', lastName: 'Admin', gymId: testGym.id });
        expect(res.status).toBe(400);
      });
    });
  });

  describe('PUT /users/:id/profile-image', () => {
    const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    it('should return 400 when imageData is missing', async () => {
      const res = await request(app)
        .put(`/users/${testMember.id}/profile-image`)
        .set('Authorization', authHeader(testMember))
        .send({});
      expect(res.status).toBe(400);
    });

    it('should return 403 when member tries to update other user', async () => {
      const res = await request(app)
        .put(`/users/${testAdmin.id}/profile-image`)
        .set('Authorization', authHeader(testMember))
        .send({ imageData: validImageData });
      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .put('/users/99999/profile-image')
        .set('Authorization', authHeader(testAdmin))
        .send({ imageData: validImageData });
      expect(res.status).toBe(404);
    });

    it('should update own profile image as member', async () => {
      const res = await request(app)
        .put(`/users/${testMember.id}/profile-image`)
        .set('Authorization', authHeader(testMember))
        .send({ imageData: validImageData });
      expect(res.status).toBe(200);
    });

    it('should update profile image as admin for gym member', async () => {
      const res = await request(app)
        .put(`/users/${testMember.id}/profile-image`)
        .set('Authorization', authHeader(testAdmin))
        .send({ imageData: validImageData });
      expect(res.status).toBe(200);
    });

    it('should accept plain base64 without data URI prefix', async () => {
      const res = await request(app)
        .put(`/users/${testMember.id}/profile-image`)
        .set('Authorization', authHeader(testMember))
        .send({ imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /users/:id/profile-image', () => {
    it('should return 403 when member accesses other user image', async () => {
      const res = await request(app)
        .get(`/users/${testAdmin.id}/profile-image`)
        .set('Authorization', authHeader(testMember));
      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/users/99999/profile-image')
        .set('Authorization', authHeader(testAdmin));
      expect(res.status).toBe(404);
    });

    it('should return SVG avatar when member has no profile image', async () => {
      const res = await request(app)
        .get(`/users/${testMember.id}/profile-image`)
        .set('Authorization', authHeader(testMember));
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/svg/);
    });

    it('should return image when admin accesses gym member', async () => {
      const res = await request(app)
        .get(`/users/${testMember.id}/profile-image`)
        .set('Authorization', authHeader(testAdmin));
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /users/:id/profile-image', () => {
    it('should return 403 when member tries to delete other user image', async () => {
      const res = await request(app)
        .delete(`/users/${testAdmin.id}/profile-image`)
        .set('Authorization', authHeader(testMember));
      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .delete('/users/99999/profile-image')
        .set('Authorization', authHeader(testAdmin));
      expect(res.status).toBe(404);
    });

    it('should delete own profile image as member', async () => {
      const res = await request(app)
        .delete(`/users/${testMember.id}/profile-image`)
        .set('Authorization', authHeader(testMember));
      expect(res.status).toBe(200);
    });

    it('should delete profile image as admin for gym member', async () => {
      const res = await request(app)
        .delete(`/users/${testMember.id}/profile-image`)
        .set('Authorization', authHeader(testAdmin));
      expect(res.status).toBe(200);
    });
  });
});
