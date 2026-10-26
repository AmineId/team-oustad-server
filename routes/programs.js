const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { apiLimiter } = require('../middleware/rateLimiter');
const { sendPushNotification } = require('../services/pushNotificationService');
const programService = require('../services/programService');
const { ProgramError } = programService;

/**
 * Rôles V2 : programmes.
 * - Lecture : owner, manager, coach (les programmes sont communs à toutes les salles)
 * - Écriture : owner uniquement
 * - Affectation : owner (tous), coach (ses membres affectés) ; le manager n'affecte pas
 */

const READ_ROLES = ['owner', 'manager', 'coach'];
const ASSIGN_ROLES = ['owner', 'coach'];

function loadRequester(roles) {
  return async (req, res, next) => {
    try {
      const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
      if (!requester || !roles.includes(requester.role)) {
        return res.status(403).json({ error: 'forbidden', message: `Accès réservé : ${roles.join(', ')}` });
      }
      req.requester = requester;
      next();
    } catch (error) {
      next(error);
    }
  };
}

const requireOwner = loadRequester(['owner']);
const requireReader = loadRequester(READ_ROLES);
const requireAssigner = loadRequester(ASSIGN_ROLES);

function sendError(res, error, fallback) {
  if (error instanceof ProgramError) {
    return res.status(error.status).json({ error: error.code, message: error.message, ...error.extra });
  }
  logger.error(`💥 ${fallback}:`, error);
  return res.status(500).json({ error: fallback });
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id)) throw new ProgramError(400, 'invalid_id', 'Identifiant invalide');
  return id;
}

router.get('/', auth, requireReader, async (req, res) => {
  try {
    res.json(await programService.listPrograms({ search: req.query.search }));
  } catch (error) {
    sendError(res, error, 'Erreur lors de la récupération des programmes');
  }
});

router.get('/:id', auth, requireReader, async (req, res) => {
  try {
    res.json(await programService.getProgram(parseId(req.params.id)));
  } catch (error) {
    sendError(res, error, 'Erreur lors de la récupération du programme');
  }
});

router.post('/', auth, requireOwner, apiLimiter, async (req, res) => {
  try {
    res.status(201).json(await programService.createProgram(req.body, req.requester.id));
  } catch (error) {
    sendError(res, error, 'Erreur lors de la création du programme');
  }
});

router.put('/:id', auth, requireOwner, apiLimiter, async (req, res) => {
  try {
    res.json(await programService.updateProgram(parseId(req.params.id), req.body));
  } catch (error) {
    sendError(res, error, 'Erreur lors de la mise à jour du programme');
  }
});

router.delete('/:id', auth, requireOwner, apiLimiter, async (req, res) => {
  try {
    res.json(await programService.deleteProgram(parseId(req.params.id)));
  } catch (error) {
    sendError(res, error, 'Erreur lors de la suppression du programme');
  }
});

router.post('/:id/days/:dayOfWeek/exercises', auth, requireOwner, apiLimiter, async (req, res) => {
  try {
    const exercise = await programService.addExercise(parseId(req.params.id), req.params.dayOfWeek, req.body);
    res.status(201).json(exercise);
  } catch (error) {
    sendError(res, error, 'Erreur lors de l\'ajout de l\'exercice');
  }
});

router.put('/:id/days/:dayOfWeek/exercises/:exerciseId', auth, requireOwner, apiLimiter, async (req, res) => {
  try {
    res.json(await programService.updateExercise(
      parseId(req.params.id), req.params.dayOfWeek, parseId(req.params.exerciseId), req.body
    ));
  } catch (error) {
    sendError(res, error, 'Erreur lors de la mise à jour de l\'exercice');
  }
});

router.delete('/:id/days/:dayOfWeek/exercises/:exerciseId', auth, requireOwner, apiLimiter, async (req, res) => {
  try {
    res.json(await programService.removeExercise(
      parseId(req.params.id), req.params.dayOfWeek, parseId(req.params.exerciseId)
    ));
  } catch (error) {
    sendError(res, error, 'Erreur lors de la suppression de l\'exercice');
  }
});

router.post('/:id/assignments', auth, requireAssigner, apiLimiter, async (req, res) => {
  try {
    const { assignments, replaced, members, program } = await programService.assignProgram(
      parseId(req.params.id), req.body, req.requester
    );

    // Notification aux membres (sans bloquer la réponse)
    const byMember = new Map(assignments.map(a => [a.memberId, a]));
    for (const member of members) {
      if (!member.fcmToken || !member.notificationsEnabled) continue;
      const assignment = byMember.get(member.id);
      sendPushNotification(member.fcmToken, {
        title: '💪 Nouveau programme d\'entraînement',
        body: program.title,
        data: {
          type: 'program',
          assignmentId: String(assignment.id),
          programId: String(program.id)
        }
      }, member.id).catch(err => logger.warn(`⚠️ Notification programme non envoyée: ${err.message}`));
    }

    res.status(201).json({ assignments, replaced });
  } catch (error) {
    sendError(res, error, 'Erreur lors de l\'affectation du programme');
  }
});

module.exports = router;
module.exports.loadRequester = loadRequester;
module.exports.ASSIGN_ROLES = ASSIGN_ROLES;
module.exports.sendProgramError = sendError;
