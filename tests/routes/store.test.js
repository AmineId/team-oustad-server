const request = require('supertest');
const express = require('express');
const storeRoutes = require('../../routes/store');
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
app.use('/store', storeRoutes);

describe('Store Routes', () => {
  let testGym;
  let testAdmin;
  let testMember;

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
    await prisma.storeProduct.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.member.deleteMany({});
    await prisma.admin.deleteMany({});
    await prisma.user.deleteMany({});
    
    // Create fresh test users
    testAdmin = await createTestAdmin(testGym.id, {
      email: 'admin@test.com',
      password: 'admin123'
    });
    
    testMember = await createTestMember(testGym.id, {
      email: 'member@test.com',
      password: 'member123'
    });
  });

  describe('POST /store/products', () => {
    it('should create a product as admin', async () => {
      const response = await request(app)
        .post('/store/products')
        .set('Authorization', authHeader(testAdmin))
        .send({
          name: 'Protein Shake',
          description: 'Whey protein shake',
          price: 29.99,
          stock: 50,
          category: 'supplements'
        });

      expect(response.status).toBe(201);
      expect(response.body.product.name).toBe('Protein Shake');
      expect(response.body.product.price).toBe(29.99);
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .post('/store/products')
        .set('Authorization', authHeader(testMember))
        .send({
          name: 'Test Product',
          price: 19.99,
          stock: 10
        });

      expect(response.status).toBe(403);
    });

    it('should return 400 with missing required fields', async () => {
      const response = await request(app)
        .post('/store/products')
        .set('Authorization', authHeader(testAdmin))
        .send({
          name: 'Incomplete Product'
          // Missing price and stock
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /store/products', () => {
    beforeEach(async () => {
      // Create products one by one with createdBy field
      await prisma.storeProduct.create({
        data: {
          displayId: `PROD${Date.now()}1`,
          name: 'Protein Bar',
          description: 'Energy bar',
          price: 4.99,
          stock: 100,
          category: 'snacks',
          gymId: testGym.id,
          createdBy: testAdmin.id
        }
      });
      await prisma.storeProduct.create({
        data: {
          displayId: `PROD${Date.now()}2`,
          name: 'Water Bottle',
          description: 'Sports bottle',
          price: 9.99,
          stock: 50,
          category: 'accessories',
          gymId: testGym.id,
          createdBy: testAdmin.id
        }
      });
    });

    it('should get all products', async () => {
      const response = await request(app)
        .get('/store/products')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.products)).toBe(true);
      expect(response.body.products.length).toBe(2);
    });

    it('should work for both members and admins', async () => {
      const memberResponse = await request(app)
        .get('/store/products')
        .set('Authorization', authHeader(testMember));

      const adminResponse = await request(app)
        .get('/store/products')
        .set('Authorization', authHeader(testAdmin));

      expect(memberResponse.status).toBe(200);
      expect(adminResponse.status).toBe(200);
    });
  });

  describe('GET /store/products/:id', () => {
    let testProduct;

    beforeEach(async () => {
      testProduct = await prisma.storeProduct.create({
        data: {
          displayId: `PROD${Date.now()}`,
          name: 'Test Product',
          description: 'Test description',
          price: 19.99,
          stock: 25,
          category: 'supplements',
          gymId: testGym.id,
          createdBy: testAdmin.id
        }
      });
    });

    it('should get a specific product', async () => {
      const response = await request(app)
        .get(`/store/products/${testProduct.displayId}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(response.body.product.id).toBe(testProduct.id);
      expect(response.body.product.name).toBe('Test Product');
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/store/products/99999')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /store/products/:id', () => {
    let testProduct;

    beforeEach(async () => {
      testProduct = await prisma.storeProduct.create({
        data: {
          displayId: `PROD${Date.now()}`,
          name: 'Original Name',
          description: 'Original description',
          price: 19.99,
          stock: 25,
          category: 'supplements',
          gymId: testGym.id,
          createdBy: testAdmin.id
        }
      });
    });

    it('should update a product as admin', async () => {
      const response = await request(app)
        .put(`/store/products/${testProduct.displayId}`)
        .set('Authorization', authHeader(testAdmin))
        .send({
          name: 'Updated Name',
          price: 24.99
        });

      expect(response.status).toBe(200);
      expect(response.body.product.name).toBe('Updated Name');
      expect(response.body.product.price).toBe(24.99);
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .put(`/store/products/${testProduct.displayId}`)
        .set('Authorization', authHeader(testMember))
        .send({
          name: 'Updated Name'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /store/products/:id', () => {
    let testProduct;

    beforeEach(async () => {
      testProduct = await prisma.storeProduct.create({
        data: {
          displayId: `PROD${Date.now()}`,
          name: 'To Delete',
          description: 'Will be deleted',
          price: 19.99,
          stock: 25,
          category: 'supplements',
          gymId: testGym.id,
          createdBy: testAdmin.id
        }
      });
    });

    it('should delete a product as admin', async () => {
      const response = await request(app)
        .delete(`/store/products/${testProduct.displayId}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      
      // Verify deletion
      const deletedProduct = await prisma.storeProduct.findUnique({
        where: { id: testProduct.id }
      });
      expect(deletedProduct).toBeNull();
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .delete(`/store/products/${testProduct.displayId}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(403);
    });
  });

  describe('Reservations', () => {
    let testProduct;

    beforeEach(async () => {
      testProduct = await prisma.storeProduct.create({
        data: {
          displayId: `PROD${Date.now()}`,
          name: 'Reserve Me',
          description: 'Test product for reservations',
          price: 15.00,
          stock: 10,
          category: 'supplements',
          gymId: testGym.id,
          createdBy: testAdmin.id,
          isActive: true
        }
      });
    });

    describe('POST /store/reservations', () => {
      it('should return 400 when productId or quantity missing', async () => {
        const res = await request(app)
          .post('/store/reservations')
          .set('Authorization', authHeader(testMember))
          .send({ notes: 'no fields' });
        expect(res.status).toBe(400);
      });

      it('should create a reservation as member', async () => {
        const res = await request(app)
          .post('/store/reservations')
          .set('Authorization', authHeader(testMember))
          .send({ productId: testProduct.id, quantity: 2 });
        expect(res.status).toBe(201);
        expect(res.body.reservation.quantity).toBe(2);
      });

      it('should return 400 when admin posts without memberId', async () => {
        const res = await request(app)
          .post('/store/reservations')
          .set('Authorization', authHeader(testAdmin))
          .send({ productId: testProduct.id, quantity: 1 });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/memberId/);
      });

      it('should create a reservation as admin with memberId', async () => {
        const res = await request(app)
          .post('/store/reservations')
          .set('Authorization', authHeader(testAdmin))
          .send({ productId: testProduct.id, quantity: 1, memberId: testMember.id });
        expect(res.status).toBe(201);
      });
    });

    describe('GET /store/reservations/my', () => {
      it('should return 403 for admins', async () => {
        const res = await request(app)
          .get('/store/reservations/my')
          .set('Authorization', authHeader(testAdmin));
        expect(res.status).toBe(403);
      });

      it('should return member reservations', async () => {
        await prisma.storeReservation.create({
          data: {
            displayId: `RES${Date.now()}`,
            productId: testProduct.id,
            memberId: testMember.id,
            quantity: 1,
            totalPrice: 15.00,
            status: 'pending'
          }
        });
        const res = await request(app)
          .get('/store/reservations/my')
          .set('Authorization', authHeader(testMember));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.reservations)).toBe(true);
      });
    });

    describe('PATCH /store/reservations/:id/cancel', () => {
      it('should cancel a reservation as member', async () => {
        const reservation = await prisma.storeReservation.create({
          data: {
            displayId: `RES${Date.now()}`,
            productId: testProduct.id,
            memberId: testMember.id,
            quantity: 1,
            totalPrice: 15.00,
            status: 'pending'
          }
        });
        const res = await request(app)
          .patch(`/store/reservations/${reservation.displayId}/cancel`)
          .set('Authorization', authHeader(testMember));
        expect(res.status).toBe(200);
        expect(res.body.reservation.status).toBe('cancelled');
      });
    });

    describe('GET /store/reservations', () => {
      it('should return 403 for members', async () => {
        const res = await request(app)
          .get('/store/reservations')
          .set('Authorization', authHeader(testMember));
        expect(res.status).toBe(403);
      });

      it('should return all reservations for admin', async () => {
        const res = await request(app)
          .get('/store/reservations')
          .set('Authorization', authHeader(testAdmin));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.reservations)).toBe(true);
      });
    });

    describe('PATCH /store/reservations/:id/complete', () => {
      it('should return 403 for members', async () => {
        const reservation = await prisma.storeReservation.create({
          data: {
            displayId: `RES${Date.now()}`,
            productId: testProduct.id,
            memberId: testMember.id,
            quantity: 1,
            totalPrice: 15.00,
            status: 'pending'
          }
        });
        const res = await request(app)
          .patch(`/store/reservations/${reservation.displayId}/complete`)
          .set('Authorization', authHeader(testMember));
        expect(res.status).toBe(403);
      });

      it('should complete a reservation as admin', async () => {
        const reservation = await prisma.storeReservation.create({
          data: {
            displayId: `RES${Date.now()}`,
            productId: testProduct.id,
            memberId: testMember.id,
            quantity: 1,
            totalPrice: 15.00,
            status: 'pending'
          }
        });
        const res = await request(app)
          .patch(`/store/reservations/${reservation.displayId}/complete`)
          .set('Authorization', authHeader(testAdmin));
        expect(res.status).toBe(200);
        expect(res.body.reservation.status).toBe('completed');
      });
    });
  });

  describe('GET /store/stats', () => {
    it('should return 403 for members', async () => {
      const res = await request(app)
        .get('/store/stats')
        .set('Authorization', authHeader(testMember));
      expect(res.status).toBe(403);
    });

    it('should return store stats for admin', async () => {
      const res = await request(app)
        .get('/store/stats')
        .set('Authorization', authHeader(testAdmin));
      expect(res.status).toBe(200);
      expect(res.body.stats).toBeDefined();
    });
  });
});
