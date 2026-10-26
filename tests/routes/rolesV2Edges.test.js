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
  createTestProgram,
  createTestAssignment,
  createTestExercise,
  authHeader,
  prisma
} = require('../helpers/testHelpers');
const programService = require('../../services/programService');

const app = express();
app.use(express.json());
app.use('/sessions', require('../../routes/sessions'));
app.use('/incidents', require('../../routes/incidents'));
app.use('/programs', require('../../routes/programs'));
app.use('/members', require('../../routes/members'));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function slot(days, hourUtc, hours = 1) {
  const start = new Date(Date.now() + days * DAY);
  start.setUTCHours(hourUtc, 0, 0, 0);
  return { startAt: start.toISOString(), endAt: new Date(start.getTime() + hours * HOUR).toISOString() };
}

/** Cas limites et validations des routes Rôles V2 (séances, incidents, programmes). */
describe('Rôles V2 : cas limites', () => {
  let gym;
  let otherGym;
  let owner;
  let manager;
  let otherManager;
  let coach;
  let member;

  beforeEach(async () => {
    await cleanDatabase();
    gym = await createTestGym({ name: 'Salle A' });
    otherGym = await createTestGym({ name: 'Salle B' });
    owner = await createTestOwner(gym.id);
    manager = await createTestAdmin(gym.id);
    otherManager = await createTestAdmin(otherGym.id);
    coach = await createTestCoach([gym.id]);
    member = await createTestMember(gym.id);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  describe('séances', () => {
    const create = (user, body) => request(app).post('/sessions').set('Authorization', authHeader(user))
      .send({ gymId: gym.id, coachId: coach.id, type: 'training', ...slot(3, 9), ...body });

    it('valide les champs de création', async () => {
      const cases = [
        [{ gymId: 'x' }, 'missing_fields'],
        [{ startAt: 'pas une date' }, 'invalid_date'],
        [slot(3, 9, 25), 'invalid_time_range'],
        [{ capacity: 0 }, 'invalid_capacity'],
        [{ coachId: member.id }, 'coach_not_found'],
        [{ repeat: { weekly: false } }, 'invalid_repeat']
      ];
      for (const [body, error] of cases) {
        const res = await create(manager, body);
        expect([res.status, res.body.error]).toEqual([error === 'coach_not_found' ? 404 : 400, error]);
      }
    });

    it('modifie titre, notes et capacité ; refuse un scope inconnu et une séance annulée', async () => {
      const session = (await create(manager, {})).body.sessions[0];
      const patch = (body, qs = '') => request(app).patch(`/sessions/${session.id}${qs}`)
        .set('Authorization', authHeader(manager)).send(body);

      const updated = await patch({ title: 'Cardio', notes: 'Apporter une serviette', capacity: 4 });
      expect(updated.status).toBe(200);
      expect(updated.body.sessions[0]).toMatchObject({ title: 'Cardio', notes: 'Apporter une serviette', capacity: 4 });
      expect((await patch({ title: '' })).body.sessions[0].title).toBeNull();

      expect((await patch({}, '?scope=all')).body.error).toBe('invalid_scope');

      await request(app).delete(`/sessions/${session.id}`).set('Authorization', authHeader(manager));
      const closed = await patch({ title: 'Trop tard' });
      expect([closed.status, closed.body.error]).toEqual([409, 'session_not_open']);
    });

    it('lit avec filtres et contrôle la portée', async () => {
      const session = (await create(manager, {})).body.sessions[0];
      const from = encodeURIComponent(slot(0, 0).startAt);

      const ownerList = await request(app).get(`/sessions?gymId=${gym.id}&status=scheduled&from=${from}`)
        .set('Authorization', authHeader(owner));
      expect(ownerList.body.map(s => s.id)).toEqual([session.id]);

      const reversed = await request(app).get(`/sessions?from=${encodeURIComponent(slot(5, 0).startAt)}&to=${from}`)
        .set('Authorization', authHeader(owner));
      expect(reversed.body.error).toBe('invalid_time_range');

      expect((await request(app).get('/sessions/999999').set('Authorization', authHeader(owner))).status).toBe(404);

      const foreign = await request(app).get(`/sessions/available?gymId=${gym.id}`).set('Authorization', authHeader(otherManager));
      expect(foreign.status).toBe(403);

      const byCoach = await request(app).get(`/sessions/available?gymId=${gym.id}&coachId=${coach.id}&from=${from}`)
        .set('Authorization', authHeader(owner));
      expect(byCoach.body.map(s => s.id)).toEqual([session.id]);

      const unknownMember = await request(app).get(`/sessions/available?gymId=${gym.id}&memberId=999999`)
        .set('Authorization', authHeader(owner));
      expect(unknownMember.body.error).toBe('member_not_found');
    });

    it('valide les inscriptions et le pointage', async () => {
      const session = (await create(manager, {})).body.sessions[0];
      const book = await request(app).post(`/sessions/${session.id}/members`)
        .set('Authorization', authHeader(manager)).send({ memberIds: [] });
      expect(book.body.error).toBe('member_ids_required');

      const checkIn = await request(app).post(`/sessions/${session.id}/check-in`)
        .set('Authorization', authHeader(coach)).send({});
      expect(checkIn.body.error).toBe('member_id_required');
    });
  });

  describe('incidents', () => {
    const base = { title: 'Fuite', description: 'Fuite d\'eau vestiaire', category: 'hygiene', severity: 'medium' };

    it('valide titre et photo', async () => {
      const tooLong = await request(app).post('/incidents').set('Authorization', authHeader(manager))
        .send({ ...base, title: 'x'.repeat(201) });
      expect(tooLong.body.error).toBe('invalid_field');

      const notImage = await request(app).post('/incidents').set('Authorization', authHeader(manager))
        .field('title', base.title).field('description', base.description)
        .field('category', base.category).field('severity', base.severity)
        .attach('photo', Buffer.from('texte'), { filename: 'note.txt', contentType: 'text/plain' });
      expect(notImage.body.error).toBe('invalid_photo');

      const badUri = await request(app).post('/incidents').set('Authorization', authHeader(manager))
        .send({ ...base, photoData: 'data:text/plain;base64,AAAA' });
      expect(badUri.body.error).toBe('invalid_photo');
    });

    it('filtre par salle, 404 inconnu, lecture d\'un fil vide', async () => {
      const incident = (await request(app).post('/incidents').set('Authorization', authHeader(coach))
        .send({ ...base, gymId: gym.id })).body;

      const ownerOther = await request(app).get(`/incidents?gymId=${otherGym.id}`).set('Authorization', authHeader(owner));
      expect(ownerOther.body).toEqual([]);
      const coachMine = await request(app).get(`/incidents?gymId=${gym.id}`).set('Authorization', authHeader(coach));
      expect(coachMine.body.map(i => i.id)).toEqual([incident.id]);
      expect(coachMine.body[0]).toMatchObject({ unreadCount: 0, lastMessage: null });

      expect((await request(app).get('/incidents/999999').set('Authorization', authHeader(owner))).status).toBe(404);
      expect((await request(app).get('/incidents/abc').set('Authorization', authHeader(owner))).body.error).toBe('invalid_id');

      const read = await request(app).post(`/incidents/${incident.id}/read`).set('Authorization', authHeader(coach));
      expect(read.body).toEqual({ incidentId: incident.id, lastReadMessageId: 0, unreadCount: 0 });

      const empty = await request(app).get(`/incidents/${incident.id}/messages`).set('Authorization', authHeader(owner));
      expect(empty.body).toEqual({ messages: [], hasMore: false });
    });
  });

  describe('programmes', () => {
    it('recherche, valide les jours et refuse les exercices inconnus', async () => {
      await createTestProgram(owner.id, { title: 'Force débutant' });
      await createTestProgram(owner.id, { title: 'Cardio' });
      const found = await request(app).get('/programs?search=force').set('Authorization', authHeader(coach));
      expect(found.body.map(p => p.title)).toEqual(['Force débutant']);

      const post = (body) => request(app).post('/programs').set('Authorization', authHeader(owner)).send(body);
      expect((await post({ title: 'X', days: 'lundi' })).body.error).toBe('invalid_days');
      expect((await post({ title: 'X', days: [{ dayOfWeek: 1, exercises: [{ exerciseId: 999999 }] }] })).body.error)
        .toBe('exercise_not_found');
      const exercise = await createTestExercise();
      expect((await post({ title: 'X', days: [{ dayOfWeek: 1, exercises: [{ exerciseId: exercise.id, weight: -2 }] }] })).body.error)
        .toBe('invalid_field');

      const ok = await post({ title: 'Complet', description: '', level: 'beginner', durationWeeks: 4 });
      expect(ok.status).toBe(201);
      expect(ok.body).toMatchObject({ description: null, level: 'beginner', durationWeeks: 4 });
    });

    it('le service refuse aussi le manager (défense en profondeur)', async () => {
      const program = await createTestProgram(owner.id);
      const managerUser = await prisma.user.findUnique({ where: { id: manager.id } });

      await expect(programService.assignProgram(program.id, { memberIds: [member.id], startDate: '2026-11-01' }, managerUser))
        .rejects.toMatchObject({ status: 422, extra: { rejected: [{ memberId: member.id, reason: 'forbidden' }] } });

      const assignment = await createTestAssignment(program.id, member.id, owner.id);
      await expect(programService.cancelAssignment(assignment.id, managerUser)).rejects.toMatchObject({ status: 403 });
    });

    it('GET /members/:id/programs filtre par statut et valide le statut', async () => {
      const program = await createTestProgram(owner.id);
      await createTestAssignment(program.id, member.id, owner.id, { status: 'cancelled' });
      const get = (qs) => request(app).get(`/members/${member.id}/programs${qs}`).set('Authorization', authHeader(manager));

      expect((await get('?status=active')).body).toHaveLength(0);
      expect((await get('?status=cancelled')).body).toHaveLength(1);
      expect((await get('?status=nope')).body.error).toBe('invalid_status');
      expect((await request(app).get('/members/999999/programs').set('Authorization', authHeader(owner))).status).toBe(404);
    });
  });
});
