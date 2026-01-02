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
    await prisma.product.deleteMany({});
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
      expect(response.body.name).toBe('Protein Shake');
      expect(response.body.price).toBe(29.99);
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .post('/store/products')
        .set('Authorization', authHeader(testMember))
        .send({
          name: 'Test Product',
          price: 19.99
        });

      expect(response.status).toBe(403);
    });

    it('should return 400 with missing required fields', async () => {
      const response = await request(app)
        .post('/store/products')
        .set('Authorization', authHeader(testAdmin))
        .send({
          name: 'Incomplete Product'
          // Missing price
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /store/products', () => {
    beforeEach(async () => {
      await prisma.product.createMany({
        data: [
          {
            displayId: 'PROD001',
            name: 'Protein Bar',
            description: 'Energy bar',
            price: 4.99,
            stock: 100,
            category: 'snacks',
            gymId: testGym.id
          },
          {
            displayId: 'PROD002',
            name: 'Water Bottle',
            description: 'Sports bottle',
            price: 9.99,
            stock: 50,
            category: 'accessories',
            gymId: testGym.id
          }
        ]
      });
    });

    it('should get all products', async () => {
      const response = await request(app)
        .get('/store/products')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
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
      testProduct = await prisma.product.create({
        data: {
          displayId: 'PROD001',
          name: 'Test Product',
          description: 'Test description',
          price: 19.99,
          stock: 25,
          category: 'supplements',
          gymId: testGym.id
        }
      });
    });

    it('should get a specific product', async () => {
      const response = await request(app)
        .get(`/store/products/${testProduct.id}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testProduct.id);
      expect(response.body.name).toBe('Test Product');
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
      testProduct = await prisma.product.create({
        data: {
          displayId: 'PROD001',
          name: 'Original Name',
          description: 'Original description',
          price: 19.99,
          stock: 25,
          category: 'supplements',
          gymId: testGym.id
        }
      });
    });

    it('should update a product as admin', async () => {
      const response = await request(app)
        .put(`/store/products/${testProduct.id}`)
        .set('Authorization', authHeader(testAdmin))
        .send({
          name: 'Updated Name',
          price: 24.99
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.price).toBe(24.99);
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .put(`/store/products/${testProduct.id}`)
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
      testProduct = await prisma.product.create({
        data: {
          displayId: 'PROD001',
          name: 'To Delete',
          description: 'Will be deleted',
          price: 19.99,
          stock: 25,
          category: 'supplements',
          gymId: testGym.id
        }
      });
    });

    it('should delete a product as admin', async () => {
      const response = await request(app)
        .delete(`/store/products/${testProduct.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      
      // Verify deletion
      const deletedProduct = await prisma.product.findUnique({
        where: { id: testProduct.id }
      });
      expect(deletedProduct).toBeNull();
    });

    it('should return 403 for members', async () => {
      const response = await request(app)
        .delete(`/store/products/${testProduct.id}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(403);
    });
  });
});
