const request = require('supertest');
const express = require('express');
const planningsRoutes = require('../../routes/plannings');
const {
  cleanDatabase,
  disconnectDatabase,
  createTestGym,
  createTestAdmin,
  createTestCoach,
  createTestMember,
  createTestPlanning,
  createTestProgram,
  createTestAssignment,
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
    await prisma.planning.deleteMany({});
    await prisma.programAssignment.deleteMany({});
    await prisma.program.deleteMany({});
    await prisma.exercise.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.member.deleteMany({});
    await prisma.manager.deleteMany({});
    await prisma.coachGym.deleteMany({});
    await prisma.coach.deleteMany({});
    await prisma.owner.deleteMany({});
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

  describe('écritures historiques (410, remplacées par /programs)', () => {
    it('POST /plannings, DELETE et exercices renvoient 410 plannings_deprecated', async () => {
      const calls = [
        request(app).post('/plannings').send({ memberId: testMember.id, title: 'X' }),
        request(app).delete('/plannings/1'),
        request(app).post('/plannings/1/days/1/exercises').send({ exerciseId: testExercise.id }),
        request(app).delete(`/plannings/1/days/1/exercises/${testExercise.id}`)
      ];
      for (const call of calls) {
        const res = await call.set('Authorization', authHeader(testAdmin));
        expect(res.status).toBe(410);
        expect(res.body.error).toBe('plannings_deprecated');
      }
    });
  });

  describe('lecture (alimentée par les affectations de programme)', () => {
    let assignment;
    const today = new Date().getDay();

    beforeEach(async () => {
      const program = await createTestProgram(testAdmin.id, {
        title: 'Programme Force',
        days: [{ dayOfWeek: today, exercises: [{ exerciseId: testExercise.id, sets: 3, reps: 10, restTime: 60 }] }]
      });
      assignment = await createTestAssignment(program.id, testMember.id, testAdmin.id);
    });

    it('GET /plannings/member/:memberId garde la forme historique', async () => {
      const res = await request(app)
        .get(`/plannings/member/${testMember.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(res.status).toBe(200);
      expect(res.body.member.id).toBe(testMember.id);
      expect(res.body.plannings).toHaveLength(1);
      const planning = res.body.plannings[0];
      expect(planning).toMatchObject({ id: assignment.id, title: 'Programme Force', memberId: testMember.id, status: 'active' });
      expect(planning.User.id).toBe(testAdmin.id);
      expect(planning.User.fcmToken).toBeUndefined();
      expect(planning.PlanningDay[0].dayOfWeek).toBe(today);
      expect(planning.PlanningDay[0].PlanningExercise[0]).toMatchObject({ sets: 3, reps: 10, restTime: 60 });
      expect(planning.PlanningDay[0].PlanningExercise[0].Exercise.name).toBe('Push-ups');
    });

    it('le membre lit ses propres plannings mais pas ceux d\'un autre', async () => {
      const own = await request(app)
        .get(`/plannings/member/${testMember.id}`)
        .set('Authorization', authHeader(testMember));
      expect(own.status).toBe(200);

      const other = await createTestMember(testGym.id);
      const res = await request(app)
        .get(`/plannings/member/${testMember.id}`)
        .set('Authorization', authHeader(other));
      expect(res.status).toBe(403);
    });

    it('le coach lit les plannings de ses membres seulement', async () => {
      const coach = await createTestCoach([testGym.id]);
      const denied = await request(app)
        .get(`/plannings/member/${testMember.id}`)
        .set('Authorization', authHeader(coach));
      expect(denied.status).toBe(403);

      await prisma.member.update({ where: { userId: testMember.id }, data: { coachId: coach.id } });
      const allowed = await request(app)
        .get(`/plannings/member/${testMember.id}`)
        .set('Authorization', authHeader(coach));
      expect(allowed.status).toBe(200);
      expect(allowed.body.plannings).toHaveLength(1);
    });

    it('GET /plannings liste les plannings de la salle (manager) et les siens (membre)', async () => {
      const mgr = await request(app).get('/plannings').set('Authorization', authHeader(testAdmin));
      expect(mgr.status).toBe(200);
      expect(mgr.body.plannings).toHaveLength(1);
      expect(mgr.body.plannings[0].Member.User.id).toBe(testMember.id);

      const member = await request(app).get('/plannings').set('Authorization', authHeader(testMember));
      expect(member.status).toBe(200);
      expect(member.body.plannings).toHaveLength(1);
    });

    it('GET /plannings/next-day renvoie l\'entraînement du jour', async () => {
      const res = await request(app)
        .get(`/plannings/next-day/${testMember.id}`)
        .set('Authorization', authHeader(testMember));
      expect(res.status).toBe(200);
      expect(res.body.planning.id).toBe(assignment.id);
      expect(res.body.day).toMatchObject({ dayOfWeek: today, isToday: true });
      expect(res.body.day.exercises[0]).toMatchObject({ sets: 3, reps: 10 });
      expect(res.body.day.exercises[0].exercise.name).toBe('Push-ups');
    });

    it('GET /plannings/next-day renvoie 204 sans programme actif', async () => {
      await prisma.programAssignment.update({ where: { id: assignment.id }, data: { status: 'cancelled' } });
      const res = await request(app)
        .get(`/plannings/next-day/${testMember.id}`)
        .set('Authorization', authHeader(testMember));
      expect(res.status).toBe(204);
    });

    it('une affectation sans endDate reste active', async () => {
      await prisma.programAssignment.update({ where: { id: assignment.id }, data: { endDate: null } });
      const res = await request(app)
        .get(`/plannings/next-day/${testMember.id}`)
        .set('Authorization', authHeader(testMember));
      expect(res.status).toBe(200);
    });

    it('GET /plannings/next-day refuse sans authentification', async () => {
      const res = await request(app).get(`/plannings/next-day/${testMember.id}`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /plannings/request-help', () => {
    const { sendPushNotification } = require('../../services/pushNotificationService');

    it('renvoie 400 sans exerciseName', async () => {
      const response = await request(app)
        .post('/plannings/request-help')
        .set('Authorization', authHeader(testMember))
        .send({});
      expect(response.status).toBe(400);
    });

    it('renvoie 401 sans authentification', async () => {
      const response = await request(app)
        .post('/plannings/request-help')
        .send({ message: 'Need help' });
      expect(response.status).toBe(401);
    });

    it('renvoie 403 sans programme actif', async () => {
      const response = await request(app)
        .post('/plannings/request-help')
        .set('Authorization', authHeader(testMember))
        .send({ exerciseName: 'Push-ups' });
      expect(response.status).toBe(403);
    });

    it('notifie l\'auteur du programme et le coach affecté, sans doublon', async () => {
      const coach = await createTestCoach([testGym.id]);
      await prisma.user.update({ where: { id: coach.id }, data: { fcmToken: 'coach-token' } });
      await prisma.user.update({ where: { id: testAdmin.id }, data: { fcmToken: 'manager-token' } });
      await prisma.member.update({ where: { userId: testMember.id }, data: { coachId: coach.id } });
      await createTestPlanning(testAdmin.id, testMember.id);

      const response = await request(app)
        .post('/plannings/request-help')
        .set('Authorization', authHeader(testMember))
        .send({ exerciseName: 'Push-ups' });

      expect(response.status).toBe(200);
      expect(response.body.coach.id).toBe(coach.id);
      expect(response.body.notified.map(n => n.id).sort()).toEqual([testAdmin.id, coach.id].sort());
      const tokens = sendPushNotification.mock.calls.map(c => c[0]);
      expect(tokens.sort()).toEqual(['coach-token', 'manager-token']);
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

    it('le coach répond à ses membres seulement', async () => {
      const coach = await createTestCoach([testGym.id]);
      const denied = await request(app)
        .post('/plannings/respond-help')
        .set('Authorization', authHeader(coach))
        .send({ memberId: testMember.id, response: 'coming' });
      expect(denied.status).toBe(403);

      await prisma.member.update({ where: { userId: testMember.id }, data: { coachId: coach.id } });
      const allowed = await request(app)
        .post('/plannings/respond-help')
        .set('Authorization', authHeader(coach))
        .send({ memberId: testMember.id, response: 'coming' });
      expect(allowed.status).toBe(200);
    });
  });
});
