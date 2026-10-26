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
  authHeader,
  prisma
} = require('../helpers/testHelpers');

const app = express();
app.use(express.json());
app.use('/auth', require('../../routes/auth'));
app.use('/users', require('../../routes/users'));
app.use('/coaches', require('../../routes/coaches'));
app.use('/members', require('../../routes/members'));
app.use('/gyms', require('../../routes/gyms'));
app.use('/subscriptions', require('../../routes/subscriptions'));

describe('Rôles V2 : coachs', () => {
  let gym1;
  let gym2;
  let gym3;
  let owner;
  let manager;
  let coach;
  let member1;
  let member2;

  beforeEach(async () => {
    await cleanDatabase();
    gym1 = await createTestGym({ name: 'Salle A' });
    gym2 = await createTestGym({ name: 'Salle B' });
    gym3 = await createTestGym({ name: 'Salle C' });
    owner = await createTestOwner(gym1.id);
    manager = await createTestAdmin(gym1.id);
    coach = await createTestCoach([gym1.id, gym2.id], { email: 'coach@test.com', password: 'coach123' });
    member1 = await createTestMember(gym1.id);
    member2 = await createTestMember(gym2.id);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  describe('POST /users/create-coach', () => {
    it('l\'owner crée un coach rattaché à plusieurs salles', async () => {
      const res = await request(app)
        .post('/users/create-coach')
        .set('Authorization', authHeader(owner))
        .send({
          email: 'New.Coach@Test.com',
          firstName: 'Nina',
          lastName: 'Coach',
          phoneNumber: '+212600000001',
          gymIds: [gym2.id, gym1.id]
        });

      expect(res.status).toBe(201);
      expect(res.body.setupEmailSent).toBe(true);
      expect(res.body.coach.role).toBe('coach');
      expect(res.body.coach.email).toBe('new.coach@test.com');
      expect(res.body.coach.gymId).toBe(gym2.id);
      expect(res.body.coach.gyms.map(g => g.name)).toEqual(['Salle A', 'Salle B']);

      const links = await prisma.coachGym.count({ where: { coachId: res.body.coach.id } });
      expect(links).toBe(2);
    });

    it('refuse le manager (403)', async () => {
      const res = await request(app)
        .post('/users/create-coach')
        .set('Authorization', authHeader(manager))
        .send({ email: 'x@test.com', firstName: 'X', lastName: 'Y', gymIds: [gym1.id] });
      expect(res.status).toBe(403);
    });

    it('valide gymIds', async () => {
      const empty = await request(app)
        .post('/users/create-coach')
        .set('Authorization', authHeader(owner))
        .send({ email: 'x@test.com', firstName: 'X', lastName: 'Y', gymIds: [] });
      expect(empty.status).toBe(400);
      expect(empty.body.error).toBe('gym_ids_required');

      const unknown = await request(app)
        .post('/users/create-coach')
        .set('Authorization', authHeader(owner))
        .send({ email: 'x@test.com', firstName: 'X', lastName: 'Y', gymIds: [999999] });
      expect(unknown.status).toBe(404);
    });

    it('refuse un email déjà utilisé', async () => {
      const res = await request(app)
        .post('/users/create-coach')
        .set('Authorization', authHeader(owner))
        .send({ email: 'coach@test.com', firstName: 'X', lastName: 'Y', gymIds: [gym1.id] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('email_taken');
    });

    it('POST /users refuse de créer un coach (passer par create-coach)', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', authHeader(owner))
        .send({ email: 'y@test.com', firstName: 'X', lastName: 'Y', role: 'coach', gymId: gym1.id });
      expect(res.status).toBe(403);
    });
  });

  describe('login et /auth/me du coach', () => {
    it('renvoie role=coach et ses salles', async () => {
      const res = await request(app).post('/auth/login').send({ email: 'coach@test.com', password: 'coach123' });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('coach');
      expect(res.body.user.gyms.map(g => g.id).sort()).toEqual([gym1.id, gym2.id].sort());

      const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${res.body.token}`);
      expect(me.status).toBe(200);
      expect(me.body.role).toBe('coach');
      expect(me.body.gyms).toHaveLength(2);
    });

    it('refuse le coach au kiosk', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'coach@test.com', password: 'coach123', client: 'kiosk' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('kiosk_forbidden_role');
    });
  });

  describe('PATCH /users/:id/gyms', () => {
    it('remplace les salles et désaffecte les membres des salles retirées', async () => {
      await prisma.member.update({ where: { userId: member1.id }, data: { coachId: coach.id } });
      await prisma.member.update({ where: { userId: member2.id }, data: { coachId: coach.id } });

      const res = await request(app)
        .patch(`/users/${coach.id}/gyms`)
        .set('Authorization', authHeader(owner))
        .send({ gymIds: [gym2.id, gym3.id] });

      expect(res.status).toBe(200);
      expect(res.body.gymIds).toEqual([gym2.id, gym3.id]);
      expect(res.body.unassignedMembers).toBe(1);

      const m1 = await prisma.member.findUnique({ where: { userId: member1.id } });
      const m2 = await prisma.member.findUnique({ where: { userId: member2.id } });
      expect(m1.coachId).toBeNull();
      expect(m2.coachId).toBe(coach.id);

      // La salle principale (gym1) a été retirée : elle bascule sur une salle restante
      const updated = await prisma.user.findUnique({ where: { id: coach.id } });
      expect([gym2.id, gym3.id]).toContain(updated.gymId);
    });

    it('refuse le manager et un utilisateur qui n\'est pas coach', async () => {
      const mgr = await request(app)
        .patch(`/users/${coach.id}/gyms`)
        .set('Authorization', authHeader(manager))
        .send({ gymIds: [gym1.id] });
      expect(mgr.status).toBe(403);

      const notCoach = await request(app)
        .patch(`/users/${member1.id}/gyms`)
        .set('Authorization', authHeader(owner))
        .send({ gymIds: [gym1.id] });
      expect(notCoach.status).toBe(404);
    });
  });

  describe('GET /coaches', () => {
    it('owner : tous les coachs, ou filtrés par salle', async () => {
      await createTestCoach([gym3.id], { lastName: 'Zeta' });

      const all = await request(app).get('/coaches').set('Authorization', authHeader(owner));
      expect(all.status).toBe(200);
      expect(all.body).toHaveLength(2);

      const filtered = await request(app).get(`/coaches?gymId=${gym3.id}`).set('Authorization', authHeader(owner));
      expect(filtered.body).toHaveLength(1);
      expect(filtered.body[0].lastName).toBe('Zeta');
    });

    it('manager : coachs de sa salle uniquement', async () => {
      await createTestCoach([gym3.id]);
      await prisma.member.update({ where: { userId: member1.id }, data: { coachId: coach.id } });

      const res = await request(app).get('/coaches').set('Authorization', authHeader(manager));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ id: coach.id, role: 'coach', membersCount: 1 });
      expect(res.body[0].gyms.map(g => g.name)).toEqual(['Salle A', 'Salle B']);

      const other = await request(app).get(`/coaches?gymId=${gym3.id}`).set('Authorization', authHeader(manager));
      expect(other.status).toBe(403);
    });

    it('refuse les membres', async () => {
      const res = await request(app).get('/coaches').set('Authorization', authHeader(member1));
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /members/:id/coach', () => {
    it('le manager affecte un coach de sa salle, puis le retire', async () => {
      const res = await request(app)
        .patch(`/members/${member1.id}/coach`)
        .set('Authorization', authHeader(manager))
        .send({ coachId: coach.id });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        memberId: member1.id,
        coachId: coach.id,
        coach: { id: coach.id, firstName: coach.firstName, lastName: coach.lastName }
      });

      const cleared = await request(app)
        .patch(`/members/${member1.id}/coach`)
        .set('Authorization', authHeader(manager))
        .send({ coachId: null });
      expect(cleared.status).toBe(200);
      expect(cleared.body.coach).toBeNull();
    });

    it('refuse un coach non rattaché à la salle du membre', async () => {
      const outsider = await createTestCoach([gym3.id]);
      const res = await request(app)
        .patch(`/members/${member1.id}/coach`)
        .set('Authorization', authHeader(owner))
        .send({ coachId: outsider.id });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('coach_not_in_gym');
    });

    it('refuse le manager sur un membre d\'une autre salle et le coach', async () => {
      const mgr = await request(app)
        .patch(`/members/${member2.id}/coach`)
        .set('Authorization', authHeader(manager))
        .send({ coachId: coach.id });
      expect(mgr.status).toBe(403);

      const self = await request(app)
        .patch(`/members/${member1.id}/coach`)
        .set('Authorization', authHeader(coach))
        .send({ coachId: coach.id });
      expect(self.status).toBe(403);
    });

    it('valide coachId', async () => {
      const res = await request(app)
        .patch(`/members/${member1.id}/coach`)
        .set('Authorization', authHeader(owner))
        .send({ coachId: 'abc' });
      expect(res.status).toBe(400);
    });
  });

  describe('membres exposant leur coach', () => {
    beforeEach(async () => {
      await prisma.member.update({ where: { userId: member1.id }, data: { coachId: coach.id } });
    });

    it('GET /coaches/me/members renvoie les membres affectés au coach', async () => {
      const res = await request(app).get('/coaches/me/members').set('Authorization', authHeader(coach));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ id: member1.id, coachId: coach.id, gymId: gym1.id });
      expect(res.body[0].coach.id).toBe(coach.id);
    });

    it('/users/gym/:gymId/members et /users/:id exposent coachId et coach', async () => {
      const list = await request(app).get(`/users/gym/${gym1.id}/members`).set('Authorization', authHeader(manager));
      expect(list.status).toBe(200);
      const entry = list.body.members.find(m => m.id === member1.id);
      expect(entry.coachId).toBe(coach.id);
      expect(entry.coach.firstName).toBe(coach.firstName);

      const detail = await request(app).get(`/users/${member1.id}`).set('Authorization', authHeader(manager));
      expect(detail.body.coachId).toBe(coach.id);
      expect(detail.body.coach.id).toBe(coach.id);
    });
  });

  describe('garde coach (refus par défaut)', () => {
    it('refuse les routes non ouvertes au coach', async () => {
      const cases = [
        request(app).get('/users'),
        request(app).get(`/users/gym/${gym1.id}/members`),
        request(app).get(`/users/${member1.id}`),
        request(app).get('/coaches'),
        request(app).post('/subscriptions').send({}),
        request(app).put(`/gyms/${gym1.id}`).send({ phone: '1' })
      ];
      for (const req of cases) {
        const res = await req.set('Authorization', authHeader(coach));
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('coach_forbidden');
      }
    });

    it('laisse le coach lire son profil et ses salles, pas les autres', async () => {
      const self = await request(app).get(`/users/${coach.id}`).set('Authorization', authHeader(coach));
      expect(self.status).toBe(200);
      expect(self.body.gyms).toHaveLength(2);

      const gyms = await request(app).get('/gyms').set('Authorization', authHeader(coach));
      expect(gyms.status).toBe(200);
      expect(gyms.body.gyms.map(g => g.id).sort()).toEqual([gym1.id, gym2.id].sort());

      const ownGym = await request(app).get(`/gyms/${gym2.id}`).set('Authorization', authHeader(coach));
      expect(ownGym.status).toBe(200);

      const otherGym = await request(app).get(`/gyms/${gym3.id}`).set('Authorization', authHeader(coach));
      expect(otherGym.status).toBe(403);
    });
  });

  it('supprimer un coach désaffecte ses membres', async () => {
    await prisma.member.update({ where: { userId: member1.id }, data: { coachId: coach.id } });
    const res = await request(app).delete(`/users/${coach.id}`).set('Authorization', authHeader(owner));
    expect(res.status).toBe(200);
    const m1 = await prisma.member.findUnique({ where: { userId: member1.id } });
    expect(m1.coachId).toBeNull();
    expect(await prisma.coachGym.count({ where: { coachId: coach.id } })).toBe(0);
  });
});
