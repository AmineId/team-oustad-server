const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();
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
    
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const memberUser = await prisma.user.findUnique({
      where: { id: memberId },
      include: { member: true }
    });

    if (!memberUser || !memberUser.member) {
      return notFound(res, 'Member', memberId);
    }

    // Owner peut tout modifier
    if (requester.role === 'owner') {
      req.targetMember = memberUser;
      return next();
    }

    // Admin peut modifier les membres de sa salle
    if (requester.role === 'admin' && memberUser.gymId === requester.gymId) {
      req.targetMember = memberUser;
      return next();
    }

    // Member peut modifier son propre profil
    if (requester.role === 'member' && memberId === req.user.sub) {
      req.targetMember = memberUser;
      return next();
    }

    return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour accéder à ce profil' });
  } catch (error) {
    console.error('Erreur middleware canAccessMemberProfile:', error);
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
router.put('/:id/profile', auth, canAccessMemberProfile, async (req, res) => {
  console.log(`👤 Mise à jour profil membre - User ID: ${req.params.id}`);

  try {
    const memberId = Number(req.params.id);
    const { birthDate, phone, profession, fitnessLevel, profileImage, preferredTrainingDays, workoutNotificationsEnabled, onboarding } = req.body;

    const updateData = {};
    
    // Mettre à jour les champs du profil Member
    const memberUpdateData = {};
    if (birthDate !== undefined) memberUpdateData.birthDate = birthDate ? new Date(birthDate) : null;
    if (phone !== undefined) memberUpdateData.phone = phone;
    if (profession !== undefined) memberUpdateData.profession = profession;
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
        user: {
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

    console.log(`✅ Profil membre mis à jour pour ${updatedMember.user.fullName}`);

    res.json({
      message: 'Profil membre mis à jour avec succès',
      member: {
        userId: updatedMember.userId,
        email: updatedMember.user.email,
        fullName: updatedMember.user.fullName,
        displayId: updatedMember.user.displayId,
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
    console.error('💥 Erreur mise à jour profil membre:', e);
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
router.post('/:id/goals', auth, canAccessMemberProfile, async (req, res) => {
  console.log(`🎯 Création objectif membre - User ID: ${req.params.id}`);

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
        member: {
          include: {
            user: {
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

    console.log(`✅ Objectif créé pour ${goal.member.user.fullName}: ${goal.title}`);

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
    console.error('💥 Erreur création objectif:', e);
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
  console.log(`📋 Récupération objectifs membre - User ID: ${req.params.id}`);

  try {
    const memberId = Number(req.params.id);

    const goals = await prisma.memberGoal.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`✅ ${goals.length} objectifs trouvés`);

    res.json({ goals });

  } catch (e) {
    console.error('💥 Erreur récupération objectifs:', e);
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
router.post('/:id/measurements', auth, canAccessMemberProfile, async (req, res) => {
  console.log(`📏 Création mesure membre - User ID: ${req.params.id}`);

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
        member: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true, lastName: true
              }
            }
          }
        }
      }
    });

    console.log(`✅ Mesure créée pour ${measurement.member.user.fullName}`);

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
    console.error('💥 Erreur création mesure:', e);
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
  console.log(`📊 Récupération mesures membre - User ID: ${req.params.id}`);

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

    console.log(`✅ ${measurements.length} mesures trouvées`);

    res.json({ measurements });

  } catch (e) {
    console.error('💥 Erreur récupération mesures:', e);
    handleError(res, e, 500);
  }
});

module.exports = router;
