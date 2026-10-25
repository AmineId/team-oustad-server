const request = require('supertest');
const express = require('express');
const gymsRoutes = require('../../routes/gyms');
const showcaseRoutes = require('../../routes/showcase');
const publicRoutes = require('../../routes/public');
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

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/gyms', gymsRoutes);
app.use('/showcase', showcaseRoutes);
app.use('/public', publicRoutes);

const samplePage = {
  sections: [
    { id: 'gymInfo', type: 'gymInfo', visible: true },
    {
      id: 's1',
      type: 'markdown',
      visible: true,
      data: { title: 'Tarifs', body: '**30 €** / mois' }
    },
    { id: 's2', type: 'markdown', visible: false, data: { title: 'Brouillon', body: '...' } }
  ]
};

describe('Showcase CMS routes', () => {
  let gym;
  let otherGym;
  let owner;
  let admin;
  let member;

  beforeEach(async () => {
    await prisma.showcasePage.deleteMany({});
    await cleanDatabase();
    gym = await createTestGym({ name: 'Main Gym' });
    otherGym = await createTestGym({ name: 'Other Gym' });
    owner = await createTestOwner(gym.id);
    admin = await createTestAdmin(gym.id);
    member = await createTestMember(gym.id);
  });

  afterAll(async () => {
    await prisma.showcasePage.deleteMany({});
    await cleanDatabase();
    await disconnectDatabase();
  });

  describe('GET/PUT /gyms/:id/showcase', () => {
    it('renvoie {} tant que rien n\'est enregistré', async () => {
      const res = await request(app)
        .get(`/gyms/${gym.id}/showcase`)
        .set('Authorization', authHeader(admin));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });

    it('l\'admin de la salle enregistre puis relit la page', async () => {
      const put = await request(app)
        .put(`/gyms/${gym.id}/showcase`)
        .set('Authorization', authHeader(admin))
        .send(samplePage);
      expect(put.status).toBe(200);

      const get = await request(app)
        .get(`/gyms/${gym.id}/showcase`)
        .set('Authorization', authHeader(admin));
      expect(get.body.sections.map((s) => s.id)).toEqual(['gymInfo', 's1', 's2']);
    });

    it('refuse l\'admin d\'une autre salle et les membres', async () => {
      const otherAdmin = await createTestAdmin(otherGym.id);
      for (const user of [otherAdmin, member]) {
        const res = await request(app)
          .put(`/gyms/${gym.id}/showcase`)
          .set('Authorization', authHeader(user))
          .send(samplePage);
        expect(res.status).toBe(403);
      }
    });

    it('refuse un owner sans canManageGyms', async () => {
      const limited = await createTestOwner(gym.id, { canManageGyms: false });
      const res = await request(app)
        .put(`/gyms/${gym.id}/showcase`)
        .set('Authorization', authHeader(limited))
        .send(samplePage);
      expect(res.status).toBe(403);
    });

    it('valide le body (hero interdit, ids en double, lien non http)', async () => {
      const cases = [
        { hero: { tagline: 'x' }, sections: [] },
        { sections: [{ id: 'a', type: 'markdown' }, { id: 'a', type: 'markdown' }] },
        { sections: [{ id: 'c', type: 'cta', data: { url: 'javascript:alert(1)' } }] },
        { sections: [{ id: 'm', type: 'markdown', data: { body: 'x'.repeat(5001) } }] },
        { sections: 'nope' }
      ];
      for (const body of cases) {
        const res = await request(app)
          .put(`/gyms/${gym.id}/showcase`)
          .set('Authorization', authHeader(owner))
          .send(body);
        expect(res.status).toBe(400);
      }
    });
  });

  describe('/showcase/home', () => {
    it('réservé aux owners', async () => {
      const res = await request(app)
        .put('/showcase/home')
        .set('Authorization', authHeader(admin))
        .send({ sections: [] });
      expect(res.status).toBe(403);
    });

    it('l\'owner enregistre la page d\'accueil avec son en-tête', async () => {
      const page = {
        hero: { eyebrow: 'VITRINE', tagline: 'Dépasse tes limites.' },
        sections: [{ id: 'gyms', type: 'gyms', visible: true }]
      };
      const put = await request(app)
        .put('/showcase/home')
        .set('Authorization', authHeader(owner))
        .send(page);
      expect(put.status).toBe(200);

      const pub = await request(app).get('/public/showcase/home');
      expect(pub.status).toBe(200);
      expect(pub.body.hero.tagline).toBe('Dépasse tes limites.');
      expect(pub.headers['cache-control']).toContain('max-age=300');
    });
  });

  describe('exposition publique', () => {
    it('la fiche publique inclut description et sections visibles uniquement', async () => {
      await prisma.gym.update({
        where: { id: gym.id },
        data: { isPublished: true, slug: 'main-gym', description: 'Salle **moderne**' }
      });
      await request(app)
        .put(`/gyms/${gym.id}/showcase`)
        .set('Authorization', authHeader(owner))
        .send(samplePage);

      const res = await request(app).get('/public/gyms/main-gym');
      expect(res.status).toBe(200);
      expect(res.body.gym.description).toBe('Salle **moderne**');
      expect(res.body.gym.showcase.sections.map((s) => s.id)).toEqual(['gymInfo', 's1']);
    });

    it('PUT /gyms/:id enregistre la description', async () => {
      const res = await request(app)
        .put(`/gyms/${gym.id}`)
        .set('Authorization', authHeader(admin))
        .send({ description: 'Nouvelle description' });
      expect(res.status).toBe(200);
      expect(res.body.gym.description).toBe('Nouvelle description');
    });
  });
});
