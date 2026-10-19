const express = require('express');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const auth = require('../middleware/auth');
const { generatePlanningId, generateExerciseId } = require('../utils/idGenerator');
const { getFullName } = require('../utils/nameUtils');
const { 
  notifyNewTrainingPlan,
  notifyPlanningModified,
  notifyPlanningDeleted
} = require('../services/pushNotificationService');

// Utility helpers
function handleError(res, e, status = 400) {
  res.status(status).json({ error: e.message });
}
function notFound(res, entity, id) {
  res.status(404).json({ error: `${entity} with id ${id} not found` });
}

// Middleware pour vérifier que c'est un admin (coach)
// IMPORTANT: Ce middleware doit être utilisé APRÈS le middleware auth
const requireCoach = async (req, res, next) => {
  logger.info(`🏋️ Vérification rôle Coach - User: ${req.user?.email} (${req.user?.type})`);

  if (!req.user) {
    logger.warn('❌ req.user est undefined - Le middleware auth n\'a pas été appliqué');
    return res.status(401).json({ error: 'Authentification requise' });
  }

  try {
    logger.debug(`🔍 Recherche utilisateur en base - ID: ${req.user.sub}`);
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { Admin: true }
    });

    if (!user) {
      logger.warn(`❌ Utilisateur non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Accès réservé aux coachs' });
    }

    logger.debug(`✅ Utilisateur trouvé: ${getFullName(user)} (${user.role}) - ID: ${user.id}`);
    logger.debug(`🔍 Vérification rôle admin pour coach...`);

    if (user.role !== 'admin') {
      logger.warn(`🚫 Rôle insuffisant: ${getFullName(user)} est ${user.role}, coach requis`);
      return res.status(403).json({ error: 'Accès réservé aux coachs' });
    }

    logger.debug(`✅ Rôle admin validé pour ${getFullName(user)}`);
    req.user.coachProfile = user.Admin;
    logger.debug(`✅ Accès coach autorisé pour ${getFullName(user)}`);
    next();
  } catch (error) {
    logger.error('💥 Erreur middleware requireCoach:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== EXERCICES ====================

// Créer un nouvel exercice (seulement pour les coachs)
/**
 * @swagger
 * /plannings/exercises:
 *   post:
 *     summary: Create a new exercise
 *     description: Create a new exercise that can be used in workout plans. Only coaches can create exercises.
 *     tags: [Plannings, Exercises]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *               - difficulty
 *             properties:
 *               name:
 *                 type: string
 *                 description: Exercise name
 *                 example: "Push-ups"
 *               description:
 *                 type: string
 *                 description: Exercise description
 *                 example: "Classic bodyweight exercise for chest and triceps"
 *               category:
 *                 type: string
 *                 enum: [strength, cardio, flexibility, balance, functional]
 *                 description: Exercise category
 *                 example: "strength"
 *               muscleGroup:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Target muscle groups
 *                 example: ["chest", "triceps"]
 *               equipment:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Required equipment
 *                 example: ["none"]
 *               difficulty:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *                 description: Exercise difficulty level
 *                 example: "beginner"
 *               instructions:
 *                 type: string
 *                 description: Detailed exercise instructions
 *                 example: "Start in plank position, lower your body until chest nearly touches floor, then push back up."
 *     responses:
 *       201:
 *         description: Exercise created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Exercice créé avec succès"
 *                 exercise:
 *                   $ref: '#/components/schemas/Exercise'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Nom et catégorie requis"
 *       403:
 *         description: Access denied - not a coach
 *       500:
 *         description: Server error
 */
router.post('/exercises', auth, requireCoach, apiLimiter, async (req, res) => {
  logger.info(`🏋️ Création exercice - Coach: ${req.user?.email}, Données: ${JSON.stringify(req.body)}`);

  try {
    const { name, description, category, muscleGroup, equipment, difficulty, instructions } = req.body;

    if (!name || !category || !difficulty) {
      logger.warn(`❌ Création exercice échouée - Champs manquants`);
      return res.status(400).json({ error: 'Nom, catégorie et difficulté requis' });
    }

    logger.debug(`✅ Données validées pour exercice: ${name} | catégorie: ${category} | difficulté: ${difficulty}`);

    const exercise = await prisma.exercise.create({
      data: {
        displayId: generateExerciseId(),
        name,
        description,
        category,
        muscleGroup: muscleGroup || [],
        equipment: equipment || [],
        difficulty,
        instructions
      }
    });

    logger.info(`✅ Exercice créé: ${exercise.name} (ID: ${exercise.id})`);

    const responseData = {
      message: 'Exercice créé avec succès',
      exercise
    };

    res.status(201).json(responseData);
  } catch (e) {
    logger.error('💥 Erreur création exercice:', e);
    handleError(res, e);
  }
});

// Lister tous les exercices
/**
 * @swagger
 * /plannings/exercises:
 *   get:
 *     summary: List all exercises
 *     description: Get a list of all available exercises with optional filtering.
 *     tags: [Plannings, Exercises]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *         description: Filter by difficulty
 *       - in: query
 *         name: muscleGroup
 *         schema:
 *           type: string
 *         description: Filter by muscle group
 *     responses:
 *       200:
 *         description: List of exercises
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exercises:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Exercise'
 *       500:
 *         description: Server error
 */
router.get('/exercises', auth, async (req, res) => {
  logger.info(`📋 Liste des exercices - User: ${req.user?.email}, Filtres: ${JSON.stringify(req.query)}`);

  try {
    const { category, difficulty, muscleGroup } = req.query;

    const whereClause = {};
    if (category) whereClause.category = category;
    if (difficulty) whereClause.difficulty = difficulty;
    if (muscleGroup) whereClause.muscleGroup = { has: muscleGroup };

    const exercises = await prisma.exercise.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });

    logger.info(`✅ ${exercises.length} exercice(s) trouvé(s)`);

    const responseData = { exercises };
    res.json(responseData);
  } catch (e) {
    logger.error('💥 Erreur list exercises:', e);
    handleError(res, e, 500);
  }
});

// Obtenir les détails d'un exercice spécifique
router.get('/exercises/:id', auth, async (req, res) => {
  logger.info(`🔍 Détails exercice - User: ${req.user?.email}, ID: ${req.params.id}`);

  try {
    const exerciseId = parseInt(req.params.id);
    
    if (isNaN(exerciseId)) {
      logger.warn(`❌ ID exercice invalide: ${req.params.id}`);
      return res.status(400).json({ error: 'ID exercice invalide' });
    }

    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId }
    });

    if (!exercise) {
      logger.warn(`❌ Exercice non trouvé: ID ${exerciseId}`);
      return res.status(404).json({ error: 'Exercice non trouvé' });
    }

    logger.info(`✅ Exercice trouvé: ${exercise.name}`);
    res.json({ exercise });
  } catch (e) {
    logger.error('💥 Erreur get exercise:', e);
    handleError(res, e, 500);
  }
});

// ==================== PLANNINGS ====================

// Créer un nouveau planning (seulement pour les coachs)
/**
 * @swagger
 * /plannings:
 *   post:
 *     summary: Create a new workout plan
 *     description: Create a new workout plan for a member. Only coaches can create plans for members in their gym.
 *     tags: [Plannings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberId
 *               - title
 *               - startDate
 *               - endDate
 *             properties:
 *               memberId:
 *                 type: integer
 *                 description: ID of the member
 *                 example: 1
 *               title:
 *                 type: string
 *                 description: Plan title
 *                 example: "Upper Body Strength Training"
 *               description:
 *                 type: string
 *                 description: Plan description
 *                 example: "Focus on building upper body strength"
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Plan start date
 *                 example: "2025-11-15"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: Plan end date
 *                 example: "2025-12-15"
 *     responses:
 *       201:
 *         description: Planning created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Planning créé avec succès"
 *                 planning:
 *                   $ref: '#/components/schemas/Planning'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Membre, titre, dates et jour requis"
 *       403:
 *         description: Access denied - not a coach or member not in coach's gym
 *       404:
 *         description: Member not found
 *       500:
 *         description: Server error
 */
router.post('/', auth, requireCoach, apiLimiter, async (req, res) => {
  logger.info(`📅 Création planning - Coach: ${req.user?.email}, Données: ${JSON.stringify(req.body)}`);

  try {
    const { memberId, title, description, startDate, endDate } = req.body;
    logger.debug(`🔍 Validation des données - memberId: ${memberId}, title: ${title}, dates: ${startDate} -> ${endDate}`);

    if (!memberId || !title || !startDate || !endDate) {
      logger.warn(`❌ Création planning échouée - Champs manquants: memberId=${!!memberId}, title=${!!title}, startDate=${!!startDate}, endDate=${!!endDate}`);
      return res.status(400).json({ error: 'Membre, titre, dates requis' });
    }

    logger.debug(`🔍 Recherche du membre - ID: ${memberId}`);
    // Vérifier que le membre existe et appartient à la même salle que le coach
    const member = await prisma.member.findUnique({
      where: { userId: memberId },
      include: { User: true }
    });

    if (!member) {
      logger.warn(`❌ Membre non trouvé: ID ${memberId}`);
      return notFound(res, 'Member', memberId);
    }

    logger.debug(`✅ Membre trouvé: ${getFullName(member.User)} (ID: ${member.userId})`);
    logger.debug(`🔍 Recherche du coach - ID: ${req.user.sub}`);

    const coach = await prisma.user.findUnique({ where: { id: req.user.sub } });
    logger.debug(`✅ Coach trouvé: ${getFullName(coach)} (Salle: ${coach.gymId})`);
    logger.debug(`🔍 Vérification appartenance à la même salle - Membre: ${member.User.gymId}, Coach: ${coach.gymId}`);

    if (member.User.gymId !== coach.gymId) {
      logger.warn(`🚫 Coach ${getFullName(coach)} ne peut pas créer planning pour membre d'une autre salle`);
      return res.status(403).json({ error: 'Vous ne pouvez créer des plannings que pour les membres de votre salle' });
    }

    logger.debug(`✅ Appartenance validée - Même salle: ${coach.gymId}`);
    logger.debug(`🔍 Création du planning en base...`);

    const planning = await prisma.planning.create({
      data: {
        displayId: generatePlanningId(),
        memberId,
        coachId: req.user.sub,
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      },
      include: {
        Member: {
          include: { User: { select: { id: true, firstName: true,
              lastName: true, email: true } } }
        },
        User: { select: { id: true, firstName: true,
              lastName: true, email: true } },
        PlanningDay: {
          include: {
            PlanningExercise: {
              include: { Exercise: true },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { dayOfWeek: 'asc' }
        }
      }
    });

    logger.info(`✅ Planning créé: ${planning.title} (ID: ${planning.id}) pour ${getFullName(member.User)}`);

    // Envoyer notification au membre
    if (member.User.fcmToken) {
      logger.info(`🔔 Envoi notification nouveau planning à ${getFullName(member.User)}`);
      await notifyNewTrainingPlan(member.User.fcmToken, planning).catch(err =>
        logger.error('⚠️ Erreur notification FCM:', err)
      );
    }

    const responseData = {
      message: 'Planning créé avec succès',
      planning
    };

    res.status(201).json(responseData);
  } catch (e) {
    logger.error('💥 Erreur création planning:', e);
    handleError(res, e);
  }
});

// Lister les plannings (pour coachs et membres)
/**
 * @swagger
 * /plannings:
 *   get:
 *     summary: List workout plans
 *     description: Get workout plans. Coaches see plans they created, members see their own plans.
 *     tags: [Plannings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: memberId
 *         schema:
 *           type: integer
 *         description: Filter by member ID (coaches only)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: dayOfWeek
 *         schema:
 *           type: integer
 *         description: Filter by day of week
 *     responses:
 *       200:
 *         description: List of plannings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 plannings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Planning'
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get('/', auth, async (req, res) => {
  logger.info(`📋 Liste des plannings - User: ${req.user?.email} (${req.user?.type}), Filtres: ${JSON.stringify(req.query)}`);

  try {
    logger.debug(`🔍 Recherche du requester - ID: ${req.user.sub}`);
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    logger.debug(`✅ Requester trouvé: ${getFullName(requester)} (${requester.role})`);
    const { memberId, status, dayOfWeek } = req.query;
    logger.debug(`🔍 Analyse des filtres - memberId: ${memberId}, status: ${status}, dayOfWeek: ${dayOfWeek}`);

    let whereClause = {};
    logger.debug(`🔍 Construction de la clause WHERE selon le rôle: ${requester.role}`);

    if (requester.role === 'admin') {
      logger.debug(`👨‍💼 Mode coach - Planning créés par ce coach`);
      // Coach voit les plannings qu'il a créés
      whereClause.coachId = req.user.sub;
      if (memberId) {
        whereClause.memberId = parseInt(memberId);
        logger.debug(`👨‍💼 Filtre membre appliqué: ${memberId}`);
      }
    } else if (requester.role === 'member') {
      logger.debug(`👤 Mode membre - Plannings personnels`);
      // Membre voit ses propres plannings
      const member = await prisma.member.findUnique({
        where: { userId: req.user.sub }
      });
      whereClause.memberId = member.userId;
      logger.debug(`👤 Filtre automatique appliqué: memberId = ${member.userId}`);
    } else if (requester.role === 'owner') {
      logger.debug(`👑 Mode owner - Tous les plannings de la salle`);
      // Owner voit tous les plannings de sa salle
      whereClause.Member = {
        User: {
          gymId: requester.gymId
        }
      };
      if (memberId) {
        whereClause.memberId = parseInt(memberId);
        logger.debug(`👑 Filtre membre appliqué: ${memberId}`);
      }
    } else {
      logger.warn(`❓ Rôle non supporté: ${requester.role}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (status) {
      whereClause.status = status;
      logger.debug(`🔍 Filtre status appliqué: ${status}`);
    }

    logger.debug(`🔍 Clause WHERE finale: ${JSON.stringify(whereClause)}`);
    logger.debug(`🔍 Exécution de la requête Prisma...`);

    const plannings = await prisma.planning.findMany({
      where: whereClause,
      include: {
        Member: {
          include: { User: { select: { id: true, firstName: true,
              lastName: true, email: true } } }
        },
        User: { select: { id: true, firstName: true,
              lastName: true, email: true } },
        PlanningDay: {
          include: {
            PlanningExercise: {
              include: { Exercise: true },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { dayOfWeek: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    logger.info(`✅ ${plannings.length} planning(s) trouvé(s)`);
    if (plannings.length > 0) {
      logger.debug(`📊 Détails des plannings: ${JSON.stringify(plannings.map(p => ({
        id: p.id,
        title: p.title,
        member: getFullName(p.Member.User),
        status: p.status,
        daysCount: p.PlanningDay.length
      })))}`);
    }

    const responseData = { plannings };
    res.json(responseData);
  } catch (e) {
    logger.error('💥 Erreur list plannings:', e);
    handleError(res, e, 500);
  }
});

// Supprimer un planning (seulement pour les coachs)
/**
 * @swagger
 * /plannings/{planningId}:
 *   delete:
 *     summary: Delete a planning
 *     description: Delete a workout plan. Only the coach who created the plan can delete it.
 *     tags: [Plannings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planningId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Planning ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Planning deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Planning supprimé avec succès"
 *       403:
 *         description: Access denied - not the coach who created this plan
 *       404:
 *         description: Planning not found
 *       500:
 *         description: Server error
 */
router.delete('/:planningId', auth, requireCoach, apiLimiter, async (req, res) => {
  logger.info(`🗑️ Suppression planning - Coach: ${req.user?.email}, Planning ID: ${req.params.planningId}`);

  try {
    const planningId = parseInt(req.params.planningId);

    if (isNaN(planningId)) {
      logger.warn(`❌ ID planning invalide: ${req.params.planningId}`);
      return res.status(400).json({ error: 'ID planning invalide' });
    }

    logger.debug(`🔍 Recherche du planning - ID: ${planningId}`);

    // Vérifier que le planning existe et appartient au coach
    const planning = await prisma.planning.findUnique({
      where: { id: planningId },
      include: { 
        User: true,
        Member: {
          include: { User: true }
        }
      }
    });

    if (!planning) {
      logger.warn(`❌ Planning non trouvé: ID ${planningId}`);
      return notFound(res, 'Planning', planningId);
    }

    logger.debug(`✅ Planning trouvé: ${planning.title} (Coach: ${getFullName(planning.User)})`);
    logger.debug(`🔍 Vérification propriété du planning - Coach ID: ${req.user.sub} vs Planning coachId: ${planning.coachId}`);

    if (planning.coachId !== req.user.sub) {
      logger.warn(`🚫 Coach ${req.user.email} ne peut pas supprimer le planning d'un autre coach`);
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres plannings' });
    }

    logger.debug(`✅ Propriété validée`);
    logger.debug(`🔍 Suppression du planning et de toutes ses dépendances (cascade)...`);

    // Supprimer le planning (cascade supprimera automatiquement les PlanningDay et PlanningExercise)
    await prisma.planning.delete({
      where: { id: planningId }
    });

    logger.info(`✅ Planning supprimé: ${planning.title} (ID: ${planningId})`);

    // Envoyer notification au membre
    if (planning.Member.User.fcmToken) {
      logger.info(`🔔 Envoi notification suppression planning à ${getFullName(planning.Member.User)}`);
      await notifyPlanningDeleted(planning.Member.User.fcmToken, planning).catch(err =>
        logger.error('⚠️ Erreur notification FCM:', err)
      );
    }

    const responseData = {
      message: 'Planning supprimé avec succès'
    };

    res.json(responseData);
  } catch (e) {
    logger.error('💥 Erreur suppression planning:', e);
    handleError(res, e, 500);
  }
});

// ==================== AJOUTER EXERCICES À UN PLANNING ====================

// Ajouter un exercice à un planning pour un jour spécifique
/**
 * @swagger
 * /plannings/{planningId}/days/{dayOfWeek}/exercises:
 *   post:
 *     summary: Add exercise to planning day
 *     description: Add an exercise to a specific day in a workout plan. Only the coach who created the plan can modify it.
 *     tags: [Plannings, Exercises]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planningId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Planning ID
 *         example: 1
 *       - in: path
 *         name: dayOfWeek
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *         description: Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exerciseId
 *             properties:
 *               exerciseId:
 *                 type: integer
 *                 description: Exercise ID to add
 *                 example: 1
 *               sets:
 *                 type: integer
 *                 description: Number of sets
 *                 example: 3
 *               reps:
 *                 type: integer
 *                 description: Number of repetitions per set
 *                 example: 12
 *               duration:
 *                 type: integer
 *                 description: Duration in minutes (for cardio)
 *                 example: 30
 *               weight:
 *                 type: number
 *                 format: float
 *                 description: Weight in kg
 *                 example: 20.5
 *               restTime:
 *                 type: integer
 *                 description: Rest time between sets in seconds
 *                 example: 60
 *               notes:
 *                 type: string
 *                 description: Specific notes for this exercise
 *                 example: "Focus on proper form"
 *               order:
 *                 type: integer
 *                 description: Order in the day
 *                 example: 1
 *     responses:
 *       201:
 *         description: Exercise added to planning day successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Exercice ajouté au jour du planning avec succès"
 *                 planningExercise:
 *                   $ref: '#/components/schemas/PlanningExercise'
 *       403:
 *         description: Access denied - not the coach who created this plan
 *       404:
 *         description: Planning or exercise not found
 *       500:
 *         description: Server error
 */
router.post('/:planningId/days/:dayOfWeek/exercises', auth, requireCoach, apiLimiter, async (req, res) => {
  logger.info(`➕ Ajout exercice au planning - Coach: ${req.user?.email}, Planning ID: ${req.params.planningId}, Jour: ${req.params.dayOfWeek}, Données: ${JSON.stringify(req.body)}`);

  try {
    const planningId = Number(req.params.planningId);
    const dayOfWeek = Number(req.params.dayOfWeek);
    const { exerciseId, sets, reps, duration, weight, restTime, notes, order = 0 } = req.body;

    logger.debug(`🔍 Validation des paramètres - planningId: ${planningId}, dayOfWeek: ${dayOfWeek}, exerciseId: ${exerciseId}`);

    if (!exerciseId) {
      logger.warn(`❌ Ajout exercice échoué - exerciseId manquant`);
      return res.status(400).json({ error: 'ID de l\'exercice requis' });
    }

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      logger.warn(`❌ Jour invalide: ${dayOfWeek} (doit être entre 0 et 6)`);
      return res.status(400).json({ error: 'Jour de la semaine doit être entre 0 (dimanche) et 6 (samedi)' });
    }

    logger.debug(`🔍 Recherche du planning - ID: ${planningId}`);
    // Vérifier que le planning existe et appartient au coach
    const planning = await prisma.planning.findUnique({
      where: { id: planningId },
      include: { User: true }
    });

    if (!planning) {
      logger.warn(`❌ Planning non trouvé: ID ${planningId}`);
      return notFound(res, 'Planning', planningId);
    }

    logger.debug(`✅ Planning trouvé: ${planning.title} (Coach: ${getFullName(planning.User)})`);
    logger.debug(`🔍 Vérification propriété du planning - Coach ID: ${req.user.sub} vs Planning coachId: ${planning.coachId}`);

    if (planning.coachId !== req.user.sub) {
      logger.warn(`🚫 Coach ${req.user.email} ne peut pas modifier le planning d'un autre coach`);
      return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres plannings' });
    }

    logger.debug(`✅ Propriété validée`);
    logger.debug(`🔍 Recherche de l'exercice - ID: ${exerciseId}`);

    // Vérifier que l'exercice existe
    const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
    if (!exercise) {
      logger.warn(`❌ Exercice non trouvé: ID ${exerciseId}`);
      return notFound(res, 'Exercise', exerciseId);
    }

    logger.debug(`✅ Exercice trouvé: ${exercise.name} (${exercise.category})`);
    logger.debug(`🔍 Recherche/Création du PlanningDay pour jour ${dayOfWeek}`);

    // Créer ou récupérer le PlanningDay pour ce jour
    let planningDay = await prisma.planningDay.findUnique({
      where: {
        planningId_dayOfWeek: {
          planningId,
          dayOfWeek
        }
      }
    });

    if (!planningDay) {
      logger.debug(`📅 PlanningDay n'existe pas, création...`);
      planningDay = await prisma.planningDay.create({
        data: {
          planningId,
          dayOfWeek
        }
      });
      logger.debug(`✅ PlanningDay créé pour le jour ${dayOfWeek} (ID: ${planningDay.id})`);
    } else {
      logger.debug(`✅ PlanningDay existant trouvé (ID: ${planningDay.id})`);
    }

    logger.debug(`🔍 Création de l'exercice dans le planning...`);
    logger.debug(`📊 Détails exercice: sets=${sets}, reps=${reps}, duration=${duration}, weight=${weight}, restTime=${restTime}, order=${order}`);

    const planningExercise = await prisma.planningExercise.create({
      data: {
        planningDayId: planningDay.id,
        exerciseId,
        sets,
        reps,
        duration,
        weight,
        restTime,
        notes,
        order
      },
      include: {
        Exercise: true,
        PlanningDay: {
          include: {
            Planning: {
              include: {
                Member: { include: { User: { select: { firstName: true, lastName: true } } } }
              }
            }
          }
        }
      }
    });

    logger.info(`✅ Exercice ajouté: ${exercise.name} au jour ${dayOfWeek} du planning ${planning.title}`);
    logger.info(`👤 Pour le membre: ${getFullName(planningExercise.PlanningDay.Planning.Member.User)}`);

    // Envoyer notification au membre
    const memberUser = await prisma.user.findUnique({
      where: { id: planning.memberId }
    });
    
    if (memberUser?.fcmToken) {
      logger.info(`🔔 Envoi notification modification planning à ${getFullName(memberUser)}`);
      await notifyPlanningModified(memberUser.fcmToken, planning, 'exercise_added').catch(err =>
        logger.error('⚠️ Erreur notification FCM:', err)
      );
    }

    const responseData = {
      message: 'Exercice ajouté au jour du planning avec succès',
      planningExercise
    };

    res.status(201).json(responseData);
  } catch (e) {
    logger.error('💥 Erreur ajout exercice au planning:', e);
    handleError(res, e);
  }
});

// Supprimer un exercice d'un jour du planning
/**
 * @swagger
 * /plannings/{planningId}/days/{dayOfWeek}/exercises/{exerciseId}:
 *   delete:
 *     summary: Remove exercise from planning day
 *     description: Remove a specific exercise from a specific day in a workout plan. Only the coach who created the plan can modify it.
 *     tags: [Plannings, Exercises]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planningId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Planning ID
 *         example: 1
 *       - in: path
 *         name: dayOfWeek
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *         description: Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 *         example: 1
 *       - in: path
 *         name: exerciseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Exercise ID to remove
 *         example: 1
 *     responses:
 *       200:
 *         description: Exercise removed from planning day successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Exercice supprimé du jour du planning avec succès"
 *       403:
 *         description: Access denied - not the coach who created this plan
 *       404:
 *         description: Planning, day, or exercise not found
 *       500:
 *         description: Server error
 */
router.delete('/:planningId/days/:dayOfWeek/exercises/:exerciseId', auth, requireCoach, apiLimiter, async (req, res) => {
  logger.info(`🗑️ Suppression exercice du planning - Coach: ${req.user?.email}, Planning ID: ${req.params.planningId}, Jour: ${req.params.dayOfWeek}, Exercise ID: ${req.params.exerciseId}`);

  try {
    const planningId = Number(req.params.planningId);
    const dayOfWeek = Number(req.params.dayOfWeek);
    const exerciseId = Number(req.params.exerciseId);

    logger.debug(`🔍 Validation paramètres - planningId: ${planningId}, dayOfWeek: ${dayOfWeek}, exerciseId: ${exerciseId}`);
    logger.debug(`🔍 Recherche du planning - ID: ${planningId}`);

    // Vérifier que le planning existe et appartient au coach
    const planning = await prisma.planning.findUnique({
      where: { id: planningId },
      include: { User: true }
    });

    if (!planning) {
      logger.warn(`❌ Planning non trouvé: ID ${planningId}`);
      return notFound(res, 'Planning', planningId);
    }

    logger.debug(`✅ Planning trouvé: ${planning.title} (Coach: ${getFullName(planning.User)})`);
    logger.debug(`🔍 Vérification propriété du planning - Coach ID: ${req.user.sub} vs Planning coachId: ${planning.coachId}`);

    if (planning.coachId !== req.user.sub) {
      logger.warn(`🚫 Coach ${req.user.email} ne peut pas modifier le planning d'un autre coach`);
      return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres plannings' });
    }

    logger.debug(`✅ Propriété validée`);
    logger.debug(`🔍 Recherche du PlanningDay pour jour ${dayOfWeek}`);

    // Récupérer le PlanningDay pour ce jour
    const planningDay = await prisma.planningDay.findUnique({
      where: {
        planningId_dayOfWeek: {
          planningId,
          dayOfWeek
        }
      }
    });

    if (!planningDay) {
      logger.warn(`❌ Jour ${dayOfWeek} non trouvé dans le planning ${planningId}`);
      return res.status(404).json({ error: 'Jour non trouvé dans ce planning' });
    }

    logger.debug(`✅ PlanningDay trouvé (ID: ${planningDay.id})`);
    logger.debug(`🔍 Recherche et suppression de l'exercice ${exerciseId} dans le jour ${dayOfWeek}`);

    // Supprimer l'exercice spécifique de ce jour
    const deletedExercise = await prisma.planningExercise.deleteMany({
      where: {
        planningDayId: planningDay.id,
        exerciseId
      }
    });

    logger.info(`🗑️ Résultat suppression: ${deletedExercise.count} exercice(s) supprimé(s)`);

    if (deletedExercise.count === 0) {
      logger.warn(`❌ Exercice ${exerciseId} non trouvé dans le jour ${dayOfWeek} du planning ${planningId}`);
      return res.status(404).json({ error: 'Exercice non trouvé dans ce jour du planning' });
    }

    logger.info(`✅ Exercice supprimé avec succès du jour ${dayOfWeek} du planning ${planning.title}`);

    // Envoyer notification au membre
    const memberUser = await prisma.user.findUnique({
      where: { id: planning.memberId }
    });
    
    if (memberUser?.fcmToken) {
      logger.info(`🔔 Envoi notification modification planning à ${getFullName(memberUser)}`);
      await notifyPlanningModified(memberUser.fcmToken, planning, 'exercise_removed').catch(err =>
        logger.error('⚠️ Erreur notification FCM:', err)
      );
    }

    const responseData = {
      message: 'Exercice supprimé du jour du planning avec succès'
    };

    res.json(responseData);
  } catch (e) {
    logger.error('💥 Erreur suppression exercice du planning:', e);
    handleError(res, e);
  }
});

// ==================== NOUVELLES ROUTES MEMBRE ====================

// Récupérer tous les plannings d'un membre avec toutes les données
/**
 * @swagger
 * /plannings/member/{memberId}:
 *   get:
 *     summary: Get all plannings for a member
 *     description: Get all workout plans for a specific member with complete data (days and exercises). Only coaches from the same gym or the member themselves can access this.
 *     tags: [Plannings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Member ID
 *         example: 1
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, cancelled]
 *         description: Filter by planning status
 *         example: active
 *     responses:
 *       200:
 *         description: Member plannings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 member:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     user:
 *                       type: object
 *                       properties:
 *                         fullName:
 *                           type: string
 *                           example: "Bob Member"
 *                         email:
 *                           type: string
 *                           example: "bob@example.com"
 *                 plannings:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       title:
 *                         type: string
 *                         example: "Upper Body Strength Training"
 *                       description:
 *                         type: string
 *                         example: "Focus on building upper body strength"
 *                       startDate:
 *                         type: string
 *                         format: date
 *                         example: "2025-11-15"
 *                       endDate:
 *                         type: string
 *                         format: date
 *                         example: "2025-12-15"
 *                       status:
 *                         type: string
 *                         example: "active"
 *                       coach:
 *                         type: object
 *                         properties:
 *                           fullName:
 *                             type: string
 *                             example: "Admin TeamFitness"
 *                       days:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             dayOfWeek:
 *                               type: integer
 *                               example: 1
 *                             exercises:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   exercise:
 *                                     type: object
 *                                     properties:
 *                                       id:
 *                                         type: integer
 *                                         example: 1
 *                                       name:
 *                                         type: string
 *                                         example: "Push-ups"
 *                                       category:
 *                                         type: string
 *                                         example: "strength"
 *                                   sets:
 *                                     type: integer
 *                                     example: 3
 *                                   reps:
 *                                     type: integer
 *                                     example: 12
 *                                   notes:
 *                                     type: string
 *                                     example: "Focus on proper form"
 *       403:
 *         description: Access denied - not authorized to view this member's plannings
 *       404:
 *         description: Member not found
 *       500:
 *         description: Server error
 */
router.get('/member/:memberId', auth, async (req, res) => {
  logger.info(`📋 Récupération plannings du membre - User: ${req.user?.email}, Member ID: ${req.params.memberId}`);

  try {
    logger.debug(`📋 Récupération plannings du membre - User: ${req.user?.email}, Member ID: ${req.params.memberId}, Filtres: ${JSON.stringify(req.query)}`);
    const memberId = Number(req.params.memberId);
    const { status } = req.query;

    logger.debug(`🔍 Recherche du membre - Tentative 1: userId = ${memberId}`);

    // Vérifier que le membre existe (essayer d'abord par member.userId, puis par userId pour compatibilité frontend)
    let member = await prisma.member.findUnique({
      where: { userId: memberId },
      include: { User: { select: { id: true, firstName: true,
              lastName: true, email: true, gymId: true } } }
    });

    if (!member) {
      logger.debug(`🔄 Membre non trouvé par userId, tentative 2: userId = ${memberId} (fallback)`);
      // Peut-être que le frontend a passé l'userId au lieu du memberId. Tenter une recherche par userId.
      member = await prisma.member.findUnique({
        where: { userId: memberId },
        include: { User: { select: { id: true, firstName: true,
              lastName: true, email: true, gymId: true } } }
      });
      if (member) {
        logger.debug(`ℹ️ Membre trouvé via userId: userId ${memberId} -> userId ${member.userId}`);
      }
    }

    if (!member) {
      logger.warn(`❌ Membre non trouvé: ID ${memberId} (aucune des 2 tentatives n'a réussi)`);
      return notFound(res, 'Member', memberId);
    }

    logger.debug(`✅ Membre trouvé: ${getFullName(member.User)} (userId: ${member.userId}, gymId: ${member.User.gymId})`);
    logger.debug(`🔍 Recherche du requester - ID: ${req.user.sub}`);

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    logger.debug(`✅ Requester trouvé: ${getFullName(requester)} (${requester.role}, gymId: ${requester.gymId})`);
    logger.debug(`🔍 Vérification des permissions selon le rôle: ${requester.role}`);

    // Seuls les coaches de la même salle ou le membre lui-même peuvent voir ses plannings
    if (requester.role === 'member') {
      logger.debug(`👤 Mode membre - Vérification accès personnel`);
      // Un membre ne peut voir que ses propres plannings
      const memberProfile = await prisma.member.findUnique({
        where: { userId: req.user.sub }
      });
      logger.debug(`👤 Profil membre requester: userId ${memberProfile.userId}`);
      logger.debug(`👤 Comparaison: requester.userId (${memberProfile.userId}) vs target.userId (${member.userId})`);

      if (memberProfile.userId !== member.userId) {
        logger.warn(`🚫 Membre ${getFullName(requester)} ne peut pas voir les plannings d'un autre membre`);
        return res.status(403).json({ error: 'Vous ne pouvez voir que vos propres plannings' });
      }
      logger.debug(`✅ Accès personnel validé`);
    } else if (requester.role === 'admin') {
      logger.debug(`👨‍💼 Mode coach - Vérification appartenance salle`);
      // Un coach ne peut voir que les plannings des membres de sa salle
      logger.debug(`👨‍💼 Comparaison salles: requester.gymId (${requester.gymId}) vs member.gymId (${member.User.gymId})`);

      if (requester.gymId !== member.User.gymId) {
        logger.warn(`🚫 Coach ${getFullName(requester)} ne peut pas voir les plannings des membres d'une autre salle`);
        return res.status(403).json({ error: 'Vous ne pouvez voir que les plannings des membres de votre salle' });
      }
      logger.debug(`✅ Appartenance salle validée`);
    } else if (requester.role === 'owner') {
      logger.debug(`👑 Mode owner - Accès complet autorisé`);
      // Owner peut tout voir
    }

    logger.debug(`🔍 Construction de la requête plannings`);
    // Construire la requête
    let whereClause = { memberId };
    if (status) {
      whereClause.status = status;
      logger.debug(`🔍 Filtre status appliqué: ${status}`);
    }

    logger.debug(`🔍 Clause WHERE: ${JSON.stringify(whereClause)}`);
    logger.debug(`🔍 Exécution requête plannings...`);

    const plannings = await prisma.planning.findMany({
      where: whereClause,
      include: {
        User: { select: { id: true, firstName: true,
              lastName: true, email: true } },
        PlanningDay: {
          include: {
            PlanningExercise: {
              include: { Exercise: true },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { dayOfWeek: 'asc' }
        }
      },
      orderBy: { startDate: 'desc' }
    });

    logger.info(`✅ ${plannings.length} planning(s) trouvé(s) pour le membre ${getFullName(member.User)}`);
    if (plannings.length > 0) {
      logger.debug(`📊 Résumé plannings: ${JSON.stringify(plannings.map(p => ({
        id: p.id,
        title: p.title,
        coach: getFullName(p.User),
        status: p.status,
        daysCount: p.PlanningDay.length,
        exercisesCount: p.PlanningDay.reduce((sum, day) => sum + day.PlanningExercise.length, 0)
      })))}`);
    }

    const responseData = {
      member: {
        id: member.userId,
        user: member.User
      },
      plannings
    };

    res.json(responseData);
  } catch (e) {
    logger.error('💥 Erreur récupération plannings membre:', e);
    handleError(res, e, 500);
  }
});

// Récupérer le prochain jour de planning avec ses exercices pour un membre
/**
 * @swagger
 * /plannings/next-day/{memberId}:
 *   get:
 *     summary: Get next planning day for a member
 *     description: Get the next workout day with exercises for a specific member based on current date. Returns today's exercises if available, otherwise the next available day in the active planning.
 *     tags: [Plannings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Member ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Next planning day retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 member:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     user:
 *                       type: object
 *                       properties:
 *                         fullName:
 *                           type: string
 *                           example: "Bob Member"
 *                 planning:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     title:
 *                       type: string
 *                       example: "Upper Body Strength Training"
 *                     startDate:
 *                       type: string
 *                       format: date
 *                       example: "2025-11-15"
 *                     endDate:
 *                       type: string
 *                       format: date
 *                       example: "2025-12-15"
 *                 day:
 *                   type: object
 *                   properties:
 *                     dayOfWeek:
 *                       type: integer
 *                       example: 1
 *                     dayName:
 *                       type: string
 *                       example: "Lundi"
 *                     date:
 *                       type: string
 *                       format: date
 *                       example: "2025-11-11"
 *                     exercises:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           exercise:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 example: 1
 *                               name:
 *                                 type: string
 *                                 example: "Push-ups"
 *                               category:
 *                                 type: string
 *                                 example: "strength"
 *                               instructions:
 *                                 type: string
 *                                 example: "Start in plank position..."
 *                           sets:
 *                             type: integer
 *                             example: 3
 *                           reps:
 *                             type: integer
 *                             example: 12
 *                           weight:
 *                             type: number
 *                             example: 0
 *                           notes:
 *                             type: string
 *                             example: "Focus on proper form"
 *       204:
 *         description: No active planning or no exercises scheduled for today/next days
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Aucun entraînement prévu pour aujourd'hui ou les prochains jours"
 *                 member:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     user:
 *                       type: object
 *                       properties:
 *                         fullName:
 *                           type: string
 *                           example: "Bob Member"
 *       403:
 *         description: Access denied - not authorized to view this member's planning
 *       404:
 *         description: Member not found
 *       500:
 *         description: Server error
 */
router.get('/next-day/:memberId', auth, async (req, res) => {
  // Initial log for debugging
  logger.info(`📅 Récupération prochain jour de planning - ${new Date().toISOString()} - User: ${req.user?.email || 'unknown'}, Member ID: ${req.params.memberId}`);

  try {
    const memberId = Number(req.params.memberId);
    logger.debug(`🔍 Recherche du membre - Tentative 1: userId = ${memberId}`);

    // Vérifier que le membre existe (essayer d'abord par member.userId, puis par userId pour compatibilité frontend)
    let member = await prisma.member.findUnique({
      where: { userId: memberId },
      include: { User: { select: { id: true, firstName: true,
              lastName: true, email: true, gymId: true } } }
    });

    if (!member) {
      logger.debug(`🔄 Membre non trouvé par userId, tentative 2: userId = ${memberId} (fallback)`);
      // Peut-être que le frontend a passé l'userId au lieu du memberId. Tenter une recherche par userId.
      member = await prisma.member.findUnique({
        where: { userId: memberId },
        include: { User: { select: { id: true, firstName: true,
              lastName: true, email: true, gymId: true } } }
      });
      if (member) {
        logger.debug(`ℹ️ Membre trouvé via userId: userId ${memberId} -> userId ${member.userId}`);
      }
    }

    if (!member) {
      logger.warn(`❌ Membre non trouvé: ID ${memberId} (aucune des 2 tentatives n'a réussi)`);
      return notFound(res, 'Member', memberId);
    }

    logger.debug(`✅ Membre trouvé: ${getFullName(member.User)} (userId: ${member.userId}, gymId: ${member.User.gymId})`);
    logger.debug(`🔍 Recherche du requester - ID: ${req.user.sub}`);

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    logger.debug(`✅ Requester trouvé: ${getFullName(requester)} (${requester.role}, gymId: ${requester.gymId})`);
    logger.debug(`🔍 Vérification des permissions selon le rôle: ${requester.role}`);

    // Seuls les coaches de la même salle ou le membre lui-même peuvent voir son planning
    if (requester.role === 'member') {
      logger.debug(`👤 Mode membre - Vérification accès personnel`);
      const memberProfile = await prisma.member.findUnique({
        where: { userId: req.user.sub }
      });
      logger.debug(`👤 Profil membre requester: userId ${memberProfile.userId}`);
      logger.debug(`👤 Comparaison: requester.userId (${memberProfile.userId}) vs target.userId (${member.userId})`);

      if (memberProfile.userId !== member.userId) {
        logger.warn(`🚫 Membre ${getFullName(requester)} ne peut pas voir le planning d'un autre membre`);
        return res.status(403).json({ error: 'Vous ne pouvez voir que votre propre planning' });
      }
      logger.debug(`✅ Accès personnel validé`);
    } else if (requester.role === 'admin') {
      logger.debug(`👨‍💼 Mode coach - Vérification appartenance salle`);
      logger.debug(`👨‍💼 Comparaison salles: requester.gymId (${requester.gymId}) vs member.gymId (${member.User.gymId})`);

      if (requester.gymId !== member.User.gymId) {
        logger.warn(`🚫 Coach ${getFullName(requester)} ne peut pas voir le planning des membres d'une autre salle`);
        return res.status(403).json({ error: 'Vous ne pouvez voir que les plannings des membres de votre salle' });
      }
      logger.debug(`✅ Appartenance salle validée`);
    } else if (requester.role === 'owner') {
      logger.debug(`👑 Mode owner - Accès complet autorisé`);
    }

    logger.debug(`📅 Calcul des dates pour planning`);
    // Obtenir la date actuelle et le jour de la semaine (0 = dimanche, 1 = lundi, etc.)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Minuit aujourd'hui

    // Calculer la date de demain
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowDayOfWeek = tomorrow.getDay();

    const currentDayOfWeek = now.getDay();

    logger.debug(`📅 Date actuelle: ${today.toISOString().split('T')[0]}, Jour de la semaine: ${currentDayOfWeek}`);
    logger.debug(`📅 Date de demain: ${tomorrow.toISOString().split('T')[0]}, Jour de la semaine: ${tomorrowDayOfWeek}`);

    logger.debug(`🔍 Recherche planning actif pour aujourd'hui ou demain`);
    logger.debug(`🔍 Critères: memberId=${memberId}, status='active', startDate <= ${today.toISOString().split('T')[0]}, endDate >= ${today.toISOString().split('T')[0]}`);

    // Trouver le planning actif du membre (le plus récent avec status 'active') couvrant aujourd'hui
    const activePlanning = await prisma.planning.findFirst({
      where: {
        memberId,
        status: 'active',
        startDate: { lte: today },
        endDate: { gte: today }
      },
      include: {
        User: { select: { id: true, firstName: true,
              lastName: true, email: true } },
        PlanningDay: {
          include: {
            PlanningExercise: {
              include: { Exercise: true },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { dayOfWeek: 'asc' }
        }
      },
      orderBy: { startDate: 'desc' }
    });

    if (!activePlanning) {
      logger.info(`ℹ️ Aucun planning actif trouvé pour le membre ${getFullName(member.User)}`);
      logger.debug(`ℹ️ Critères non remplis: planning actif couvrant la date ${today.toISOString().split('T')[0]}`);
      return res.status(204).json({
        message: 'Aucun entraînement prévu pour aujourd\'hui ou demain',
        member: {
          id: member.userId,
          user: member.User
        }
      });
    }

    logger.info(`✅ Planning actif trouvé: ${activePlanning.title} (ID: ${activePlanning.id})`);
    logger.debug(`📊 Planning détails: ${activePlanning.PlanningDay.length} jours définis, Coach: ${getFullName(activePlanning.User)}`);
    
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    
    // Chercher d'abord les exercices pour aujourd'hui
    logger.debug(`🔍 Recherche exercices pour aujourd'hui (jour ${currentDayOfWeek})`);
    const todayDay = activePlanning.PlanningDay.find(day => day.dayOfWeek === currentDayOfWeek);

    if (todayDay && todayDay.PlanningExercise.length > 0) {
      logger.info(`✅ Entraînement trouvé pour aujourd'hui: ${dayNames[todayDay.dayOfWeek]} (${today.toISOString().split('T')[0]}) - ${todayDay.PlanningExercise.length} exercice(s)`);
      logger.debug(`📋 Liste exercices: ${JSON.stringify(todayDay.PlanningExercise.map(ex => `${ex.Exercise.name} (${ex.sets}x${ex.reps})`))}`);

      const responseData = {
        member: {
          id: member.userId,
          user: member.User
        },
        planning: {
          id: activePlanning.id,
          title: activePlanning.title,
          startDate: activePlanning.startDate,
          endDate: activePlanning.endDate
        },
        day: {
          dayOfWeek: todayDay.dayOfWeek,
          dayName: dayNames[todayDay.dayOfWeek],
          date: today.toISOString().split('T')[0],
          isToday: true,
          exercises: todayDay.PlanningExercise.map(ex => ({
            exercise: ex.Exercise,
            sets: ex.sets,
            reps: ex.reps,
            duration: ex.duration,
            weight: ex.weight,
            restTime: ex.restTime,
            notes: ex.notes
          }))
        }
      };

      res.json(responseData);
      return;
    }

    logger.info(`ℹ️ Aucun exercice pour aujourd'hui, recherche pour demain (jour ${tomorrowDayOfWeek})`);
    
    // Si pas d'exercices aujourd'hui, chercher pour demain
    const tomorrowDay = activePlanning.PlanningDay.find(day => day.dayOfWeek === tomorrowDayOfWeek);

    if (!tomorrowDay || tomorrowDay.PlanningExercise.length === 0) {
      logger.info(`ℹ️ Aucun exercices prévu pour aujourd'hui ni demain`);
      if (tomorrowDay) {
        logger.debug(`ℹ️ Jour trouvé mais aucun exercice: ${tomorrowDay.PlanningExercise.length} exercices`);
      } else {
        logger.debug(`ℹ️ Jour ${tomorrowDayOfWeek} non défini dans ce planning`);
      }
      return res.status(204).json({
        message: 'Aucun entraînement prévu pour aujourd\'hui ou demain',
        member: {
          id: member.userId,
          user: member.User
        }
      });
    }

    logger.info(`✅ Entraînement trouvé pour demain: ${dayNames[tomorrowDay.dayOfWeek]} (${tomorrow.toISOString().split('T')[0]}) - ${tomorrowDay.PlanningExercise.length} exercice(s)`);
    logger.debug(`📋 Liste exercices: ${JSON.stringify(tomorrowDay.PlanningExercise.map(ex => `${ex.Exercise.name} (${ex.sets}x${ex.reps})`))}`);

    const responseData = {
      member: {
        id: member.userId,
        user: member.User
      },
      planning: {
        id: activePlanning.id,
        title: activePlanning.title,
        startDate: activePlanning.startDate,
        endDate: activePlanning.endDate
      },
      day: {
        dayOfWeek: tomorrowDay.dayOfWeek,
        dayName: dayNames[tomorrowDay.dayOfWeek],
        date: tomorrow.toISOString().split('T')[0],
        isToday: false,
        exercises: tomorrowDay.PlanningExercise.map(ex => ({
          exercise: ex.Exercise,
          sets: ex.sets,
          reps: ex.reps,
          duration: ex.duration,
          weight: ex.weight,
          restTime: ex.restTime,
          notes: ex.notes
        }))
      }
    };

    res.json(responseData);
  } catch (e) {
    logger.error('💥 Erreur récupération prochain jour:', e);
    handleError(res, e, 500);
  }
});

// ==================== REQUEST HELP ====================

/**
 * @swagger
 * /plannings/request-help:
 *   post:
 *     summary: Request help for an exercise
 *     description: Member requests help from their coach for a specific exercise
 *     tags: [Plannings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exerciseName
 *             properties:
 *               exerciseName:
 *                 type: string
 *                 description: Name of the exercise needing help
 *                 example: "Push-ups"
 *               notes:
 *                 type: string
 *                 description: Optional notes about the help request
 *                 example: "I need help with proper form"
 *     responses:
 *       200:
 *         description: Help request sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Help request sent to coach"
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: User is not a member or no active planning
 *       500:
 *         description: Server error
 */
router.post('/request-help', auth, apiLimiter, async (req, res) => {
  try {
    const { exerciseName, notes } = req.body;

    logger.info(`🆘 Demande d'aide reçue - User ID: ${req.user.sub}, Exercise: ${exerciseName}`);

    // Validation
    if (!exerciseName) {
      logger.warn('❌ Nom exercice manquant');
      return res.status(400).json({ error: 'Exercise name is required' });
    }

    // Vérifier que l'utilisateur est un membre
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { Member: true }
    });

    if (!user || user.role !== 'member' || !user.Member) {
      logger.warn(`❌ Utilisateur n'est pas un membre: ${user ? getFullName(user) : 'inconnu'}`);
      return res.status(403).json({ error: 'Only members can request help' });
    }

    logger.debug(`✅ Membre trouvé: ${getFullName(user)}`);

    // Trouver le planning actif du membre
    const activePlanning = await prisma.planning.findFirst({
      where: {
        memberId: user.id,
        status: 'active',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      },
      include: {
        User: true
      }
    });

    if (!activePlanning) {
      logger.warn(`❌ Aucun planning actif pour ${getFullName(user)}`);
      return res.status(403).json({ error: 'No active planning found' });
    }

    logger.debug(`✅ Planning actif trouvé - Coach: ${getFullName(activePlanning.User)}`);

    // Envoyer une notification au coach
    if (activePlanning.User.fcmToken) {
      logger.info(`🔔 Envoi notification au coach ${getFullName(activePlanning.User)}`);
      
      const { sendPushNotification } = require('../services/pushNotificationService');
      
      const helpMessage = notes 
        ? `${getFullName(user)} demande de l'aide pour "${exerciseName}": ${notes}`
        : `${getFullName(user)} demande de l'aide pour "${exerciseName}"`;

      await sendPushNotification(activePlanning.User.fcmToken, {
        title: '🆘 Demande d\'aide',
        body: helpMessage,
        data: {
          type: 'help_request',
          memberId: user.id.toString(),
          memberName: getFullName(user),
          exerciseName: exerciseName,
          notes: notes || '',
          planningId: activePlanning.id.toString(),
          // Actions pour les boutons
          actions: JSON.stringify([
            { id: 'coming', title: "J'arrive", icon: 'check' },
            { id: 'busy', title: 'Occupé', icon: 'close' }
          ])
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            color: '#FF6B00',
            // Pour Android, définir le channel ID et les actions
            channelId: 'help_requests',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              // Pour iOS, les actions interactives
              category: 'HELP_REQUEST'
            }
          }
        }
      });

      logger.info(`✅ Notification envoyée au coach`);
    } else {
      logger.warn(`⚠️ Coach ${getFullName(activePlanning.User)} n'a pas de FCM token`);
    }

    logger.info(`✅ Demande d'aide traitée avec succès`);
    res.json({ 
      success: true, 
      message: 'Help request sent to coach',
      coach: {
        id: activePlanning.User.id,
        name: getFullName(activePlanning.User)
      }
    });
  } catch (e) {
    logger.error('💥 Erreur demande d\'aide:', e);
    handleError(res, e, 500);
  }
});

/**
 * @swagger
 * /plannings/respond-help:
 *   post:
 *     summary: Respond to a help request
 *     description: Coach responds to a member's help request with "coming" or "busy"
 *     tags: [Plannings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberId
 *               - response
 *             properties:
 *               memberId:
 *                 type: integer
 *                 description: ID of the member who requested help
 *                 example: 15
 *               response:
 *                 type: string
 *                 enum: [coming, busy]
 *                 description: Coach's response
 *                 example: "coming"
 *               exerciseName:
 *                 type: string
 *                 description: Name of the exercise (optional, for context)
 *                 example: "Push-ups"
 *     responses:
 *       200:
 *         description: Response sent successfully
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: User is not a coach
 *       500:
 *         description: Server error
 */
router.post('/respond-help', auth, requireCoach, apiLimiter, async (req, res) => {
  try {
    const { memberId: memberIdRaw, response, exerciseName } = req.body;
    const memberId = parseInt(memberIdRaw, 10);

    logger.info(`💬 Réponse à demande d'aide - Coach: ${req.user.sub}, Membre: ${memberId}, Réponse: ${response}`);

    // Validation
    if (!memberIdRaw || !response) {
      logger.warn('❌ Paramètres manquants');
      return res.status(400).json({ error: 'Member ID and response are required' });
    }

    if (!['coming', 'busy'].includes(response)) {
      logger.warn('❌ Réponse invalide:', response);
      return res.status(400).json({ error: 'Response must be "coming" or "busy"' });
    }

    // Récupérer le coach
    const coach = await prisma.user.findUnique({
      where: { id: req.user.sub }
    });

    logger.debug(`✅ Coach trouvé: ${getFullName(coach)}`);

    // Récupérer le membre
    const member = await prisma.user.findUnique({
      where: { id: memberId }
    });

    if (!member) {
      logger.warn(`❌ Membre non trouvé: ${memberId}`);
      return res.status(404).json({ error: 'Member not found' });
    }

    logger.debug(`✅ Membre trouvé: ${getFullName(member)}`);

    // Vérifier que le membre et le coach sont dans la même salle
    if (member.gymId !== coach.gymId) {
      logger.warn(`🚫 Coach et membre ne sont pas dans la même salle`);
      return res.status(403).json({ error: 'Member not in your gym' });
    }

    // Envoyer notification au membre
    if (member.fcmToken) {
      logger.info(`🔔 Envoi notification au membre ${getFullName(member)}`);
      
      const { sendPushNotification } = require('../services/pushNotificationService');
      
      const responseMessages = {
        coming: `${getFullName(coach)} arrive pour vous aider${exerciseName ? ` avec "${exerciseName}"` : ''} 👍`,
        busy: `${getFullName(coach)} est occupé pour le moment${exerciseName ? ` pour "${exerciseName}"` : ''} ⏰`
      };

      const responseEmojis = {
        coming: '✅',
        busy: '⏰'
      };

      await sendPushNotification(member.fcmToken, {
        title: `${responseEmojis[response]} Réponse du coach`,
        body: responseMessages[response],
        data: {
          type: 'help_response',
          coachId: coach.id.toString(),
          coachName: getFullName(coach),
          response: response,
          exerciseName: exerciseName || ''
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            color: response === 'coming' ? '#00C853' : '#FFA000'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      });

      logger.info(`✅ Notification envoyée au membre`);
    } else {
      logger.warn(`⚠️ Membre ${getFullName(member)} n'a pas de FCM token`);
    }

    logger.info(`✅ Réponse à la demande d'aide traitée avec succès`);
    res.json({ 
      success: true, 
      message: `Response "${response}" sent to member`,
      member: {
        id: member.id,
        name: getFullName(member)
      }
    });
  } catch (e) {
    logger.error('💥 Erreur réponse demande d\'aide:', e);
    handleError(res, e, 500);
  }
});

module.exports = router;