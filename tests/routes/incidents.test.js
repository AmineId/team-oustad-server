const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const {
  cleanDatabase,
  disconnectDatabase,
  createTestGym,
  createTestOwner,
  createTestAdmin,
  createTestCoach,
  createTestMember,
  authHeader,
  prisma
} = require('../helpers/testHelpers');
const { sendPushNotification } = require('../../services/pushNotificationService');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/incidents', require('../../routes/incidents'));

// PNG 1x1
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const kioskHeader = (user) => `Bearer ${jwt.sign(
  { sub: user.id, email: user.email, type: user.role, client: 'kiosk' },
  process.env.JWT_SECRET || 'change_this_secret',
  { expiresIn: '1h' }
)}`;

async function waitForPush(count = 1) {
  for (let i = 0; i < 50 && sendPushNotification.mock.calls.length < count; i++) {
    await new Promise(r => setTimeout(r, 20));
  }
}

describe('Rôles V2 : incidents', () => {
  let gym;
  let otherGym;
  let owner;
  let manager;
  let otherManager;
  let coach;
  let member;

  const base = { title: 'Tapis cassé', description: 'Le tapis 3 ne démarre plus', category: 'equipment', severity: 'high' };

  beforeEach(async () => {
    await cleanDatabase();
    gym = await createTestGym({ name: 'Salle A' });
    otherGym = await createTestGym({ name: 'Salle B' });
    owner = await createTestOwner(gym.id);
    await prisma.user.update({ where: { id: owner.id }, data: { fcmToken: 'owner-token' } });
    manager = await createTestAdmin(gym.id);
    otherManager = await createTestAdmin(otherGym.id);
    coach = await createTestCoach([gym.id, otherGym.id]);
    member = await createTestMember(gym.id);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  const create = (header, body = base) => request(app).post('/incidents').set('Authorization', header).send(body);

  describe('POST /incidents', () => {
    it('le manager signale depuis l\'app pour sa salle ; les owners sont notifiés', async () => {
      const res = await create(authHeader(manager));

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        gymId: gym.id, creatorRole: 'manager', source: 'app', status: 'open',
        title: 'Tapis cassé', category: 'equipment', severity: 'high', hasPhoto: false, messagesCount: 0
      });
      expect(res.body.createdBy).toMatchObject({ id: manager.id, role: 'manager' });
      expect(res.body.gym.name).toBe('Salle A');

      await waitForPush();
      expect(sendPushNotification).toHaveBeenCalledWith(
        'owner-token',
        expect.objectContaining({ data: { type: 'incident', incidentId: String(res.body.id), action: 'created' } }),
        owner.id
      );
    });

    it('déduit source=kiosk du token, jamais du body', async () => {
      const kiosk = await create(kioskHeader(manager), { ...base, source: 'app' });
      expect(kiosk.status).toBe(201);
      expect(kiosk.body.source).toBe('kiosk');

      const app2 = await create(authHeader(manager), { ...base, source: 'kiosk' });
      expect(app2.body.source).toBe('app');
    });

    it('le coach signale pour une de ses salles depuis l\'app, jamais depuis le kiosk', async () => {
      const res = await create(authHeader(coach), { ...base, gymId: otherGym.id });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ gymId: otherGym.id, creatorRole: 'coach' });

      const noGym = await create(authHeader(coach));
      expect(noGym.body.error).toBe('gym_id_required');

      const outside = await createTestGym({ name: 'Salle C' });
      expect((await create(authHeader(coach), { ...base, gymId: outside.id })).status).toBe(403);

      const kiosk = await create(kioskHeader(coach), { ...base, gymId: gym.id });
      expect(kiosk.status).toBe(403);
    });

    it('refuse l\'owner, le membre et le manager sur une autre salle', async () => {
      expect((await create(authHeader(owner))).status).toBe(403);
      expect((await create(authHeader(member))).status).toBe(403);
      expect((await create(authHeader(manager), { ...base, gymId: otherGym.id })).status).toBe(403);
    });

    it('valide les champs', async () => {
      expect((await create(authHeader(manager), { ...base, title: '' })).body.error).toBe('missing_fields');
      expect((await create(authHeader(manager), { ...base, category: 'fire' })).body.error).toBe('invalid_field');
      expect((await create(authHeader(manager), { ...base, severity: 'huge' })).body.error).toBe('invalid_field');
      expect((await create(authHeader(manager), { ...base, photoData: 'not-an-image' })).body.error).toBe('invalid_photo');
    });

    it('accepte une photo en multipart et en data URI, servie par GET /incidents/:id/photo', async () => {
      const multipart = await request(app)
        .post('/incidents')
        .set('Authorization', authHeader(manager))
        .field('title', base.title)
        .field('description', base.description)
        .field('category', base.category)
        .field('severity', base.severity)
        .attach('photo', PNG, { filename: 'tapis.png', contentType: 'image/png' });
      expect(multipart.status).toBe(201);
      expect(multipart.body.hasPhoto).toBe(true);

      const photo = await request(app).get(`/incidents/${multipart.body.id}/photo`).set('Authorization', authHeader(owner));
      expect(photo.status).toBe(200);
      expect(photo.headers['content-type']).toBe('image/png');
      expect(Buffer.compare(photo.body, PNG)).toBe(0);

      const dataUri = await create(authHeader(manager), { ...base, photoData: `data:image/png;base64,${PNG.toString('base64')}` });
      expect(dataUri.body.hasPhoto).toBe(true);

      const noPhoto = await create(authHeader(manager));
      const missing = await request(app).get(`/incidents/${noPhoto.body.id}/photo`).set('Authorization', authHeader(owner));
      expect(missing.status).toBe(404);
    });
  });

  describe('lecture', () => {
    it('owner : tout ; manager : sa salle ; coach : les siens', async () => {
      const byManager = (await create(authHeader(manager))).body;
      const byCoach = (await create(authHeader(coach), { ...base, gymId: gym.id })).body;
      const elsewhere = (await create(authHeader(otherManager))).body;

      const ownerList = await request(app).get('/incidents').set('Authorization', authHeader(owner));
      expect(ownerList.body).toHaveLength(3);

      const mgrList = await request(app).get('/incidents').set('Authorization', authHeader(manager));
      expect(mgrList.body.map(i => i.id).sort()).toEqual([byManager.id, byCoach.id].sort());
      expect((await request(app).get(`/incidents?gymId=${otherGym.id}`).set('Authorization', authHeader(manager))).status).toBe(403);

      const coachList = await request(app).get('/incidents').set('Authorization', authHeader(coach));
      expect(coachList.body.map(i => i.id)).toEqual([byCoach.id]);

      expect((await request(app).get(`/incidents/${byManager.id}`).set('Authorization', authHeader(coach))).status).toBe(403);
      expect((await request(app).get(`/incidents/${elsewhere.id}`).set('Authorization', authHeader(manager))).status).toBe(403);
      expect((await request(app).get('/incidents').set('Authorization', authHeader(member))).status).toBe(403);
    });

    it('filtre par statut', async () => {
      const incident = (await create(authHeader(manager))).body;
      await create(authHeader(manager));
      await prisma.incident.update({ where: { id: incident.id }, data: { status: 'resolved' } });

      const res = await request(app).get('/incidents?status=resolved').set('Authorization', authHeader(owner));
      expect(res.body.map(i => i.id)).toEqual([incident.id]);
      expect((await request(app).get('/incidents?status=bogus').set('Authorization', authHeader(owner))).status).toBe(400);
    });
  });

  describe('fil et statut', () => {
    let incident;

    beforeEach(async () => {
      await prisma.user.update({ where: { id: coach.id }, data: { fcmToken: 'coach-token' } });
      incident = (await create(authHeader(coach), { ...base, gymId: gym.id })).body;
      await waitForPush();
      sendPushNotification.mockClear();
    });

    const post = (user, body) => request(app)
      .post(`/incidents/${incident.id}/messages`).set('Authorization', authHeader(user)).send({ body });

    it('l\'owner répond, le créateur est notifié ; le créateur répond, les owners sont notifiés', async () => {
      const reply = await post(owner, 'On envoie un technicien demain');
      expect(reply.status).toBe(201);
      expect(reply.body).toMatchObject({ incidentId: incident.id, body: 'On envoie un technicien demain' });
      expect(reply.body.author).toMatchObject({ id: owner.id, role: 'owner' });
      await waitForPush();
      expect(sendPushNotification).toHaveBeenCalledWith(
        'coach-token',
        expect.objectContaining({ data: expect.objectContaining({ action: 'message' }) }),
        coach.id
      );

      sendPushNotification.mockClear();
      const answer = await post(coach, 'Merci');
      expect(answer.status).toBe(201);
      await waitForPush();
      expect(sendPushNotification.mock.calls[0][0]).toBe('owner-token');

      const detail = await request(app).get(`/incidents/${incident.id}`).set('Authorization', authHeader(coach));
      expect(detail.body.messages.map(m => m.body)).toEqual(['On envoie un technicien demain', 'Merci']);
      expect(detail.body.messagesCount).toBe(2);
    });

    it('le manager de la salle lit mais ne répond pas s\'il n\'est pas le créateur', async () => {
      expect((await request(app).get(`/incidents/${incident.id}`).set('Authorization', authHeader(manager))).status).toBe(200);
      expect((await post(manager, 'Je regarde')).status).toBe(403);
      expect((await post(owner, '')).body.error).toBe('missing_fields');
    });

    it('seul l\'owner change le statut ; le créateur est notifié ; plus de réponse une fois clôturé', async () => {
      const denied = await request(app).patch(`/incidents/${incident.id}`).set('Authorization', authHeader(coach)).send({ status: 'closed' });
      expect(denied.status).toBe(403);

      const progress = await request(app).patch(`/incidents/${incident.id}`).set('Authorization', authHeader(owner)).send({ status: 'in_progress' });
      expect(progress.status).toBe(200);
      expect(progress.body).toMatchObject({ status: 'in_progress', closedAt: null, closedBy: null });

      const closed = await request(app).patch(`/incidents/${incident.id}`).set('Authorization', authHeader(owner)).send({ status: 'closed' });
      expect(closed.body.status).toBe('closed');
      expect(closed.body.closedAt).not.toBeNull();
      expect(closed.body.closedBy.id).toBe(owner.id);

      await waitForPush(2);
      const actions = sendPushNotification.mock.calls.map(c => [c[0], c[1].data.action]);
      expect(actions).toEqual([['coach-token', 'status'], ['coach-token', 'status']]);

      expect((await post(owner, 'Encore ?')).body.error).toBe('incident_closed');
      expect((await request(app).patch(`/incidents/${incident.id}`).set('Authorization', authHeader(owner)).send({ status: 'done' })).status).toBe(400);
    });
  });
});
