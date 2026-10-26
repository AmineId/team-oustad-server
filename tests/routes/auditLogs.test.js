const request = require('supertest');
const express = require('express');
const {
  cleanDatabase,
  disconnectDatabase,
  createTestGym,
  createTestOwner,
  createTestAdmin,
  createTestMember,
  authHeader,
  prisma
} = require('../helpers/testHelpers');
const { auditContextMiddleware, runAsSystem } = require('../../utils/auditContext');
const { flushAudit, REDACTED } = require('../../utils/audit');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(auditContextMiddleware);
app.use('/users', require('../../routes/users'));
app.use('/incidents', require('../../routes/incidents'));
app.use('/audit-logs', require('../../routes/auditLogs'));

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function entries(where = {}) {
  await flushAudit();
  return prisma.auditLog.findMany({ where, orderBy: { id: 'asc' } });
}

describe('Historique (AuditLog)', () => {
  let gym, otherGym, superOwner, owner, manager, member;

  beforeEach(async () => {
    await cleanDatabase();
    gym = await createTestGym({ name: 'Salle Centre' });
    otherGym = await createTestGym({ name: 'Salle Nord' });
    superOwner = await createTestOwner(gym.id, { isSuperOwner: true, firstName: 'Sam', lastName: 'Super' });
    owner = await createTestOwner(gym.id, { firstName: 'Olga', lastName: 'Owner' });
    manager = await createTestAdmin(gym.id, { firstName: 'Max', lastName: 'Manager' });
    member = await createTestMember(gym.id, { firstName: 'Bob', lastName: 'Martin' });
  });

  afterAll(async () => {
    await flushAudit();
    await cleanDatabase();
    await disconnectDatabase();
  });

  describe('capture des écritures', () => {
    it('ne journalise rien hors contexte (seed, scripts, tests)', async () => {
      expect(await entries()).toHaveLength(0);
    });

    it('journalise une modification : auteur, salle, source et diff', async () => {
      const res = await request(app)
        .put(`/users/${member.id}`)
        .set('Authorization', authHeader(manager))
        .send({ firstName: 'Robert', password: 'nouveau-mdp' });
      expect(res.status).toBe(200);

      const [entry] = await entries({ entity: 'User' });
      expect(entry).toMatchObject({
        action: 'update',
        entity: 'User',
        entityId: String(member.id),
        entityDisplayId: member.displayId,
        label: 'Robert Martin',
        gymId: gym.id,
        actorId: manager.id,
        actorRole: 'manager',
        actorLabel: 'Max Manager',
        source: `PUT /users/${member.id}`,
      });
      expect(entry.changes.firstName).toEqual({ from: 'Bob', to: 'Robert' });
      expect(entry.changes.password).toEqual({ from: REDACTED, to: REDACTED });
      expect(entry.changes.updatedAt).toBeUndefined();
    });

    it('n\'écrit pas d\'entrée quand rien ne change', async () => {
      await request(app).put(`/users/${member.id}`).set('Authorization', authHeader(manager)).send({ firstName: 'Bob' });
      expect(await entries({ entity: 'User' })).toHaveLength(0);
    });

    it('journalise une suppression avec l\'état avant, profil compris', async () => {
      const res = await request(app).delete(`/users/${member.id}`).set('Authorization', authHeader(manager));
      expect(res.status).toBe(200);

      const deleted = await entries({ action: 'delete' });
      const user = deleted.find((e) => e.entity === 'User');
      expect(user.changes.firstName).toEqual({ from: 'Bob', to: null });
      expect(user.changes.uniqueCode).toEqual({ from: REDACTED, to: null });
      const profile = deleted.find((e) => e.entity === 'Member');
      expect(profile).toMatchObject({ entityId: String(member.id), label: 'Bob Martin', gymId: gym.id });
    });

    it('fige les libellés des clés étrangères (fromLabel / toLabel)', async () => {
      const res = await request(app)
        .put(`/users/${manager.id}`)
        .set('Authorization', authHeader(superOwner))
        .send({ gymId: otherGym.id });
      expect(res.status).toBe(200);

      const [entry] = await entries({ entity: 'User' });
      expect(entry.changes.gymId).toEqual({ from: gym.id, to: otherGym.id, fromLabel: 'Salle Centre', toLabel: 'Salle Nord' });
      expect(entry.gymId).toBe(otherGym.id);
    });

    it('garde le contexte à travers un upload multipart et masque les binaires', async () => {
      const res = await request(app)
        .post('/incidents')
        .set('Authorization', authHeader(manager))
        .field('title', 'Tapis cassé')
        .field('description', 'Le tapis 3 ne démarre plus')
        .field('category', 'equipment')
        .field('severity', 'high')
        .attach('photo', PNG, { filename: 'tapis.png', contentType: 'image/png' });
      expect(res.status).toBe(201);

      const [entry] = await entries({ entity: 'Incident' });
      expect(entry).toMatchObject({ action: 'create', label: 'Tapis cassé', gymId: gym.id, actorId: manager.id });
      expect(entry.changes.photo).toEqual({ from: null, to: REDACTED });
    });

    it('attribue au système les écritures des tâches planifiées', async () => {
      await runAsSystem('testJob', () => prisma.gym.update({ where: { id: gym.id }, data: { name: 'Salle Centre-Ville' } }));
      const [entry] = await entries({ entity: 'Gym' });
      expect(entry).toMatchObject({ actorId: null, actorLabel: 'Système (testJob)', source: 'cron:testJob', gymId: gym.id });
      expect(entry.changes.name).toEqual({ from: 'Salle Centre', to: 'Salle Centre-Ville' });
    });

    it('détaille updateMany ligne à ligne, y compris les incréments', async () => {
      await runAsSystem('testJob', () => prisma.gym.updateMany({ where: { id: { in: [gym.id, otherGym.id] } }, data: { phone: '0600000000' } }));
      expect(await entries({ entity: 'Gym', action: 'update' })).toHaveLength(2);

      await runAsSystem('testJob', () => prisma.owner.updateMany({ where: { userId: owner.id }, data: { maxGymsAllowed: { increment: 2 } } }));
      const [entry] = await entries({ entity: 'Owner' });
      expect(entry).toMatchObject({ entityId: String(owner.id), label: 'Olga Owner', gymId: gym.id });
      expect(entry.changes.maxGymsAllowed).toEqual({ from: 10, to: 12 });
    });

    it('résume une opération de masse en une seule entrée', async () => {
      const data = Array.from({ length: 201 }, (_, i) => ({
        displayId: `EXO-T${i}`, name: `Exo ${i}`, category: 'force', difficulty: 'easy',
      }));
      await runAsSystem('testJob', () => prisma.exercise.createMany({ data }));
      const result = await entries({ entity: 'Exercise' });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ action: 'create', label: '201 lignes' });
      expect(result[0].changes._count).toEqual({ from: null, to: 201 });
    });
  });

  describe('protection du super-owner', () => {
    it('un autre owner ne peut ni le modifier ni le supprimer', async () => {
      const put = await request(app).put(`/users/${superOwner.id}`).set('Authorization', authHeader(owner)).send({ firstName: 'X' });
      expect(put.status).toBe(403);
      expect(put.body.error).toBe('super_owner_protected');
      const del = await request(app).delete(`/users/${superOwner.id}`).set('Authorization', authHeader(owner));
      expect(del.status).toBe(403);
      expect(del.body.error).toBe('super_owner_protected');
    });

    it('le super-owner modifie son propre profil', async () => {
      const res = await request(app).put(`/users/${superOwner.id}`).set('Authorization', authHeader(superOwner)).send({ firstName: 'Samuel' });
      expect(res.status).toBe(200);
    });

    it('expose isSuperOwner dans les permissions de GET /users/me', async () => {
      const mine = await request(app).get('/users/me').set('Authorization', authHeader(superOwner));
      const other = await request(app).get('/users/me').set('Authorization', authHeader(owner));
      expect(mine.status).toBe(200);
      expect(mine.body.permissions?.isSuperOwner ?? mine.body.Owner?.isSuperOwner).toBe(true);
      expect(other.body.permissions?.isSuperOwner ?? other.body.Owner?.isSuperOwner).toBe(false);
    });
  });

  describe('GET /audit-logs', () => {
    const list = (user, query = {}) => request(app).get('/audit-logs').query(query).set('Authorization', authHeader(user));

    async function seedEntries() {
      await request(app).put(`/users/${member.id}`).set('Authorization', authHeader(manager)).send({ firstName: 'Robert' });
      await request(app).put(`/users/${member.id}`).set('Authorization', authHeader(superOwner)).send({ lastName: 'Durand' });
      await runAsSystem('testJob', () => prisma.gym.update({ where: { id: otherGym.id }, data: { name: 'Salle Sud' } }));
      await flushAudit();
    }

    it('est réservé au super-owner', async () => {
      for (const user of [owner, manager, member]) {
        const res = await list(user);
        expect(res.status).toBe(403);
      }
      expect((await list(owner)).body.error).toBe('super_owner_required');
      expect((await list(superOwner)).status).toBe(200);
    });

    it('renvoie les entrées les plus récentes d\'abord, avec auteur et salle', async () => {
      await seedEntries();
      const res = await list(superOwner);
      expect(res.status).toBe(200);
      expect(res.body.hasMore).toBe(false);
      expect(res.body.entries.map((e) => e.entity)).toEqual(['Gym', 'User', 'User']);
      const [system, latest] = res.body.entries;
      expect(system.actor).toBeNull();
      expect(system.gym).toEqual({ displayId: otherGym.displayId, name: 'Salle Sud' });
      expect(latest.actor).toEqual({ displayId: superOwner.displayId, firstName: 'Sam', lastName: 'Super', role: 'owner' });
      expect(latest.changes.lastName).toEqual({ from: 'Martin', to: 'Durand' });
    });

    it('filtre par entité, action, auteur, salle, objet, texte et période', async () => {
      await seedEntries();
      const count = async (query) => (await list(superOwner, query)).body.entries.length;
      expect(await count({ entity: 'Gym' })).toBe(1);
      expect(await count({ action: 'update' })).toBe(3);
      expect(await count({ action: 'delete' })).toBe(0);
      expect(await count({ actorId: manager.displayId })).toBe(1);
      expect(await count({ actorId: 'USR-INCONNU' })).toBe(0);
      expect(await count({ gymId: gym.displayId })).toBe(2);
      expect(await count({ entityId: member.displayId })).toBe(2);
      expect(await count({ entityId: String(member.id) })).toBe(2);
      expect(await count({ q: 'durand' })).toBe(1);
      expect(await count({ q: 'max manager' })).toBe(1);
      expect(await count({ from: new Date(Date.now() + 60000).toISOString() })).toBe(0);
      expect(await count({ to: new Date(Date.now() + 60000).toISOString() })).toBe(3);
    });

    it('pagine avec before et limit', async () => {
      await seedEntries();
      const first = await list(superOwner, { limit: 2 });
      expect(first.body.entries).toHaveLength(2);
      expect(first.body.hasMore).toBe(true);
      const next = await list(superOwner, { limit: 2, before: first.body.entries[1].id });
      expect(next.body.entries).toHaveLength(1);
      expect(next.body.hasMore).toBe(false);
      expect((await list(superOwner, { limit: 500 })).body.entries).toHaveLength(3);
    });

    it('valide les paramètres', async () => {
      const error = async (query) => (await list(superOwner, query)).body.error;
      expect(await error({ entity: 'Nope' })).toBe('invalid_entity');
      expect(await error({ action: 'read' })).toBe('invalid_action');
      expect(await error({ from: 'hier' })).toBe('invalid_date');
      expect(await error({ before: 'abc' })).toBe('invalid_cursor');
      expect(await error({ limit: 0 })).toBe('invalid_limit');
    });

    it('GET /audit-logs/meta et GET /audit-logs/:id', async () => {
      await seedEntries();
      const meta = await request(app).get('/audit-logs/meta').set('Authorization', authHeader(superOwner));
      expect(meta.body.actions).toEqual(['create', 'update', 'delete']);
      expect(meta.body.entities).toEqual(expect.arrayContaining(['User', 'Gym', 'Subscription']));
      expect(meta.body.entities).not.toContain('AuditLog');

      const [entry] = (await list(superOwner)).body.entries;
      const one = await request(app).get(`/audit-logs/${entry.id}`).set('Authorization', authHeader(superOwner));
      expect(one.body).toEqual(entry);
      expect((await request(app).get('/audit-logs/999999').set('Authorization', authHeader(superOwner))).status).toBe(404);
      expect((await request(app).get('/audit-logs/abc').set('Authorization', authHeader(superOwner))).body.error).toBe('invalid_id');
    });
  });
});
