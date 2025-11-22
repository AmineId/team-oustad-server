const express = require('express');
const router = express.Router();
const prisma = require('../utils/prismaClient');
const auth = require('../middleware/auth');
const { generateSubscriptionTypeId } = require('../utils/idGenerator');
const logger = require('../utils/logger');
const apiLimiter = require('../middleware/apiLimiter');

/**
 * GET /subscription-types
 * Liste tous les types d'abonnements disponibles (actifs)
 */
router.get('/', async (req, res) => {
  logger.info(`📋 Liste types abonnement - Filtres: ${JSON.stringify(req.query)}`);

  try {
    const { includeInactive } = req.query;
    logger.debug(`🔍 includeInactive: ${includeInactive}`);
    
    const whereClause = includeInactive === 'true' ? {} : { isActive: true };
    logger.debug(`🔍 Clause WHERE: ${JSON.stringify(whereClause)}`);
    logger.debug(`🔍 Recherche types abonnement...`);
    
    const types = await prisma.subscriptionType.findMany({
      where: whereClause,
      orderBy: { monthlyPrice: 'asc' }
    });
    
    logger.info(`✅ ${types.length} type(s) trouvé(s)`);
    if (types.length > 0) {
      logger.debug(`📊 Types: ${types.map(t => `${t.name} (${t.monthlyPrice}€/mois, ${t.isActive ? 'actif' : 'inactif'})`).join(', ')}`);
    }
    
    logger.debug(`📤 Réponse liste types: ${types.length} résultat(s)`);
    res.json(types);
  } catch (error) {
    logger.error('💥 Erreur récupération types:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /subscription-types/:id
 * Obtenir les détails d'un type d'abonnement
 */
router.get('/:id', async (req, res) => {
  logger.info(`🔍 Détails type abonnement - ID: ${req.params.id}`);

  try {
    const typeId = parseInt(req.params.id);
    logger.debug(`🔍 Recherche type ${typeId}...`);
    
    const type = await prisma.subscriptionType.findUnique({
      where: { id: typeId },
      include: {
        _count: {
          select: { Subscription: true }
        }
      }
    });
    
    if (!type) {
      logger.warn(`❌ Type non trouvé: ID ${typeId}`);
      return res.status(404).json({ error: 'Type d\'abonnement non trouvé' });
    }
    
    logger.info(`✅ Type trouvé: ${type.name}`);
    logger.debug(`📊 Prix: ${type.monthlyPrice}€/mois, ${type._count.Subscription} abonnement(s) actif(s)`);
    logger.debug(`📤 Réponse détails type ${typeId}`);
    
    res.json({ type });
  } catch (error) {
    logger.error('💥 Erreur récupération type:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subscription-types
 * Créer un nouveau type d'abonnement (Owner uniquement)
 */
router.post('/', auth, apiLimiter, async (req, res) => {
  try {
    const requester = req.user;
    
    // Seuls les owners peuvent créer des types
    if (requester.role !== 'owner') {
      logger.warn(`⛔ Tentative création type non autorisée par ${requester.sub}`);
      return res.status(403).json({ error: 'Accès réservé aux propriétaires' });
    }
    
    const { name, description, monthlyPrice, features } = req.body;
    
    if (!name || !monthlyPrice) {
      logger.warn('❌ Paramètres manquants pour création type');
      return res.status(400).json({ error: 'name et monthlyPrice sont requis' });
    }
    
    // Vérifier si le nom existe déjà
    const existing = await prisma.subscriptionType.findUnique({
      where: { name }
    });
    
    if (existing) {
      logger.warn(`❌ Type existe déjà: ${name}`);
      return res.status(400).json({ error: 'Un type avec ce nom existe déjà' });
    }
    
    const type = await prisma.subscriptionType.create({
      data: {
        displayId: generateSubscriptionTypeId(),
        name,
        description,
        monthlyPrice: parseFloat(monthlyPrice),
        features: features || [],
        isActive: true
      }
    });
    
    logger.info(`✅ Type d'abonnement créé: ${type.name} (${type.monthlyPrice}€/mois)`);
    
    res.status(201).json({
      message: 'Type d\'abonnement créé avec succès',
      type
    });
  } catch (error) {
    logger.error('Erreur création type:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /subscription-types/:id
 * Mettre à jour un type d'abonnement (Owner uniquement)
 */
router.put('/:id', auth, apiLimiter, async (req, res) => {
  try {
    const requester = req.user;
    
    if (requester.role !== 'owner') {
      logger.warn(`⛔ Tentative modification type non autorisée par ${requester.sub}`);
      return res.status(403).json({ error: 'Accès réservé aux propriétaires' });
    }
    
    const typeId = parseInt(req.params.id);
    const { name, description, monthlyPrice, features, isActive } = req.body;
    
    const existing = await prisma.subscriptionType.findUnique({
      where: { id: typeId }
    });
    
    if (!existing) {
      logger.warn(`❌ Type non trouvé pour modification: ${typeId}`);
      return res.status(404).json({ error: 'Type d\'abonnement non trouvé' });
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (monthlyPrice !== undefined) updateData.monthlyPrice = parseFloat(monthlyPrice);
    if (features !== undefined) updateData.features = features;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const type = await prisma.subscriptionType.update({
      where: { id: typeId },
      data: updateData
    });
    
    logger.info(`✅ Type d'abonnement mis à jour: ${type.name}`);
    
    res.json({
      message: 'Type d\'abonnement mis à jour avec succès',
      type
    });
  } catch (error) {
    logger.error('Erreur mise à jour type:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /subscription-types/:id
 * Désactiver un type d'abonnement (soft delete) (Owner uniquement)
 */
router.delete('/:id', auth, apiLimiter, async (req, res) => {
  try {
    const requester = req.user;
    
    if (requester.role !== 'owner') {
      logger.warn(`⛔ Tentative suppression type non autorisée par ${requester.sub}`);
      return res.status(403).json({ error: 'Accès réservé aux propriétaires' });
    }
    
    const typeId = parseInt(req.params.id);
    
    // Vérifier s'il existe des abonnements actifs avec ce type
    const activeSubscriptionsCount = await prisma.subscription.count({
      where: {
        subscriptionTypeId: typeId,
        status: 'active'
      }
    });
    
    if (activeSubscriptionsCount > 0) {
      logger.warn(`❌ Impossible supprimer type ${typeId}: ${activeSubscriptionsCount} abonnements actifs`);
      return res.status(400).json({
        error: `Impossible de supprimer ce type: ${activeSubscriptionsCount} abonnement(s) actif(s) l'utilisent`,
        activeSubscriptions: activeSubscriptionsCount
      });
    }
    
    // Soft delete: marquer comme inactif
    const type = await prisma.subscriptionType.update({
      where: { id: typeId },
      data: { isActive: false }
    });
    
    logger.info(`✅ Type d'abonnement désactivé: ${type.name}`);
    
    res.json({
      message: 'Type d\'abonnement désactivé avec succès',
      type
    });
  } catch (error) {
    logger.error('Erreur suppression type:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /subscription-types/:id/subscriptions
 * Obtenir tous les abonnements d'un type donné (Owner/Admin)
 */
router.get('/:id/subscriptions', auth, async (req, res) => {
  try {
    const requester = req.user;
    const typeId = parseInt(req.params.id);
    
    if (requester.role === 'member') {
      logger.warn(`⛔ Accès refusé pour membre ${requester.sub} aux abonnements du type ${typeId}`);
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    let whereClause = { subscriptionTypeId: typeId };
    
    // Si admin, filtrer par salle
    if (requester.role === 'admin') {
      whereClause.member = {
        user: {
          gymId: requester.gymId
        }
      };
    }
    
    const subscriptions = await prisma.subscription.findMany({
      where: whereClause,
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
        },
        subscriptionType: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    logger.info(`✅ ${subscriptions.length} abonnements trouvés pour le type ${typeId}`);
    
    res.json({
      count: subscriptions.length,
      subscriptions
    });
  } catch (error) {
    logger.error('Erreur récupération abonnements par type:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
