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
  createTestSubscriptionType,
  createTestSubscription,
  authHeader,
  prisma
} = require('../helpers/testHelpers');
const { sendPushNotification } = require('../../services/pushNotificationService');
const { sendSessionReminders, closePastSessions } = require('../../jobs/sessionReminder');

const app = express();
app.use(express.json());
app.use('/sessions', require('../../routes/sessions'));
app.use('/coaches', require('../../routes/coaches'));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Créneau futur à heure ronde : J+days à `hourUtc`h UTC, durée `hours`. */
function slot(days, hourUtc, hours = 1) {
  const start = new Date(Date.now() + days * DAY);
  start.setUTCHours(hourUtc, 0, 0, 0);
  return { startAt: start.toISOString(), endAt: new Date(start.getTime() + hours * HOUR).toISOString() };
}

describe('Rôles V2 : séances', () => {
  let gym;
  let otherGym;
  let owner;
  let manager;
  let otherManager;
  let coach;
  let coach2;
  let member;
  let member2;
  let noSubMember;
  let subType;

  beforeEach(async () => {
    await cleanDatabase();
    gym = await createTestGym({ name: 'Salle A' });
    otherGym = await createTestGym({ name: 'Salle B' });
    owner = await createTestOwner(gym.id);
    manager = await createTestAdmin(gym.id);
    otherManager = await createTestAdmin(otherGym.id);
    coach = await createTestCoach([gym.id, otherGym.id]);
    coach2 = await createTestCoach([gym.id]);
    member = await createTestMember(gym.id);
    member2 = await createTestMember(gym.id);
    noSubMember = await createTestMember(gym.id);
    subType = await createTestSubscriptionType();
    await createTestSubscription(member.id, subType.id);
    await createTestSubscription(member2.id, subType.id);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  const create = (user, body) => request(app).post('/sessions').set('Authorization', authHeader(user)).send({ type: 'training', ...body });
  const createOne = async (body = {}) => {
    const res = await create(manager, { gymId: gym.id, coachId: coach.id, capacity: 2, title: 'Cross', ...slot(2, 9), ...body });
    expect(res.status).toBe(201);
    return res.body.sessions[0];
  };

  describe('POST /sessions', () => {
    it('le manager crée une séance pour un coach de sa salle', async () => {
      const res = await create(manager, { gymId: gym.id, coachId: coach.id, capacity: 3, title: 'HIIT', type: 'group_class', ...slot(1, 9) });

      expect(res.status).toBe(201);
      expect(res.body.sessions).toHaveLength(1);
      expect(res.body.sessions[0]).toMatchObject({
        gymId: gym.id, coachId: coach.id, capacity: 3, title: 'HIIT', type: 'group_class',
        status: 'scheduled', seriesId: null, bookedCount: 0, remaining: 3, members: []
      });
      expect(res.body.sessions[0].coach.id).toBe(coach.id);
      expect(res.body.sessions[0].gym.name).toBe('Salle A');
      expect(res.body.sessions[0].createdBy.id).toBe(manager.id);
    });

    it('exige un type de séance valide', async () => {
      const base = { gymId: gym.id, coachId: coach.id, ...slot(1, 9) };
      const missing = await request(app).post('/sessions').set('Authorization', authHeader(manager)).send(base);
      expect(missing.status).toBe(400);
      expect(missing.body.error).toBe('invalid_type');

      const invalid = await create(manager, { ...base, type: 'yoga' });
      expect(invalid.status).toBe(400);
      expect(invalid.body.error).toBe('invalid_type');
    });

    it('filtre les listes par type et permet de le modifier', async () => {
      const discovery = await createOne({ type: 'discovery', ...slot(2, 9) });
      const training = await createOne({ type: 'training', ...slot(2, 11) });
      const range = `from=${encodeURIComponent(slot(0, 0).startAt)}`;

      const list = await request(app).get(`/sessions?type=discovery&${range}`).set('Authorization', authHeader(manager));
      expect(list.status).toBe(200);
      expect(list.body.map(s => s.id)).toEqual([discovery.id]);

      const available = await request(app).get(`/sessions/available?gymId=${gym.id}&type=training&${range}`).set('Authorization', authHeader(manager));
      expect(available.body.map(s => s.id)).toEqual([training.id]);

      const mine = await request(app).get(`/coaches/me/sessions?type=discovery&${range}`).set('Authorization', authHeader(coach));
      expect(mine.body.map(s => s.id)).toEqual([discovery.id]);

      expect((await request(app).get('/sessions?type=yoga').set('Authorization', authHeader(manager))).body.error).toBe('invalid_type');

      const updated = await request(app).patch(`/sessions/${training.id}`).set('Authorization', authHeader(manager)).send({ type: 'assessment' });
      expect(updated.status).toBe(200);
      expect(updated.body.sessions[0].type).toBe('assessment');
      const bad = await request(app).patch(`/sessions/${training.id}`).set('Authorization', authHeader(manager)).send({ type: null });
      expect(bad.body.error).toBe('invalid_type');
    });

    it('refuse un chevauchement du même coach (409 avec la séance en conflit)', async () => {
      const first = await createOne(slot(2, 9, 2));
      const res = await create(manager, { gymId: gym.id, coachId: coach.id, ...slot(2, 10) });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('session_overlap');
      expect(res.body.conflicts.map(c => c.id)).toEqual([first.id]);

      // Bord à bord : autorisé
      const adjacent = await create(manager, { gymId: gym.id, coachId: coach.id, ...slot(2, 11) });
      expect(adjacent.status).toBe(201);
    });

    it('détecte le chevauchement même dans une autre salle du coach', async () => {
      await createOne();
      const res = await create(owner, { gymId: otherGym.id, coachId: coach.id, ...slot(2, 9) });
      expect(res.status).toBe(409);
    });

    it('crée une série hebdomadaire en tout ou rien', async () => {
      const base = slot(1, 9);
      const until = new Date(new Date(base.startAt).getTime() + 3 * 7 * DAY).toISOString();
      const res = await create(manager, { gymId: gym.id, coachId: coach.id, ...base, repeat: { weekly: true, until } });

      expect(res.status).toBe(201);
      expect(res.body.sessions).toHaveLength(4);
      const seriesId = res.body.sessions[0].seriesId;
      expect(seriesId).toMatch(/^SERIES-/);
      expect(res.body.sessions.every(s => s.seriesId === seriesId)).toBe(true);

      // Une occurrence en conflit (semaine 3) : rien n'est créé
      const blocker = new Date(new Date(base.startAt).getTime() + 2 * 7 * DAY);
      await create(manager, { gymId: gym.id, coachId: coach2.id, startAt: blocker.toISOString(), endAt: new Date(blocker.getTime() + HOUR).toISOString() });
      const before = await prisma.trainingSession.count({ where: { coachId: coach2.id } });
      const conflict = await create(manager, {
        gymId: gym.id, coachId: coach2.id, ...base, repeat: { weekly: true, until }
      });
      expect(conflict.status).toBe(409);
      expect(await prisma.trainingSession.count({ where: { coachId: coach2.id } })).toBe(before);
    });

    it('limite une série à 26 séances', async () => {
      const base = slot(1, 9);
      const until = new Date(new Date(base.startAt).getTime() + 40 * 7 * DAY).toISOString();
      const res = await create(manager, { gymId: gym.id, coachId: coach.id, ...base, repeat: { weekly: true, until } });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('too_many_occurrences');
    });

    it('respecte les horaires d\'ouverture quand ils sont définis', async () => {
      const s = slot(3, 9); // 10:00 heure du Maroc
      const weekday = new Date(new Date(s.startAt).getTime() + HOUR).getUTCDay();
      await prisma.openingHour.create({ data: { gymId: gym.id, dayOfWeek: weekday, openTime: '11:00', closeTime: '20:00' } });

      const res = await create(manager, { gymId: gym.id, coachId: coach.id, ...s });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('outside_opening_hours');

      await prisma.openingHour.updateMany({ where: { gymId: gym.id }, data: { isClosed: true } });
      const closed = await create(manager, { gymId: gym.id, coachId: coach.id, ...s });
      expect(closed.body.error).toBe('gym_closed');
    });

    it('valide le coach, la salle, les dates et la capacité', async () => {
      const outsider = await createTestCoach([otherGym.id]);
      expect((await create(manager, { gymId: gym.id, coachId: outsider.id, ...slot(1, 9) })).body.error).toBe('coach_not_in_gym');
      expect((await create(manager, { gymId: otherGym.id, coachId: coach.id, ...slot(1, 9) })).status).toBe(403);
      const s = slot(1, 9);
      expect((await create(manager, { gymId: gym.id, coachId: coach.id, startAt: s.endAt, endAt: s.startAt })).body.error).toBe('invalid_time_range');
      expect((await create(manager, { gymId: gym.id, coachId: coach.id, capacity: 0, ...s })).body.error).toBe('invalid_capacity');
      expect((await create(coach, { gymId: gym.id, coachId: coach.id, ...s })).status).toBe(403);
      expect((await create(member, { gymId: gym.id, coachId: coach.id, ...s })).status).toBe(403);
    });

    it('notifie le coach de la séance affectée', async () => {
      await prisma.user.update({ where: { id: coach.id }, data: { fcmToken: 'coach-token' } });
      await createOne();
      // La notification part après la réponse
      for (let i = 0; i < 50 && sendPushNotification.mock.calls.length === 0; i++) {
        await new Promise(r => setTimeout(r, 20));
      }
      expect(sendPushNotification).toHaveBeenCalledWith(
        'coach-token',
        expect.objectContaining({ data: expect.objectContaining({ type: 'session', action: 'assigned' }) }),
        coach.id
      );
    });
  });

  describe('PATCH / DELETE', () => {
    it('décale toute la série et revérifie les chevauchements', async () => {
      const base = slot(1, 9);
      const until = new Date(new Date(base.startAt).getTime() + 2 * 7 * DAY).toISOString();
      const { body } = await create(manager, { gymId: gym.id, coachId: coach.id, ...base, repeat: { weekly: true, until } });
      const [first, second] = body.sessions;

      const newStart = new Date(new Date(second.startAt).getTime() + HOUR);
      const res = await request(app)
        .patch(`/sessions/${second.id}?scope=following`)
        .set('Authorization', authHeader(manager))
        .send({ startAt: newStart.toISOString(), endAt: new Date(newStart.getTime() + HOUR).toISOString(), title: 'Décalée' });

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(2);
      expect(res.body.sessions.every(s => s.title === 'Décalée')).toBe(true);
      const untouched = await prisma.trainingSession.findUnique({ where: { id: first.id } });
      expect(untouched.startAt.toISOString()).toBe(first.startAt);
      expect(untouched.title).toBeNull();

      // Changer de coach vers un coach occupé : 409
      await create(manager, { gymId: gym.id, coachId: coach2.id, ...base });
      const busy = await request(app)
        .patch(`/sessions/${first.id}`)
        .set('Authorization', authHeader(manager))
        .send({ coachId: coach2.id });
      expect(busy.status).toBe(409);
    });

    it('refuse une capacité inférieure au nombre d\'inscrits', async () => {
      const session = await createOne();
      await request(app).post(`/sessions/${session.id}/members`).set('Authorization', authHeader(manager)).send({ memberIds: [member.id, member2.id] });
      const res = await request(app).patch(`/sessions/${session.id}`).set('Authorization', authHeader(manager)).send({ capacity: 1 });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('capacity_below_booked');
    });

    it('DELETE annule (historique conservé) et le manager d\'une autre salle est refusé', async () => {
      const session = await createOne();
      const denied = await request(app).delete(`/sessions/${session.id}`).set('Authorization', authHeader(otherManager));
      expect(denied.status).toBe(403);

      const res = await request(app).delete(`/sessions/${session.id}`).set('Authorization', authHeader(manager));
      expect(res.status).toBe(200);
      expect(res.body.sessions[0].status).toBe('cancelled');

      // Le créneau est de nouveau libre
      const again = await create(manager, { gymId: gym.id, coachId: coach.id, startAt: session.startAt, endAt: session.endAt });
      expect(again.status).toBe(201);
    });
  });

  describe('lecture', () => {
    it('GET /sessions : manager limité à sa salle, filtres coach et dates', async () => {
      await createOne();
      await create(owner, { gymId: otherGym.id, coachId: coach.id, ...slot(3, 9) });

      const mine = await request(app).get('/sessions').set('Authorization', authHeader(manager));
      expect(mine.status).toBe(200);
      expect(mine.body).toHaveLength(1);

      const other = await request(app).get(`/sessions?gymId=${otherGym.id}`).set('Authorization', authHeader(manager));
      expect(other.status).toBe(403);

      const all = await request(app).get(`/sessions?coachId=${coach.id}`).set('Authorization', authHeader(owner));
      expect(all.body).toHaveLength(2);

      const far = await request(app).get('/sessions?from=2026-01-01&to=2026-12-31').set('Authorization', authHeader(owner));
      expect(far.body.error).toBe('range_too_large');
    });

    it('GET /coaches/me/sessions et GET /sessions/:id pour le coach', async () => {
      const session = await createOne();
      await create(owner, { gymId: otherGym.id, coachId: coach.id, ...slot(3, 9) });
      const foreign = (await create(manager, { gymId: gym.id, coachId: coach2.id, ...slot(2, 9) })).body.sessions[0];

      const list = await request(app).get('/coaches/me/sessions').set('Authorization', authHeader(coach));
      expect(list.status).toBe(200);
      expect(list.body.map(s => s.gymId).sort()).toEqual([gym.id, otherGym.id].sort());

      const own = await request(app).get(`/sessions/${session.id}`).set('Authorization', authHeader(coach));
      expect(own.status).toBe(200);
      const denied = await request(app).get(`/sessions/${foreign.id}`).set('Authorization', authHeader(coach));
      expect(denied.status).toBe(403);
    });
  });

  describe('inscriptions', () => {
    let session;
    const add = (memberIds, user = manager) => request(app)
      .post(`/sessions/${session.id}/members`).set('Authorization', authHeader(user)).send({ memberIds });

    beforeEach(async () => {
      session = await createOne();
    });

    it('inscrit des membres et calcule les places restantes', async () => {
      const res = await add([member.id]);
      expect(res.status).toBe(200);
      expect(res.body.bookedCount).toBe(1);
      expect(res.body.remaining).toBe(1);
      expect(res.body.members[0]).toMatchObject({ memberId: member.id, status: 'booked' });
      expect(res.body.members[0].member.firstName).toBe(member.firstName);
    });

    it('refuse en tout ou rien (422) : sans abonnement, autre salle, déjà inscrit', async () => {
      const foreign = await createTestMember(otherGym.id);
      await add([member.id]);
      const res = await add([member.id, member2.id, noSubMember.id, foreign.id, 999999]);

      expect(res.status).toBe(422);
      expect(res.body.rejected).toEqual([
        { memberId: member.id, reason: 'already_booked' },
        { memberId: noSubMember.id, reason: 'no_active_subscription' },
        { memberId: foreign.id, reason: 'member_other_gym' },
        { memberId: 999999, reason: 'member_not_found' }
      ]);
      const count = await prisma.trainingSessionMember.count({ where: { sessionId: session.id } });
      expect(count).toBe(1);
    });

    it('refuse si la capacité ne suffit pas (409 session_full)', async () => {
      const third = await createTestMember(gym.id);
      await createTestSubscription(third.id, subType.id);
      const res = await add([member.id, member2.id, third.id]);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: 'session_full', remaining: 2 });
    });

    it('refuse un membre déjà inscrit à une séance qui chevauche', async () => {
      await add([member.id]);
      const overlapping = (await create(manager, {
        gymId: gym.id, coachId: coach2.id, startAt: session.startAt, endAt: session.endAt
      })).body.sessions[0];
      const res = await request(app)
        .post(`/sessions/${overlapping.id}/members`).set('Authorization', authHeader(manager)).send({ memberIds: [member.id] });
      expect(res.status).toBe(422);
      expect(res.body.rejected).toEqual([{ memberId: member.id, reason: 'member_overlap' }]);
    });

    it('désinscrit un membre puis permet de le réinscrire', async () => {
      await add([member.id]);
      const removed = await request(app).delete(`/sessions/${session.id}/members/${member.id}`).set('Authorization', authHeader(manager));
      expect(removed.status).toBe(200);
      expect(removed.body.remaining).toBe(2);
      expect(removed.body.members[0].status).toBe('cancelled');

      const again = await add([member.id]);
      expect(again.status).toBe(200);
      expect(again.body.members[0].status).toBe('booked');
    });

    it('refuse le coach et une séance annulée', async () => {
      expect((await add([member.id], coach)).status).toBe(403);
      await prisma.trainingSession.update({ where: { id: session.id }, data: { status: 'cancelled' } });
      expect((await add([member.id])).body.error).toBe('session_not_open');
    });
  });

  describe('GET /sessions/available', () => {
    it('renvoie les séances avec places, sans chevauchement pour le membre, coach du membre d\'abord', async () => {
      await prisma.member.update({ where: { userId: member.id }, data: { coachId: coach2.id } });
      const early = await createOne({ ...slot(2, 8) });
      const late = (await create(manager, { gymId: gym.id, coachId: coach2.id, capacity: 1, ...slot(3, 9) })).body.sessions[0];
      const full = (await create(manager, { gymId: gym.id, coachId: coach2.id, capacity: 1, ...slot(4, 9) })).body.sessions[0];
      await request(app).post(`/sessions/${full.id}/members`).set('Authorization', authHeader(manager)).send({ memberIds: [member2.id] });
      const booked = await createOne({ ...slot(5, 9) });
      await request(app).post(`/sessions/${booked.id}/members`).set('Authorization', authHeader(manager)).send({ memberIds: [member.id] });

      const res = await request(app)
        .get(`/sessions/available?memberId=${member.id}`)
        .set('Authorization', authHeader(manager));

      expect(res.status).toBe(200);
      expect(res.body.map(s => s.id)).toEqual([late.id, early.id]);
      expect(res.body[0].isMemberCoach).toBe(true);
      expect(res.body[1].isMemberCoach).toBe(false);
    });

    it('exige gymId pour l\'owner', async () => {
      const res = await request(app).get('/sessions/available').set('Authorization', authHeader(owner));
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('gym_id_required');
    });
  });

  describe('POST /sessions/:id/check-in', () => {
    let session;

    beforeEach(async () => {
      session = await createOne();
      await request(app).post(`/sessions/${session.id}/members`).set('Authorization', authHeader(manager)).send({ memberIds: [member.id] });
    });

    const checkIn = (user, memberId = member.id) => request(app)
      .post(`/sessions/${session.id}/check-in`).set('Authorization', authHeader(user)).send({ memberId });

    it('le coach pointe le membre : entrée salle créée et quota décompté, une fois par jour', async () => {
      await prisma.subscription.updateMany({ where: { memberId: member.id }, data: { sessionQuota: 10, sessionsUsed: 2 } });

      const res = await checkIn(coach);
      expect(res.status).toBe(200);
      expect(res.body.member).toMatchObject({ memberId: member.id, status: 'checked_in' });
      expect(res.body.gymCheckIn).toMatchObject({ created: true, sessionsRemaining: 7 });

      const sub = await prisma.subscription.findFirst({ where: { memberId: member.id } });
      expect(sub.sessionsUsed).toBe(3);

      // Rappel : idempotent
      const again = await checkIn(coach);
      expect(again.status).toBe(200);
      expect(again.body.gymCheckIn.created).toBe(false);
      expect(await prisma.gymCheckIn.count({ where: { memberId: member.id } })).toBe(1);
    });

    it('ne décompte rien si le membre a déjà scanné aujourd\'hui', async () => {
      const sub = await prisma.subscription.findFirst({ where: { memberId: member.id } });
      await prisma.gymCheckIn.create({ data: { displayId: `CHECKIN-${Date.now()}`, memberId: member.id, subscriptionId: sub.id, gymId: gym.id } });

      const res = await checkIn(manager);
      expect(res.status).toBe(200);
      expect(res.body.gymCheckIn.created).toBe(false);
      expect(await prisma.gymCheckIn.count({ where: { memberId: member.id } })).toBe(1);
    });

    it('refuse si le quota est épuisé, sans pointer', async () => {
      await prisma.subscription.updateMany({ where: { memberId: member.id }, data: { sessionQuota: 5, sessionsUsed: 5 } });
      const res = await checkIn(coach);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('quota_exhausted');
      const entry = await prisma.trainingSessionMember.findFirst({ where: { sessionId: session.id, memberId: member.id } });
      expect(entry.status).toBe('booked');
    });

    it('refuse un membre non inscrit, un autre coach et un membre', async () => {
      expect((await checkIn(coach, member2.id)).body.error).toBe('member_not_in_session');
      expect((await checkIn(coach2)).status).toBe(403);
      expect((await checkIn(member)).status).toBe(403);
    });
  });

  describe('jobs', () => {
    it('envoie le rappel une seule fois aux inscrits', async () => {
      const start = new Date(Date.now() + HOUR);
      const session = (await create(manager, {
        gymId: gym.id, coachId: coach.id, startAt: start.toISOString(), endAt: new Date(start.getTime() + HOUR).toISOString()
      })).body.sessions[0];
      await request(app).post(`/sessions/${session.id}/members`).set('Authorization', authHeader(manager)).send({ memberIds: [member.id] });
      await prisma.user.update({ where: { id: member.id }, data: { fcmToken: 'member-token' } });
      sendPushNotification.mockClear();

      expect((await sendSessionReminders()).sent).toBe(1);
      expect(sendPushNotification).toHaveBeenCalledWith(
        'member-token',
        expect.objectContaining({ data: expect.objectContaining({ action: 'reminder' }) }),
        member.id
      );
      expect((await sendSessionReminders()).sent).toBe(0);
    });

    it('clôture les séances passées et marque les non pointés absents', async () => {
      const session = await createOne();
      await request(app).post(`/sessions/${session.id}/members`).set('Authorization', authHeader(manager)).send({ memberIds: [member.id] });

      const result = await closePastSessions(new Date(Date.now() + 10 * DAY));
      expect(result).toEqual({ closed: 1, absent: 1 });
      const entry = await prisma.trainingSessionMember.findFirst({ where: { sessionId: session.id } });
      expect(entry.status).toBe('absent');
    });
  });
});
