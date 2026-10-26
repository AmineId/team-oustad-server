const request = require('supertest');
const express = require('express');
const gymsRoutes = require('../../routes/gyms');
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

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/gyms', gymsRoutes);

describe('Gyms Routes', () => {
  let testGym;
  let testOwner;
  let testAdmin;
  let testMember;
  let otherGym;

  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    
    testGym = await createTestGym({ name: 'Main Gym' });
    otherGym = await createTestGym({ name: 'Other Gym' });
    
    testOwner = await createTestOwner(testGym.id, {
      email: 'owner@test.com',
      password: 'owner123'
    });
    
    testAdmin = await createTestAdmin(testGym.id, {
      email: 'admin@test.com',
      password: 'admin123'
    });
    
    testMember = await createTestMember(testGym.id, {
      email: 'member@test.com',
      password: 'member123'
    });
  });

  describe('POST /gyms', () => {
    it('should allow owner to create a gym', async () => {
      const gymData = {
        name: 'New Fitness Center',
        address: '456 New Street',
        phone: '+1987654321'
      };

      const response = await request(app)
        .post('/gyms')
        .set('Authorization', authHeader(testOwner))
        .send(gymData);

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('créée');
      expect(response.body.gym).toBeDefined();
      expect(response.body.gym.name).toBe(gymData.name);
      expect(response.body.gym.address).toBe(gymData.address);
      expect(response.body.gym.phone).toBe(gymData.phone);
      expect(response.body.gym.displayId).toBeDefined();
    });

    it('should return 403 if non-owner tries to create gym', async () => {
      const response = await request(app)
        .post('/gyms')
        .set('Authorization', authHeader(testAdmin))
        .send({
          name: 'New Gym',
          address: '123 Street'
        });

      expect(response.status).toBe(403);
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/gyms')
        .set('Authorization', authHeader(testOwner))
        .send({ address: '123 Street' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('requis');
    });

    it('should return 400 if address is missing', async () => {
      const response = await request(app)
        .post('/gyms')
        .set('Authorization', authHeader(testOwner))
        .send({ name: 'New Gym' });

      expect(response.status).toBe(400);
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .post('/gyms')
        .send({ name: 'New Gym', address: '123 Street' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /gyms', () => {
    it('should allow owner to see all gyms', async () => {
      const response = await request(app)
        .get('/gyms')
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(200);
      expect(response.body.gyms).toBeDefined();
      expect(response.body.gyms.length).toBeGreaterThanOrEqual(2);
      
      const gymNames = response.body.gyms.map(g => g.name);
      expect(gymNames).toContain('Main Gym');
      expect(gymNames).toContain('Other Gym');
    });

    it('should allow admin to see only their gym', async () => {
      const response = await request(app)
        .get('/gyms')
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(response.body.gyms).toBeDefined();
      expect(response.body.gyms.length).toBe(1);
      expect(response.body.gyms[0].name).toBe('Main Gym');
    });

    it('should allow member to see only their gym', async () => {
      const response = await request(app)
        .get('/gyms')
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(response.body.gyms.length).toBe(1);
      expect(response.body.gyms[0].id).toBe(testGym.id);
    });

    it('should include user count in gym data', async () => {
      const response = await request(app)
        .get('/gyms')
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(200);
      const mainGym = response.body.gyms.find(g => g.name === 'Main Gym');
      expect(mainGym._count).toBeDefined();
      expect(mainGym._count.User).toBeGreaterThan(0);
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app).get('/gyms');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /gyms/:id', () => {
    it('should allow owner to get any gym details', async () => {
      const response = await request(app)
        .get(`/gyms/${testGym.id}`)
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(200);
      expect(response.body.gym).toBeDefined();
      expect(response.body.gym.id).toBe(testGym.id);
      expect(response.body.gym.name).toBe('Main Gym');
      expect(response.body.gym.User).toBeDefined();
    });

    it('should allow admin to get their gym details', async () => {
      const response = await request(app)
        .get(`/gyms/${testGym.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(response.body.gym.id).toBe(testGym.id);
    });

    it('should return 403 if admin tries to access other gym', async () => {
      const response = await request(app)
        .get(`/gyms/${otherGym.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(403);
    });

    it('should allow member to get their gym details', async () => {
      const response = await request(app)
        .get(`/gyms/${testGym.id}`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(response.body.gym.id).toBe(testGym.id);
    });

    it('should return 404 for non-existent gym', async () => {
      const response = await request(app)
        .get('/gyms/99999')
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(404);
    });

    it('should include opening hours in gym details', async () => {
      const response = await request(app)
        .get(`/gyms/${testGym.id}`)
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(200);
      expect(response.body.gym.OpeningHour).toBeDefined();
      expect(Array.isArray(response.body.gym.OpeningHour)).toBe(true);
    });
  });

  describe('PUT /gyms/:id', () => {
    it('should allow owner to update any gym', async () => {
      const updateData = {
        name: 'Updated Main Gym',
        address: 'New Address 123',
        phone: '+1234567890'
      };

      const response = await request(app)
        .put(`/gyms/${testGym.id}`)
        .set('Authorization', authHeader(testOwner))
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('mise à jour');
      expect(response.body.gym.name).toBe(updateData.name);
      expect(response.body.gym.address).toBe(updateData.address);
      expect(response.body.gym.phone).toBe(updateData.phone);
    });

    it('should allow admin to update their gym', async () => {
      const response = await request(app)
        .put(`/gyms/${testGym.id}`)
        .set('Authorization', authHeader(testAdmin))
        .send({ name: 'Admin Updated Gym' });

      expect(response.status).toBe(200);
      expect(response.body.gym.name).toBe('Admin Updated Gym');
    });

    it('should return 403 if admin tries to update other gym', async () => {
      const response = await request(app)
        .put(`/gyms/${otherGym.id}`)
        .set('Authorization', authHeader(testAdmin))
        .send({ name: 'Hacked Gym' });

      expect(response.status).toBe(403);
    });

    it('should return 403 if member tries to update gym', async () => {
      const response = await request(app)
        .put(`/gyms/${testGym.id}`)
        .set('Authorization', authHeader(testMember))
        .send({ name: 'Member Updated Gym' });

      expect(response.status).toBe(403);
    });

    it('should allow partial updates', async () => {
      const response = await request(app)
        .put(`/gyms/${testGym.id}`)
        .set('Authorization', authHeader(testOwner))
        .send({ phone: '+9999999999' });

      expect(response.status).toBe(200);
      expect(response.body.gym.phone).toBe('+9999999999');
      expect(response.body.gym.name).toBe('Main Gym'); // Unchanged
    });

    it('should return 404 for non-existent gym', async () => {
      const response = await request(app)
        .put('/gyms/99999')
        .set('Authorization', authHeader(testOwner))
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /gyms/:id', () => {
    it('should allow owner to delete gym', async () => {
      const gymToDelete = await createTestGym({ name: 'Gym To Delete' });

      const response = await request(app)
        .delete(`/gyms/${gymToDelete.id}`)
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('supprimée');
      expect(response.body.deletedId).toBe(gymToDelete.id);

      // Verify gym is deleted
      const deleted = await prisma.gym.findUnique({ where: { id: gymToDelete.id } });
      expect(deleted).toBeNull();
    });

    it('should return 403 if non-owner tries to delete gym', async () => {
      const response = await request(app)
        .delete(`/gyms/${testGym.id}`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent gym', async () => {
      const response = await request(app)
        .delete('/gyms/99999')
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(404);
    });
  });

  describe('POST /gyms/:id/opening-hours', () => {
    it('should allow owner to set opening hours', async () => {
      const openingHours = [
        { dayOfWeek: 1, openTime: '09:00', closeTime: '18:00', isClosed: false },
        { dayOfWeek: 2, openTime: '09:00', closeTime: '18:00', isClosed: false },
        { dayOfWeek: 0, isClosed: true }
      ];

      const response = await request(app)
        .post(`/gyms/${testGym.id}/opening-hours`)
        .set('Authorization', authHeader(testOwner))
        .send(openingHours);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Horaires');
      expect(response.body.openingHours).toHaveLength(3);
      expect(response.body.openingHours[0].dayOfWeek).toBe(1);
    });

    it('should return 403 if manager sets opening hours, even for their gym (Rôles V2)', async () => {
      const openingHours = [
        { dayOfWeek: 1, openTime: '08:00', closeTime: '20:00' }
      ];

      const response = await request(app)
        .post(`/gyms/${testGym.id}/opening-hours`)
        .set('Authorization', authHeader(testAdmin))
        .send(openingHours);

      expect(response.status).toBe(403);
    });

    it('should return 403 if admin tries to set hours for other gym', async () => {
      const response = await request(app)
        .post(`/gyms/${otherGym.id}/opening-hours`)
        .set('Authorization', authHeader(testAdmin))
        .send([{ dayOfWeek: 1, openTime: '09:00', closeTime: '18:00' }]);

      expect(response.status).toBe(403);
    });

    it('should replace existing opening hours', async () => {
      // Set initial hours
      await request(app)
        .post(`/gyms/${testGym.id}/opening-hours`)
        .set('Authorization', authHeader(testOwner))
        .send([{ dayOfWeek: 1, openTime: '09:00', closeTime: '18:00' }]);

      // Replace with new hours
      const newHours = [
        { dayOfWeek: 2, openTime: '10:00', closeTime: '19:00' }
      ];

      const response = await request(app)
        .post(`/gyms/${testGym.id}/opening-hours`)
        .set('Authorization', authHeader(testOwner))
        .send(newHours);

      expect(response.status).toBe(200);
      expect(response.body.openingHours).toHaveLength(1);
      expect(response.body.openingHours[0].dayOfWeek).toBe(2);
    });

    it('should return 400 if data is not an array', async () => {
      const response = await request(app)
        .post(`/gyms/${testGym.id}/opening-hours`)
        .set('Authorization', authHeader(testOwner))
        .send({ dayOfWeek: 1 });

      expect(response.status).toBe(400);
    });

    it('should handle closed days correctly', async () => {
      const response = await request(app)
        .post(`/gyms/${testGym.id}/opening-hours`)
        .set('Authorization', authHeader(testOwner))
        .send([{ dayOfWeek: 0, isClosed: true }]);

      expect(response.status).toBe(200);
      expect(response.body.openingHours[0].isClosed).toBe(true);
    });
  });

  describe('GET /gyms/:id/opening-hours', () => {
    beforeEach(async () => {
      // Create opening hours
      await prisma.openingHour.createMany({
        data: [
          { gymId: testGym.id, dayOfWeek: 1, openTime: '09:00', closeTime: '18:00', isClosed: false },
          { gymId: testGym.id, dayOfWeek: 2, openTime: '09:00', closeTime: '18:00', isClosed: false },
          { gymId: testGym.id, dayOfWeek: 0, openTime: '00:00', closeTime: '00:00', isClosed: true }
        ]
      });
    });

    it('should return opening hours for owner', async () => {
      const response = await request(app)
        .get(`/gyms/${testGym.id}/opening-hours`)
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(200);
      expect(response.body.openingHours).toHaveLength(3);
      expect(response.body.openingHours[0].dayOfWeek).toBe(0); // Sorted by dayOfWeek
    });

    it('should return opening hours for admin of that gym', async () => {
      const response = await request(app)
        .get(`/gyms/${testGym.id}/opening-hours`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
      expect(response.body.openingHours).toHaveLength(3);
    });

    it('should return 403 if admin tries to get hours of other gym', async () => {
      const response = await request(app)
        .get(`/gyms/${otherGym.id}/opening-hours`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(403);
    });

    it('should return empty array if no hours set', async () => {
      const newGym = await createTestGym({ name: 'New Gym' });

      const response = await request(app)
        .get(`/gyms/${newGym.id}/opening-hours`)
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(200);
      expect(response.body.openingHours).toHaveLength(0);
    });
  });

  describe('PUT /gyms/:id/image', () => {
    it('should allow owner to upload gym image', async () => {
      const imageData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD';

      const response = await request(app)
        .put(`/gyms/${testGym.id}/image`)
        .set('Authorization', authHeader(testOwner))
        .send({ imageData });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Image');

      // Verify image was saved
      const gym = await prisma.gym.findUnique({ where: { id: testGym.id } });
      expect(gym.image).not.toBeNull();
    });

    it('should return 403 if manager uploads image, even for their gym (Rôles V2)', async () => {
      const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';

      const response = await request(app)
        .put(`/gyms/${testGym.id}/image`)
        .set('Authorization', authHeader(testAdmin))
        .send({ imageData });

      expect(response.status).toBe(403);
    });

    it('should return 403 if admin tries to upload to other gym', async () => {
      const response = await request(app)
        .put(`/gyms/${otherGym.id}/image`)
        .set('Authorization', authHeader(testAdmin))
        .send({ imageData: 'data:image/jpeg;base64,test' });

      expect(response.status).toBe(403);
    });

    it('should return 403 if member tries to upload image', async () => {
      const response = await request(app)
        .put(`/gyms/${testGym.id}/image`)
        .set('Authorization', authHeader(testMember))
        .send({ imageData: 'data:image/jpeg;base64,test' });

      expect(response.status).toBe(403);
    });

    it('should return 400 if imageData is missing', async () => {
      const response = await request(app)
        .put(`/gyms/${testGym.id}/image`)
        .set('Authorization', authHeader(testOwner))
        .send({});

      expect(response.status).toBe(400);
    });

    it('should handle base64 data without prefix', async () => {
      const response = await request(app)
        .put(`/gyms/${testGym.id}/image`)
        .set('Authorization', authHeader(testOwner))
        .send({ imageData: 'SGVsbG8gV29ybGQ=' }); // "Hello World" in base64

      expect(response.status).toBe(200);
    });
  });

  describe('GET /gyms/:id/image', () => {
    it('should return gym image if exists', async () => {
      // Upload an image first
      const imageBuffer = Buffer.from('fake image data');
      await prisma.gym.update({
        where: { id: testGym.id },
        data: { image: imageBuffer }
      });

      const response = await request(app)
        .get(`/gyms/${testGym.id}/image`)
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/image/);
    });

    it('should return SVG placeholder if no image exists', async () => {
      const response = await request(app)
        .get(`/gyms/${testGym.id}/image`)
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/svg+xml');
      const svgContent = response.body.toString('utf8');
      expect(svgContent).toContain('<svg');
      expect(svgContent).toContain('MG'); // Initials of "Main Gym"
    });

    it('should allow admin to get image of their gym', async () => {
      const response = await request(app)
        .get(`/gyms/${testGym.id}/image`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
    });

    it('should return 403 if admin tries to get image of other gym', async () => {
      const response = await request(app)
        .get(`/gyms/${otherGym.id}/image`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent gym', async () => {
      const response = await request(app)
        .get('/gyms/99999/image')
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /gyms/:id/image', () => {
    beforeEach(async () => {
      // Add an image to testGym
      const imageBuffer = Buffer.from('fake image data');
      await prisma.gym.update({
        where: { id: testGym.id },
        data: { image: imageBuffer }
      });
    });

    it('should allow owner to delete gym image', async () => {
      const response = await request(app)
        .delete(`/gyms/${testGym.id}/image`)
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('supprimée');

      // Verify image was deleted
      const gym = await prisma.gym.findUnique({ where: { id: testGym.id } });
      expect(gym.image).toBeNull();
    });

    it('should return 403 if manager deletes image, even for their gym (Rôles V2)', async () => {
      const response = await request(app)
        .delete(`/gyms/${testGym.id}/image`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(403);
    });

    it('should return 403 if admin tries to delete image of other gym', async () => {
      const response = await request(app)
        .delete(`/gyms/${otherGym.id}/image`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(403);
    });

    it('should return 403 if member tries to delete image', async () => {
      const response = await request(app)
        .delete(`/gyms/${testGym.id}/image`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent gym', async () => {
      const response = await request(app)
        .delete('/gyms/99999/image')
        .set('Authorization', authHeader(testOwner));

      expect(response.status).toBe(404);
    });
  });
});
