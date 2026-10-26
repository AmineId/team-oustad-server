const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const programService = require('../services/programService');
const { loadRequester, sendProgramError, ASSIGN_ROLES } = require('./programs');

// Rôles V2 : annuler une affectation (statut `cancelled`, l'historique est conservé).
// Mêmes droits que l'affectation : owner, coach (ses membres).
router.delete('/:id', auth, loadRequester(ASSIGN_ROLES), apiLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
    res.json(await programService.cancelAssignment(id, req.requester));
  } catch (error) {
    sendProgramError(res, error, 'Erreur lors de l\'annulation de l\'affectation');
  }
});

module.exports = router;
