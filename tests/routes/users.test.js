const request = require('supertest');
const express = require('express');
const usersRoutes = require('../../routes/users');
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
      
      // Verify deletion
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
});
