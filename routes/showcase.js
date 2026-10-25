const express = require('express');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const {
  HOME_KEY,
  ShowcaseValidationError,
  validatePage,
  readPage,
  writePage
} = require('../utils/showcasePages');

const router = express.Router();

// Page d'accueil du site vitrine : réservée aux owners (rôle relu en base).
async function requireOwnerRole(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user || user.role !== 'owner') {
      return res.status(403).json({ error: 'Accès réservé aux propriétaires' });
    }
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// GET /showcase/home
router.get('/home', auth, requireOwnerRole, async (req, res) => {
  try {
    res.json(await readPage(HOME_KEY));
  } catch (e) {
    logger.error('💥 Erreur GET /showcase/home:', e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /showcase/home
router.put('/home', auth, requireOwnerRole, apiLimiter, async (req, res) => {
  try {
    const page = validatePage(req.body, { allowHero: true });
    await writePage(HOME_KEY, page, { userId: req.user.sub });
    res.json(page);
  } catch (e) {
    if (e instanceof ShowcaseValidationError) return res.status(400).json({ error: e.message });
    logger.error('💥 Erreur PUT /showcase/home:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
