const express = require('express');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const auth = require('../middleware/auth');
const { generateExerciseId } = require('../utils/idGenerator');
const { getFullName } = require('../utils/nameUtils');
const programService = require('../services/programService');

// Utility helpers
function handleError(res, e, status = 400) {
  res.status(status).json({ error: e.message });
}
function notFound(res, entity, id) {
  res.status(404).json({ error: `${entity} with id ${id} not found` });
}

// Middleware : gestion du catalogue d'exercices (manager ou owner)
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
    });

    if (!user) {
      logger.warn(`❌ Utilisateur non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Accès réservé aux managers et owners' });
    }

    logger.debug(`✅ Utilisateur trouvé: ${getFullName(user)} (${user.role}) - ID: ${user.id}`);

    if (!['manager', 'owner'].includes(user.role)) {
      logger.warn(`🚫 Rôle insuffisant: ${getFullName(user)} est ${user.role}, manager ou owner requis`);
      return res.status(403).json({ error: 'Accès réservé aux managers et owners' });
    }

    logger.debug(`✅ Accès catalogue autorisé pour ${getFullName(user)}`);
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
// ==================== PLANNINGS (compatibilité Rôles V2) ====================
//
// Les plannings sont remplacés par les programmes (/programs) et leurs
// affectations (ProgramAssignment). Les routes de lecture gardent leur forme
// pour l'app membre ; `planning.id` est désormais l'id de l'affectation.
// Les écritures historiques renvoient 410.

function planningsDeprecated(req, res) {
  res.status(410).json({
    error: 'plannings_deprecated',
    message: 'Les plannings sont remplacés par les programmes : utiliser /programs et POST /programs/{id}/assignments'
  });
}

router.post('/', auth, planningsDeprecated);
router.delete('/:planningId', auth, planningsDeprecated);
router.post('/:planningId/days/:dayOfWeek/exercises', auth, planningsDeprecated);
router.delete('/:planningId/days/:dayOfWeek/exercises/:exerciseId', auth, planningsDeprecated);

const MEMBER_USER_SELECT = { id: true, firstName: true, lastName: true, email: true, gymId: true };

/**
 * Charge le membre et vérifie que `requester` peut lire ses plannings :
 * lui-même, manager de sa salle, son coach, owner. Répond et renvoie null sinon.
 */
async function loadReadableMember(req, res) {
  const memberId = Number(req.params.memberId);
  const member = Number.isInteger(memberId)
    ? await prisma.member.findUnique({ where: { userId: memberId }, include: { User: { select: MEMBER_USER_SELECT } } })
    : null;
  if (!member) {
    notFound(res, 'Member', req.params.memberId);
    return null;
  }

  const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
  const allowed = requester && (
    requester.role === 'owner' ||
    (requester.role === 'member' && requester.id === member.userId) ||
    (requester.role === 'manager' && requester.gymId === member.User.gymId) ||
    (requester.role === 'coach' && member.coachId === requester.id)
  );
  if (!allowed) {
    res.status(403).json({ error: 'Vous ne pouvez pas voir les plannings de ce membre' });
    return null;
  }
  return member;
}

// Lister les plannings (affectations) visibles par l'utilisateur
router.get('/', auth, async (req, res) => {
  try {
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) return res.status(403).json({ error: 'Forbidden' });

    const { memberId, status } = req.query;
    const where = {};
    switch (requester.role) {
      case 'member':
        where.memberId = requester.id;
        break;
      case 'manager':
        where.Member = { User: { gymId: requester.gymId } };
        break;
      case 'coach':
        where.Member = { coachId: requester.id };
        break;
      case 'owner':
        break;
      default:
        return res.status(403).json({ error: 'Forbidden' });
    }
    if (memberId && requester.role !== 'member') where.memberId = parseInt(memberId);
    if (status) where.status = status;

    const plannings = await programService.listLegacyPlannings(where);
    // Forme historique : chaque planning porte son membre
    const members = await prisma.member.findMany({
      where: { userId: { in: [...new Set(plannings.map(p => p.memberId))] } },
      include: { User: { select: { id: true, firstName: true, lastName: true, email: true } } }
    });
    const byId = new Map(members.map(m => [m.userId, m]));
    res.json({ plannings: plannings.map(p => ({ ...p, Member: byId.get(p.memberId) || null })) });
  } catch (e) {
    logger.error('💥 Erreur list plannings:', e);
    handleError(res, e, 500);
  }
});

// Plannings (affectations) d'un membre
router.get('/member/:memberId', auth, async (req, res) => {
  try {
    const member = await loadReadableMember(req, res);
    if (!member) return;

    const where = { memberId: member.userId };
    if (req.query.status) where.status = req.query.status;

    res.json({
      member: { id: member.userId, user: member.User },
      plannings: await programService.listLegacyPlannings(where)
    });
  } catch (e) {
    logger.error('💥 Erreur récupération plannings membre:', e);
    handleError(res, e, 500);
  }
});

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// Prochain jour d'entraînement (aujourd'hui, sinon demain) du programme actif
router.get('/next-day/:memberId', auth, async (req, res) => {
  try {
    const member = await loadReadableMember(req, res);
    if (!member) return;

    const memberRef = { id: member.userId, user: member.User };
    const noWorkout = () => res.status(204).json({
      message: 'Aucun entraînement prévu pour aujourd\'hui ou demain',
      member: memberRef
    });

    const today = programService.startOfToday();
    const assignment = await programService.findActiveAssignment(member.userId, today);
    if (!assignment) return noWorkout();

    const planning = programService.toLegacyPlanning(assignment);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const candidates = [
      { date: today, isToday: true },
      // Demain doit encore être couvert par l'affectation
      ...(!assignment.endDate || assignment.endDate >= tomorrow ? [{ date: tomorrow, isToday: false }] : [])
    ];

    for (const { date, isToday } of candidates) {
      const day = planning.PlanningDay.find(d => d.dayOfWeek === date.getDay());
      if (!day || day.PlanningExercise.length === 0) continue;

      return res.json({
        member: memberRef,
        planning: {
          id: planning.id,
          programId: planning.programId,
          title: planning.title,
          startDate: planning.startDate,
          endDate: planning.endDate
        },
        day: {
          dayOfWeek: day.dayOfWeek,
          dayName: DAY_NAMES[day.dayOfWeek],
          date: date.toISOString().split('T')[0],
          isToday,
          exercises: day.PlanningExercise.map(ex => ({
            exercise: ex.Exercise,
            sets: ex.sets,
            reps: ex.reps,
            duration: ex.duration,
            weight: ex.weight,
            restTime: ex.restTime,
            notes: ex.notes
          }))
        }
      });
    }
    return noWorkout();
  } catch (e) {
    logger.error('💥 Erreur récupération prochain jour:', e);
    handleError(res, e, 500);
  }
});

// ==================== REQUEST HELP ====================

// Le membre demande de l'aide : notifie l'auteur de son programme actif et son coach
router.post('/request-help', auth, apiLimiter, async (req, res) => {
  try {
    const { exerciseName, notes } = req.body;
    if (!exerciseName) {
      return res.status(400).json({ error: 'Exercise name is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { Member: { include: { Coach: true } } }
    });
    if (!user || user.role !== 'member' || !user.Member) {
      return res.status(403).json({ error: 'Only members can request help' });
    }

    const assignment = await programService.findActiveAssignment(user.id);
    if (!assignment) {
      return res.status(403).json({ error: 'No active planning found' });
    }

    // Destinataires : auteur de l'affectation + coach affecté, sans doublon
    const recipients = new Map();
    for (const staff of [assignment.Assigner, user.Member.Coach]) {
      if (staff) recipients.set(staff.id, staff);
    }
    if (recipients.size === 0) {
      return res.status(403).json({ error: 'No coach to notify' });
    }

    const { sendPushNotification } = require('../services/pushNotificationService');
    const helpMessage = notes
      ? `${getFullName(user)} demande de l'aide pour "${exerciseName}": ${notes}`
      : `${getFullName(user)} demande de l'aide pour "${exerciseName}"`;

    for (const staff of recipients.values()) {
      if (!staff.fcmToken) {
        logger.warn(`⚠️ ${getFullName(staff)} n'a pas de FCM token`);
        continue;
      }
      await sendPushNotification(staff.fcmToken, {
        title: '🆘 Demande d\'aide',
        body: helpMessage,
        data: {
          type: 'help_request',
          memberId: user.id.toString(),
          memberName: getFullName(user),
          exerciseName: exerciseName,
          notes: notes || '',
          planningId: assignment.id.toString(),
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
            channelId: 'help_requests',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK'
          }
        },
        apns: {
          payload: {
            aps: { sound: 'default', badge: 1, category: 'HELP_REQUEST' }
          }
        }
      });
    }

    // `coach` : coach affecté en priorité, sinon l'auteur du programme (forme historique)
    const primary = user.Member.Coach || assignment.Assigner;
    res.json({
      success: true,
      message: 'Help request sent to coach',
      coach: { id: primary.id, name: getFullName(primary) },
      notified: [...recipients.values()].map(s => ({ id: s.id, name: getFullName(s) }))
    });
  } catch (e) {
    logger.error('💥 Erreur demande d\'aide:', e);
    handleError(res, e, 500);
  }
});

// Réponse du staff à une demande d'aide : coach (ses membres), manager (sa salle), owner
router.post('/respond-help', auth, apiLimiter, async (req, res) => {
  try {
    const { memberId: memberIdRaw, response, exerciseName } = req.body;
    const memberId = parseInt(memberIdRaw, 10);

    if (!memberIdRaw || !response) {
      return res.status(400).json({ error: 'Member ID and response are required' });
    }
    if (!['coming', 'busy'].includes(response)) {
      return res.status(400).json({ error: 'Response must be "coming" or "busy"' });
    }

    const coach = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!coach || !['owner', 'manager', 'coach'].includes(coach.role)) {
      return res.status(403).json({ error: 'Accès réservé aux coachs' });
    }

    const member = await prisma.user.findUnique({ where: { id: memberId }, include: { Member: true } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const allowed = coach.role === 'owner' ||
      (coach.role === 'manager' && member.gymId === coach.gymId) ||
      (coach.role === 'coach' && member.Member?.coachId === coach.id);
    if (!allowed) {
      return res.status(403).json({ error: 'Member not in your gym' });
    }

    if (member.fcmToken) {
      const { sendPushNotification } = require('../services/pushNotificationService');
      const responseMessages = {
        coming: `${getFullName(coach)} arrive pour vous aider${exerciseName ? ` avec "${exerciseName}"` : ''} 👍`,
        busy: `${getFullName(coach)} est occupé pour le moment${exerciseName ? ` pour "${exerciseName}"` : ''} ⏰`
      };
      const responseEmojis = { coming: '✅', busy: '⏰' };

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
          payload: { aps: { sound: 'default', badge: 1 } }
        }
      });
    } else {
      logger.warn(`⚠️ Membre ${getFullName(member)} n'a pas de FCM token`);
    }

    res.json({
      success: true,
      message: `Response "${response}" sent to member`,
      member: { id: member.id, name: getFullName(member) }
    });
  } catch (e) {
    logger.error('💥 Erreur réponse demande d\'aide:', e);
    handleError(res, e, 500);
  }
});

module.exports = router;
