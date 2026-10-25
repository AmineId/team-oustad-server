const express = require('express');
const { getFullName } = require('../utils/nameUtils');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const auth = require('../middleware/auth');
const { generateGymId } = require('../utils/idGenerator');
const { ownerHasPermission, requireOwnerPermission } = require('../utils/ownerPermissions');
const { gymKey, ShowcaseValidationError, validatePage, readPage, writePage } = require('../utils/showcasePages');

// Utility helpers
function handleError(res, e, status = 400) {
  res.status(status).json({ error: e.message });
}
function notFound(res, entity, id) {
  res.status(404).json({ error: `${entity} with id ${id} not found` });
}

// Middleware pour vérifier que c'est un owner
const requireOwner = async (req, res, next) => {
  logger.debug(`👑 Vérification rôle Owner - User: ${req.user?.email} (${req.user?.type})`);

  if (!req.user) {
    logger.warn('❌ req.user est undefined - Le middleware auth n\'a pas été appliqué');
    return res.status(401).json({ error: 'Authentification requise' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { Owner: true }
    });

    if (!user) {
      logger.warn(`❌ Utilisateur non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Accès réservé aux propriétaires' });
    }

    if (user.role !== 'owner') {
      logger.warn(`🚫 Rôle insuffisant: ${getFullName(user)} est ${user.role}, owner requis`);
      return res.status(403).json({ error: 'Accès réservé aux propriétaires' });
    }

    req.user.ownerProfile = user.Owner;
    logger.debug(`✅ Accès owner autorisé pour ${getFullName(user)}`);
    next();
  } catch (error) {
    logger.error('💥 Erreur middleware requireOwner:', error);
    res.status(500).json({ error: error.message });
  }
};

// Middleware pour vérifier que c'est un admin
const requireAdmin = async (req, res, next) => {
  logger.debug(`👨‍💼 Vérification rôle Admin - User: ${req.user?.email} (${req.user?.type})`);

  if (!req.user) {
    logger.warn('❌ req.user est undefined - Le middleware auth n\'a pas été appliqué');
    return res.status(401).json({ error: 'Authentification requise' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { Admin: true }
    });

    if (!user) {
      logger.warn(`❌ Utilisateur non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    if (user.role !== 'admin') {
      logger.warn(`🚫 Rôle insuffisant: ${getFullName(user)} est ${user.role}, admin requis`);
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    req.user.adminProfile = user.Admin;
    logger.debug(`✅ Accès admin autorisé pour ${getFullName(user)}`);
    next();
  } catch (error) {
    logger.error('💥 Erreur middleware requireAdmin:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create a new gym (only owners)
/**
 * @swagger
 * /gyms:
 *   post:
 *     summary: Create a new gym
 *     description: Create a new gym with location and contact details. Only owners can create gyms.
 *     tags: [Gyms]
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
 *               - address
 *             properties:
 *               name:
 *                 type: string
 *                 description: Gym name
 *                 example: "Fitness Center A"
 *               address:
 *                 type: string
 *                 description: Gym address
 *                 example: "123 Main Street, City, Country"
 *               phone:
 *                 type: string
 *                 description: Contact phone number
 *                 example: "+1234567890"
 *     responses:
 *       201:
 *         description: Gym created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Salle de sport créée avec succès"
 *                 gym:
 *                   $ref: '#/components/schemas/Gym'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Nom et adresse requis"
 *       403:
 *         description: Access denied - not an owner
 *       500:
 *         description: Server error
 */
function generateSlug(name, id) {
  const base = name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base}-${id}`;
}

router.post('/', auth, requireOwnerPermission('canManageGyms'), apiLimiter, async (req, res) => {
  logger.info(`🏢 Création salle de sport - Owner: ${req.user?.email}, Données:`, {
    name: req.body.name,
    address: req.body.address,
    phone: req.body.phone
  });

  try {
    const { name, address, phone } = req.body;

    if (!name || !address) {
      logger.warn(`❌ Création gym échouée - Champs manquants: name=${!!name}, address=${!!address}`);
      return res.status(400).json({ error: 'Nom et adresse requis' });
    }

    logger.debug(`✅ Données validées pour gym: ${name}`);

    const gym = await prisma.gym.create({
      data: {
        displayId: generateGymId(),
        name,
        address,
        phone,
      }
    });

    // Generate slug from name + id after creation
    const slug = generateSlug(name, gym.id);
    const gymWithSlug = await prisma.gym.update({
      where: { id: gym.id },
      data: { slug }
    });

    logger.info(`✅ Gym créé en base: ${gymWithSlug.name} (ID: ${gymWithSlug.id}, slug: ${slug})`);

    const responseData = {
      message: 'Salle de sport créée avec succès',
      gym: gymWithSlug
    };

    logger.debug(`📤 Réponse création gym:`, responseData);
    res.status(201).json(responseData);
  } catch (e) {
    logger.error('💥 Erreur création gym:', e);
    handleError(res, e);
  }
});

// List gyms (filtered by permissions)
/**
 * @swagger
 * /gyms:
 *   get:
 *     summary: List gyms
 *     description: Get a list of gyms filtered by user permissions. Owners see all gyms, admins see their gym, members see their gym.
 *     tags: [Gyms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of gyms
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gyms:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Gym'
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/', auth, async (req, res) => {
  logger.debug(`📋 Liste des gyms - User: ${req.user?.email} (${req.user?.type})`);

  try {
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    let whereClause = {};

    if (requester.role === 'admin') {
      // Admin voit seulement sa salle
      whereClause.id = requester.gymId;
      logger.debug(`👨‍💼 Admin ${getFullName(requester)} voit seulement sa salle: ${requester.gymId}`);
    } else if (requester.role === 'member') {
      // Member voit seulement sa salle
      whereClause.id = requester.gymId;
      logger.debug(`👤 Membre ${getFullName(requester)} voit seulement sa salle: ${requester.gymId}`);
    } else {
      logger.debug(`👑 Owner ${getFullName(requester)} voit toutes les salles`);
    }
    // Owner voit toutes les salles

    const gyms = await prisma.gym.findMany({
      where: whereClause,
      include: {
        User: {
          select: {
            id: true,
            email: true,
            firstName: true,
              lastName: true,
            role: true
          }
        },
        OpeningHour: true,
        _count: {
          select: { User: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    logger.info(`✅ ${gyms.length} gym(s) trouvé(s)`);

    const responseData = { gyms };
    logger.debug(`📤 Réponse liste gyms: ${gyms.length} résultat(s)`);
    res.json(responseData);
  } catch (e) {
    logger.error('💥 Erreur list gyms:', e);
    handleError(res, e, 500);
  }
});

// Get one gym
/**
 * @swagger
 * /gyms/{id}:
 *   get:
 *     summary: Get gym details
 *     description: Get detailed information about a specific gym including opening hours and user counts.
 *     tags: [Gyms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Gym ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Gym details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gym:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Fitness Center A"
 *                     address:
 *                       type: string
 *                       example: "123 Main Street"
 *                     phone:
 *                       type: string
 *                       example: "+1234567890"
 *                     openingHours:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/OpeningHour'
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           email:
 *                             type: string
 *                           fullName:
 *                             type: string
 *                           role:
 *                             type: string
 *                     _count:
 *                       type: object
 *                       properties:
 *                         users:
 *                           type: integer
 *                           example: 25
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Gym not found
 *       500:
 *         description: Server error
 */
router.get('/:id', auth, async (req, res) => {
  logger.debug(`🔍 Détails gym - ID: ${req.params.id}, User: ${req.user?.email} (${req.user?.type})`);

  try {
    const id = Number(req.params.id);
    logger.debug(`🔢 Conversion ID: ${req.params.id} → ${id}`);

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Vérifier les permissions
    let hasAccess = false;
    if (requester.role === 'owner') {
      hasAccess = true;
      logger.debug(`👑 Owner ${getFullName(requester)} accède à gym ${id}`);
    } else if (requester.role === 'admin' || requester.role === 'member') {
      hasAccess = requester.gymId === id;
      logger.debug(`${requester.role === 'admin' ? '👨‍💼' : '👤'} ${requester.role} ${getFullName(requester)} ${hasAccess ? 'accède' : 'refuse accès'} à gym ${id} (sa salle: ${requester.gymId})`);
    }

    if (!hasAccess) {
      logger.warn(`🚫 Accès refusé pour ${getFullName(requester)} (${requester.role}) à gym ${id}`);
      return res.status(403).json({ error: 'Vous n\'avez pas accès à cette salle' });
    }

    logger.debug(`🔍 Recherche gym ${id} en base...`);
    const gym = await prisma.gym.findUnique({
      where: { id },
      include: {
        User: {
          select: {
            id: true,
            email: true,
            firstName: true,
              lastName: true,
            role: true
          }
        },
        OpeningHour: {
          orderBy: { dayOfWeek: 'asc' }
        },
        _count: {
          select: { User: true }
        }
      }
    });

    if (!gym) {
      logger.warn(`❌ Gym non trouvé: ID ${id}`);
      return notFound(res, 'Gym', id);
    }

    logger.info(`✅ Gym trouvé: ${gym.name} (${id}) - ${gym._count.User} utilisateurs, ${gym.OpeningHour.length} horaires`);
    logger.debug(`📤 Réponse détails gym: ${gym.name}`);
    res.json({ gym });
  } catch (e) {
    logger.error('💥 Erreur get gym details:', e);
    handleError(res, e, 500);
  }
});

// Update gym
/**
 * @swagger
 * /gyms/{id}:
 *   put:
 *     summary: Update gym
 *     description: Update gym information. Owners can update any gym, admins can only update their gym.
 *     tags: [Gyms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Gym ID to update
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: New gym name
 *                 example: "Updated Fitness Center"
 *               address:
 *                 type: string
 *                 description: New address
 *                 example: "456 New Street, City, Country"
 *               phone:
 *                 type: string
 *                 description: New contact phone
 *                 example: "+1987654321"
 *     responses:
 *       200:
 *         description: Gym updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Salle de sport mise à jour avec succès"
 *                 gym:
 *                   $ref: '#/components/schemas/Gym'
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Gym not found
 *       500:
 *         description: Server error
 */
router.put('/:id', auth, apiLimiter, async (req, res) => {
  logger.info(`✏️ Mise à jour gym - ID: ${req.params.id}, User: ${req.user?.email} (${req.user?.type})`);
  logger.debug(`📝 Données reçues:`, {
    name: req.body.name,
    address: req.body.address,
    phone: req.body.phone
  });

  try {
    const id = Number(req.params.id);
    const { name, address, phone, isPublished, slug, description } = req.body;

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Vérifier les permissions
    let canUpdate = false;
    if (requester.role === 'owner') {
      canUpdate = await ownerHasPermission(requester, 'canManageGyms');
      logger.debug(`👑 Owner ${getFullName(requester)} peut modifier gym ${id} : ${canUpdate}`);
    } else if (requester.role === 'admin') {
      canUpdate = requester.gymId === id;
      logger.debug(`👨‍💼 Admin ${getFullName(requester)} ${canUpdate ? 'peut modifier' : 'ne peut pas modifier'} gym ${id} (sa salle: ${requester.gymId})`);
    }

    if (!canUpdate) {
      logger.warn(`🚫 Permissions insuffisantes pour ${getFullName(requester)} (${requester.role})`);
      return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour modifier cette salle' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (isPublished !== undefined) updateData.isPublished = Boolean(isPublished);
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        return res.status(400).json({ error: 'description doit être une chaîne' });
      }
      if (description && description.length > 5000) {
        return res.status(400).json({ error: 'description trop longue (5000 caractères max)' });
      }
      updateData.description = description || null;
    }

    logger.debug(`🔄 Mise à jour gym ${id} avec:`, updateData);

    const gym = await prisma.gym.update({
      where: { id },
      data: updateData,
      include: {
        OpeningHour: true,
        _count: { select: { User: true } }
      }
    });

    logger.info(`✅ Gym mis à jour: ${gym.name} (${id})`);
    logger.debug(`📤 Réponse mise à jour gym: ${gym.name}`);
    res.json({
      message: 'Salle de sport mise à jour avec succès',
      gym
    });
  } catch (e) {
    if (e.code === 'P2025') {
      logger.warn(`❌ Gym non trouvé pour mise à jour: ID ${req.params.id}`);
      return notFound(res, 'Gym', req.params.id);
    }
    logger.error('💥 Erreur update gym:', e);
    handleError(res, e);
  }
});

// Delete gym (only owners)
/**
 * @swagger
 * /gyms/{id}:
 *   delete:
 *     summary: Delete gym
 *     description: Delete a gym and all associated data. Only owners can delete gyms.
 *     tags: [Gyms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Gym ID to delete
 *         example: 1
 *     responses:
 *       200:
 *         description: Gym deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Salle de sport supprimée avec succès"
 *                 deletedId:
 *                   type: integer
 *                   example: 1
 *       403:
 *         description: Insufficient permissions - only owners can delete gyms
 *       404:
 *         description: Gym not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', auth, requireOwnerPermission('canManageGyms'), apiLimiter, async (req, res) => {
  logger.info(`🗑️ Suppression gym - ID: ${req.params.id}, Owner: ${req.user?.email}`);

  try {
    const id = Number(req.params.id);
    logger.debug(`🔢 Conversion ID: ${req.params.id} → ${id}`);

    logger.debug(`🔍 Vérification existence gym ${id}...`);
    const gym = await prisma.gym.findUnique({ where: { id } });
    if (!gym) {
      logger.warn(`❌ Gym non trouvé: ID ${id}`);
      return notFound(res, 'Gym', id);
    }

    logger.debug(`✅ Gym trouvé: ${gym.name} (${id}) - prêt pour suppression`);

    // Vérifier si le gym a des admins ou membres
    const gymUsersCount = await prisma.user.count({
      where: { 
        gymId: id,
        role: { in: ['admin', 'member'] }
      }
    });

    if (gymUsersCount > 0) {
      logger.warn(`❌ Impossible de supprimer le gym ${gym.name}: ${gymUsersCount} utilisateurs affectés`);
      return res.status(400).json({ 
        error: `Impossible de supprimer cette salle: ${gymUsersCount} utilisateur(s) y sont affectés. Veuillez d'abord réaffecter ou supprimer les utilisateurs.`,
        usersCount: gymUsersCount
      });
    }

    // Supprimer les banners du gym
    logger.info(`🗑️ Suppression des banners du gym ${gym.name}...`);
    const banners = await prisma.banner.findMany({
      where: { gymId: id },
      include: { BannerVariant: true }
    });
    
    for (const banner of banners) {
      // Supprimer les variants d'abord
      await prisma.bannerVariant.deleteMany({ where: { bannerId: banner.id } });
      // Supprimer le banner
      await prisma.banner.delete({ where: { id: banner.id } });
    }

    // Supprimer les check-ins du gym
    logger.info(`🗑️ Suppression des check-ins du gym ${gym.name}...`);
    await prisma.gymCheckIn.deleteMany({ where: { gymId: id } });

    // Supprimer les produits store du gym
    logger.info(`🗑️ Suppression des produits store du gym ${gym.name}...`);
    const storeProducts = await prisma.storeProduct.findMany({ where: { gymId: id } });
    for (const product of storeProducts) {
      await prisma.storeReservation.deleteMany({ where: { productId: product.id } });
      await prisma.storeProduct.delete({ where: { id: product.id } });
    }

    // Supprimer la salle (les heures d'ouverture seront supprimées automatiquement grâce à onDelete: Cascade)
    logger.info(`🗑️ Suppression gym ${gym.name} (${id})...`);
    await prisma.gym.delete({ where: { id } });

    logger.info(`✅ Gym supprimé avec succès: ${gym.name} (${id})`);
    logger.debug(`📤 Réponse suppression gym: ID ${id}`);
    res.json({
      message: 'Salle de sport supprimée avec succès',
      deletedId: id
    });
  } catch (e) {
    if (e.code === 'P2025') {
      logger.warn(`❌ Gym non trouvé pour suppression: ID ${req.params.id}`);
      return notFound(res, 'Gym', req.params.id);
    }
    logger.error('💥 Erreur delete gym:', e);
    handleError(res, e);
  }
});

// Routes pour les heures d'ouverture

// Créer/Mettre à jour les heures d'ouverture pour une salle
/**
 * @swagger
 * /gyms/{id}/opening-hours:
 *   post:
 *     summary: Set opening hours for gym
 *     description: Create or update opening hours for each day of the week. Owners can set hours for any gym, admins only for their gym.
 *     tags: [Gyms, Opening Hours]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Gym ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Array of opening hours for each day
 *             example: [
 *               { "dayOfWeek": 1, "openTime": "09:00", "closeTime": "18:00", "isClosed": false },
 *               { "dayOfWeek": 2, "openTime": "09:00", "closeTime": "18:00", "isClosed": false },
 *               { "dayOfWeek": 0, "isClosed": true }
 *             ]
 *     responses:
 *       200:
 *         description: Opening hours updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Horaires d'ouverture mis à jour avec succès"
 *                 openingHours:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OpeningHour'
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Gym not found
 *       500:
 *         description: Server error
 */
router.post('/:id/opening-hours', auth, apiLimiter, async (req, res) => {
  logger.info(`🕐 Mise à jour horaires - Gym ID: ${req.params.id}, User: ${req.user?.email} (${req.user?.type})`);
  logger.debug(`📝 Données horaires reçues:`, req.body);

  try {
    const id = Number(req.params.id);
    const openingHoursData = req.body; // Array of opening hours

    if (!Array.isArray(openingHoursData)) {
      logger.warn(`❌ Données invalides - attendu tableau, reçu: ${typeof openingHoursData}`);
      return res.status(400).json({ error: 'Les données doivent être un tableau d\'horaires d\'ouverture' });
    }

    logger.debug(`✅ ${openingHoursData.length} horaires reçus pour gym ${id}`);

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Vérifier les permissions
    let canUpdate = false;
    if (requester.role === 'owner') {
      canUpdate = await ownerHasPermission(requester, 'canManageGyms');
      logger.debug(`👑 Owner ${getFullName(requester)} peut modifier horaires gym ${id} : ${canUpdate}`);
    } else if (requester.role === 'admin') {
      canUpdate = requester.gymId === id;
      logger.debug(`👨‍💼 Admin ${getFullName(requester)} ${canUpdate ? 'peut modifier' : 'ne peut pas modifier'} horaires gym ${id} (sa salle: ${requester.gymId})`);
    }

    if (!canUpdate) {
      logger.warn(`🚫 Permissions insuffisantes pour ${getFullName(requester)} (${requester.role})`);
      return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour modifier les horaires de cette salle' });
    }

    logger.debug(`🔍 Vérification existence gym ${id}...`);
    const gym = await prisma.gym.findUnique({ where: { id } });
    if (!gym) {
      logger.warn(`❌ Gym non trouvé: ID ${id}`);
      return notFound(res, 'Gym', id);
    }

    // Supprimer les anciens horaires
    logger.debug(`🗑️ Suppression anciens horaires pour gym ${gym.name}...`);
    await prisma.openingHour.deleteMany({ where: { gymId: id } });

    // Créer les nouveaux horaires
    logger.debug(`➕ Création nouveaux horaires...`);
    const openingHours = [];
    for (const hourData of openingHoursData) {
      const { dayOfWeek, openTime, closeTime, isClosed = false } = hourData;

      if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) {
        logger.warn(`⚠️ Jour invalide ignoré: ${dayOfWeek}`);
        continue; // Skip invalid days
      }

      const hour = await prisma.openingHour.create({
        data: {
          gymId: id,
          dayOfWeek,
          openTime: isClosed ? '00:00' : (openTime || '09:00'),
          closeTime: isClosed ? '00:00' : (closeTime || '18:00'),
          isClosed
        }
      });
      openingHours.push(hour);
      logger.debug(`✅ Horaire créé: Jour ${dayOfWeek} - ${isClosed ? 'Fermé' : `${hour.openTime}-${hour.closeTime}`}`);
    }

    logger.info(`✅ ${openingHours.length} horaires créés pour gym ${gym.name}`);
    logger.debug(`📤 Réponse mise à jour horaires: ${openingHours.length} horaires`);
    res.json({
      message: 'Horaires d\'ouverture mis à jour avec succès',
      openingHours
    });
  } catch (e) {
    logger.error('💥 Erreur update opening hours:', e);
    handleError(res, e, 500);
  }
});

// Récupérer les heures d'ouverture d'une salle
/**
 * @swagger
 * /gyms/{id}/opening-hours:
 *   get:
 *     summary: Get opening hours for gym
 *     description: Get the opening hours for a specific gym.
 *     tags: [Gyms, Opening Hours]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Gym ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Opening hours retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 openingHours:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OpeningHour'
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Gym not found
 *       500:
 *         description: Server error
 */
router.get('/:id/opening-hours', auth, async (req, res) => {
  logger.debug(`🕐 Récupération horaires - Gym ID: ${req.params.id}, User: ${req.user?.email} (${req.user?.type})`);

  try {
    const id = Number(req.params.id);

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Vérifier les permissions
    let hasAccess = false;
    if (requester.role === 'owner') {
      hasAccess = true;
      logger.debug(`👑 Owner ${getFullName(requester)} accède aux horaires gym ${id}`);
    } else if (requester.role === 'admin' || requester.role === 'member') {
      hasAccess = requester.gymId === id;
      logger.debug(`${requester.role === 'admin' ? '👨‍💼' : '👤'} ${requester.role} ${getFullName(requester)} ${hasAccess ? 'accède' : 'refuse accès'} aux horaires gym ${id} (sa salle: ${requester.gymId})`);
    }

    if (!hasAccess) {
      logger.warn(`🚫 Accès refusé aux horaires pour ${getFullName(requester)} (${requester.role})`);
      return res.status(403).json({ error: 'Vous n\'avez pas accès aux horaires de cette salle' });
    }

    logger.debug(`🔍 Recherche horaires pour gym ${id}...`);
    const openingHours = await prisma.openingHour.findMany({
      where: { gymId: id },
      orderBy: { dayOfWeek: 'asc' }
    });

    logger.info(`✅ ${openingHours.length} horaires trouvés pour gym ${id}`);
    logger.debug(`📤 Réponse horaires: ${openingHours.length} résultat(s)`);
    res.json({ openingHours });
  } catch (e) {
    logger.error('💥 Erreur get opening hours:', e);
    handleError(res, e, 500);
  }
});

// Upload gym image
/**
 * @swagger
 * /gyms/{id}/image:
 *   put:
 *     summary: Upload gym image
 *     description: Upload or update an image for a gym. Owners can update any gym image, admins can only update their gym's image.
 *     tags: [Gyms, Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Gym ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageData
 *             properties:
 *               imageData:
 *                 type: string
 *                 description: Base64 encoded image data
 *                 example: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
 *     responses:
 *       200:
 *         description: Gym image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Image de salle mise à jour avec succès"
 *       400:
 *         description: Invalid image data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Données d'image invalides"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Vous n'avez pas les permissions pour modifier l'image de cette salle"
 *       404:
 *         description: Gym not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Gym with id 1 not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.put('/:id/image', auth, apiLimiter, async (req, res) => {
  logger.info(`🏢 Upload image salle - Gym ID: ${req.params.id}, Requester: ${req.user?.email}`);

  try {
    const id = Number(req.params.id);
    const { imageData } = req.body;

    if (!imageData) {
      logger.warn(`❌ Données image manquantes pour gym ${id}`);
      return res.status(400).json({ error: 'Données d\'image requises' });
    }

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetGym = await prisma.gym.findUnique({ where: { id } });
    if (!targetGym) {
      logger.warn(`❌ Salle non trouvée: ID ${id}`);
      return notFound(res, 'Gym', id);
    }

    let canUpdate = false;
    if (requester.role === 'owner') {
      canUpdate = await ownerHasPermission(requester, 'canManageGyms');
      logger.debug(`👑 Owner ${getFullName(requester)} peut modifier image salle ${id} : ${canUpdate}`);
    } else if (requester.role === 'admin') {
      canUpdate = targetGym.id === requester.gymId;
      logger.debug(`👨‍💼 Admin ${getFullName(requester)} ${canUpdate ? 'peut modifier' : 'ne peut pas modifier'} image salle ${id} (sa salle: ${requester.gymId})`);
    } else if (requester.role === 'member') {
      canUpdate = false;
      logger.debug(`👤 Membre ${getFullName(requester)} ne peut pas modifier image salle`);
    }

    if (!canUpdate) {
      logger.warn(`🚫 Permissions insuffisantes pour ${getFullName(requester)}`);
      return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour modifier l\'image de cette salle' });
    }

    // Traiter les données d'image (base64)
    let imageBuffer;
    try {
      if (imageData.startsWith('data:image/')) {
        // Extraire les données base64
        const base64Data = imageData.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        // Supposer que c'est déjà du base64 pur
        imageBuffer = Buffer.from(imageData, 'base64');
      }
      logger.debug(`✅ Image décodée: ${imageBuffer.length} bytes`);
    } catch (error) {
      logger.warn(`❌ Erreur décodage image: ${error.message}`);
      return res.status(400).json({ error: 'Données d\'image invalides' });
    }

    // Mettre à jour l'image de la salle
    await prisma.gym.update({
      where: { id },
      data: { image: imageBuffer }
    });

    logger.info(`✅ Image de salle mise à jour pour ${targetGym.name}`);
    logger.debug(`📤 Réponse upload image salle: succès`);
    res.json({ message: 'Image de salle mise à jour avec succès' });

  } catch (e) {
    logger.error('💥 Erreur upload image salle:', e);
    handleError(res, e, 500);
  }
});

// Get gym image
/**
 * @swagger
 * /gyms/{id}/image:
 *   get:
 *     summary: Get gym image
 *     description: Retrieve the image for a gym. Users can view images of gyms they have access to.
 *     tags: [Gyms, Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Gym ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Gym image (binary data or generated placeholder)
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *             description: Returns the uploaded gym image, or a generated SVG placeholder with gym name initials if no image is uploaded
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Vous n'avez pas accès à l'image de cette salle"
 *       404:
 *         description: Gym not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Gym with id 1 not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.get('/:id/image', auth, async (req, res) => {
  logger.debug(`🏢 Récupération image salle - Gym ID: ${req.params.id}, Requester: ${req.user?.email}`);

  try {
    const id = Number(req.params.id);

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetGym = await prisma.gym.findUnique({
      where: { id },
      select: { id: true, name: true, image: true }
    });

    if (!targetGym) {
      logger.warn(`❌ Salle non trouvée: ID ${id}`);
      return notFound(res, 'Gym', id);
    }

    let hasAccess = false;
    if (requester.role === 'owner') {
      hasAccess = true;
      logger.debug(`👑 Owner ${getFullName(requester)} accède à image salle ${id}`);
    } else if (requester.role === 'admin' || requester.role === 'member') {
      hasAccess = targetGym.id === requester.gymId;
      logger.debug(`${requester.role === 'admin' ? '👨‍💼' : '👤'} ${requester.role} ${getFullName(requester)} ${hasAccess ? 'accède' : 'refuse accès'} à image salle ${id} (sa salle: ${requester.gymId})`);
    }

    if (!hasAccess) {
      logger.warn(`🚫 Accès refusé à image salle pour ${getFullName(requester)}`);
      return res.status(403).json({ error: 'Vous n\'avez pas accès à l\'image de cette salle' });
    }

    if (!targetGym.image) {
      logger.debug(`❌ Image de salle non trouvée pour ${targetGym.name} - génération image par défaut`);

      // Générer une image par défaut avec les initiales du nom de la salle
      const initials = targetGym.name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');

      const svgImage = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="300" fill="#10b981"/>
        <text x="200" y="165" font-family="Arial, sans-serif" font-size="120" font-weight="bold" text-anchor="middle" fill="white">${initials}</text>
      </svg>`;

      const svgBuffer = Buffer.from(svgImage, 'utf8');

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Length', svgBuffer.length);
      res.setHeader('Cache-Control', 'private, max-age=3600');

      logger.debug(`📤 Image par défaut générée pour ${targetGym.name}: ${initials}`);
      return res.send(svgBuffer);
    }

    logger.debug(`✅ Image de salle récupérée pour ${targetGym.name} (${targetGym.image.length} bytes)`);

    // Déterminer le type MIME (par défaut JPEG si on ne peut pas le déterminer)
    let mimeType = 'image/jpeg';
    if (targetGym.image.length > 4) {
      const firstBytes = targetGym.image.subarray(0, 4);
      if (firstBytes[0] === 0xFF && firstBytes[1] === 0xD8) {
        mimeType = 'image/jpeg';
      } else if (firstBytes[0] === 0x89 && firstBytes[1] === 0x50) {
        mimeType = 'image/png';
      } else if (firstBytes[0] === 0x47 && firstBytes[1] === 0x49) {
        mimeType = 'image/gif';
      }
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', targetGym.image.length);
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache 1 heure

    logger.debug(`📤 Réponse image salle: ${mimeType}, ${targetGym.image.length} bytes`);
    res.send(targetGym.image);

  } catch (e) {
    logger.error('💥 Erreur récupération image salle:', e);
    handleError(res, e, 500);
  }
});

// Delete gym image
/**
 * @swagger
 * /gyms/{id}/image:
 *   delete:
 *     summary: Delete gym image
 *     description: Delete the image for a gym. Owners can delete any gym image, admins can only delete their gym's image.
 *     tags: [Gyms, Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Gym ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Gym image deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Image de salle supprimée avec succès"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Vous n'avez pas les permissions pour supprimer l'image de cette salle"
 *       404:
 *         description: Gym not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Gym with id 1 not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.delete('/:id/image', auth, apiLimiter, async (req, res) => {
  logger.info(`🗑️ Suppression image salle - Gym ID: ${req.params.id}, Requester: ${req.user?.email}`);

  try {
    const id = Number(req.params.id);

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetGym = await prisma.gym.findUnique({
      where: { id },
      select: { id: true, name: true, image: true }
    });

    if (!targetGym) {
      logger.warn(`❌ Salle non trouvée: ID ${id}`);
      return notFound(res, 'Gym', id);
    }

    let canDelete = false;
    if (requester.role === 'owner') {
      canDelete = await ownerHasPermission(requester, 'canManageGyms');
      logger.debug(`👑 Owner ${getFullName(requester)} peut supprimer image salle ${id} : ${canDelete}`);
    } else if (requester.role === 'admin') {
      canDelete = targetGym.id === requester.gymId;
      logger.debug(`👨‍💼 Admin ${getFullName(requester)} ${canDelete ? 'peut supprimer' : 'ne peut pas supprimer'} image salle ${id} (sa salle: ${requester.gymId})`);
    } else if (requester.role === 'member') {
      canDelete = false;
      logger.debug(`👤 Membre ${getFullName(requester)} ne peut pas supprimer image salle`);
    }

    if (!canDelete) {
      logger.warn(`🚫 Permissions insuffisantes pour ${getFullName(requester)}`);
      return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour supprimer l\'image de cette salle' });
    }

    // Supprimer l'image de la salle (mettre à null)
    await prisma.gym.update({
      where: { id },
      data: { image: null }
    });

    logger.info(`✅ Image de salle supprimée pour ${targetGym.name}`);
    logger.debug(`📤 Réponse suppression image salle: succès`);
    res.json({ message: 'Image de salle supprimée avec succès' });

  } catch (e) {
    logger.error('💥 Erreur suppression image salle:', e);
    handleError(res, e, 500);
  }
});

// ── Gallery photo routes ──────────────────────────────────────────────────────

async function canManageGym(requester, gymId) {
  if (requester.role === 'owner') return ownerHasPermission(requester, 'canManageGyms');
  if (requester.role === 'admin') return requester.gymId === gymId;
  return false;
}

// POST /gyms/:id/photos
router.post('/:id/photos', auth, apiLimiter, async (req, res) => {
  try {
    const gymId = Number(req.params.id);
    const { imageData } = req.body;

    if (!imageData) return res.status(400).json({ error: 'imageData requis' });

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester || !await canManageGym(requester, gymId)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }

    const gym = await prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) return notFound(res, 'Gym', gymId);

    const maxPos = await prisma.gymPhoto.aggregate({
      where: { gymId },
      _max: { position: true }
    });
    const position = (maxPos._max.position ?? -1) + 1;

    const photo = await prisma.gymPhoto.create({
      data: { gymId, imageData, position }
    });

    res.status(201).json({ photo: { id: photo.id, position: photo.position, isCover: photo.isCover } });
  } catch (e) {
    logger.error('💥 Erreur création photo gym:', e);
    handleError(res, e);
  }
});

// GET /gyms/:id/photos
router.get('/:id/photos', auth, async (req, res) => {
  try {
    const gymId = Number(req.params.id);

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester || !await canManageGym(requester, gymId)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }

    const gym = await prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) return notFound(res, 'Gym', gymId);

    const photos = await prisma.gymPhoto.findMany({
      where: { gymId },
      orderBy: { position: 'asc' },
      select: { id: true, position: true, isCover: true }
    });

    res.json({ photos });
  } catch (e) {
    handleError(res, e, 500);
  }
});

// GET /gyms/:id/photos/:photoId/image
router.get('/:id/photos/:photoId/image', auth, async (req, res) => {
  try {
    const gymId = Number(req.params.id);
    const photoId = Number(req.params.photoId);

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester || !await canManageGym(requester, gymId)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }

    const photo = await prisma.gymPhoto.findFirst({
      where: { id: photoId, gymId }
    });
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    const base64 = photo.imageData.includes(',') ? photo.imageData.split(',')[1] : photo.imageData;
    const buf = Buffer.from(base64, 'base64');

    let mimeType = 'image/jpeg';
    if (buf.length > 4) {
      if (buf[0] === 0x89 && buf[1] === 0x50) mimeType = 'image/png';
      else if (buf[0] === 0x47 && buf[1] === 0x49) mimeType = 'image/gif';
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buf);
  } catch (e) {
    handleError(res, e, 500);
  }
});

// DELETE /gyms/:id/photos/:photoId
router.delete('/:id/photos/:photoId', auth, apiLimiter, async (req, res) => {
  try {
    const gymId = Number(req.params.id);
    const photoId = Number(req.params.photoId);

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester || !await canManageGym(requester, gymId)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }

    const photo = await prisma.gymPhoto.findFirst({ where: { id: photoId, gymId } });
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    await prisma.gymPhoto.delete({ where: { id: photoId } });
    res.json({ message: 'Photo supprimée avec succès' });
  } catch (e) {
    handleError(res, e, 500);
  }
});

// PUT /gyms/:id/photos/reorder
router.put('/:id/photos/reorder', auth, apiLimiter, async (req, res) => {
  try {
    const gymId = Number(req.params.id);
    const { order } = req.body;

    if (!Array.isArray(order)) return res.status(400).json({ error: 'order doit être un tableau d\'ids' });

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester || !await canManageGym(requester, gymId)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }

    await prisma.$transaction(
      order.map((photoId, index) =>
        prisma.gymPhoto.updateMany({
          where: { id: photoId, gymId },
          data: { position: index }
        })
      )
    );

    res.json({ message: 'Ordre mis à jour' });
  } catch (e) {
    handleError(res, e, 500);
  }
});

// PUT /gyms/:id/photos/:photoId/cover
router.put('/:id/photos/:photoId/cover', auth, apiLimiter, async (req, res) => {
  try {
    const gymId = Number(req.params.id);
    const photoId = Number(req.params.photoId);

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester || !await canManageGym(requester, gymId)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }

    const photo = await prisma.gymPhoto.findFirst({ where: { id: photoId, gymId } });
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    await prisma.$transaction([
      prisma.gymPhoto.updateMany({ where: { gymId }, data: { isCover: false } }),
      prisma.gymPhoto.update({ where: { id: photoId }, data: { isCover: true } })
    ]);

    res.json({ message: 'Photo de couverture mise à jour' });
  } catch (e) {
    handleError(res, e, 500);
  }
});

// ── Contenu CMS de la page vitrine ───────────────────────────────────────────

// GET /gyms/:id/showcase — page { sections } de la fiche salle, {} si vide
router.get('/:id/showcase', auth, async (req, res) => {
  try {
    const gymId = Number(req.params.id);
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester || !await canManageGym(requester, gymId)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }
    const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { id: true } });
    if (!gym) return notFound(res, 'Gym', gymId);
    res.json(await readPage(gymKey(gymId)));
  } catch (e) {
    logger.error('💥 Erreur GET showcase gym:', e);
    handleError(res, e, 500);
  }
});

// PUT /gyms/:id/showcase — remplace la page entière
router.put('/:id/showcase', auth, apiLimiter, async (req, res) => {
  try {
    const gymId = Number(req.params.id);
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester || !await canManageGym(requester, gymId)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }
    const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { id: true } });
    if (!gym) return notFound(res, 'Gym', gymId);
    const page = validatePage(req.body, { allowHero: false });
    await writePage(gymKey(gymId), page, { gymId, userId: requester.id });
    res.json(page);
  } catch (e) {
    if (e instanceof ShowcaseValidationError) return res.status(400).json({ error: e.message });
    logger.error('💥 Erreur PUT showcase gym:', e);
    handleError(res, e, 500);
  }
});

module.exports = router;