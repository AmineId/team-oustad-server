const request = require('supertest');
const express = require('express');
const planningsRoutes = require('../../routes/plannings');
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
app.use('/plannings', planningsRoutes);

describe('Plannings Routes', () => {
  let testGym;
  let testAdmin;
  let testMember;
  let testExercise;

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
    await prisma.planningExercise.deleteMany({});
    await prisma.planningDay.deleteMany({});
    await prisma.exercise.deleteMany({});
    await prisma.planning.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.member.deleteMany({});
    await prisma.admin.deleteMany({});
    await prisma.user.deleteMany({});
    
    // Create fresh test users
    testAdmin = await createTestAdmin(testGym.id, {
      email: 'coach@test.com',
      password: 'coach123'
    });
    
    testMember = await createTestMember(testGym.id, {
      email: 'member@test.com',
      password: 'member123'
    });

    // Create a test exercise
    testExercise = await prisma.exercise.create({
      data: {
        displayId: 'EX001',
        name: 'Push-ups',
        description: 'Classic push-up exercise',
        category: 'strength',
        muscleGroup: 'chest',
        difficulty: 'beginner',
        gymId: testGym.id,
        createdById: testAdmin.id
      }
    });
  });

  describe('POST /plannings/exercises', () => {
    it('should create an exercise as admin', async () => {
      const response = await request(app)
        .post('/plannings/exercises')
        .set('Authorization', authHeader(testAdmin))
        .send({
          name: 'Squats',
          description: 'Leg exercise',
          category: 'strength',
          muscleGroup: 'legs',
          difficulty: 'intermediate'
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Squats');
      expect(response.body.category).toBe('strength');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/plannings/exercises')
        .send({
          name: 'Squats',
          category: 'strength',
          difficulty: 'intermediate'
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 with missing required fields', async () => {
      const response = await request(app)
        .post('/plannings/exercises')
        .set('Authorization', authHeader(testAdmin))
        .send({
          name: 'Squats'
          // Missing category and difficulty
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /plannings/exercises', () => {
    it('should get all exercises for gym', async () => {
      const response = await request(app)
        .get('/plannings/exercises')
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should work for members too', async () => {
      const response = await request(app)
        .get('/plannings/exercises')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /plannings/exercises/:id', () => {
    it('should get a specific exercise', async () => {
      const response = await request(app)
        .get(`/plannings/exercises/${testExercise.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testExercise.id);
      expect(response.body.name).toBe('Push-ups');
    });

    it('should return 404 for non-existent exercise', async () => {
      const response = await request(app)
        .get('/plannings/exercises/99999')
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(404);
    });
  });

  describe('POST /plannings (Create Planning)', () => {
    it('should create a planning as admin', async () => {
      const response = await request(app)
        .post('/plannings')
        .set('Authorization', authHeader(testAdmin))
        .send({
          memberId: testMember.id,
          name: 'Week 1 Workout',
          description: 'First week training plan',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          days: [
            {
              dayNumber: 1,
              name: 'Chest Day',
              exercises: [
                {
                  exerciseId: testExercise.id,
                  sets: 3,
                  reps: 10,
                  restSeconds: 60
                }
              ]
            }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Week 1 Workout');
      expect(response.body.days).toBeDefined();
      expect(response.body.days.length).toBe(1);
    });

    it('should return 403 for members trying to create planning', async () => {
      const response = await request(app)
        .post('/plannings')
        .set('Authorization', authHeader(testMember))
        .send({
          memberId: testMember.id,
          name: 'My Own Plan',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /plannings/member/:memberId', () => {
    let testPlanning;

    beforeEach(async () => {
      testPlanning = await prisma.planning.create({
        data: {
          displayId: 'PLAN001',
          name: 'Test Planning',
          description: 'Test description',
          memberId: testMember.id,
          coachId: testAdmin.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });
    });

    it('should get plannings for a member', async () => {
      const response = await request(app)
        .get(`/plannings/member/${testMember.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should allow member to get their own plannings', async () => {
      const response = await request(app)
        .get(`/plannings/member/${testMember.id}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
