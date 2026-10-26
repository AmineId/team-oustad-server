const express = require('express');
const multer = require('multer');
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { apiLimiter } = require('../middleware/rateLimiter');
const { sendPushNotification } = require('../services/pushNotificationService');
const incidentService = require('../services/incidentService');
const { IncidentError, MAX_PHOTO_BYTES } = incidentService;
const { loadRequester } = require('./programs');

/**
 * Rôles V2 : incidents (voir services/incidentService.js pour la portée).
 * La source (app / kiosk) est déduite du token, jamais du body.
 */

const requireIncidentRole = loadRequester(['owner', 'manager', 'coach']);

// Photo en multipart (`photo`) ; le body JSON accepte aussi `photoData` (data URI base64)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } });
function handlePhotoUpload(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'invalid_photo', message: err.message });
    next();
  });
}

function sendError(res, error, fallback) {
  if (error instanceof IncidentError) {
    return res.status(error.status).json({ error: error.code, message: error.message });
  }
  logger.error(`💥 ${fallback}:`, error);
  return res.status(500).json({ error: fallback });
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id)) throw new IncidentError(400, 'invalid_id', 'Identifiant invalide');
  return id;
}

/** FCM `data: { type: "incident", incidentId, action }`, sans bloquer la réponse. */
async function notify(where, incident, action, title, body) {
  try {
    const users = await prisma.user.findMany({
      where: { ...where, fcmToken: { not: null }, notificationsEnabled: true },
      select: { id: true, fcmToken: true }
    });
    for (const user of users) {
      sendPushNotification(user.fcmToken, {
        title,
        body,
        data: { type: 'incident', incidentId: String(incident.id), action }
      }, user.id).catch(err => logger.warn(`⚠️ Notification incident non envoyée: ${err.message}`));
    }
  } catch (error) {
    logger.warn(`⚠️ Notifications incident: ${error.message}`);
  }
}

const STATUS_LABELS = { open: 'rouvert', in_progress: 'en cours', resolved: 'résolu', closed: 'clôturé' };

router.post('/', auth, requireIncidentRole, apiLimiter, handlePhotoUpload, async (req, res) => {
  try {
    const incident = await incidentService.createIncident(req.body, req.file, req.requester, req.user.client);
    // Nouvel incident : tous les owners
    notify({ role: 'owner' }, incident, 'created',
      `🚨 Incident ${incident.severity} — ${incident.gym.name}`, incident.title);
    res.status(201).json(incident);
  } catch (error) {
    sendError(res, error, 'Erreur lors de la création de l\'incident');
  }
});

router.get('/', auth, requireIncidentRole, async (req, res) => {
  try {
    res.json(await incidentService.listIncidents(req.query, req.requester));
  } catch (error) {
    sendError(res, error, 'Erreur lors de la récupération des incidents');
  }
});

router.get('/:id', auth, requireIncidentRole, async (req, res) => {
  try {
    res.json(await incidentService.getIncident(parseId(req.params.id), req.requester));
  } catch (error) {
    sendError(res, error, 'Erreur lors de la récupération de l\'incident');
  }
});

router.get('/:id/photo', auth, requireIncidentRole, async (req, res) => {
  try {
    const { photo, photoMime } = await incidentService.getPhoto(parseId(req.params.id), req.requester);
    res.set('Content-Type', photoMime || 'application/octet-stream');
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(photo);
  } catch (error) {
    sendError(res, error, 'Erreur lors de la récupération de la photo');
  }
});

router.post('/:id/messages', auth, requireIncidentRole, apiLimiter, async (req, res) => {
  try {
    const { message, incident } = await incidentService.addMessage(parseId(req.params.id), req.body.body, req.requester);
    // Réponse de l'owner → créateur ; réponse du créateur → owners
    const where = req.requester.role === 'owner'
      ? { id: incident.createdBy }
      : { role: 'owner' };
    notify(where, incident, 'message', `💬 Réponse — ${incident.title}`, message.body.slice(0, 140));
    res.status(201).json(message);
  } catch (error) {
    sendError(res, error, 'Erreur lors de l\'envoi du message');
  }
});

router.patch('/:id', auth, requireIncidentRole, apiLimiter, async (req, res) => {
  try {
    const { incident, previousStatus } = await incidentService.updateStatus(
      parseId(req.params.id), req.body.status, req.requester
    );
    if (incident.status !== previousStatus) {
      notify({ id: incident.createdBy.id }, incident, 'status',
        `📌 Incident ${STATUS_LABELS[incident.status]}`, incident.title);
    }
    res.json(incident);
  } catch (error) {
    sendError(res, error, 'Erreur lors de la mise à jour de l\'incident');
  }
});

module.exports = router;
