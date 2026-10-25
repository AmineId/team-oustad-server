const request = require('supertest');
const express = require('express');
const gymsRoutes = require('../../routes/gyms');
const usersRoutes = require('../../routes/users');
const authRoutes = require('../../routes/auth');
const {
  cleanDatabase,
  disconnectDatabase,
  createTestGym,
  createTestOwner,
  createTestAdmin,
  createTestMember,
  authHeader
} = require('../helpers/testHelpers');

const app = express();
app.use(express.json());
app.use('/gyms', gymsRoutes);
app.use('/users', usersRoutes);
app.use('/auth', authRoutes);

describe('Permissions fines des owners', () => {
  let gym;

  beforeEach(async () => {
    await cleanDatabase();
    gym = await createTestGym({ name: 'Main Gym' });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('login renvoie les vraies permissions (relation Owner)', async () => {
    await createTestOwner(gym.id, {
      email: 'limited@test.com',
      password: 'owner123',
      canManageAdmins: false,
      canViewReports: false
    });
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'limited@test.com', password: 'owner123' });
    expect(res.status).toBe(200);
    expect(res.body.user.permissions).toMatchObject({
      canManageAdmins: false,
      canManageGyms: true,
      canViewReports: false
    });
  });

  it('canManageGyms : création/suppression/modification de salle', async () => {
    const limited = await createTestOwner(gym.id, { canManageGyms: false });
    const create = await request(app)
      .post('/gyms')
      .set('Authorization', authHeader(limited))
      .send({ name: 'X', address: 'Y' });
    expect(create.status).toBe(403);

    const update = await request(app)
      .put(`/gyms/${gym.id}`)
      .set('Authorization', authHeader(limited))
      .send({ name: 'Renommée' });
    expect(update.status).toBe(403);

    const read = await request(app)
      .get(`/gyms/${gym.id}`)
      .set('Authorization', authHeader(limited));
    expect(read.status).toBe(200);
  });

  it('canViewReports : statistiques globales', async () => {
    const limited = await createTestOwner(gym.id, { canViewReports: false });
    const full = await createTestOwner(gym.id);
    const denied = await request(app)
      .get('/users/stats')
      .set('Authorization', authHeader(limited));
    expect(denied.status).toBe(403);
    const ok = await request(app)
      .get('/users/stats')
      .set('Authorization', authHeader(full));
    expect(ok.status).toBe(200);
  });

  it('canManageAdmins : création et modification d\'admins', async () => {
    const limited = await createTestOwner(gym.id, { canManageAdmins: false });
    const admin = await createTestAdmin(gym.id);
    const member = await createTestMember(gym.id);

    const create = await request(app)
      .post('/users')
      .set('Authorization', authHeader(limited))
      .send({ email: 'new.admin@test.com', firstName: 'A', lastName: 'B', role: 'admin', gymId: gym.id });
    expect(create.status).toBe(403);

    const editAdmin = await request(app)
      .put(`/users/${admin.id}`)
      .set('Authorization', authHeader(limited))
      .send({ firstName: 'Hack' });
    expect(editAdmin.status).toBe(403);

    // Les membres restent gérables
    const editMember = await request(app)
      .put(`/users/${member.id}`)
      .set('Authorization', authHeader(limited))
      .send({ firstName: 'Ok' });
    expect(editMember.status).toBe(200);
  });

  it('un owner ne peut pas modifier ses propres permissions', async () => {
    const limited = await createTestOwner(gym.id, { canManageAdmins: false });
    const res = await request(app)
      .put(`/users/${limited.id}`)
      .set('Authorization', authHeader(limited))
      .send({ permissions: { canManageAdmins: true } });
    expect(res.status).toBe(403);
  });

  it('un admin ne peut pas modifier un owner ou un autre admin de sa salle', async () => {
    const owner = await createTestOwner(gym.id);
    const admin = await createTestAdmin(gym.id);
    const otherAdmin = await createTestAdmin(gym.id);
    for (const target of [owner, otherAdmin]) {
      const res = await request(app)
        .put(`/users/${target.id}`)
        .set('Authorization', authHeader(admin))
        .send({ password: 'hijacked123' });
      expect(res.status).toBe(403);
    }
    const self = await request(app)
      .put(`/users/${admin.id}`)
      .set('Authorization', authHeader(admin))
      .send({ firstName: 'Moi' });
    expect(self.status).toBe(200);
  });
});
