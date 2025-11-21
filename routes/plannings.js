const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();
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
  console.log(`🏋️ Vérification rôle Coach - User: ${req.user?.email} (${req.user?.type})`);

  if (!req.user) {
    console.log('❌ req.user est undefined - Le middleware auth n\'a pas été appliqué');
    return res.status(401).json({ error: 'Authentification requise' });
  }

  try {
    console.log(`🔍 Recherche utilisateur en base - ID: ${req.user.sub}`);
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { Admin: true }
    });

    if (!user) {
      console.log(`❌ Utilisateur non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Accès réservé aux coachs' });
    }

    console.log(`✅ Utilisateur trouvé: ${getFullName(user)} (${user.role}) - ID: ${user.id}`);
    console.log(`🔍 Vérification rôle admin pour coach...`);

    if (user.role !== 'admin') {
      console.log(`🚫 Rôle insuffisant: ${getFullName(user)} est ${user.role}, coach requis`);
      return res.status(403).json({ error: 'Accès réservé aux coachs' });
    }

    console.log(`✅ Rôle admin validé pour ${getFullName(user)}`);
    req.user.coachProfile = user.Admin;
    console.log(`✅ Accès coach autorisé pour ${getFullName(user)}`);
    next();
  } catch (error) {
    console.error('💥 Erreur middleware requireCoach:', error);
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
router.post('/exercises', auth, requireCoach, async (req, res) => {
  console.log(`🏋️ Création exercice - Coach: ${req.user?.email}, Données:`, req.body);

  try {
    const { name, description, category, muscleGroup, equipment, difficulty, instructions } = req.body;

    if (!name || !category || !difficulty) {
      console.log(`❌ Création exercice échouée - Champs manquants`);
      return res.status(400).json({ error: 'Nom, catégorie et difficulté requis' });
    }

    console.log(`✅ Données validées pour exercice: ${name} | catégorie: ${category} | difficulté: ${difficulty}`);
    // You can uncomment the next line to see the full payload during debugging
    // console.log('Payload:', { name, description, category, difficulty });

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

    console.log(`✅ Exercice créé: ${exercise.name} (ID: ${exercise.id})`);

    const responseData = {
      message: 'Exercice créé avec succès',
      exercise
    };

    console.log(`📤 Réponse création exercice:`, responseData);
    res.status(201).json(responseData);
  } catch (e) {
    console.error('💥 Erreur création exercice:', e);
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
  console.log(`📋 Liste des exercices - User: ${req.user?.email}, Filtres:`, req.query);

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

    console.log(`✅ ${exercises.length} exercice(s) trouvé(s)`);

    const responseData = { exercises };
    console.log(`📤 Réponse liste exercices: ${exercises.length} résultat(s)`);
    res.json(responseData);
  } catch (e) {
    console.error('💥 Erreur list exercises:', e);
    handleError(res, e, 500);
  }
});

// Obtenir les détails d'un exercice spécifique
router.get('/exercises/:id', auth, async (req, res) => {
  console.log(`🔍 Détails exercice - User: ${req.user?.email}, ID: ${req.params.id}`);

  try {
    const exerciseId = parseInt(req.params.id);
    
    if (isNaN(exerciseId)) {
      console.log(`❌ ID exercice invalide: ${req.params.id}`);
      return res.status(400).json({ error: 'ID exercice invalide' });
    }

    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId }
    });

    if (!exercise) {
      console.log(`❌ Exercice non trouvé: ID ${exerciseId}`);
      return res.status(404).json({ error: 'Exercice non trouvé' });
    }

    console.log(`✅ Exercice trouvé: ${exercise.name}`);
    res.json({ exercise });
  } catch (e) {
    console.error('💥 Erreur get exercise:', e);
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
router.post('/', auth, requireCoach, async (req, res) => {
  console.log(`📅 Création planning - Coach: ${req.user?.email}, Données:`, req.body);

  try {
    const { memberId, title, description, startDate, endDate } = req.body;
    console.log(`🔍 Validation des données - memberId: ${memberId}, title: ${title}, dates: ${startDate} -> ${endDate}`);

    if (!memberId || !title || !startDate || !endDate) {
      console.log(`❌ Création planning échouée - Champs manquants: memberId=${!!memberId}, title=${!!title}, startDate=${!!startDate}, endDate=${!!endDate}`);
      return res.status(400).json({ error: 'Membre, titre, dates requis' });
    }

    console.log(`🔍 Recherche du membre - ID: ${memberId}`);
    // Vérifier que le membre existe et appartient à la même salle que le coach
    const member = await prisma.member.findUnique({
      where: { userId: memberId },
      include: { User: true }
    });

    if (!member) {
      console.log(`❌ Membre non trouvé: ID ${memberId}`);
      return notFound(res, 'Member', memberId);
    }

    console.log(`✅ Membre trouvé: ${getFullName(member.User)} (ID: ${member.userId})`);
    console.log(`🔍 Recherche du coach - ID: ${req.user.sub}`);

    const coach = await prisma.user.findUnique({ where: { id: req.user.sub } });
    console.log(`✅ Coach trouvé: ${getFullName(coach)} (Salle: ${coach.gymId})`);
    console.log(`🔍 Vérification appartenance à la même salle - Membre: ${member.User.gymId}, Coach: ${coach.gymId}`);

    if (member.User.gymId !== coach.gymId) {
      console.log(`🚫 Coach ${getFullName(coach)} ne peut pas créer planning pour membre d'une autre salle`);
      return res.status(403).json({ error: 'Vous ne pouvez créer des plannings que pour les membres de votre salle' });
    }

    console.log(`✅ Appartenance validée - Même salle: ${coach.gymId}`);
    console.log(`🔍 Création du planning en base...`);

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
        member: {
          include: { User: { select: { id: true, firstName: true,
              lastName: true, email: true } } }
        },
        User: { select: { id: true, firstName: true,
              lastName: true, email: true } },
        days: {
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { dayOfWeek: 'asc' }
        }
      }
    });

    console.log(`✅ Planning créé: ${planning.title} (ID: ${planning.id}) pour ${getFullName(member.User)}`);

    // Envoyer notification au membre
    if (member.User.fcmToken) {
      console.log(`🔔 Envoi notification nouveau planning à ${getFullName(member.User)}`);
      await notifyNewTrainingPlan(member.User.fcmToken, planning).catch(err =>
        console.error('⚠️ Erreur notification FCM:', err)
      );
    }

    const responseData = {
      message: 'Planning créé avec succès',
      planning
    };

    console.log(`📤 Réponse création planning:`, responseData);
    res.status(201).json(responseData);
  } catch (e) {
    console.error('💥 Erreur création planning:', e);
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
  console.log(`📋 Liste des plannings - User: ${req.user?.email} (${req.user?.type}), Filtres:`, req.query);

  try {
    console.log(`🔍 Recherche du requester - ID: ${req.user.sub}`);
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    console.log(`✅ Requester trouvé: ${getFullName(requester)} (${requester.role})`);
    const { memberId, status, dayOfWeek } = req.query;
    console.log(`🔍 Analyse des filtres - memberId: ${memberId}, status: ${status}, dayOfWeek: ${dayOfWeek}`);

    let whereClause = {};
    console.log(`🔍 Construction de la clause WHERE selon le rôle: ${requester.role}`);

    if (requester.role === 'admin') {
      console.log(`👨‍💼 Mode coach - Planning créés par ce coach`);
      // Coach voit les plannings qu'il a créés
      whereClause.coachId = req.user.sub;
      if (memberId) {
        whereClause.memberId = parseInt(memberId);
        console.log(`👨‍💼 Filtre membre appliqué: ${memberId}`);
      }
    } else if (requester.role === 'member') {
      console.log(`👤 Mode membre - Plannings personnels`);
      // Membre voit ses propres plannings
      const member = await prisma.member.findUnique({
        where: { userId: req.user.sub }
      });
      whereClause.memberId = member.userId;
      console.log(`👤 Filtre automatique appliqué: memberId = ${member.userId}`);
    } else {
      console.log(`❓ Rôle non supporté: ${requester.role}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (status) {
      whereClause.status = status;
      console.log(`🔍 Filtre status appliqué: ${status}`);
    }

    console.log(`🔍 Clause WHERE finale:`, whereClause);
    console.log(`🔍 Exécution de la requête Prisma...`);

    const plannings = await prisma.planning.findMany({
      where: whereClause,
      include: {
        member: {
          include: { User: { select: { id: true, firstName: true,
              lastName: true, email: true } } }
        },
        User: { select: { id: true, firstName: true,
              lastName: true, email: true } },
        days: {
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { dayOfWeek: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`✅ ${plannings.length} planning(s) trouvé(s)`);
    if (plannings.length > 0) {
      console.log(`📊 Détails des plannings:`, plannings.map(p => ({
        id: p.id,
        title: p.title,
        member: getFullName(p.member.User),
        status: p.status,
        daysCount: p.days.length
      })));
    }

    const responseData = { plannings };
    console.log(`📤 Réponse liste plannings: ${plannings.length} résultat(s)`);
    res.json(responseData);
  } catch (e) {
    console.error('💥 Erreur list plannings:', e);
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
router.delete('/:planningId', auth, requireCoach, async (req, res) => {
  console.log(`🗑️ Suppression planning - Coach: ${req.user?.email}, Planning ID: ${req.params.planningId}`);

  try {
    const planningId = parseInt(req.params.planningId);

    if (isNaN(planningId)) {
      console.log(`❌ ID planning invalide: ${req.params.planningId}`);
      return res.status(400).json({ error: 'ID planning invalide' });
    }

    console.log(`🔍 Recherche du planning - ID: ${planningId}`);

    // Vérifier que le planning existe et appartient au coach
    const planning = await prisma.planning.findUnique({
      where: { id: planningId },
      include: { 
        User: true,
        member: {
          include: { User: true }
        }
      }
    });

    if (!planning) {
      console.log(`❌ Planning non trouvé: ID ${planningId}`);
      return notFound(res, 'Planning', planningId);
    }

    console.log(`✅ Planning trouvé: ${planning.title} (Coach: ${getFullName(planning.User)})`);
    console.log(`🔍 Vérification propriété du planning - Coach ID: ${req.user.sub} vs Planning coachId: ${planning.coachId}`);

    if (planning.coachId !== req.user.sub) {
      console.log(`🚫 Coach ${req.user.email} ne peut pas supprimer le planning d'un autre coach`);
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres plannings' });
    }

    console.log(`✅ Propriété validée`);
    console.log(`🔍 Suppression du planning et de toutes ses dépendances (cascade)...`);

    // Supprimer le planning (cascade supprimera automatiquement les PlanningDay et PlanningExercise)
    await prisma.planning.delete({
      where: { id: planningId }
    });

    console.log(`✅ Planning supprimé: ${planning.title} (ID: ${planningId})`);

    // Envoyer notification au membre
    if (planning.member.User.fcmToken) {
      console.log(`🔔 Envoi notification suppression planning à ${getFullName(planning.member.User)}`);
      await notifyPlanningDeleted(planning.member.User.fcmToken, planning).catch(err =>
        console.error('⚠️ Erreur notification FCM:', err)
      );
    }

    const responseData = {
      message: 'Planning supprimé avec succès'
    };

    console.log(`📤 Réponse suppression planning:`, responseData);
    res.json(responseData);
  } catch (e) {
    console.error('💥 Erreur suppression planning:', e);
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
router.post('/:planningId/days/:dayOfWeek/exercises', auth, requireCoach, async (req, res) => {
  console.log(`➕ Ajout exercice au planning - Coach: ${req.user?.email}, Planning ID: ${req.params.planningId}, Jour: ${req.params.dayOfWeek}, Données:`, req.body);

  try {
    const planningId = Number(req.params.planningId);
    const dayOfWeek = Number(req.params.dayOfWeek);
    const { exerciseId, sets, reps, duration, weight, restTime, notes, order = 0 } = req.body;

    console.log(`🔍 Validation des paramètres - planningId: ${planningId}, dayOfWeek: ${dayOfWeek}, exerciseId: ${exerciseId}`);

    if (!exerciseId) {
      console.log(`❌ Ajout exercice échoué - exerciseId manquant`);
      return res.status(400).json({ error: 'ID de l\'exercice requis' });
    }

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      console.log(`❌ Jour invalide: ${dayOfWeek} (doit être entre 0 et 6)`);
      return res.status(400).json({ error: 'Jour de la semaine doit être entre 0 (dimanche) et 6 (samedi)' });
    }

    console.log(`🔍 Recherche du planning - ID: ${planningId}`);
    // Vérifier que le planning existe et appartient au coach
    const planning = await prisma.planning.findUnique({
      where: { id: planningId },
      include: { User: true }
    });

    if (!planning) {
      console.log(`❌ Planning non trouvé: ID ${planningId}`);
      return notFound(res, 'Planning', planningId);
    }

    console.log(`✅ Planning trouvé: ${planning.title} (Coach: ${getFullName(planning.User)})`);
    console.log(`🔍 Vérification propriété du planning - Coach ID: ${req.user.sub} vs Planning coachId: ${planning.coachId}`);

    if (planning.coachId !== req.user.sub) {
      console.log(`🚫 Coach ${req.user.email} ne peut pas modifier le planning d'un autre coach`);
      return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres plannings' });
    }

    console.log(`✅ Propriété validée`);
    console.log(`🔍 Recherche de l'exercice - ID: ${exerciseId}`);

    // Vérifier que l'exercice existe
    const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
    if (!exercise) {
      console.log(`❌ Exercice non trouvé: ID ${exerciseId}`);
      return notFound(res, 'Exercise', exerciseId);
    }

    console.log(`✅ Exercice trouvé: ${exercise.name} (${exercise.category})`);
    console.log(`🔍 Recherche/Création du PlanningDay pour jour ${dayOfWeek}`);

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
      console.log(`📅 PlanningDay n'existe pas, création...`);
      planningDay = await prisma.planningDay.create({
        data: {
          planningId,
          dayOfWeek
        }
      });
      console.log(`✅ PlanningDay créé pour le jour ${dayOfWeek} (ID: ${planningDay.id})`);
    } else {
      console.log(`✅ PlanningDay existant trouvé (ID: ${planningDay.id})`);
    }

    console.log(`🔍 Création de l'exercice dans le planning...`);
    console.log(`📊 Détails exercice: sets=${sets}, reps=${reps}, duration=${duration}, weight=${weight}, restTime=${restTime}, order=${order}`);

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
        exercise: true,
        planningDay: {
          include: {
            planning: {
              include: {
                member: { include: { User: { select: { firstName: true, lastName: true } } } }
              }
            }
          }
        }
      }
    });

    console.log(`✅ Exercice ajouté: ${exercise.name} au jour ${dayOfWeek} du planning ${planning.title}`);
    console.log(`👤 Pour le membre: ${getFullName(planningExercise.planningDay.planning.member.User)}`);

    // Envoyer notification au membre
    const memberUser = await prisma.user.findUnique({
      where: { id: planning.memberId }
    });
    
    if (memberUser?.fcmToken) {
      console.log(`🔔 Envoi notification modification planning à ${getFullName(memberUser)}`);
      await notifyPlanningModified(memberUser.fcmToken, planning, 'exercise_added').catch(err =>
        console.error('⚠️ Erreur notification FCM:', err)
      );
    }

    const responseData = {
      message: 'Exercice ajouté au jour du planning avec succès',
      planningExercise
    };

    console.log(`📤 Réponse ajout exercice:`, responseData);
    res.status(201).json(responseData);
  } catch (e) {
    console.error('💥 Erreur ajout exercice au planning:', e);
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
router.delete('/:planningId/days/:dayOfWeek/exercises/:exerciseId', auth, requireCoach, async (req, res) => {
  console.log(`🗑️ Suppression exercice du planning - Coach: ${req.user?.email}, Planning ID: ${req.params.planningId}, Jour: ${req.params.dayOfWeek}, Exercise ID: ${req.params.exerciseId}`);

  try {
    const planningId = Number(req.params.planningId);
    const dayOfWeek = Number(req.params.dayOfWeek);
    const exerciseId = Number(req.params.exerciseId);

    console.log(`🔍 Validation paramètres - planningId: ${planningId}, dayOfWeek: ${dayOfWeek}, exerciseId: ${exerciseId}`);
    console.log(`🔍 Recherche du planning - ID: ${planningId}`);

    // Vérifier que le planning existe et appartient au coach
    const planning = await prisma.planning.findUnique({
      where: { id: planningId },
      include: { User: true }
    });

    if (!planning) {
      console.log(`❌ Planning non trouvé: ID ${planningId}`);
      return notFound(res, 'Planning', planningId);
    }

    console.log(`✅ Planning trouvé: ${planning.title} (Coach: ${getFullName(planning.User)})`);
    console.log(`🔍 Vérification propriété du planning - Coach ID: ${req.user.sub} vs Planning coachId: ${planning.coachId}`);

    if (planning.coachId !== req.user.sub) {
      console.log(`🚫 Coach ${req.user.email} ne peut pas modifier le planning d'un autre coach`);
      return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres plannings' });
    }

    console.log(`✅ Propriété validée`);
    console.log(`🔍 Recherche du PlanningDay pour jour ${dayOfWeek}`);

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
      console.log(`❌ Jour ${dayOfWeek} non trouvé dans le planning ${planningId}`);
      return res.status(404).json({ error: 'Jour non trouvé dans ce planning' });
    }

    console.log(`✅ PlanningDay trouvé (ID: ${planningDay.id})`);
    console.log(`🔍 Recherche et suppression de l'exercice ${exerciseId} dans le jour ${dayOfWeek}`);

    // Supprimer l'exercice spécifique de ce jour
    const deletedExercise = await prisma.planningExercise.deleteMany({
      where: {
        planningDayId: planningDay.id,
        exerciseId
      }
    });

    console.log(`🗑️ Résultat suppression: ${deletedExercise.count} exercice(s) supprimé(s)`);

    if (deletedExercise.count === 0) {
      console.log(`❌ Exercice ${exerciseId} non trouvé dans le jour ${dayOfWeek} du planning ${planningId}`);
      return res.status(404).json({ error: 'Exercice non trouvé dans ce jour du planning' });
    }

    console.log(`✅ Exercice supprimé avec succès du jour ${dayOfWeek} du planning ${planning.title}`);

    // Envoyer notification au membre
    const memberUser = await prisma.user.findUnique({
      where: { id: planning.memberId }
    });
    
    if (memberUser?.fcmToken) {
      console.log(`🔔 Envoi notification modification planning à ${getFullName(memberUser)}`);
      await notifyPlanningModified(memberUser.fcmToken, planning, 'exercise_removed').catch(err =>
        console.error('⚠️ Erreur notification FCM:', err)
      );
    }

    const responseData = {
      message: 'Exercice supprimé du jour du planning avec succès'
    };

    console.log(`📤 Réponse suppression exercice:`, responseData);
    res.json(responseData);
  } catch (e) {
    console.error('💥 Erreur suppression exercice du planning:', e);
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
  console.log(`📋 Récupération plannings du membre - User: ${req.user?.email}, Member ID: ${req.params.memberId}`);

  try {
    console.log(`📋 Récupération plannings du membre - User: ${req.user?.email}, Member ID: ${req.params.memberId}, Filtres:`, req.query);
    const memberId = Number(req.params.memberId);
    const { status } = req.query;

    console.log(`🔍 Recherche du membre - Tentative 1: userId = ${memberId}`);

    // Vérifier que le membre existe (essayer d'abord par member.userId, puis par userId pour compatibilité frontend)
    let member = await prisma.member.findUnique({
      where: { userId: memberId },
      include: { User: { select: { id: true, firstName: true,
              lastName: true, email: true, gymId: true } } }
    });

    if (!member) {
      console.log(`🔄 Membre non trouvé par userId, tentative 2: userId = ${memberId} (fallback)`);
      // Peut-être que le frontend a passé l'userId au lieu du memberId. Tenter une recherche par userId.
      member = await prisma.member.findUnique({
        where: { userId: memberId },
        include: { User: { select: { id: true, firstName: true,
              lastName: true, email: true, gymId: true } } }
      });
      if (member) {
        console.log(`ℹ️ Membre trouvé via userId: userId ${memberId} -> userId ${member.userId}`);
      }
    }

    if (!member) {
      console.log(`❌ Membre non trouvé: ID ${memberId} (aucune des 2 tentatives n'a réussi)`);
      return notFound(res, 'Member', memberId);
    }

    console.log(`✅ Membre trouvé: ${getFullName(member.User)} (userId: ${member.userId}, gymId: ${member.User.gymId})`);
    console.log(`🔍 Recherche du requester - ID: ${req.user.sub}`);

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    console.log(`✅ Requester trouvé: ${getFullName(requester)} (${requester.role}, gymId: ${requester.gymId})`);
    console.log(`🔍 Vérification des permissions selon le rôle: ${requester.role}`);

    // Seuls les coaches de la même salle ou le membre lui-même peuvent voir ses plannings
    if (requester.role === 'member') {
      console.log(`👤 Mode membre - Vérification accès personnel`);
      // Un membre ne peut voir que ses propres plannings
      const memberProfile = await prisma.member.findUnique({
        where: { userId: req.user.sub }
      });
      console.log(`👤 Profil membre requester: userId ${memberProfile.userId}`);
      console.log(`👤 Comparaison: requester.userId (${memberProfile.userId}) vs target.userId (${member.userId})`);

      if (memberProfile.userId !== member.userId) {
        console.log(`🚫 Membre ${getFullName(requester)} ne peut pas voir les plannings d'un autre membre`);
        return res.status(403).json({ error: 'Vous ne pouvez voir que vos propres plannings' });
      }
      console.log(`✅ Accès personnel validé`);
    } else if (requester.role === 'admin') {
      console.log(`👨‍💼 Mode coach - Vérification appartenance salle`);
      // Un coach ne peut voir que les plannings des membres de sa salle
      console.log(`👨‍💼 Comparaison salles: requester.gymId (${requester.gymId}) vs member.gymId (${member.User.gymId})`);

      if (requester.gymId !== member.User.gymId) {
        console.log(`🚫 Coach ${getFullName(requester)} ne peut pas voir les plannings des membres d'une autre salle`);
        return res.status(403).json({ error: 'Vous ne pouvez voir que les plannings des membres de votre salle' });
      }
      console.log(`✅ Appartenance salle validée`);
    } else if (requester.role === 'owner') {
      console.log(`👑 Mode owner - Accès complet autorisé`);
      // Owner peut tout voir
    }

    console.log(`🔍 Construction de la requête plannings`);
    // Construire la requête
    let whereClause = { memberId };
    if (status) {
      whereClause.status = status;
      console.log(`🔍 Filtre status appliqué: ${status}`);
    }

    console.log(`🔍 Clause WHERE:`, whereClause);
    console.log(`🔍 Exécution requête plannings...`);

    const plannings = await prisma.planning.findMany({
      where: whereClause,
      include: {
        User: { select: { id: true, firstName: true,
              lastName: true, email: true } },
        days: {
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { dayOfWeek: 'asc' }
        }
      },
      orderBy: { startDate: 'desc' }
    });

    console.log(`✅ ${plannings.length} planning(s) trouvé(s) pour le membre ${getFullName(member.User)}`);
    if (plannings.length > 0) {
      console.log(`📊 Résumé plannings:`, plannings.map(p => ({
        id: p.id,
        title: p.title,
        coach: getFullName(p.User),
        status: p.status,
        daysCount: p.days.length,
        exercisesCount: p.days.reduce((sum, day) => sum + day.exercises.length, 0)
      })));
    }

    const responseData = {
      member: {
        id: member.userId,
        user: member.User
      },
      plannings
    };

    console.log(`📤 Réponse plannings membre: ${plannings.length} résultat(s)`);
    res.json(responseData);
  } catch (e) {
    console.error('💥 Erreur récupération plannings membre:', e);
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
  console.log(`📅 Récupération prochain jour de planning - ${new Date().toISOString()} - User: ${req.user?.email || 'unknown'}, Member ID: ${req.params.memberId}`);

  try {
    const memberId = Number(req.params.memberId);
    console.log(`🔍 Recherche du membre - Tentative 1: userId = ${memberId}`);

    // Vérifier que le membre existe (essayer d'abord par member.userId, puis par userId pour compatibilité frontend)
    let member = await prisma.member.findUnique({
      where: { userId: memberId },
      include: { User: { select: { id: true, firstName: true,
              lastName: true, email: true, gymId: true } } }
    });

    if (!member) {
      console.log(`🔄 Membre non trouvé par userId, tentative 2: userId = ${memberId} (fallback)`);
      // Peut-être que le frontend a passé l'userId au lieu du memberId. Tenter une recherche par userId.
      member = await prisma.member.findUnique({
        where: { userId: memberId },
        include: { User: { select: { id: true, firstName: true,
              lastName: true, email: true, gymId: true } } }
      });
      if (member) {
        console.log(`ℹ️ Membre trouvé via userId: userId ${memberId} -> userId ${member.userId}`);
      }
    }

    if (!member) {
      console.log(`❌ Membre non trouvé: ID ${memberId} (aucune des 2 tentatives n'a réussi)`);
      return notFound(res, 'Member', memberId);
    }

    console.log(`✅ Membre trouvé: ${getFullName(member.User)} (userId: ${member.userId}, gymId: ${member.User.gymId})`);
    console.log(`🔍 Recherche du requester - ID: ${req.user.sub}`);

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    console.log(`✅ Requester trouvé: ${getFullName(requester)} (${requester.role}, gymId: ${requester.gymId})`);
    console.log(`🔍 Vérification des permissions selon le rôle: ${requester.role}`);

    // Seuls les coaches de la même salle ou le membre lui-même peuvent voir son planning
    if (requester.role === 'member') {
      console.log(`👤 Mode membre - Vérification accès personnel`);
      const memberProfile = await prisma.member.findUnique({
        where: { userId: req.user.sub }
      });
      console.log(`👤 Profil membre requester: userId ${memberProfile.userId}`);
      console.log(`👤 Comparaison: requester.userId (${memberProfile.userId}) vs target.userId (${member.userId})`);

      if (memberProfile.userId !== member.userId) {
        console.log(`🚫 Membre ${getFullName(requester)} ne peut pas voir le planning d'un autre membre`);
        return res.status(403).json({ error: 'Vous ne pouvez voir que votre propre planning' });
      }
      console.log(`✅ Accès personnel validé`);
    } else if (requester.role === 'admin') {
      console.log(`👨‍💼 Mode coach - Vérification appartenance salle`);
      console.log(`👨‍💼 Comparaison salles: requester.gymId (${requester.gymId}) vs member.gymId (${member.User.gymId})`);

      if (requester.gymId !== member.User.gymId) {
        console.log(`🚫 Coach ${getFullName(requester)} ne peut pas voir le planning des membres d'une autre salle`);
        return res.status(403).json({ error: 'Vous ne pouvez voir que les plannings des membres de votre salle' });
      }
      console.log(`✅ Appartenance salle validée`);
    } else if (requester.role === 'owner') {
      console.log(`👑 Mode owner - Accès complet autorisé`);
    }

    console.log(`📅 Calcul des dates pour planning`);
    // Obtenir la date actuelle et le jour de la semaine (0 = dimanche, 1 = lundi, etc.)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Minuit aujourd'hui

    // Calculer la date de demain
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowDayOfWeek = tomorrow.getDay();

    const currentDayOfWeek = now.getDay();

    console.log(`📅 Date actuelle: ${today.toISOString().split('T')[0]}, Jour de la semaine: ${currentDayOfWeek}`);
    console.log(`📅 Date de demain: ${tomorrow.toISOString().split('T')[0]}, Jour de la semaine: ${tomorrowDayOfWeek}`);

    console.log(`🔍 Recherche planning actif pour aujourd'hui ou demain`);
    console.log(`🔍 Critères: memberId=${memberId}, status='active', startDate <= ${today.toISOString().split('T')[0]}, endDate >= ${today.toISOString().split('T')[0]}`);

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
        days: {
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { dayOfWeek: 'asc' }
        }
      },
      orderBy: { startDate: 'desc' }
    });

    if (!activePlanning) {
      console.log(`ℹ️ Aucun planning actif trouvé pour le membre ${getFullName(member.User)}`);
      console.log(`ℹ️ Critères non remplis: planning actif couvrant la date ${today.toISOString().split('T')[0]}`);
      return res.status(204).json({
        message: 'Aucun entraînement prévu pour aujourd\'hui ou demain',
        member: {
          id: member.userId,
          user: member.User
        }
      });
    }

    console.log(`✅ Planning actif trouvé: ${activePlanning.title} (ID: ${activePlanning.id})`);
    console.log(`📊 Planning détails: ${activePlanning.days.length} jours définis, Coach: ${getFullName(activePlanning.User)}`);
    
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    
    // Chercher d'abord les exercices pour aujourd'hui
    console.log(`🔍 Recherche exercices pour aujourd'hui (jour ${currentDayOfWeek})`);
    const todayDay = activePlanning.days.find(day => day.dayOfWeek === currentDayOfWeek);

    if (todayDay && todayDay.exercises.length > 0) {
      console.log(`✅ Entraînement trouvé pour aujourd'hui: ${dayNames[todayDay.dayOfWeek]} (${today.toISOString().split('T')[0]}) - ${todayDay.exercises.length} exercice(s)`);
      console.log(`📋 Liste exercices:`, todayDay.exercises.map(ex => `${ex.exercise.name} (${ex.sets}x${ex.reps})`));

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
          exercises: todayDay.exercises.map(ex => ({
            exercise: ex.exercise,
            sets: ex.sets,
            reps: ex.reps,
            duration: ex.duration,
            weight: ex.weight,
            restTime: ex.restTime,
            notes: ex.notes
          }))
        }
      };

      console.log(`📤 Réponse jour actuel: ${responseData.day.dayName} avec ${responseData.day.exercises.length} exercice(s)`);
      return res.json(responseData);
    }

    console.log(`ℹ️ Aucun exercice pour aujourd'hui, recherche pour demain (jour ${tomorrowDayOfWeek})`);
    
    // Si pas d'exercices aujourd'hui, chercher pour demain
    const tomorrowDay = activePlanning.days.find(day => day.dayOfWeek === tomorrowDayOfWeek);

    if (!tomorrowDay || tomorrowDay.exercises.length === 0) {
      console.log(`ℹ️ Aucun exercices prévu pour aujourd'hui ni demain`);
      if (tomorrowDay) {
        console.log(`ℹ️ Jour trouvé mais aucun exercice: ${tomorrowDay.exercises.length} exercices`);
      } else {
        console.log(`ℹ️ Jour ${tomorrowDayOfWeek} non défini dans ce planning`);
      }
      return res.status(204).json({
        message: 'Aucun entraînement prévu pour aujourd\'hui ou demain',
        member: {
          id: member.userId,
          user: member.User
        }
      });
    }

    console.log(`✅ Entraînement trouvé pour demain: ${dayNames[tomorrowDay.dayOfWeek]} (${tomorrow.toISOString().split('T')[0]}) - ${tomorrowDay.exercises.length} exercice(s)`);
    console.log(`📋 Liste exercices:`, tomorrowDay.exercises.map(ex => `${ex.exercise.name} (${ex.sets}x${ex.reps})`));

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
        exercises: tomorrowDay.exercises.map(ex => ({
          exercise: ex.exercise,
          sets: ex.sets,
          reps: ex.reps,
          duration: ex.duration,
          weight: ex.weight,
          restTime: ex.restTime,
          notes: ex.notes
        }))
      }
    };

    console.log(`📤 Réponse jour suivant: ${responseData.day.dayName} avec ${responseData.day.exercises.length} exercice(s)`);
    res.json(responseData);
  } catch (e) {
    console.error('💥 Erreur récupération prochain jour:', e);
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
router.post('/request-help', auth, async (req, res) => {
  try {
    const { exerciseName, notes } = req.body;

    console.log(`🆘 Demande d'aide reçue - User ID: ${req.user.sub}, Exercise: ${exerciseName}`);

    // Validation
    if (!exerciseName) {
      console.log('❌ Nom exercice manquant');
      return res.status(400).json({ error: 'Exercise name is required' });
    }

    // Vérifier que l'utilisateur est un membre
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { Member: true }
    });

    if (!user || user.role !== 'member' || !user.Member) {
      console.log(`❌ Utilisateur n'est pas un membre: ${user ? getFullName(user) : 'inconnu'}`);
      return res.status(403).json({ error: 'Only members can request help' });
    }

    console.log(`✅ Membre trouvé: ${getFullName(user)}`);

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
      console.log(`❌ Aucun planning actif pour ${getFullName(user)}`);
      return res.status(403).json({ error: 'No active planning found' });
    }

    console.log(`✅ Planning actif trouvé - Coach: ${getFullName(activePlanning.User)}`);

    // Envoyer une notification au coach
    if (activePlanning.User.fcmToken) {
      console.log(`🔔 Envoi notification au coach ${getFullName(activePlanning.User)}`);
      
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

      console.log(`✅ Notification envoyée au coach`);
    } else {
      console.log(`⚠️ Coach ${getFullName(activePlanning.User)} n'a pas de FCM token`);
    }

    console.log(`✅ Demande d'aide traitée avec succès`);
    res.json({ 
      success: true, 
      message: 'Help request sent to coach',
      coach: {
        id: activePlanning.User.id,
        name: getFullName(activePlanning.User)
      }
    });
  } catch (e) {
    console.error('💥 Erreur demande d\'aide:', e);
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
router.post('/respond-help', auth, requireCoach, async (req, res) => {
  try {
    const { memberId, response, exerciseName } = req.body;

    console.log(`💬 Réponse à demande d'aide - Coach: ${req.user.sub}, Membre: ${memberId}, Réponse: ${response}`);

    // Validation
    if (!memberId || !response) {
      console.log('❌ Paramètres manquants');
      return res.status(400).json({ error: 'Member ID and response are required' });
    }

    if (!['coming', 'busy'].includes(response)) {
      console.log('❌ Réponse invalide:', response);
      return res.status(400).json({ error: 'Response must be "coming" or "busy"' });
    }

    // Récupérer le coach
    const coach = await prisma.user.findUnique({
      where: { id: req.user.sub }
    });

    console.log(`✅ Coach trouvé: ${getFullName(coach)}`);

    // Récupérer le membre
    const member = await prisma.user.findUnique({
      where: { id: memberId }
    });

    if (!member) {
      console.log(`❌ Membre non trouvé: ${memberId}`);
      return res.status(404).json({ error: 'Member not found' });
    }

    console.log(`✅ Membre trouvé: ${getFullName(member)}`);

    // Vérifier que le membre et le coach sont dans la même salle
    if (member.gymId !== coach.gymId) {
      console.log(`🚫 Coach et membre ne sont pas dans la même salle`);
      return res.status(403).json({ error: 'Member not in your gym' });
    }

    // Envoyer notification au membre
    if (member.fcmToken) {
      console.log(`🔔 Envoi notification au membre ${getFullName(member)}`);
      
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

      console.log(`✅ Notification envoyée au membre`);
    } else {
      console.log(`⚠️ Membre ${getFullName(member)} n'a pas de FCM token`);
    }

    console.log(`✅ Réponse à la demande d'aide traitée avec succès`);
    res.json({ 
      success: true, 
      message: `Response "${response}" sent to member`,
      member: {
        id: member.id,
        name: getFullName(member)
      }
    });
  } catch (e) {
    console.error('💥 Erreur réponse demande d\'aide:', e);
    handleError(res, e, 500);
  }
});

module.exports = router;