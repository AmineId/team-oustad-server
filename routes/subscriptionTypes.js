const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const auth = require('../middleware/auth');
const { generateSubscriptionTypeId } = require('../utils/idGenerator');

/**
 * GET /subscription-types
 * Liste tous les types d'abonnements disponibles (actifs)
 */
router.get('/', async (req, res) => {
  console.log(`📋 Liste types abonnement - Filtres:`, req.query);

  try {
    const { includeInactive } = req.query;
    console.log(`🔍 includeInactive: ${includeInactive}`);
    
    const whereClause = includeInactive === 'true' ? {} : { isActive: true };
    console.log(`🔍 Clause WHERE:`, whereClause);
    console.log(`🔍 Recherche types abonnement...`);
    
    const types = await prisma.subscriptionType.findMany({
      where: whereClause,
      orderBy: { monthlyPrice: 'asc' }
    });
    
    console.log(`✅ ${types.length} type(s) trouvé(s)`);
    if (types.length > 0) {
      console.log(`📊 Types:`, types.map(t => `${t.name} (${t.monthlyPrice}€/mois, ${t.isActive ? 'actif' : 'inactif'})`));
    }
    
    console.log(`📤 Réponse liste types: ${types.length} résultat(s)`);
    console.log(types);
    res.json(types);
  } catch (error) {
    console.error('💥 Erreur récupération types:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /subscription-types/:id
 * Obtenir les détails d'un type d'abonnement
 */
router.get('/:id', async (req, res) => {
  console.log(`🔍 Détails type abonnement - ID: ${req.params.id}`);

  try {
    const typeId = parseInt(req.params.id);
    console.log(`🔍 Recherche type ${typeId}...`);
    
    const type = await prisma.subscriptionType.findUnique({
      where: { id: typeId },
      include: {
        _count: {
          select: { Subscription: true }
        }
      }
    });
    
    if (!type) {
      console.log(`❌ Type non trouvé: ID ${typeId}`);
      return res.status(404).json({ error: 'Type d\'abonnement non trouvé' });
    }
    
    console.log(`✅ Type trouvé: ${type.name}`);
    console.log(`📊 Prix: ${type.monthlyPrice}€/mois, ${type._count.Subscription} abonnement(s) actif(s)`);
    console.log(`📤 Réponse détails type ${typeId}`);
    
    res.json({ type });
  } catch (error) {
    console.error('💥 Erreur récupération type:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /subscription-types
 * Créer un nouveau type d'abonnement (Owner uniquement)
 */
router.post('/', auth, async (req, res) => {
  try {
    const requester = req.user;
    
    // Seuls les owners peuvent créer des types
    if (requester.role !== 'owner') {
      return res.status(403).json({ error: 'Accès réservé aux propriétaires' });
    }
    
    const { name, description, monthlyPrice, features } = req.body;
    
    if (!name || !monthlyPrice) {
      return res.status(400).json({ error: 'name et monthlyPrice sont requis' });
    }
    
    // Vérifier si le nom existe déjà
    const existing = await prisma.subscriptionType.findUnique({
      where: { name }
    });
    
    if (existing) {
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
    
    console.log(`✅ Type d'abonnement créé: ${type.name} (${type.monthlyPrice}€/mois)`);
    
    res.status(201).json({
      message: 'Type d\'abonnement créé avec succès',
      type
    });
  } catch (error) {
    console.error('Erreur création type:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /subscription-types/:id
 * Mettre à jour un type d'abonnement (Owner uniquement)
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const requester = req.user;
    
    if (requester.role !== 'owner') {
      return res.status(403).json({ error: 'Accès réservé aux propriétaires' });
    }
    
    const typeId = parseInt(req.params.id);
    const { name, description, monthlyPrice, features, isActive } = req.body;
    
    const existing = await prisma.subscriptionType.findUnique({
      where: { id: typeId }
    });
    
    if (!existing) {
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
    
    console.log(`✅ Type d'abonnement mis à jour: ${type.name}`);
    
    res.json({
      message: 'Type d\'abonnement mis à jour avec succès',
      type
    });
  } catch (error) {
    console.error('Erreur mise à jour type:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /subscription-types/:id
 * Désactiver un type d'abonnement (soft delete) (Owner uniquement)
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const requester = req.user;
    
    if (requester.role !== 'owner') {
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
    
    console.log(`✅ Type d'abonnement désactivé: ${type.name}`);
    
    res.json({
      message: 'Type d\'abonnement désactivé avec succès',
      type
    });
  } catch (error) {
    console.error('Erreur suppression type:', error);
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
                fullName: true,
                email: true
              }
            }
          }
        },
        subscriptionType: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({
      count: subscriptions.length,
      subscriptions
    });
  } catch (error) {
    console.error('Erreur récupération abonnements par type:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
