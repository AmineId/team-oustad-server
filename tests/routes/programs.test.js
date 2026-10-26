const request = require('supertest');
const express = require('express');
const {
  cleanDatabase,
  disconnectDatabase,
  createTestGym,
  createTestOwner,
  createTestAdmin,
  createTestCoach,
  createTestMember,
  createTestExercise,
  createTestProgram,
  createTestAssignment,
  authHeader,
  prisma
} = require('../helpers/testHelpers');
const { sendPushNotification } = require('../../services/pushNotificationService');

const app = express();
app.use(express.json());
app.use('/programs', require('../../routes/programs'));
app.use('/program-assignments', require('../../routes/programAssignments'));
app.use('/members', require('../../routes/members'));

describe('Rôles V2 : programmes', () => {
  let gym;
  let otherGym;
  let owner;
  let manager;
  let coach;
  let member;
  let coachedMember;
  let otherGymMember;
  let squat;
  let pushup;

  beforeEach(async () => {
    await cleanDatabase();
    gym = await createTestGym({ name: 'Salle A' });
    otherGym = await createTestGym({ name: 'Salle B' });
    owner = await createTestOwner(gym.id);
    manager = await createTestAdmin(gym.id);
    coach = await createTestCoach([gym.id]);
    member = await createTestMember(gym.id);
    coachedMember = await createTestMember(gym.id);
    otherGymMember = await createTestMember(otherGym.id);
    await prisma.member.update({ where: { userId: coachedMember.id }, data: { coachId: coach.id } });
    squat = await createTestExercise({ name: 'Squat' });
    pushup = await createTestExercise({ name: 'Pompes' });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  const fullProgram = () => ({
    title: 'Force 8 semaines',
    description: 'Programme force',
    level: 'intermediate',
    durationWeeks: 8,
    days: [
      { dayOfWeek: 1, exercises: [{ exerciseId: squat.id, sets: 5, reps: 5, restTime: 120 }, { exerciseId: pushup.id, sets: 3, reps: 12 }] },
      { dayOfWeek: 4, exercises: [{ exerciseId: pushup.id, sets: 4, reps: 10, notes: 'Lent' }] }
    ]
  });

  describe('CRUD (owner uniquement)', () => {
    it('crée un programme complet avec ses jours', async () => {
      const res = await request(app).post('/programs').set('Authorization', authHeader(owner)).send(fullProgram());

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ title: 'Force 8 semaines', level: 'intermediate', durationWeeks: 8, assignmentsCount: 0 });
      expect(res.body.createdBy.id).toBe(owner.id);
      expect(res.body.days.map(d => d.dayOfWeek)).toEqual([1, 4]);
      expect(res.body.days[0].exercises.map(e => e.exercise.name)).toEqual(['Squat', 'Pompes']);
      expect(res.body.days[0].exercises[0]).toMatchObject({ exerciseId: squat.id, sets: 5, reps: 5, restTime: 120, order: 0 });
    });

    it('refuse manager et coach en écriture, les laisse lire', async () => {
      for (const user of [manager, coach]) {
        const res = await request(app).post('/programs').set('Authorization', authHeader(user)).send(fullProgram());
        expect(res.status).toBe(403);
      }
      await createTestProgram(owner.id, { title: 'Lisible' });
      for (const user of [manager, coach]) {
        const res = await request(app).get('/programs').set('Authorization', authHeader(user));
        expect(res.status).toBe(200);
        expect(res.body.map(p => p.title)).toEqual(['Lisible']);
      }
      const res = await request(app).get('/programs').set('Authorization', authHeader(member));
      expect(res.status).toBe(403);
    });

    it('valide le body', async () => {
      const cases = [
        [{}, 'title_required'],
        [{ title: 'X', days: [{ dayOfWeek: 7 }] }, 'invalid_day_of_week'],
        [{ title: 'X', days: [{ dayOfWeek: 1 }, { dayOfWeek: 1 }] }, 'duplicate_day'],
        [{ title: 'X', days: [{ dayOfWeek: 1, exercises: [{ sets: 3 }] }] }, 'exercise_id_required'],
        [{ title: 'X', days: [{ dayOfWeek: 1, exercises: [{ exerciseId: squat.id, sets: -1 }] }] }, 'invalid_field']
      ];
      for (const [body, code] of cases) {
        const res = await request(app).post('/programs').set('Authorization', authHeader(owner)).send(body);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe(code);
      }
      const unknown = await request(app).post('/programs').set('Authorization', authHeader(owner))
        .send({ title: 'X', days: [{ dayOfWeek: 1, exercises: [{ exerciseId: 999999 }] }] });
      expect(unknown.status).toBe(404);
    });

    it('PUT remplace les jours seulement si days est fourni', async () => {
      const created = await request(app).post('/programs').set('Authorization', authHeader(owner)).send(fullProgram());
      const id = created.body.id;

      const renamed = await request(app).put(`/programs/${id}`).set('Authorization', authHeader(owner)).send({ title: 'Renommé' });
      expect(renamed.status).toBe(200);
      expect(renamed.body.title).toBe('Renommé');
      expect(renamed.body.days).toHaveLength(2);

      const replaced = await request(app).put(`/programs/${id}`).set('Authorization', authHeader(owner))
        .send({ days: [{ dayOfWeek: 6, exercises: [{ exerciseId: squat.id }] }] });
      expect(replaced.body.days.map(d => d.dayOfWeek)).toEqual([6]);
    });

    it('ajoute, modifie et retire un exercice jour par jour', async () => {
      const program = await createTestProgram(owner.id);

      const added = await request(app).post(`/programs/${program.id}/days/2/exercises`)
        .set('Authorization', authHeader(owner)).send({ exerciseId: squat.id, sets: 3, reps: 8 });
      expect(added.status).toBe(201);
      expect(added.body).toMatchObject({ exerciseId: squat.id, sets: 3, reps: 8, order: 0 });

      const second = await request(app).post(`/programs/${program.id}/days/2/exercises`)
        .set('Authorization', authHeader(owner)).send({ exerciseId: pushup.id });
      expect(second.body.order).toBe(1);

      const updated = await request(app).put(`/programs/${program.id}/days/2/exercises/${added.body.id}`)
        .set('Authorization', authHeader(owner)).send({ reps: 10 });
      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({ sets: 3, reps: 10 });

      const wrongDay = await request(app).delete(`/programs/${program.id}/days/3/exercises/${added.body.id}`)
        .set('Authorization', authHeader(owner));
      expect(wrongDay.status).toBe(404);

      const removed = await request(app).delete(`/programs/${program.id}/days/2/exercises/${added.body.id}`)
        .set('Authorization', authHeader(owner));
      expect(removed.status).toBe(200);

      const get = await request(app).get(`/programs/${program.id}`).set('Authorization', authHeader(owner));
      expect(get.body.days[0].exercises.map(e => e.exercise.name)).toEqual(['Pompes']);
    });

    it('DELETE refuse un programme encore affecté (409), accepte sinon', async () => {
      const program = await createTestProgram(owner.id);
      const assignment = await createTestAssignment(program.id, member.id, owner.id);

      const inUse = await request(app).delete(`/programs/${program.id}`).set('Authorization', authHeader(owner));
      expect(inUse.status).toBe(409);
      expect(inUse.body).toMatchObject({ error: 'program_in_use', activeAssignments: 1 });

      await prisma.programAssignment.update({ where: { id: assignment.id }, data: { status: 'cancelled' } });
      const ok = await request(app).delete(`/programs/${program.id}`).set('Authorization', authHeader(owner));
      expect(ok.status).toBe(200);
    });

    it('GET /programs/:id renvoie 404 pour un programme inconnu', async () => {
      const res = await request(app).get('/programs/999999').set('Authorization', authHeader(owner));
      expect(res.status).toBe(404);
    });
  });

  describe('affectations', () => {
    let program;
    const start = '2026-11-02T00:00:00.000Z';

    beforeEach(async () => {
      program = await createTestProgram(owner.id, {
        title: 'Cardio',
        days: [{ dayOfWeek: 1, exercises: [{ exerciseId: squat.id, sets: 3 }] }]
      });
    });

    const assign = (user, body) => request(app)
      .post(`/programs/${program.id}/assignments`)
      .set('Authorization', authHeader(user))
      .send(body);

    it('l\'owner affecte et remplace l\'affectation active', async () => {
      const previous = await createTestAssignment(program.id, member.id, owner.id);
      await prisma.user.update({ where: { id: member.id }, data: { fcmToken: 'member-token' } });

      const res = await assign(owner, { memberIds: [member.id, coachedMember.id], startDate: start });

      expect(res.status).toBe(201);
      expect(res.body.replaced).toBe(1);
      expect(res.body.assignments).toHaveLength(2);
      expect(res.body.assignments[0]).toMatchObject({ programId: program.id, status: 'active', endDate: null });
      expect(res.body.assignments[0].assignedBy.id).toBe(owner.id);
      expect(res.body.assignments[0].program.title).toBe('Cardio');

      const old = await prisma.programAssignment.findUnique({ where: { id: previous.id } });
      expect(old.status).toBe('completed');

      expect(sendPushNotification).toHaveBeenCalledWith(
        'member-token',
        expect.objectContaining({ data: expect.objectContaining({ type: 'program', programId: String(program.id) }) }),
        member.id
      );
    });

    it('refuse l\'affectation au manager, même dans sa salle', async () => {
      const res = await assign(manager, { memberIds: [member.id], startDate: start });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
      expect(await prisma.programAssignment.count()).toBe(0);
    });

    it('est tout ou rien : 422 avec la liste des refus, rien n\'est créé', async () => {
      const res = await assign(coach, { memberIds: [coachedMember.id, member.id, 999999], startDate: start });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('assignment_rejected');
      expect(res.body.rejected).toEqual([
        { memberId: member.id, reason: 'not_your_member' },
        { memberId: 999999, reason: 'member_not_found' }
      ]);
      expect(await prisma.programAssignment.count()).toBe(0);
    });

    it('le coach n\'affecte qu\'à ses membres', async () => {
      const denied = await assign(coach, { memberIds: [member.id], startDate: start });
      expect(denied.status).toBe(422);
      expect(denied.body.rejected).toEqual([{ memberId: member.id, reason: 'not_your_member' }]);

      const ok = await assign(coach, { memberIds: [coachedMember.id], startDate: start, endDate: '2026-12-31' });
      expect(ok.status).toBe(201);
    });

    it('l\'owner affecte à toute salle', async () => {
      const res = await assign(owner, { memberIds: [otherGymMember.id], startDate: start });
      expect(res.status).toBe(201);
    });

    it('valide memberIds et les dates', async () => {
      expect((await assign(owner, { memberIds: [], startDate: start })).body.error).toBe('member_ids_required');
      expect((await assign(owner, { memberIds: [member.id] })).body.error).toBe('invalid_date');
      expect((await assign(owner, { memberIds: [member.id], startDate: start, endDate: '2026-01-01' })).status).toBe(400);
      expect((await assign(member, { memberIds: [member.id], startDate: start })).status).toBe(403);
    });

    it('DELETE /program-assignments/:id annule avec les mêmes droits', async () => {
      const assignment = await createTestAssignment(program.id, coachedMember.id, owner.id);
      const otherAssignment = await createTestAssignment(program.id, otherGymMember.id, owner.id);

      const denied = await request(app).delete(`/program-assignments/${otherAssignment.id}`).set('Authorization', authHeader(coach));
      expect(denied.status).toBe(403);
      expect(denied.body.error).toBe('not_your_member');

      const managerDenied = await request(app).delete(`/program-assignments/${assignment.id}`).set('Authorization', authHeader(manager));
      expect(managerDenied.status).toBe(403);

      const res = await request(app).delete(`/program-assignments/${assignment.id}`).set('Authorization', authHeader(coach));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');

      const missing = await request(app).delete('/program-assignments/999999').set('Authorization', authHeader(owner));
      expect(missing.status).toBe(404);
    });

    it('GET /members/:id/programs : membre, manager de la salle, son coach, owner', async () => {
      await createTestAssignment(program.id, coachedMember.id, owner.id, { status: 'completed', startDate: new Date('2026-01-01') });
      await createTestAssignment(program.id, coachedMember.id, coach.id);

      for (const user of [coachedMember, manager, coach, owner]) {
        const res = await request(app).get(`/members/${coachedMember.id}/programs`).set('Authorization', authHeader(user));
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
      }

      const active = await request(app).get(`/members/${coachedMember.id}/programs?status=active`).set('Authorization', authHeader(coach));
      expect(active.body).toHaveLength(1);
      expect(active.body[0].program.days[0].exercises[0].exercise.name).toBe('Squat');

      const otherCoach = await createTestCoach([gym.id]);
      for (const user of [member, otherCoach]) {
        const res = await request(app).get(`/members/${coachedMember.id}/programs`).set('Authorization', authHeader(user));
        expect(res.status).toBe(403);
      }
    });
  });
});
