const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { requireAdminOrOwner } = require('../middleware/bannerAuth');
const bannerService = require('../services/bannerService');

// ==================== PUBLIC ENDPOINTS ====================

/**
 * GET /banners
 * Récupère la liste des bannières actives avec filtrage
 */
router.get('/', async (req, res) => {
  try {
    const { type, gymId, subscriptionTypeId, activeOnly = 'false', locale = 'fr' } = req.query;
    
    const filters = {
      type,
      gymId: gymId ? parseInt(gymId) : undefined,
      subscriptionTypeId: subscriptionTypeId ? parseInt(subscriptionTypeId) : undefined,
      activeOnly: activeOnly === 'true',
      locale
    };

    const banners = await bannerService.getActiveBanners(filters);
    
    res.json({ banners });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({ 
      error: 'Failed to fetch banners',
      message: error.message 
    });
  }
});

/**
 * GET /banners/stats/summary
 * Résumé des statistiques de toutes les bannières
 */
router.get('/stats/summary', authenticateToken, requireAdminOrOwner, async (req, res) => {
  try {
    const { gymId, startDate, endDate } = req.query;

    const summary = await bannerService.getStatsSummary({
      gymId: gymId ? parseInt(gymId) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });

    res.json(summary);
  } catch (error) {
    console.error('Error fetching stats summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stats summary',
      message: error.message 
    });
  }
});

/**
 * GET /banners/:id
 * Récupère les détails d'une bannière par ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locale = 'fr' } = req.query;

    const banner = await bannerService.getBannerById(parseInt(id), locale);
    
    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    res.json(banner);
  } catch (error) {
    console.error('Error fetching banner:', error);
    res.status(500).json({ 
      error: 'Failed to fetch banner',
      message: error.message 
    });
  }
});

/**
 * POST /banners/:id/track/view
 * Tracker la vue d'une bannière
 */
router.post('/:id/track/view', async (req, res) => {
  try {
    const { id } = req.params;
    const { variantId, userId } = req.query;

    const result = await bannerService.trackView({
      bannerId: parseInt(id),
      variantId: variantId ? parseInt(variantId) : null,
      userId: userId ? parseInt(userId) : null,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    if (result.limitReached) {
      return res.status(429).json({ 
        error: 'View limit reached',
        remainingViews: 0
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ 
      error: 'Failed to track view',
      message: error.message 
    });
  }
});

/**
 * POST /banners/:id/track/click
 * Tracker le clic sur une bannière
 */
router.post('/:id/track/click', async (req, res) => {
  try {
    const { id } = req.params;
    const { variantId, userId } = req.query;

    const result = await bannerService.trackClick({
      bannerId: parseInt(id),
      variantId: variantId ? parseInt(variantId) : null,
      userId: userId ? parseInt(userId) : null,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    res.json(result);
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({ 
      error: 'Failed to track click',
      message: error.message 
    });
  }
});

// ==================== ADMIN/OWNER ENDPOINTS ====================

/**
 * POST /banners
 * Créer une nouvelle bannière (Admin/Owner uniquement)
 */
router.post('/', authenticateToken, requireAdminOrOwner, async (req, res) => {
  try {
    const bannerData = req.body;

    const banner = await bannerService.createBanner(bannerData);
    
    res.status(201).json(banner);
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(400).json({ 
      error: 'Failed to create banner',
      message: error.message 
    });
  }
});

/**
 * PUT /banners/:id
 * Mettre à jour une bannière (Admin/Owner uniquement)
 */
router.put('/:id', authenticateToken, requireAdminOrOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const banner = await bannerService.updateBanner(parseInt(id), updateData);
    
    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    res.json(banner);
  } catch (error) {
    console.error('Error updating banner:', error);
    res.status(400).json({ 
      error: 'Failed to update banner',
      message: error.message 
    });
  }
});

/**
 * DELETE /banners/:id
 * Supprimer une bannière (Admin/Owner uniquement)
 */
router.delete('/:id', authenticateToken, requireAdminOrOwner, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await bannerService.deleteBanner(parseInt(id));
    
    if (!result) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).json({ 
      error: 'Failed to delete banner',
      message: error.message 
    });
  }
});

// ==================== VARIANT ENDPOINTS ====================

/**
 * GET /banners/:id/variants
 * Récupérer les variantes d'une bannière
 */
router.get('/:id/variants', authenticateToken, requireAdminOrOwner, async (req, res) => {
  try {
    const { id } = req.params;

    const variants = await bannerService.getVariants(parseInt(id));
    
    res.json({ variants });
  } catch (error) {
    console.error('Error fetching variants:', error);
    res.status(500).json({ 
      error: 'Failed to fetch variants',
      message: error.message 
    });
  }
});

/**
 * POST /banners/:id/variants
 * Créer une variante A/B
 */
router.post('/:id/variants', authenticateToken, requireAdminOrOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const variantData = req.body;

    const variant = await bannerService.createVariant(parseInt(id), variantData);
    
    res.status(201).json(variant);
  } catch (error) {
    console.error('Error creating variant:', error);
    res.status(400).json({ 
      error: 'Failed to create variant',
      message: error.message 
    });
  }
});

/**
 * PUT /banners/:id/variants/:variantId
 * Mettre à jour une variante
 */
router.put('/:id/variants/:variantId', authenticateToken, requireAdminOrOwner, async (req, res) => {
  try {
    const { id, variantId } = req.params;
    const updateData = req.body;

    const variant = await bannerService.updateVariant(
      parseInt(id),
      parseInt(variantId),
      updateData
    );
    
    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    res.json(variant);
  } catch (error) {
    console.error('Error updating variant:', error);
    res.status(400).json({ 
      error: 'Failed to update variant',
      message: error.message 
    });
  }
});

/**
 * DELETE /banners/:id/variants/:variantId
 * Supprimer une variante
 */
router.delete('/:id/variants/:variantId', authenticateToken, requireAdminOrOwner, async (req, res) => {
  try {
    const { id, variantId } = req.params;

    const result = await bannerService.deleteVariant(
      parseInt(id),
      parseInt(variantId)
    );
    
    if (!result) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    res.json({ message: 'Variant deleted successfully' });
  } catch (error) {
    console.error('Error deleting variant:', error);
    res.status(500).json({ 
      error: 'Failed to delete variant',
      message: error.message 
    });
  }
});

// ==================== STATISTICS ENDPOINTS ====================

/**
 * GET /banners/:id/stats
 * Récupérer les statistiques d'une bannière
 */
router.get('/:id/stats', authenticateToken, requireAdminOrOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const stats = await bannerService.getBannerStats(parseInt(id), {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
    
    if (!stats) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stats',
      message: error.message 
    });
  }
});

module.exports = router;
