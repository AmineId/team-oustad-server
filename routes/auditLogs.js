const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const { apiLimiter } = require('../middleware/rateLimiter');
const { requireSuperOwner } = require('../utils/ownerPermissions');
const auditService = require('../services/auditService');
const { AuditError } = auditService;

/** Historique des modifications (qui, quoi, quand) : super-owner uniquement. */

function handleError(res, error, fallback) {
  if (error instanceof AuditError) {
    return res.status(error.status).json({ error: error.code, message: error.message });
  }
  logger.error(`💥 ${fallback}:`, error);
  return res.status(500).json({ error: fallback });
}

router.use(apiLimiter, auth, requireSuperOwner);

router.get('/', async (req, res) => {
  try {
    res.json(await auditService.listAuditLogs(req.query));
  } catch (error) {
    handleError(res, error, 'Erreur lors du chargement de l\'historique');
  }
});

router.get('/meta', (req, res) => {
  res.json(auditService.getMeta());
});

router.get('/:id', async (req, res) => {
  try {
    res.json(await auditService.getAuditLog(req.params.id));
  } catch (error) {
    handleError(res, error, 'Erreur lors du chargement de l\'entrée');
  }
});

module.exports = router;
