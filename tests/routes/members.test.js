const request = require('supertest');
const express = require('express');
const membersRoutes = require('../../routes/members');
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
app.use('/members', membersRoutes);

describe('Members Routes', () => {
  let testGym;
  let testAdmin;
  let testMember;
  let otherMember;

  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    
    testGym = await createTestGym({ name: 'Test Gym' });
    
    testAdmin = await createTestAdmin(testGym.id, {
      email: 'admin@test.com',
      password: 'admin123'
    });
    
    testMember = await createTestMember(testGym.id, {
      email: 'member@test.com',
      password: 'member123',
      onboarding: false
    });

    otherMember = await createTestMember(testGym.id, {
      email: 'other@test.com',
      password: 'member123',
      onboarding: true
    });
  });

  describe('PUT /members/:id/profile', () => {
    it('should allow member to update their own profile', async () => {
      const profileData = {
        birthDate: '1990-01-15',
        phone: '+33612345678',
        profession: 'Etudiant',
        fitnessLevel: 'intermediaire'
      };

      const response = await request(app)
        .put(`/members/${testMember.id}/profile`)
        .set('Authorization', authHeader(testMember))
        .send(profileData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('mis à jour');
      expect(response.body.member).toBeDefined();
      expect(response.body.member.phone).toBe(profileData.phone);
      expect(response.body.member.profession).toBe(profileData.profession);
      expect(response.body.member.fitnessLevel).toBe(profileData.fitnessLevel);
    });

    it('enregistre la taille et la date de première acceptation du règlement', async () => {
      const put = (body) => request(app).put(`/members/${testMember.id}/profile`).set('Authorization', authHeader(testMember)).send(body);

      const first = await put({ height: 178, cgAccepted: true, onboarding: false });
      expect(first.status).toBe(200);
      expect(first.body.member).toMatchObject({ height: 178, onboarding: false });
      const acceptedAt = first.body.member.cgAcceptedAt;
      expect(acceptedAt).toBeTruthy();

      const again = await put({ cgAccepted: true, height: '180.5' });
      expect(again.body.member.cgAcceptedAt).toBe(acceptedAt);
      expect(again.body.member.height).toBe(180.5);

      expect((await put({ height: null })).body.member.height).toBeNull();
      expect((await put({ height: 20 })).body.error).toBe('invalid_height');
      expect((await put({ height: 'grand' })).body.error).toBe('invalid_height');
    });

    it('should allow admin to update member profile', async () => {
      const response = await request(app)
        .put(`/members/${testMember.id}/profile`)
        .set('Authorization', authHeader(testAdmin))
        .send({ profession: 'Actif' });

      expect(response.status).toBe(200);
      expect(response.body.member.profession).toBe('Actif');
    });

    it('should return 403 if member tries to update other member profile', async () => {
      const response = await request(app)
        .put(`/members/${otherMember.id}/profile`)
        .set('Authorization', authHeader(testMember))
        .send({ profession: 'Actif' });

      expect(response.status).toBe(403);
    });

    it('should validate profession enum values', async () => {
      const response = await request(app)
        .put(`/members/${testMember.id}/profile`)
        .set('Authorization', authHeader(testMember))
        .send({ profession: 'InvalidProfession' });

      // Should fail due to Prisma enum validation
      expect(response.status).toBe(400);
    });

    it('should validate fitnessLevel enum values', async () => {
      const validLevels = ['debutant', 'intermediaire', 'avance', 'expert', 'athletique'];
      
      for (const level of validLevels) {
        const response = await request(app)
          .put(`/members/${testMember.id}/profile`)
          .set('Authorization', authHeader(testMember))
          .send({ fitnessLevel: level });

        expect(response.status).toBe(200);
        expect(response.body.member.fitnessLevel).toBe(level);
      }
    });

    it('should allow partial profile updates', async () => {
      const response = await request(app)
        .put(`/members/${testMember.id}/profile`)
        .set('Authorization', authHeader(testMember))
        .send({ phone: '+33699999999' });

      expect(response.status).toBe(200);
      expect(response.body.member.phone).toBe('+33699999999');
    });

    it('should return 404 for non-existent member', async () => {
      const response = await request(app)
        .put('/members/99999/profile')
        .set('Authorization', authHeader(testAdmin))
        .send({ phone: '+33612345678' });

      expect(response.status).toBe(404);
    });

    it('should handle date format correctly', async () => {
      const response = await request(app)
        .put(`/members/${testMember.id}/profile`)
        .set('Authorization', authHeader(testMember))
        .send({ birthDate: '1995-06-20' });

      expect(response.status).toBe(200);
      const birthDate = new Date(response.body.member.birthDate);
      expect(birthDate.getFullYear()).toBe(1995);
      expect(birthDate.getMonth()).toBe(5); // June (0-indexed)
      expect(birthDate.getDate()).toBe(20);
    });
  });

  describe('PUT /members/:id/onboarding', () => {
    it('should allow member to complete onboarding', async () => {
      const response = await request(app)
        .put(`/members/${otherMember.id}/onboarding`)
        .set('Authorization', authHeader(otherMember))
        .send({ onboarding: false });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('onboarding');
      expect(response.body.member.onboarding).toBe(false);
    });

    it('should allow admin to update member onboarding status', async () => {
      const response = await request(app)
        .put(`/members/${testMember.id}/onboarding`)
        .set('Authorization', authHeader(testAdmin))
        .send({ onboarding: true });

      expect(response.status).toBe(200);
      expect(response.body.member.onboarding).toBe(true);
    });

    it('should return 403 if member tries to update other member onboarding', async () => {
      const response = await request(app)
        .put(`/members/${otherMember.id}/onboarding`)
        .set('Authorization', authHeader(testMember))
        .send({ onboarding: false });

      expect(response.status).toBe(403);
    });

    it('should return 400 if onboarding value is missing', async () => {
      const response = await request(app)
        .put(`/members/${testMember.id}/onboarding`)
        .set('Authorization', authHeader(testMember))
        .send({});

      expect(response.status).toBe(400);
    });

    it('should accept boolean values', async () => {
      const response = await request(app)
        .put(`/members/${testMember.id}/onboarding`)
        .set('Authorization', authHeader(testMember))
        .send({ onboarding: false });

      expect(response.status).toBe(200);
      expect(response.body.member.onboarding).toBe(false);
    });
  });

  describe('PUT /members/:id/profile-picture', () => {
    it('should allow member to upload profile picture', async () => {
      const imageData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD';

      const response = await request(app)
        .put(`/members/${testMember.id}/profile-picture`)
        .set('Authorization', authHeader(testMember))
        .send({ imageData });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('picture');

      // Verify image was saved
      const user = await prisma.user.findUnique({
        where: { id: testMember.id }
      });
      expect(user.profileImage).not.toBeNull();
    });

    it('should allow admin to upload profile picture for member', async () => {
      const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';

      const response = await request(app)
        .put(`/members/${testMember.id}/profile-picture`)
        .set('Authorization', authHeader(testAdmin))
        .send({ imageData });

      expect(response.status).toBe(200);
    });

    it('should return 403 if member tries to upload for other member', async () => {
      const response = await request(app)
        .put(`/members/${otherMember.id}/profile-picture`)
        .set('Authorization', authHeader(testMember))
        .send({ imageData: 'data:image/jpeg;base64,test' });

      expect(response.status).toBe(403);
    });

    it('should return 400 if imageData is missing', async () => {
      const response = await request(app)
        .put(`/members/${testMember.id}/profile-picture`)
        .set('Authorization', authHeader(testMember))
        .send({});

      expect(response.status).toBe(400);
    });

    it('should handle base64 data without prefix', async () => {
      const response = await request(app)
        .put(`/members/${testMember.id}/profile-picture`)
        .set('Authorization', authHeader(testMember))
        .send({ imageData: 'SGVsbG8gV29ybGQ=' }); // "Hello World" in base64

      expect(response.status).toBe(200);
    });

    it('should replace existing profile picture', async () => {
      // Upload first image
      await request(app)
        .put(`/members/${testMember.id}/profile-picture`)
        .set('Authorization', authHeader(testMember))
        .send({ imageData: 'data:image/jpeg;base64,firstImage' });

      // Upload second image
      const response = await request(app)
        .put(`/members/${testMember.id}/profile-picture`)
        .set('Authorization', authHeader(testMember))
        .send({ imageData: 'data:image/jpeg;base64,secondImage' });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /members/:id/profile-picture', () => {
    it('should return member profile picture if exists', async () => {
      // Upload an image first
      const imageBuffer = Buffer.from('fake image data');
      await prisma.user.update({
        where: { id: testMember.id },
        data: { profileImage: imageBuffer }
      });

      const response = await request(app)
        .get(`/members/${testMember.id}/profile-picture`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/image/);
    });

    it('should return SVG placeholder if no picture exists', async () => {
      // Clear any existing profile picture
      await prisma.user.update({
        where: { id: testMember.id },
        data: { profileImage: null }
      });

      const response = await request(app)
        .get(`/members/${testMember.id}/profile-picture`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('image/svg+xml');
      const svgText = response.body.toString('utf8');
      expect(svgText).toContain('<svg');
      expect(svgText).toContain('TM'); // Initials of "Test Member"
    });

    it('should allow admin to get member profile picture', async () => {
      const response = await request(app)
        .get(`/members/${testMember.id}/profile-picture`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
    });

    it('should return 403 if member tries to get other member picture', async () => {
      const response = await request(app)
        .get(`/members/${otherMember.id}/profile-picture`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent member', async () => {
      const response = await request(app)
        .get('/members/99999/profile-picture')
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(404);
    });

    it('should detect JPEG images correctly', async () => {
      // JPEG magic bytes: FF D8 FF
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00]);
      await prisma.user.update({
        where: { id: testMember.id },
        data: { profileImage: jpegBuffer }
      });

      const response = await request(app)
        .get(`/members/${testMember.id}/profile-picture`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/jpeg');
    });

    it('should detect PNG images correctly', async () => {
      // PNG magic bytes: 89 50 4E 47
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D]);
      await prisma.user.update({
        where: { id: testMember.id },
        data: { profileImage: pngBuffer }
      });

      const response = await request(app)
        .get(`/members/${testMember.id}/profile-picture`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
    });
  });

  describe('DELETE /members/:id/profile-picture', () => {
    beforeEach(async () => {
      // Add a profile picture to testMember
      const imageBuffer = Buffer.from('fake image data');
      await prisma.user.update({
        where: { id: testMember.id },
        data: { profileImage: imageBuffer }
      });
    });

    it('should allow member to delete their profile picture', async () => {
      const response = await request(app)
        .delete(`/members/${testMember.id}/profile-picture`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      // Verify picture was deleted
      const user = await prisma.user.findUnique({
        where: { id: testMember.id }
      });
      expect(user.profileImage).toBeNull();
    });

    it('should allow admin to delete member profile picture', async () => {
      const response = await request(app)
        .delete(`/members/${testMember.id}/profile-picture`)
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(200);
    });

    it('should return 403 if member tries to delete other member picture', async () => {
      const response = await request(app)
        .delete(`/members/${otherMember.id}/profile-picture`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent member', async () => {
      const response = await request(app)
        .delete('/members/99999/profile-picture')
        .set('Authorization', authHeader(testAdmin));

      expect(response.status).toBe(404);
    });

    it('should succeed even if no picture exists', async () => {
      // Delete picture first
      await prisma.user.update({
        where: { id: testMember.id },
        data: { profileImage: null }
      });

      // Try to delete again
      const response = await request(app)
        .delete(`/members/${testMember.id}/profile-picture`)
        .set('Authorization', authHeader(testMember));

      expect(response.status).toBe(200);
    });
  });

  describe('PUT /members/:id/preferred-training-days', () => {
    it('should allow member to update preferred training days', async () => {
      const preferredDays = ['monday', 'wednesday', 'friday'];

      const response = await request(app)
        .put(`/members/${testMember.id}/preferred-training-days`)
        .set('Authorization', authHeader(testMember))
        .send({ preferredTrainingDays: preferredDays });

      expect(response.status).toBe(200);
      expect(response.body.member.preferredTrainingDays).toEqual(preferredDays);
    });

    it('should allow admin to update member preferred training days', async () => {
      const response = await request(app)
        .put(`/members/${testMember.id}/preferred-training-days`)
        .set('Authorization', authHeader(testAdmin))
        .send({ preferredTrainingDays: [2, 4] }); // 2=Tuesday, 4=Thursday

      expect(response.status).toBe(200);
    });

    it('should return 403 if member tries to update other member days', async () => {
      const response = await request(app)
        .put(`/members/${otherMember.id}/preferred-training-days`)
        .set('Authorization', authHeader(testMember))
        .send({ preferredTrainingDays: [1] }); // 1=Monday

      expect(response.status).toBe(403);
    });

    it('should return 400 if preferredTrainingDays is missing', async () => {
      const response = await request(app)
        .put(`/members/${testMember.id}/preferred-training-days`)
        .set('Authorization', authHeader(testMember))
        .send({});

      expect(response.status).toBe(400);
    });

    it('should accept empty array', async () => {
      const response = await request(app)
        .put(`/members/${testMember.id}/preferred-training-days`)
        .set('Authorization', authHeader(testMember))
        .send({ preferredTrainingDays: [] });

      expect(response.status).toBe(200);
      expect(response.body.member.preferredTrainingDays).toEqual([]);
    });

    it('should accept all days of the week', async () => {
      const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

      const response = await request(app)
        .put(`/members/${testMember.id}/preferred-training-days`)
        .set('Authorization', authHeader(testMember))
        .send({ preferredTrainingDays: allDays });

      expect(response.status).toBe(200);
      expect(response.body.member.preferredTrainingDays).toHaveLength(7);
    });
  });

  describe('Member Access Control', () => {
    it('should allow owner to access any member profile', async () => {
      const otherGym = await createTestGym({ name: 'Other Gym' });
      const owner = await prisma.user.create({
        data: {
          displayId: 'OWN123',
          uniqueCode: `OWN${Date.now().toString().slice(-6)}`,
          email: 'owner@test.com',
          phoneNumber: '+33600000000',
          password: '$2a$10$hash',
          firstName: 'Test',
          lastName: 'Owner',
          role: 'owner',
          gymId: otherGym.id,
          Owner: {
            create: {
              canManageAdmins: true,
              canManageGyms: true,
              canViewReports: true,
              maxGymsAllowed: 10
            }
          }
        },
        include: { Owner: true }
      });

      const response = await request(app)
        .put(`/members/${testMember.id}/profile`)
        .set('Authorization', authHeader(owner))
        .send({ phone: '+33611111111' });

      expect(response.status).toBe(200);
    });

    it('should not allow admin from different gym to access member', async () => {
      const otherGym = await createTestGym({ name: 'Other Gym' });
      const otherAdmin = await createTestAdmin(otherGym.id, {
        email: 'otheradmin@test.com'
      });

      const response = await request(app)
        .put(`/members/${testMember.id}/profile`)
        .set('Authorization', authHeader(otherAdmin))
        .send({ phone: '+33611111111' });

      expect(response.status).toBe(403);
    });
  });
});
