const express = require('express');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const auth = require('../middleware/auth');
const { generateUserIdByRole } = require('../utils/idGenerator');
const { getFullName } = require('../utils/nameUtils');

// Utility helpers
function handleError(res, e, status = 400) {
  res.status(status).json({ error: e.message });
}
function notFound(res, entity, id) {
  res.status(404).json({ error: `${entity} with id ${id} not found` });
}

// Middleware pour vérifier les permissions d'accès au profil membre
const canAccessMemberProfile = async (req, res, next) => {
  try {
    const memberId = Number(req.params.id);
    logger.info(`🔐 Vérification accès membre - MemberID: ${memberId}, RequesterID: ${req.user?.sub}, RequesterRole: ${req.user?.type}`);
    
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé - ID: ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    logger.info(`👤 Requester: ${getFullName(requester)} (${requester.role}, GymID: ${requester.gymId})`);

    const memberUser = await prisma.user.findUnique({
      where: { id: memberId },
      include: { Member: true }
    });

    if (!memberUser || !memberUser.Member) {
      logger.warn(`❌ Membre non trouvé - ID: ${memberId}`);
      return notFound(res, 'Member', memberId);
    }

    logger.info(`👤 Membre cible: ${getFullName(memberUser)} (GymID: ${memberUser.gymId})`);

    // Owner peut tout modifier
    if (requester.role === 'owner') {
      logger.info(`✅ Accès autorisé: Owner`);
      req.targetMember = memberUser;
      return next();
    }

    // Admin peut modifier les membres de sa salle
    if (requester.role === 'admin' && memberUser.gymId === requester.gymId) {
      logger.info(`✅ Accès autorisé: Admin de la même salle`);
      req.targetMember = memberUser;
      return next();
    }

    // Member peut modifier son propre profil
    if (requester.role === 'member' && memberId === req.user.sub) {
      logger.info(`✅ Accès autorisé: Membre accède à son propre profil`);
      req.targetMember = memberUser;
      return next();
    }

    logger.warn(`❌ Accès refusé: Requester ${requester.role} ne peut pas accéder au membre ${memberId}`);
    return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour accéder à ce profil' });
  } catch (error) {
    logger.error('❌ Erreur middleware canAccessMemberProfile:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * @swagger
 * /members/{id}/profile:
 *   put:
 *     summary: Update member profile information
 *     description: Update member's profile including birthDate, phone, profession, fitnessLevel, and profile picture
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Member user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               birthDate:
 *                 type: string
 *                 format: date
 *                 description: Member's birth date
 *                 example: "1990-05-15"
 *               phone:
 *                 type: string
 *                 description: Phone number
 *                 example: "+33612345678"
 *               profession:
 *                 type: string
 *                 enum: [Actif, Etudiant]
 *                 description: Profession status
 *                 example: "Actif"
 *               fitnessLevel:
 *                 type: string
 *                 enum: [debutant, intermediaire, avance, expert, athletique]
 *                 description: Fitness level
 *                 example: "intermediaire"
 *               profileImage:
 *                 type: string
 *                 description: Base64 encoded profile image
 *                 example: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
 *               workoutNotificationsEnabled:
 *                 type: boolean
 *                 description: Enable/disable workout session notifications
 *                 example: true
 *               onboarding:
 *                 type: boolean
 *                 description: Onboarding status (true = in progress, false = completed)
 *                 example: false
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Member not found
 *       500:
 *         description: Server error
 */
router.put('/:id/profile', auth, canAccessMemberProfile, apiLimiter, async (req, res) => {
  logger.info(`👤 Mise à jour profil membre - User ID: ${req.params.id}`);

  try {
    const memberId = Number(req.params.id);
    const { birthDate, phone, profession, fitnessLevel, profileImage, preferredTrainingDays, workoutNotificationsEnabled, onboarding } = req.body;

    const updateData = {};
    
    // Mettre à jour les champs du profil Member
    const memberUpdateData = {};
    if (birthDate !== undefined) memberUpdateData.birthDate = birthDate ? new Date(birthDate) : null;
    if (phone !== undefined) memberUpdateData.phone = phone;
    if (profession !== undefined) {
      // Validate profession enum
      const validProfessions = ['Actif', 'Etudiant', 'Retraite', 'Autre'];
      if (!validProfessions.includes(profession)) {
        return res.status(400).json({ error: 'Invalid profession value' });
      }
      memberUpdateData.profession = profession;
    }
    if (fitnessLevel !== undefined) memberUpdateData.fitnessLevel = fitnessLevel;
    if (onboarding !== undefined) memberUpdateData.onboarding = onboarding;
    if (onboarding !== undefined) memberUpdateData.onboarding = onboarding;
    if (preferredTrainingDays !== undefined) {
      // Valider que c'est un tableau de nombres entre 0 et 6
      if (Array.isArray(preferredTrainingDays) && preferredTrainingDays.every(day => typeof day === 'number' && day >= 0 && day <= 6)) {
        memberUpdateData.preferredTrainingDays = preferredTrainingDays;
      } else {
        return res.status(400).json({ error: 'preferredTrainingDays doit être un tableau de nombres entre 0 (dimanche) et 6 (samedi)' });
      }
    }
    if (workoutNotificationsEnabled !== undefined) memberUpdateData.workoutNotificationsEnabled = workoutNotificationsEnabled;

    // Mettre à jour la photo de profil dans User
    if (profileImage !== undefined) {
      if (profileImage === null || profileImage === '') {
        updateData.profileImage = null;
      } else {
        try {
          let imageBuffer;
          if (profileImage.startsWith('data:image/')) {
            const base64Data = profileImage.split(',')[1];
            imageBuffer = Buffer.from(base64Data, 'base64');
          } else {
            imageBuffer = Buffer.from(profileImage, 'base64');
          }
          updateData.profileImage = imageBuffer;
        } catch (error) {
          return res.status(400).json({ error: 'Données d\'image invalides' });
        }
      }
    }

    // Mettre à jour le profil Member si nécessaire
    if (Object.keys(memberUpdateData).length > 0) {
      await prisma.member.update({
        where: { userId: memberId },
        data: memberUpdateData
      });
    }

    // Mettre à jour l'utilisateur si nécessaire (photo de profil)
    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: memberId },
        data: updateData
      });
    }

    // Récupérer le profil mis à jour
    const updatedMember = await prisma.member.findUnique({
      where: { userId: memberId },
      include: {
        User: {
          select: {
            id: true,
            email: true,
            firstName: true,
              lastName: true,
            displayId: true
          }
        }
      }
    });

    logger.info(`✅ Profil membre mis à jour pour ${getFullName(updatedMember.User)}`);

    res.json({
      message: 'Profil membre mis à jour avec succès',
      member: {
        userId: updatedMember.userId,
        email: updatedMember.User.email,
        firstName: updatedMember.User.firstName,
        lastName: updatedMember.User.lastName,
        fullName: getFullName(updatedMember.User),
        displayId: updatedMember.User.displayId,
        birthDate: updatedMember.birthDate,
        phone: updatedMember.phone,
        profession: updatedMember.profession,
        fitnessLevel: updatedMember.fitnessLevel,
        preferredTrainingDays: updatedMember.preferredTrainingDays,
        workoutNotificationsEnabled: updatedMember.workoutNotificationsEnabled,
        onboarding: updatedMember.onboarding,
        joinedAt: updatedMember.joinedAt
      }
    });

  } catch (e) {
    logger.error('💥 Erreur mise à jour profil membre:', e);
    handleError(res, e, 500);
  }
});

// PUT /members/:id/onboarding - Update onboarding status
router.put('/:id/onboarding', auth, apiLimiter, async (req, res) => {
  try {
    const memberId = Number(req.params.id);
    const { onboarding } = req.body;

    if (onboarding === undefined) {
      return res.status(400).json({ error: 'onboarding is required' });
    }

    // Check permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) return res.status(403).json({ error: 'Forbidden' });

    if (requester.role === 'member' && requester.id !== memberId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const member = await prisma.member.update({
      where: { userId: memberId },
      data: { onboarding: Boolean(onboarding) }
    });

    res.json({ message: 'onboarding status updated', member });
  } catch (e) {
    handleError(res, e, 500);
  }
});

// PUT /members/:id/profile-picture - Upload profile picture
router.put('/:id/profile-picture', auth, apiLimiter, async (req, res) => {
  try {
    const memberId = Number(req.params.id);
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'imageData is required' });
    }

    // Check permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) return res.status(403).json({ error: 'Forbidden' });

    if (requester.role === 'member' && requester.id !== memberId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Process base64 image
    let imageBuffer;
    try {
      if (imageData.startsWith('data:image/')) {
        const base64Data = imageData.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        imageBuffer = Buffer.from(imageData, 'base64');
      }
    } catch (error) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    await prisma.user.update({
      where: { id: memberId },
      data: { profileImage: imageBuffer }
    });

    res.json({ message: 'Profile picture uploaded successfully' });
  } catch (e) {
    handleError(res, e, 500);
  }
});

// GET /members/:id/profile-picture - Get profile picture
router.get('/:id/profile-picture', auth, async (req, res) => {
  try {
    const memberId = Number(req.params.id);

    // Check permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) return res.status(403).json({ error: 'Forbidden' });

    if (requester.role === 'member' && requester.id !== memberId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await prisma.user.findUnique({
      where: { id: memberId },
      select: { profileImage: true, firstName: true, lastName: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (!user.profileImage) {
      // Return SVG placeholder with initials
      const initials = `${(user.firstName || '?')[0]}${(user.lastName || '?')[0]}`.toUpperCase();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#ddd"/><text x="50%" y="50%" font-size="60" text-anchor="middle" dy=".3em" fill="#999">${initials}</text></svg>`;
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }

    // Detect image type
    const buffer = user.profileImage;
    let contentType = 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      contentType = 'image/png';
    }

    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  } catch (e) {
    handleError(res, e, 500);
  }
});

// DELETE /members/:id/profile-picture - Delete profile picture
router.delete('/:id/profile-picture', auth, apiLimiter, async (req, res) => {
  try {
    const memberId = Number(req.params.id);

    // Check permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) return res.status(403).json({ error: 'Forbidden' });

    if (requester.role === 'member' && requester.id !== memberId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: memberId } });
    if (!user) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await prisma.user.update({
      where: { id: memberId },
      data: { profileImage: null }
    });

    res.json({ message: 'Profile picture deleted successfully' });
  } catch (e) {
    handleError(res, e, 500);
  }
});

// PUT /members/:id/preferred-training-days - Update preferred training days
router.put('/:id/preferred-training-days', auth, apiLimiter, async (req, res) => {
  try {
    const memberId = Number(req.params.id);
    const { days, preferredTrainingDays } = req.body;
    const daysArray = days !== undefined ? days : preferredTrainingDays;

    if (daysArray === undefined || !Array.isArray(daysArray)) {
      return res.status(400).json({ error: 'days must be an array' });
    }

    // Convert day names to numbers if strings
    const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const numericDays = daysArray.map(day => typeof day === 'string' ? dayMap[day.toLowerCase()] : day);

    // Validate days are 0-6
    if (numericDays.some(d => d === undefined || typeof d !== 'number' || d < 0 || d > 6)) {
      return res.status(400).json({ error: 'days must be numbers between 0 and 6 or valid day names' });
    }

    // Check permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) return res.status(403).json({ error: 'Forbidden' });

    if (requester.role === 'member' && requester.id !== memberId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const member = await prisma.member.update({
      where: { userId: memberId },
      data: { preferredTrainingDays: numericDays }
    });

    // Return with original format
    res.json({ message: 'preferred training days updated', member: { ...member, preferredTrainingDays: daysArray } });
  } catch (e) {
    handleError(res, e, 500);
  }
});

/**
 * @swagger
 * /members/{id}/goals:
 *   post:
 *     summary: Create a new goal for member
 *     description: Create a goal with morphological data (weight, waist) for tracking
 *     tags: [Members, Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Member user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Goal title
 *                 example: "Perte de poids"
 *               description:
 *                 type: string
 *                 description: Detailed description
 *                 example: "Perdre 10kg en 3 mois"
 *               targetDate:
 *                 type: string
 *                 format: date
 *                 description: Target date to achieve goal
 *                 example: "2025-02-15"
 *               startWeight:
 *                 type: number
 *                 format: float
 *                 description: Starting weight in kg
 *                 example: 85.5
 *               targetWeight:
 *                 type: number
 *                 format: float
 *                 description: Target weight in kg
 *                 example: 75.0
 *               startWaist:
 *                 type: number
 *                 format: float
 *                 description: Starting waist size in cm
 *                 example: 95.0
 *               targetWaist:
 *                 type: number
 *                 format: float
 *                 description: Target waist size in cm
 *                 example: 85.0
 *     responses:
 *       201:
 *         description: Goal created successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Member not found
 *       500:
 *         description: Server error
 */
router.post('/:id/goals', auth, canAccessMemberProfile, apiLimiter, async (req, res) => {
  logger.info(`🎯 Création objectif membre - User ID: ${req.params.id}`);

  try {
    const memberId = Number(req.params.id);
    const {
      title,
      description,
      targetDate,
      startWeight,
      targetWeight,
      startWaist,
      targetWaist
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Le titre est requis' });
    }

    const goal = await prisma.memberGoal.create({
      data: {
        displayId: `GOAL-${require('crypto').randomBytes(8).toString('hex')}`,
        memberId,
        title,
        description,
        targetDate: targetDate ? new Date(targetDate) : null,
        startWeight,
        targetWeight,
        startWaist,
        targetWaist,
        status: 'active'
      },
      include: {
        Member: {
          include: {
            User: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    logger.info(`✅ Objectif créé pour ${getFullName(goal.Member.User)}: ${goal.title}`);

    res.status(201).json({
      message: 'Objectif créé avec succès',
      goal: {
        id: goal.id,
        displayId: goal.displayId,
        title: goal.title,
        description: goal.description,
        targetDate: goal.targetDate,
        startWeight: goal.startWeight,
        targetWeight: goal.targetWeight,
        startWaist: goal.startWaist,
        targetWaist: goal.targetWaist,
        status: goal.status,
        createdAt: goal.createdAt
      }
    });

  } catch (e) {
    logger.error('💥 Erreur création objectif:', e);
    handleError(res, e, 500);
  }
});

/**
 * @swagger
 * /members/{id}/goals:
 *   get:
 *     summary: Get all goals for a member
 *     description: Retrieve all goals (active, achieved, abandoned) for a member
 *     tags: [Members, Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Member user ID
 *     responses:
 *       200:
 *         description: List of goals
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Member not found
 *       500:
 *         description: Server error
 */
router.get('/:id/goals', auth, canAccessMemberProfile, async (req, res) => {
  logger.info(`📋 Récupération objectifs membre - User ID: ${req.params.id}`);

  try {
    const memberId = Number(req.params.id);

    const goals = await prisma.memberGoal.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' }
    });

    logger.info(`✅ ${goals.length} objectifs trouvés`);

    res.json({ goals });

  } catch (e) {
    logger.error('💥 Erreur récupération objectifs:', e);
    handleError(res, e, 500);
  }
});

/**
 * @swagger
 * /members/{id}/measurements:
 *   post:
 *     summary: Create a new measurement for member
 *     description: Add morphological measurements for tracking progress (weight, waist, chest, etc.)
 *     tags: [Members, Measurements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Member user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               weight:
 *                 type: number
 *                 format: float
 *                 description: Weight in kg
 *                 example: 82.5
 *               waist:
 *                 type: number
 *                 format: float
 *                 description: Waist size in cm
 *                 example: 90.0
 *               chest:
 *                 type: number
 *                 format: float
 *                 description: Chest size in cm
 *                 example: 100.0
 *               hips:
 *                 type: number
 *                 format: float
 *                 description: Hips size in cm
 *                 example: 95.0
 *               thigh:
 *                 type: number
 *                 format: float
 *                 description: Thigh size in cm
 *                 example: 60.0
 *               arm:
 *                 type: number
 *                 format: float
 *                 description: Arm size in cm
 *                 example: 35.0
 *               bodyFat:
 *                 type: number
 *                 format: float
 *                 description: Body fat percentage
 *                 example: 18.5
 *               muscleMass:
 *                 type: number
 *                 format: float
 *                 description: Muscle mass in kg
 *                 example: 65.0
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *                 example: "Mesure après entraînement"
 *               measuredAt:
 *                 type: string
 *                 format: date-time
 *                 description: Measurement date (defaults to now)
 *                 example: "2025-11-19T10:30:00Z"
 *     responses:
 *       201:
 *         description: Measurement created successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Member not found
 *       500:
 *         description: Server error
 */
router.post('/:id/measurements', auth, canAccessMemberProfile, apiLimiter, async (req, res) => {
  logger.info(`📏 Création mesure membre - User ID: ${req.params.id}`);

  try {
    const memberId = Number(req.params.id);
    const {
      weight,
      waist,
      chest,
      hips,
      thigh,
      arm,
      bodyFat,
      muscleMass,
      notes,
      measuredAt
    } = req.body;

    const measurement = await prisma.memberMeasurement.create({
      data: {
        displayId: `MEAS-${require('crypto').randomBytes(8).toString('hex')}`,
        memberId,
        weight,
        waist,
        chest,
        hips,
        thigh,
        arm,
        bodyFat,
        muscleMass,
        notes,
        measuredBy: req.user.sub, // L'utilisateur qui crée la mesure
        measuredAt: measuredAt ? new Date(measuredAt) : new Date()
      },
      include: {
        Member: {
          include: {
            User: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    logger.info(`✅ Mesure créée pour ${getFullName(measurement.Member.User)}`);

    res.status(201).json({
      message: 'Mesure créée avec succès',
      measurement: {
        id: measurement.id,
        displayId: measurement.displayId,
        weight: measurement.weight,
        waist: measurement.waist,
        chest: measurement.chest,
        hips: measurement.hips,
        thigh: measurement.thigh,
        arm: measurement.arm,
        bodyFat: measurement.bodyFat,
        muscleMass: measurement.muscleMass,
        notes: measurement.notes,
        measuredAt: measurement.measuredAt,
        measuredBy: measurement.measuredBy,
        createdAt: measurement.createdAt
      }
    });

  } catch (e) {
    logger.error('💥 Erreur création mesure:', e);
    handleError(res, e, 500);
  }
});

/**
 * @swagger
 * /members/{id}/measurements:
 *   get:
 *     summary: Get all measurements for a member
 *     description: Retrieve measurement history for tracking progress over time
 *     tags: [Members, Measurements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Member user ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of measurements to return
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter measurements from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter measurements until this date
 *     responses:
 *       200:
 *         description: List of measurements
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Member not found
 *       500:
 *         description: Server error
 */
router.get('/:id/measurements', auth, canAccessMemberProfile, async (req, res) => {
  logger.info(`📊 Récupération mesures membre - User ID: ${req.params.id}`);

  try {
    const memberId = Number(req.params.id);
    const { limit = 50, startDate, endDate } = req.query;

    const where = { memberId };

    // Filtrer par date si fourni
    if (startDate || endDate) {
      where.measuredAt = {};
      if (startDate) where.measuredAt.gte = new Date(startDate);
      if (endDate) where.measuredAt.lte = new Date(endDate);
    }

    const measurements = await prisma.memberMeasurement.findMany({
      where,
      orderBy: { measuredAt: 'desc' },
      take: Number(limit)
    });

    logger.info(`✅ ${measurements.length} mesures trouvées`);

    res.json({ measurements });

  } catch (e) {
    logger.error('💥 Erreur récupération mesures:', e);
    handleError(res, e, 500);
  }
});

module.exports = router;
