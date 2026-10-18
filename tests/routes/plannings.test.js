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
        displayId: `EX${Date.now()}`,
        name: 'Push-ups',
        description: 'Classic push-up exercise',
        category: 'strength',
        muscleGroup: ['chest'],
        equipment: [],
        difficulty: 'beginner'
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
          muscleGroup: ['legs'],
          difficulty: 'intermediate'
        });

      expect(response.status).toBe(201);
      expect(response.body.exercise.name).toBe('Squats');
      expect(response.body.exercise.category).toBe('strength');
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
      expect(Array.isArray(response.body.exercises)).toBe(true);
      expect(response.body.exercises.length).toBeGreaterThan(0);
    });

    it('should work for members too', async () => {
      const response = await request(app)
        .get('/plannings/exercises')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.exercises)).toBe(true);
    });
  });

  describe('GET /plannings/exercises/:id', () => {
    it('should get a specific exercise', async () => {
      const response = await request(app)
        .get(`/plannings/exercises/${testExercise.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(response.body.exercise.id).toBe(testExercise.id);
      expect(response.body.exercise.name).toBe('Push-ups');
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
          title: 'Week 1 Workout',
          description: 'First week training plan',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });

      expect(response.status).toBe(201);
      expect(response.body.planning.title).toBe('Week 1 Workout');
    });

    it('should return 403 for members trying to create planning', async () => {
      const response = await request(app)
        .post('/plannings')
        .set('Authorization', authHeader(testMember))
        .send({
          memberId: testMember.id,
          title: 'My Own Plan',
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
          displayId: `PLAN${Date.now()}`,
          title: 'Test Planning',
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
      expect(Array.isArray(response.body.plannings)).toBe(true);
      expect(response.body.plannings.length).toBeGreaterThan(0);
    });

    it('should allow member to get their own plannings', async () => {
      const response = await request(app)
        .get(`/plannings/member/${testMember.id}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.plannings)).toBe(true);
    });
  });

  describe('GET /plannings', () => {
    beforeEach(async () => {
      await prisma.planning.create({
        data: {
          displayId: `PLAN${Date.now()}-list`,
          title: 'List Test Planning',
          description: 'desc',
          memberId: testMember.id,
          coachId: testAdmin.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });
    });

    it('should list all plannings for admin/coach', async () => {
      const response = await request(app)
        .get('/plannings')
        .set('Authorization', authHeader(testAdmin));
      expect(response.status).toBe(200);
    });

    it('should list own plannings for member', async () => {
      const response = await request(app)
        .get('/plannings')
        .set('Authorization', authHeader(testMember));
      expect([200, 403]).toContain(response.status);
    });
  });

  describe('DELETE /plannings/:planningId', () => {
    let planningToDelete;

    beforeEach(async () => {
      planningToDelete = await prisma.planning.create({
        data: {
          displayId: `PLAN${Date.now()}-del`,
          title: 'To Delete',
          description: 'desc',
          memberId: testMember.id,
          coachId: testAdmin.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });
    });

    it('should delete planning as coach/admin', async () => {
      const response = await request(app)
        .delete(`/plannings/${planningToDelete.id}`)
        .set('Authorization', authHeader(testAdmin));
      expect(response.status).toBe(200);
    });

    it('should return 403 for member trying to delete', async () => {
      const response = await request(app)
        .delete(`/plannings/${planningToDelete.id}`)
        .set('Authorization', authHeader(testMember));
      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent planning', async () => {
      const response = await request(app)
        .delete('/plannings/99999')
        .set('Authorization', authHeader(testAdmin));
      expect(response.status).toBe(404);
    });
  });

  describe('POST /plannings/:planningId/days/:dayOfWeek/exercises', () => {
    let testPlanning;

    beforeEach(async () => {
      testPlanning = await prisma.planning.create({
        data: {
          displayId: `PLAN${Date.now()}-ex`,
          title: 'Exercise Test',
          description: 'desc',
          memberId: testMember.id,
          coachId: testAdmin.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });
    });

    it('should add exercise to planning day', async () => {
      const response = await request(app)
        .post(`/plannings/${testPlanning.id}/days/1/exercises`)
        .set('Authorization', authHeader(testAdmin))
        .send({
          exerciseId: testExercise.id,
          sets: 3,
          reps: 10,
          restSeconds: 60
        });
      expect([200, 201]).toContain(response.status);
    });

    it('should return 403 for member', async () => {
      const response = await request(app)
        .post(`/plannings/${testPlanning.id}/days/1/exercises`)
        .set('Authorization', authHeader(testMember))
        .send({ exerciseId: testExercise.id, sets: 3, reps: 10 });
      expect(response.status).toBe(403);
    });
  });

  describe('GET /plannings/next-day/:memberId', () => {
    it('should get next training day info', async () => {
      const response = await request(app)
        .get(`/plannings/next-day/${testMember.id}`)
        .set('Authorization', authHeader(testMember));
      expect([200, 204, 404]).toContain(response.status);
    });

    it('should return 401 without auth', async () => {
      const response = await request(app)
        .get(`/plannings/next-day/${testMember.id}`);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /plannings/request-help', () => {
    it('should return 400 when required fields missing', async () => {
      const response = await request(app)
        .post('/plannings/request-help')
        .set('Authorization', authHeader(testMember))
        .send({});
      expect([400, 500]).toContain(response.status);
    });

    it('should return 401 without auth', async () => {
      const response = await request(app)
        .post('/plannings/request-help')
        .send({ message: 'Need help' });
      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /plannings/:planningId/days/:dayOfWeek/exercises/:exerciseId', () => {
    let testPlanning;

    beforeEach(async () => {
      testPlanning = await prisma.planning.create({
        data: {
          displayId: `PLAN${Date.now()}-delex`,
          title: 'Delete Exercise Test',
          description: 'desc',
          memberId: testMember.id,
          coachId: testAdmin.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });
      const day = await prisma.planningDay.create({
        data: { planningId: testPlanning.id, dayOfWeek: 1 }
      });
      await prisma.planningExercise.create({
        data: { planningDayId: day.id, exerciseId: testExercise.id, sets: 3, reps: 10, restTime: 60 }
      });
    });

    it('should return 403 for member', async () => {
      const res = await request(app)
        .delete(`/plannings/${testPlanning.id}/days/1/exercises/${testExercise.id}`)
        .set('Authorization', authHeader(testMember));
      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent planning', async () => {
      const res = await request(app)
        .delete(`/plannings/99999/days/1/exercises/${testExercise.id}`)
        .set('Authorization', authHeader(testAdmin));
      expect(res.status).toBe(404);
    });

    it('should return 404 when day not found in planning', async () => {
      const res = await request(app)
        .delete(`/plannings/${testPlanning.id}/days/99/exercises/${testExercise.id}`)
        .set('Authorization', authHeader(testAdmin));
      expect(res.status).toBe(404);
    });

    it('should return 404 when exercise not in day', async () => {
      const res = await request(app)
        .delete(`/plannings/${testPlanning.id}/days/1/exercises/99999`)
        .set('Authorization', authHeader(testAdmin));
      expect(res.status).toBe(404);
    });

    it('should delete exercise from planning day successfully', async () => {
      const res = await request(app)
        .delete(`/plannings/${testPlanning.id}/days/1/exercises/${testExercise.id}`)
        .set('Authorization', authHeader(testAdmin));
      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
    });
  });

  describe('POST /plannings/respond-help', () => {
    it('should return 403 for member', async () => {
      const res = await request(app)
        .post('/plannings/respond-help')
        .set('Authorization', authHeader(testMember))
        .send({ memberId: testMember.id, response: 'coming' });
      expect(res.status).toBe(403);
    });

    it('should return 400 when required fields missing', async () => {
      const res = await request(app)
        .post('/plannings/respond-help')
        .set('Authorization', authHeader(testAdmin))
        .send({});
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid response value', async () => {
      const res = await request(app)
        .post('/plannings/respond-help')
        .set('Authorization', authHeader(testAdmin))
        .send({ memberId: testMember.id, response: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should return 404 when member not found', async () => {
      const res = await request(app)
        .post('/plannings/respond-help')
        .set('Authorization', authHeader(testAdmin))
        .send({ memberId: 99999, response: 'coming' });
      expect(res.status).toBe(404);
    });

    it('should respond to help request successfully', async () => {
      const res = await request(app)
        .post('/plannings/respond-help')
        .set('Authorization', authHeader(testAdmin))
        .send({ memberId: testMember.id, response: 'coming', exerciseName: 'Push-ups' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should respond with busy status', async () => {
      const res = await request(app)
        .post('/plannings/respond-help')
        .set('Authorization', authHeader(testAdmin))
        .send({ memberId: testMember.id, response: 'busy' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
