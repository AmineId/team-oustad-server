const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();
const auth = require('../middleware/auth');
const { generateGymId } = require('../utils/idGenerator');

// Utility helpers
function handleError(res, e, status = 400) {
  res.status(status).json({ error: e.message });
}
function notFound(res, entity, id) {
  res.status(404).json({ error: `${entity} with id ${id} not found` });
}

// Middleware pour vérifier que c'est un owner
const requireOwner = async (req, res, next) => {
  console.log(`👑 Vérification rôle Owner - User: ${req.user?.email} (${req.user?.type})`);

  if (!req.user) {
    console.log('❌ req.user est undefined - Le middleware auth n\'a pas été appliqué');
    return res.status(401).json({ error: 'Authentification requise' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { owner: true }
    });

    if (!user) {
      console.log(`❌ Utilisateur non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Accès réservé aux propriétaires' });
    }

    if (user.role !== 'owner') {
      console.log(`🚫 Rôle insuffisant: ${user.fullName} est ${user.role}, owner requis`);
      return res.status(403).json({ error: 'Accès réservé aux propriétaires' });
    }

    req.user.ownerProfile = user.owner;
    console.log(`✅ Accès owner autorisé pour ${user.fullName}`);
    next();
  } catch (error) {
    console.error('💥 Erreur middleware requireOwner:', error);
    res.status(500).json({ error: error.message });
  }
};

// Middleware pour vérifier que c'est un admin
const requireAdmin = async (req, res, next) => {
  console.log(`👨‍💼 Vérification rôle Admin - User: ${req.user?.email} (${req.user?.type})`);

  if (!req.user) {
    console.log('❌ req.user est undefined - Le middleware auth n\'a pas été appliqué');
    return res.status(401).json({ error: 'Authentification requise' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { admin: true }
    });

    if (!user) {
      console.log(`❌ Utilisateur non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    if (user.role !== 'admin') {
      console.log(`🚫 Rôle insuffisant: ${user.fullName} est ${user.role}, admin requis`);
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    req.user.adminProfile = user.admin;
    console.log(`✅ Accès admin autorisé pour ${user.fullName}`);
    next();
  } catch (error) {
    console.error('💥 Erreur middleware requireAdmin:', error);
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
router.post('/', auth, requireOwner, async (req, res) => {
  console.log(`🏢 Création salle de sport - Owner: ${req.user?.email}, Données:`, {
    name: req.body.name,
    address: req.body.address,
    phone: req.body.phone
  });

  try {
    const { name, address, phone } = req.body;

    if (!name || !address) {
      console.log(`❌ Création gym échouée - Champs manquants: name=${!!name}, address=${!!address}`);
      return res.status(400).json({ error: 'Nom et adresse requis' });
    }

    console.log(`✅ Données validées pour gym: ${name}`);

    const gym = await prisma.gym.create({
      data: {
        displayId: generateGymId(),
        name,
        address,
        phone
      }
    });

    console.log(`✅ Gym créé en base: ${gym.name} (ID: ${gym.id})`);

    const responseData = {
      message: 'Salle de sport créée avec succès',
      gym
    };

    console.log(`📤 Réponse création gym:`, responseData);
    res.status(201).json(responseData);
  } catch (e) {
    console.error('💥 Erreur création gym:', e);
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
  console.log(`📋 Liste des gyms - User: ${req.user?.email} (${req.user?.type})`);

  try {
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    let whereClause = {};

    if (requester.role === 'admin') {
      // Admin voit seulement sa salle
      whereClause.id = requester.gymId;
      console.log(`👨‍💼 Admin ${requester.fullName} voit seulement sa salle: ${requester.gymId}`);
    } else if (requester.role === 'member') {
      // Member voit seulement sa salle
      whereClause.id = requester.gymId;
      console.log(`👤 Membre ${requester.fullName} voit seulement sa salle: ${requester.gymId}`);
    } else {
      console.log(`👑 Owner ${requester.fullName} voit toutes les salles`);
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

    console.log(`✅ ${gyms.length} gym(s) trouvé(s)`);

    const responseData = { gyms };
    console.log(`📤 Réponse liste gyms: ${gyms.length} résultat(s)`);
    res.json(responseData);
  } catch (e) {
    console.error('💥 Erreur list gyms:', e);
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
  console.log(`🔍 Détails gym - ID: ${req.params.id}, User: ${req.user?.email} (${req.user?.type})`);

  try {
    const id = Number(req.params.id);
    console.log(`🔢 Conversion ID: ${req.params.id} → ${id}`);

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Vérifier les permissions
    let hasAccess = false;
    if (requester.role === 'owner') {
      hasAccess = true;
      console.log(`👑 Owner ${requester.fullName} accède à gym ${id}`);
    } else if (requester.role === 'admin' || requester.role === 'member') {
      hasAccess = requester.gymId === id;
      console.log(`${requester.role === 'admin' ? '👨‍💼' : '👤'} ${requester.role} ${requester.fullName} ${hasAccess ? 'accède' : 'refuse accès'} à gym ${id} (sa salle: ${requester.gymId})`);
    }

    if (!hasAccess) {
      console.log(`🚫 Accès refusé pour ${requester.fullName} (${requester.role}) à gym ${id}`);
      return res.status(403).json({ error: 'Vous n\'avez pas accès à cette salle' });
    }

    console.log(`🔍 Recherche gym ${id} en base...`);
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
      console.log(`❌ Gym non trouvé: ID ${id}`);
      return notFound(res, 'Gym', id);
    }

    console.log(`✅ Gym trouvé: ${gym.name} (${id}) - ${gym.users.length} utilisateurs, ${gym.openingHours.length} horaires`);
    console.log(`📤 Réponse détails gym: ${gym.name}`);
    res.json({ gym });
  } catch (e) {
    console.error('💥 Erreur get gym details:', e);
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
router.put('/:id', auth, async (req, res) => {
  console.log(`✏️ Mise à jour gym - ID: ${req.params.id}, User: ${req.user?.email} (${req.user?.type})`);
  console.log(`📝 Données reçues:`, {
    name: req.body.name,
    address: req.body.address,
    phone: req.body.phone
  });

  try {
    const id = Number(req.params.id);
    const { name, address, phone } = req.body;

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Vérifier les permissions
    let canUpdate = false;
    if (requester.role === 'owner') {
      canUpdate = true;
      console.log(`👑 Owner ${requester.fullName} peut modifier gym ${id}`);
    } else if (requester.role === 'admin') {
      canUpdate = requester.gymId === id;
      console.log(`👨‍💼 Admin ${requester.fullName} ${canUpdate ? 'peut modifier' : 'ne peut pas modifier'} gym ${id} (sa salle: ${requester.gymId})`);
    }

    if (!canUpdate) {
      console.log(`🚫 Permissions insuffisantes pour ${requester.fullName} (${requester.role})`);
      return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour modifier cette salle' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;

    console.log(`🔄 Mise à jour gym ${id} avec:`, updateData);

    const gym = await prisma.gym.update({
      where: { id },
      data: updateData,
      include: {
        OpeningHour: true,
        _count: { select: { User: true } }
      }
    });

    console.log(`✅ Gym mis à jour: ${gym.name} (${id})`);
    console.log(`📤 Réponse mise à jour gym: ${gym.name}`);
    res.json({
      message: 'Salle de sport mise à jour avec succès',
      gym
    });
  } catch (e) {
    if (e.code === 'P2025') {
      console.log(`❌ Gym non trouvé pour mise à jour: ID ${req.params.id}`);
      return notFound(res, 'Gym', req.params.id);
    }
    console.error('💥 Erreur update gym:', e);
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
router.delete('/:id', auth, requireOwner, async (req, res) => {
  console.log(`🗑️ Suppression gym - ID: ${req.params.id}, Owner: ${req.user?.email}`);

  try {
    const id = Number(req.params.id);
    console.log(`🔢 Conversion ID: ${req.params.id} → ${id}`);

    console.log(`🔍 Vérification existence gym ${id}...`);
    const gym = await prisma.gym.findUnique({ where: { id } });
    if (!gym) {
      console.log(`❌ Gym non trouvé: ID ${id}`);
      return notFound(res, 'Gym', id);
    }

    console.log(`✅ Gym trouvé: ${gym.name} (${id}) - prêt pour suppression`);

    // Supprimer la salle (les heures d'ouverture seront supprimées automatiquement grâce à onDelete: Cascade)
    console.log(`🗑️ Suppression gym ${gym.name} (${id})...`);
    await prisma.gym.delete({ where: { id } });

    console.log(`✅ Gym supprimé avec succès: ${gym.name} (${id})`);
    console.log(`📤 Réponse suppression gym: ID ${id}`);
    res.json({
      message: 'Salle de sport supprimée avec succès',
      deletedId: id
    });
  } catch (e) {
    if (e.code === 'P2025') {
      console.log(`❌ Gym non trouvé pour suppression: ID ${req.params.id}`);
      return notFound(res, 'Gym', req.params.id);
    }
    console.error('💥 Erreur delete gym:', e);
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
router.post('/:id/opening-hours', auth, async (req, res) => {
  console.log(`🕐 Mise à jour horaires - Gym ID: ${req.params.id}, User: ${req.user?.email} (${req.user?.type})`);
  console.log(`📝 Données horaires reçues:`, req.body);

  try {
    const id = Number(req.params.id);
    const openingHoursData = req.body; // Array of opening hours

    if (!Array.isArray(openingHoursData)) {
      console.log(`❌ Données invalides - attendu tableau, reçu: ${typeof openingHoursData}`);
      return res.status(400).json({ error: 'Les données doivent être un tableau d\'horaires d\'ouverture' });
    }

    console.log(`✅ ${openingHoursData.length} horaires reçus pour gym ${id}`);

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Vérifier les permissions
    let canUpdate = false;
    if (requester.role === 'owner') {
      canUpdate = true;
      console.log(`👑 Owner ${requester.fullName} peut modifier horaires gym ${id}`);
    } else if (requester.role === 'admin') {
      canUpdate = requester.gymId === id;
      console.log(`👨‍💼 Admin ${requester.fullName} ${canUpdate ? 'peut modifier' : 'ne peut pas modifier'} horaires gym ${id} (sa salle: ${requester.gymId})`);
    }

    if (!canUpdate) {
      console.log(`🚫 Permissions insuffisantes pour ${requester.fullName} (${requester.role})`);
      return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour modifier les horaires de cette salle' });
    }

    console.log(`🔍 Vérification existence gym ${id}...`);
    const gym = await prisma.gym.findUnique({ where: { id } });
    if (!gym) {
      console.log(`❌ Gym non trouvé: ID ${id}`);
      return notFound(res, 'Gym', id);
    }

    // Supprimer les anciens horaires
    console.log(`🗑️ Suppression anciens horaires pour gym ${gym.name}...`);
    await prisma.openingHour.deleteMany({ where: { gymId: id } });

    // Créer les nouveaux horaires
    console.log(`➕ Création nouveaux horaires...`);
    const openingHours = [];
    for (const hourData of openingHoursData) {
      const { dayOfWeek, openTime, closeTime, isClosed = false } = hourData;

      if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) {
        console.log(`⚠️ Jour invalide ignoré: ${dayOfWeek}`);
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
      console.log(`✅ Horaire créé: Jour ${dayOfWeek} - ${isClosed ? 'Fermé' : `${hour.openTime}-${hour.closeTime}`}`);
    }

    console.log(`✅ ${openingHours.length} horaires créés pour gym ${gym.name}`);
    console.log(`📤 Réponse mise à jour horaires: ${openingHours.length} horaires`);
    res.json({
      message: 'Horaires d\'ouverture mis à jour avec succès',
      openingHours
    });
  } catch (e) {
    console.error('💥 Erreur update opening hours:', e);
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
  console.log(`🕐 Récupération horaires - Gym ID: ${req.params.id}, User: ${req.user?.email} (${req.user?.type})`);

  try {
    const id = Number(req.params.id);

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Vérifier les permissions
    let hasAccess = false;
    if (requester.role === 'owner') {
      hasAccess = true;
      console.log(`👑 Owner ${requester.fullName} accède aux horaires gym ${id}`);
    } else if (requester.role === 'admin' || requester.role === 'member') {
      hasAccess = requester.gymId === id;
      console.log(`${requester.role === 'admin' ? '👨‍💼' : '👤'} ${requester.role} ${requester.fullName} ${hasAccess ? 'accède' : 'refuse accès'} aux horaires gym ${id} (sa salle: ${requester.gymId})`);
    }

    if (!hasAccess) {
      console.log(`🚫 Accès refusé aux horaires pour ${requester.fullName} (${requester.role})`);
      return res.status(403).json({ error: 'Vous n\'avez pas accès aux horaires de cette salle' });
    }

    console.log(`🔍 Recherche horaires pour gym ${id}...`);
    const openingHours = await prisma.openingHour.findMany({
      where: { gymId: id },
      orderBy: { dayOfWeek: 'asc' }
    });

    console.log(`✅ ${openingHours.length} horaires trouvés pour gym ${id}`);
    console.log(`📤 Réponse horaires: ${openingHours.length} résultat(s)`);
    res.json({ openingHours });
  } catch (e) {
    console.error('💥 Erreur get opening hours:', e);
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
router.put('/:id/image', auth, async (req, res) => {
  console.log(`🏢 Upload image salle - Gym ID: ${req.params.id}, Requester: ${req.user?.email}`);

  try {
    const id = Number(req.params.id);
    const { imageData } = req.body;

    if (!imageData) {
      console.log(`❌ Données image manquantes pour gym ${id}`);
      return res.status(400).json({ error: 'Données d\'image requises' });
    }

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetGym = await prisma.gym.findUnique({ where: { id } });
    if (!targetGym) {
      console.log(`❌ Salle non trouvée: ID ${id}`);
      return notFound(res, 'Gym', id);
    }

    let canUpdate = false;
    if (requester.role === 'owner') {
      canUpdate = true;
      console.log(`👑 Owner ${requester.fullName} peut modifier image salle ${id}`);
    } else if (requester.role === 'admin') {
      canUpdate = targetGym.id === requester.gymId;
      console.log(`👨‍💼 Admin ${requester.fullName} ${canUpdate ? 'peut modifier' : 'ne peut pas modifier'} image salle ${id} (sa salle: ${requester.gymId})`);
    } else if (requester.role === 'member') {
      canUpdate = false;
      console.log(`👤 Membre ${requester.fullName} ne peut pas modifier image salle`);
    }

    if (!canUpdate) {
      console.log(`🚫 Permissions insuffisantes pour ${requester.fullName}`);
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
      console.log(`✅ Image décodée: ${imageBuffer.length} bytes`);
    } catch (error) {
      console.log(`❌ Erreur décodage image: ${error.message}`);
      return res.status(400).json({ error: 'Données d\'image invalides' });
    }

    // Mettre à jour l'image de la salle
    await prisma.gym.update({
      where: { id },
      data: { image: imageBuffer }
    });

    console.log(`✅ Image de salle mise à jour pour ${targetGym.name}`);
    console.log(`📤 Réponse upload image salle: succès`);
    res.json({ message: 'Image de salle mise à jour avec succès' });

  } catch (e) {
    console.error('💥 Erreur upload image salle:', e);
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
  console.log(`🏢 Récupération image salle - Gym ID: ${req.params.id}, Requester: ${req.user?.email}`);

  try {
    const id = Number(req.params.id);

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetGym = await prisma.gym.findUnique({
      where: { id },
      select: { id: true, name: true, image: true }
    });

    if (!targetGym) {
      console.log(`❌ Salle non trouvée: ID ${id}`);
      return notFound(res, 'Gym', id);
    }

    let hasAccess = false;
    if (requester.role === 'owner') {
      hasAccess = true;
      console.log(`👑 Owner ${requester.fullName} accède à image salle ${id}`);
    } else if (requester.role === 'admin' || requester.role === 'member') {
      hasAccess = targetGym.id === requester.gymId;
      console.log(`${requester.role === 'admin' ? '👨‍💼' : '👤'} ${requester.role} ${requester.fullName} ${hasAccess ? 'accède' : 'refuse accès'} à image salle ${id} (sa salle: ${requester.gymId})`);
    }

    if (!hasAccess) {
      console.log(`🚫 Accès refusé à image salle pour ${requester.fullName}`);
      return res.status(403).json({ error: 'Vous n\'avez pas accès à l\'image de cette salle' });
    }

    if (!targetGym.image) {
      console.log(`❌ Image de salle non trouvée pour ${targetGym.name} - génération image par défaut`);

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

      console.log(`📤 Image par défaut générée pour ${targetGym.name}: ${initials}`);
      return res.send(svgBuffer);
    }

    console.log(`✅ Image de salle récupérée pour ${targetGym.name} (${targetGym.image.length} bytes)`);

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

    console.log(`📤 Réponse image salle: ${mimeType}, ${targetGym.image.length} bytes`);
    res.send(targetGym.image);

  } catch (e) {
    console.error('💥 Erreur récupération image salle:', e);
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
router.delete('/:id/image', auth, async (req, res) => {
  console.log(`🗑️ Suppression image salle - Gym ID: ${req.params.id}, Requester: ${req.user?.email}`);

  try {
    const id = Number(req.params.id);

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetGym = await prisma.gym.findUnique({
      where: { id },
      select: { id: true, name: true, image: true }
    });

    if (!targetGym) {
      console.log(`❌ Salle non trouvée: ID ${id}`);
      return notFound(res, 'Gym', id);
    }

    let canDelete = false;
    if (requester.role === 'owner') {
      canDelete = true;
      console.log(`👑 Owner ${requester.fullName} peut supprimer image salle ${id}`);
    } else if (requester.role === 'admin') {
      canDelete = targetGym.id === requester.gymId;
      console.log(`👨‍💼 Admin ${requester.fullName} ${canDelete ? 'peut supprimer' : 'ne peut pas supprimer'} image salle ${id} (sa salle: ${requester.gymId})`);
    } else if (requester.role === 'member') {
      canDelete = false;
      console.log(`👤 Membre ${requester.fullName} ne peut pas supprimer image salle`);
    }

    if (!canDelete) {
      console.log(`🚫 Permissions insuffisantes pour ${requester.fullName}`);
      return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour supprimer l\'image de cette salle' });
    }

    // Supprimer l'image de la salle (mettre à null)
    await prisma.gym.update({
      where: { id },
      data: { image: null }
    });

    console.log(`✅ Image de salle supprimée pour ${targetGym.name}`);
    console.log(`📤 Réponse suppression image salle: succès`);
    res.json({ message: 'Image de salle supprimée avec succès' });

  } catch (e) {
    console.error('💥 Erreur suppression image salle:', e);
    handleError(res, e, 500);
  }
});

module.exports = router;