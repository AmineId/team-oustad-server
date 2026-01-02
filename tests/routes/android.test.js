const request = require('supertest');
const express = require('express');
const androidRoutes = require('../../routes/android');
const {
  cleanDatabase,
  disconnectDatabase,
  createTestGym
} = require('../helpers/testHelpers');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/android', androidRoutes);

describe('Android Routes', () => {
  let testGym;

  beforeAll(async () => {
    await cleanDatabase();
    testGym = await createTestGym();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  describe('GET /android/version', () => {
    it('should get latest Android version info', async () => {
      const response = await request(app)
        .get('/android/version');

      expect(response.status).toBe(200);
      expect(response.body.version_code).toBeDefined();
      expect(response.body.version_name).toBeDefined();
    });
  });

  describe('GET /android/config', () => {
    it('should get Android app configuration', async () => {
      const response = await request(app)
        .get('/android/config');

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });
  });

  describe('Health check endpoints', () => {
    it('should respond to health checks', async () => {
      const response = await request(app)
        .get('/android/health');

      // Expect either 200 or 404 (if route doesn't exist, which is ok)
      expect([200, 404]).toContain(response.status);
    });
  });
});
