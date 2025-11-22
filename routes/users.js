const express = require('express');
const prisma = require('../utils/prismaClient');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../services/emailService');
const logger = require('../utils/logger');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const auth = require('../middleware/auth');
const { generateUserIdByRole } = require('../utils/idGenerator');
const { getFullName } = require('../utils/nameUtils');

// Utility helpers
function handleError(res, e, status = 400) {
  res.status(status).json({ error: e.message });
}
function notFound(res, entity, id) {
  res.status(404).json({ error: `${entity} with id ${id} not found` });
}

// Helper function to sanitize email input
const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return email;
  // Remove null bytes and control characters that can cause PostgreSQL encoding errors
  return email.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim().toLowerCase();
};

// Middleware pour vérifier que c'est un owner
const requireOwner = async (req, res, next) => {
  logger.info(`👑 Vérification rôle Owner - User: ${req.user?.email} (${req.user?.type})`);

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

    req.user.ownerProfile = user.owner;
    logger.info(`✅ Accès owner autorisé pour ${getFullName(user)}`);
    next();
  } catch (error) {
    logger.error('💥 Erreur middleware requireOwner:', error);
    res.status(500).json({ error: error.message });
  }
};

// Middleware pour vérifier que c'est un admin
const requireAdmin = async (req, res, next) => {
  logger.info(`👨‍💼 Vérification rôle Admin - User: ${req.user?.email} (${req.user?.type})`);

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

    req.user.adminProfile = user.admin;
    logger.info(`✅ Accès admin autorisé pour ${getFullName(user)}`);
    next();
  } catch (error) {
    logger.error('💥 Erreur middleware requireAdmin:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create user (admin can create members, owner can create admins/members)
/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     description: Create a new user with role-based permissions. Admins can create members, owners can create admins and members.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *               - role
 *               - gymId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "member@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: User's password
 *                 example: "password123"
 *               fullName:
 *                 type: string
 *                 description: User's full name
 *                 example: "John Doe"
 *               role:
 *                 type: string
 *                 enum: [admin, member]
 *                 description: User role (admin can create members, owner can create admins/members)
 *                 example: "member"
 *               gymId:
 *                 type: integer
 *                 description: ID of the gym the user belongs to
 *                 example: 1
 *               permissions:
 *                 type: object
 *                 description: Permissions for owner role (only used when creating owners)
 *                 properties:
 *                   canManageAdmins:
 *                     type: boolean
 *                     default: true
 *                   canManageGyms:
 *                     type: boolean
 *                     default: true
 *                   canViewReports:
 *                     type: boolean
 *                     default: true
 *                   maxGymsAllowed:
 *                     type: integer
 *                     default: 5
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Utilisateur créé avec succès"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input or email already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     missing_fields:
 *                       value: "Email, password, fullName, role et gymId requis"
 *                     email_exists:
 *                       value: "Cet email est déjà utilisé"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     forbidden:
 *                       value: "Forbidden"
 *                     no_permissions:
 *                       value: "Vous n'avez pas les permissions pour créer cet utilisateur"
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
router.post('/', auth, apiLimiter, async (req, res) => {
  try {
    const { email, phoneNumber, password, fullName, firstName, lastName, role, gymId, permissions, sendSetupEmail = true } = req.body;
    logger.info(`👤 Création utilisateur - Email: ${email}, PhoneNumber: ${phoneNumber}, Role: ${role}, Gym: ${gymId}`);

    // Au moins email ou phoneNumber doit être fourni
    // Accepter soit fullName (pour rétrocompat) soit firstName+lastName
    const hasName = fullName || (firstName && lastName);
    if ((!email && !phoneNumber) || !hasName || !role || !gymId) {
      logger.warn(`❌ Champs manquants pour création utilisateur`);
      return res.status(400).json({ error: 'Email ou phoneNumber, (fullName ou firstName+lastName), role et gymId requis' });
    }

    // Vérifier les permissions selon le rôle du créateur
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    let canCreate = false;

    if (requester.role === 'owner') {
      // Owner peut créer admins et members
      canCreate = ['admin', 'member'].includes(role);
    } else if (requester.role === 'admin') {
      // Admin peut créer seulement des members dans sa salle
      canCreate = role === 'member' && gymId === requester.gymId;
    } else {
      canCreate = false;
    }

    if (!canCreate) {
      logger.warn(`🚫 Permissions insuffisantes - ${requester.role} ne peut pas créer ${role}`);
      return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour créer cet utilisateur' });
    }

    // Sanitize email si fourni
    const sanitizedEmail = email ? sanitizeEmail(email) : null;

    // Vérifier que l'email ou le phoneNumber n'existe pas déjà
    if (sanitizedEmail) {
      const existingUserByEmail = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
      if (existingUserByEmail) {
        logger.warn(`❌ Email déjà utilisé: ${email}`);
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }
    }
    
    if (phoneNumber) {
      const existingUserByPhone = await prisma.user.findUnique({ where: { phoneNumber } });
      if (existingUserByPhone) {
        logger.warn(`❌ Numéro de téléphone déjà utilisé: ${phoneNumber}`);
        return res.status(400).json({ error: 'Ce numéro de téléphone est déjà utilisé' });
      }
    }

    // Si pas de mot de passe fourni, on génère un mot de passe temporaire
    // Si créé avec phoneNumber, le mot de passe est requis (pas d'email de bienvenue)
    let hashedPassword;
    let shouldSendSetupEmail = false;
    
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
      logger.info(`🔐 Mot de passe fourni et hashé`);
    } else {
      // Si phoneNumber sans mot de passe: erreur car on ne peut pas envoyer d'email
      if (phoneNumber && !email) {
        logger.warn(`❌ Mot de passe requis pour création avec phoneNumber uniquement`);
        return res.status(400).json({ error: 'Le mot de passe est requis pour les utilisateurs créés avec un numéro de téléphone uniquement' });
      }
      // Générer un mot de passe temporaire aléatoire
      const tempPassword = crypto.randomBytes(32).toString('hex');
      hashedPassword = await bcrypt.hash(tempPassword, 10);
      shouldSendSetupEmail = sendSetupEmail !== false && !!email; // Envoyer uniquement si email fourni
      logger.info(`🔐 Mot de passe temporaire généré, email sera envoyé: ${shouldSendSetupEmail}`);
    }

    // Préparer les données utilisateur (gérer fullName ou firstName/lastName)
    const { splitFullName } = require('../utils/nameUtils');
    let userData;
    
    if (firstName && lastName) {
      // Utiliser firstName et lastName directement
      userData = {
        firstName,
        lastName
      };
    } else if (fullName) {
      // Splitter fullName en firstName et lastName
      const names = splitFullName(fullName);
      userData = {
        firstName: names.firstName,
        lastName: names.lastName
      };
    }

    const user = await prisma.user.create({
      data: {
        displayId: generateUserIdByRole(role),
        uniqueCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
        email: sanitizedEmail,
        phoneNumber: phoneNumber || null,
        password: hashedPassword,
        ...userData,
        role,
        gymId,
      },
      include: {
        Gym: true
      }
    });

    // Générer et stocker le QR code immédiatement après création
    try {
      const qrData = JSON.stringify({
        userId: user.id,
        displayId: user.displayId,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: getFullName(user),
        role: user.role,
        gymName: user.Gym.name,
        accessType: 'gym_access',
        generatedAt: new Date().toISOString()
      });

      const qrCodeBuffer = await QRCode.toBuffer(qrData, {
        type: 'png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Stocker le QR code en base
      await prisma.user.update({
        where: { id: user.id },
        data: { qrCode: qrCodeBuffer }
      });

      logger.info(`✅ QR code généré et stocké pour ${getFullName(user)} (${qrCodeBuffer.length} bytes)`);
    } catch (qrError) {
      logger.error(`⚠️ Erreur génération QR code pour ${getFullName(user)}:`, qrError);
      // Ne pas échouer la création utilisateur si le QR code échoue
    }

    // Créer le profil spécifique selon le rôle
    if (role === 'admin') {
      await prisma.admin.create({
        data: { userId: user.id }
      });
      logger.info(`✅ Profil admin créé pour ${getFullName(user)}`);
    } else if (role === 'member') {
      await prisma.member.create({
        data: { 
          userId: user.id,
          uniqueCode: user.uniqueCode
        }
      });
      logger.info(`✅ Profil member créé pour ${getFullName(user)}`);
    } else if (role === 'owner') {
      await prisma.owner.create({
        data: {
          userId: user.id,
          canManageAdmins: permissions?.canManageAdmins ?? true,
          canManageGyms: permissions?.canManageGyms ?? true,
          canViewReports: permissions?.canViewReports ?? true,
          maxGymsAllowed: permissions?.maxGymsAllowed ?? 5,
        }
      });
      logger.info(`✅ Profil owner créé pour ${getFullName(user)}`);
    }

    // Si pas de mot de passe fourni et email disponible, envoyer l'email d'activation
    // Ne pas envoyer d'email si créé avec phoneNumber uniquement
    if (shouldSendSetupEmail && email) {
      try {
        // Générer un token unique (6 chiffres)
        const setupToken = crypto.randomInt(100000, 999999).toString();

        // Créer le token en base avec expiration dans 24 heures
        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            token: setupToken,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 heures
          },
        });

        // Envoyer l'email avec le token
        await sendPasswordResetEmail(email, setupToken, true); // true = setup mode

        logger.info(`📧 Email d'activation envoyé à ${email}`);
      } catch (emailError) {
        logger.error(`⚠️ Erreur envoi email d'activation:`, emailError);
        // Ne pas échouer la création si l'email échoue
      }
    } else if (phoneNumber && !email) {
      logger.info(`📱 Utilisateur créé avec phoneNumber uniquement - Pas d'email de bienvenue envoyé`);
    }

    // Retourner l'utilisateur sans le mot de passe
    const { password: _, ...safeUser } = user;
    res.status(201).json({
      message: shouldSendSetupEmail 
        ? 'Utilisateur créé avec succès. Un email d\'activation a été envoyé.'
        : phoneNumber && !email
          ? 'Utilisateur créé avec succès. Le membre peut se connecter avec son numéro de téléphone.'
          : 'Utilisateur créé avec succès',
      user: safeUser,
      setupEmailSent: shouldSendSetupEmail
    });

  } catch (e) {
    logger.error('💥 Erreur création utilisateur:', e);
    handleError(res, e);
  }
});

// List users (filtered by permissions)
/**
 * @swagger
 * /users:
 *   get:
 *     summary: List users
 *     description: Get a list of users filtered by the requester's permissions. Admins see users in their gym, owners see all users.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Forbidden"
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
router.get('/', auth, async (req, res) => {
  try {
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) return res.status(403).json({ error: 'Forbidden' });

    let whereClause = {};

    if (requester.role === 'admin') {
      // Admin voit seulement les utilisateurs de sa salle
      whereClause.gymId = requester.gymId;
    }
    // Owner voit tous les utilisateurs

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        Gym: { select: { id: true, name: true } },
        Member: {
          include: {
            Subscription: { where: { status: 'active' } },
            Payment: { orderBy: { createdAt: 'desc' }, take: 3 }
          }
        },
        Admin: true,
        Owner: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Masquer les mots de passe
    const safeUsers = users.map(({ password, ...rest }) => rest);

    res.json({ users: safeUsers });

  } catch (e) {
    logger.error('Erreur list utilisateurs:', e);
    handleError(res, e, 500);
  }
});
router.get('/:id/qr', auth, async (req, res) => {
  logger.info(`🎨 Génération QR - User ID: ${req.user?.sub}, Email: ${req.user?.email}, Target User ID: ${req.params.id}`);

  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        Gym: { select: { id: true, name: true } },
        Member: true,
        Admin: true,
        Owner: true
      }
    });

    if (!user) {
      logger.warn(`❌ Utilisateur non trouvé: ID ${id}`);
      return notFound(res, 'User', id);
    }

    logger.info(`✅ Utilisateur trouvé: ${getFullName(user)} (${user.role}) - displayId: ${user.displayId}`);

    // Check permissions: user can access their own QR, admin can access QR of users in their gym, owner can access all
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    logger.info(`👤 Requester: ${getFullName(requester)} (${requester.role})`);

    let hasAccess = false;

    if (requester.role === 'owner') {
      hasAccess = true; // Owner can access all QR codes
      logger.info(`👑 Owner ${getFullName(requester)} a accès à tous les QR codes`);
    } else if (requester.role === 'admin') {
      // Admin can access their own QR code OR QR codes of users in their gym
      if (req.user.sub === id) {
        hasAccess = true; // Admin accessing their own QR code
        logger.info(`✅ Admin ${getFullName(requester)} accède à son propre QR code`);
      } else {
        // Check if admin and target user are in the same gym
        const admin = await prisma.admin.findUnique({ where: { userId: req.user.sub } });
        hasAccess = admin && user.gymId === admin.gymId;
        logger.info(`👨‍💼 Admin ${getFullName(requester)} - Accès: ${hasAccess} (admin.gymId: ${admin?.gymId}, user.gymId: ${user.gymId})`);
      }
    } else if (requester.role === 'member') {
      // Member can only access their own QR code
      hasAccess = req.user.sub === id;
      logger.info(`👤 Membre ${getFullName(requester)} - Accès: ${hasAccess} (own QR: ${req.user.sub === id})`);
    }

    if (!hasAccess) {
      logger.warn(`❌ Accès refusé pour ${getFullName(requester)} vers QR de ${getFullName(user)}`);
      return res.status(403).json({ error: 'Forbidden: You cannot access this QR code' });
    }

    // Récupérer le QR code stocké en base
    if (!user.qrCode) {
      logger.warn(`⚠️ QR code non trouvé pour ${getFullName(user)}, régénération...`);
      
      // Fallback: régénérer le QR code si non stocké
      const qrData = JSON.stringify({
        userId: user.id,
        displayId: user.displayId,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: getFullName(user),
        role: user.role,
        gymName: user.Gym.name,
        accessType: 'gym_access',
        generatedAt: new Date().toISOString()
      });

      const qrCodeBuffer = await QRCode.toBuffer(qrData, {
        type: 'png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Stocker pour les futures requêtes
      await prisma.user.update({
        where: { id: user.id },
        data: { qrCode: qrCodeBuffer }
      });

      logger.info(`✅ QR code régénéré et stocké pour ${getFullName(user)} (${qrCodeBuffer.length} bytes)`);

      // Set response headers for PNG image
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `inline; filename="${user.role}-${user.displayId}-qr.png"`);
      res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
      return res.send(qrCodeBuffer);
    }

    logger.info(`✅ QR code récupéré depuis base pour ${getFullName(user)} (${user.qrCode.length} bytes)`);

    // Set response headers for PNG image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="${user.role}-${user.displayId}-qr.png"`);
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

    // Send the stored QR code image
    res.send(user.qrCode);

  } catch (e) {
    logger.error(`💥 Erreur dans génération QR:`, e);
    handleError(res, e, 500);
  }
});

/**
 * @swagger
 * /users/{id}/qr:
 *   get:
 *     summary: Generate QR code for user
 *     description: Generate a QR code image for gym access. Members can access their own QR, admins can access QR codes of users in their gym, owners can access all QR codes.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *         example: 1
 *     responses:
 *       200:
 *         description: QR code image (PNG)
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Forbidden: You cannot access this QR code"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User with id 1 not found"
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

/**
 * @swagger
 * /users/fcm-token:
 *   put:
 *     summary: Update FCM token for push notifications
 *     description: Update the Firebase Cloud Messaging token for the authenticated user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fcmToken
 *             properties:
 *               fcmToken:
 *                 type: string
 *                 description: Firebase Cloud Messaging token
 *                 example: "dXZw8fR3QkG..."
 *     responses:
 *       200:
 *         description: FCM token updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "FCM token mis à jour avec succès"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     fcmToken:
 *                       type: string
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.put('/fcm-token', auth, async (req, res) => {
  logger.info(`🔔 Mise à jour FCM token - User: ${req.user?.email}`);
  
  try {
    const { fcmToken } = req.body;

    if (!fcmToken || typeof fcmToken !== 'string') {
      logger.warn(`❌ FCM token invalide`);
      return res.status(400).json({ error: 'FCM token requis et doit être une chaîne de caractères' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.sub },
      data: { fcmToken },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        fcmToken: true
      }
    });

    logger.info(`✅ FCM token mis à jour pour ${getFullName(updatedUser)}`);
    
    res.json({
      message: 'FCM token mis à jour avec succès',
      user: updatedUser
    });
  } catch (error) {
    logger.error('💥 Erreur mise à jour FCM token:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /users/fcm-token:
 *   delete:
 *     summary: Remove FCM token (logout from notifications)
 *     description: Remove the Firebase Cloud Messaging token for the authenticated user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: FCM token removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "FCM token supprimé avec succès"
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.delete('/fcm-token', auth, async (req, res) => {
  logger.info(`🔕 Suppression FCM token - User: ${req.user?.email}`);
  
  try {
    await prisma.user.update({
      where: { id: req.user.sub },
      data: { fcmToken: null }
    });

    logger.info(`✅ FCM token supprimé pour user ID ${req.user.sub}`);
    
    res.json({
      message: 'FCM token supprimé avec succès'
    });
  } catch (error) {
    logger.error('💥 Erreur suppression FCM token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user
/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update user
 *     description: Update user information. Owners can update anyone, admins can update members in their gym, members can update their own profile.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID to update
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: New email address
 *                 example: "newemail@example.com"
 *               fullName:
 *                 type: string
 *                 description: New full name
 *                 example: "Jane Doe"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: New password
 *                 example: "newpassword123"
 *               notificationsEnabled:
 *                 type: boolean
 *                 description: Enable/disable all notifications (global switch)
 *                 example: true
 *               permissions:
 *                 type: object
 *                 description: Updated permissions for owner role
 *                 properties:
 *                   canManageAdmins:
 *                     type: boolean
 *                   canManageGyms:
 *                     type: boolean
 *                   canViewReports:
 *                     type: boolean
 *                   maxGymsAllowed:
 *                     type: integer
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Utilisateur mis à jour avec succès"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Vous n'avez pas les permissions pour modifier cet utilisateur"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User with id 1 not found"
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
router.put('/:id', auth, apiLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    // Validate id parameter
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const { email, fullName, password, notificationsEnabled, permissions } = req.body;

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) return res.status(403).json({ error: 'Forbidden' });

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return notFound(res, 'User', id);

    // Vérifier les permissions
    let canUpdate = false;

    if (requester.role === 'owner') {
      canUpdate = true; // Owner peut modifier tout le monde
    } else if (requester.role === 'admin') {
      // Admin peut modifier seulement les membres de sa salle
      canUpdate = targetUser.gymId === requester.gymId && targetUser.role === 'member';
    } else if (requester.role === 'member') {
      // Member peut modifier seulement son propre profil
      canUpdate = id === req.user.sub;
    }

    if (!canUpdate) {
      return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour modifier cet utilisateur' });
    }

    const updateData = {};
    if (email) updateData.email = email;
    if (fullName) {
      const { firstName, lastName } = require('../utils/nameUtils').splitFullName(fullName);
      updateData.firstName = firstName;
      updateData.lastName = lastName;
    }
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (notificationsEnabled !== undefined) updateData.notificationsEnabled = notificationsEnabled;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        Gym: { select: { id: true, name: true } },
        Member: true,
        Admin: true,
        Owner: true
      }
    });

    // Régénérer le QR code si le nom ou l'email a changé
    if (email || fullName) {
      try {
        const qrData = JSON.stringify({
          userId: updatedUser.id,
          displayId: updatedUser.displayId,
          fullName: getFullName(updatedUser),
          role: updatedUser.role,
          gymName: updatedUser.Gym.name,
          accessType: 'gym_access',
          updatedAt: new Date().toISOString()
        });

        const qrCodeBuffer = await QRCode.toBuffer(qrData, {
          type: 'png',
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' }
        });

        await prisma.user.update({
          where: { id: updatedUser.id },
          data: { qrCode: qrCodeBuffer }
        });

        logger.info(`🔄 QR code régénéré pour ${getFullName(updatedUser)} après mise à jour`);
      } catch (qrError) {
        logger.error(`⚠️ Erreur régénération QR code pour ${getFullName(updatedUser)}:`, qrError);
      }
    }

    // Mettre à jour les permissions si c'est un owner
    if (targetUser.role === 'owner' && permissions) {
      await prisma.owner.update({
        where: { userId: id },
        data: {
          canManageAdmins: permissions.canManageAdmins ?? true,
          canManageGyms: permissions.canManageGyms ?? true,
          canViewReports: permissions.canViewReports ?? true,
          maxGymsAllowed: permissions.maxGymsAllowed ?? 5,
        }
      });
    }

    const { password: _, ...safeUser } = updatedUser;
    res.json({
      message: 'Utilisateur mis à jour avec succès',
      user: safeUser
    });

  } catch (e) {
    if (e.code === 'P2025') return notFound(res, 'User', req.params.id);
    logger.error('Erreur update utilisateur:', e);
    handleError(res, e);
  }
});

// Delete user
/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user
 *     description: Delete a user. Owners can delete anyone, admins can delete members in their gym, members cannot delete users.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID to delete
 *         example: 1
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Utilisateur supprimé avec succès"
 *                 deletedId:
 *                   type: integer
 *                   example: 1
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Vous n'avez pas les permissions pour supprimer cet utilisateur"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User with id 1 not found"
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
router.delete('/:id', auth, apiLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) return res.status(403).json({ error: 'Forbidden' });

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return notFound(res, 'User', id);

    // Vérifier les permissions
    let canDelete = false;

    if (requester.role === 'owner') {
      canDelete = true; // Owner peut supprimer tout le monde
    } else if (requester.role === 'admin') {
      // Admin peut supprimer seulement les membres de sa salle
      canDelete = targetUser.gymId === requester.gymId && targetUser.role === 'member';
    } else {
      canDelete = false; // Member ne peut pas supprimer
    }

    if (!canDelete) {
      return res.status(403).json({ error: "Vous n'avez pas les permissions pour supprimer cet utilisateur" });
    }

    // Supprimer les tokens de réinitialisation de mot de passe
    await prisma.passwordResetToken.deleteMany({
      where: { userId: id }
    });

    // Supprimer d'abord les profils spécifiques
    if (targetUser.role === 'admin') {
      await prisma.admin.delete({ where: { userId: id } });
    } else if (targetUser.role === 'member') {
      await prisma.member.delete({ where: { userId: id } });
    } else if (targetUser.role === 'owner') {
      await prisma.owner.delete({ where: { userId: id } });
    }

    // Supprimer l'utilisateur
    await prisma.user.delete({ where: { id } });

    logger.info(`🗑️ Utilisateur supprimé: ${getFullName(targetUser)} (ID: ${id}) par ${getFullName(requester)}`);
    res.json({ message: 'Utilisateur supprimé avec succès', deletedId: id });

  } catch (e) {
    if (e.code === 'P2025') return notFound(res, 'User', req.params.id);
    logger.error('Erreur delete utilisateur:', e);
    handleError(res, e);
  }
});

// Upload profile image for user
/**
 * @swagger
 * /users/{id}/profile-image:
 *   put:
 *     summary: Upload profile image for user
 *     description: Upload or update a profile image for a user. Users can update their own profile, admins can update users in their gym, owners can update anyone.
 *     tags: [Users, Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
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
 *         description: Profile image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Photo de profil mise à jour avec succès"
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
 *                   example: "Vous n'avez pas les permissions pour modifier cette photo de profil"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User with id 1 not found"
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
router.put('/:id/profile-image', auth, async (req, res) => {
  logger.info(`🖼️ Upload photo profil - User ID: ${req.params.id}, Requester: ${req.user?.email}`);

  try {
    const id = Number(req.params.id);
    const { imageData } = req.body;

    if (!imageData) {
      logger.warn(`❌ Données image manquantes pour user ${id}`);
      return res.status(400).json({ error: 'Données d\'image requises' });
    }

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      logger.warn(`❌ Utilisateur non trouvé: ID ${id}`);
      return notFound(res, 'User', id);
    }

    let canUpdate = false;
    if (requester.role === 'owner') {
      canUpdate = true;
      logger.info(`👑 Owner ${getFullName(requester)} peut modifier photo profil user ${id}`);
    } else if (requester.role === 'admin') {
      canUpdate = targetUser.gymId === requester.gymId;
      logger.info(`👨‍💼 Admin ${getFullName(requester)} ${canUpdate ? 'peut modifier' : 'ne peut pas modifier'} photo profil user ${id}`);
    } else if (requester.role === 'member') {
      canUpdate = id === req.user.sub;
      logger.info(`👤 Membre ${getFullName(requester)} ${canUpdate ? 'peut modifier' : 'ne peut pas modifier'} sa propre photo profil`);
    }

    if (!canUpdate) {
      logger.warn(`🚫 Permissions insuffisantes pour ${getFullName(requester)}`);
      return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour modifier cette photo de profil' });
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
      logger.info(`✅ Image décodée: ${imageBuffer.length} bytes`);
    } catch (error) {
      logger.warn(`❌ Erreur décodage image: ${error.message}`);
      return res.status(400).json({ error: 'Données d\'image invalides' });
    }

    // Mettre à jour la photo de profil
    await prisma.user.update({
      where: { id },
      data: { profileImage: imageBuffer }
    });

    logger.info(`✅ Photo de profil mise à jour pour ${getFullName(targetUser)}`);
    logger.info(`📤 Réponse upload photo profil: succès`);
    res.json({ message: 'Photo de profil mise à jour avec succès' });

  } catch (e) {
    logger.error('💥 Erreur upload photo profil:', e);
    handleError(res, e, 500);
  }
});

// Get profile image for user
/**
 * @swagger
 * /users/{id}/profile-image:
 *   get:
 *     summary: Get profile image for user
 *     description: Retrieve the profile image for a user. Users can view their own profile image, admins can view images of users in their gym, owners can view all images.
 *     tags: [Users, Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Profile image (binary data or generated avatar)
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *             description: Returns the uploaded profile image, or a generated SVG avatar with user initials if no image is uploaded
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Vous n'avez pas accès à cette photo de profil"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User with id 1 not found"
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
router.get('/:id/profile-image', auth, async (req, res) => {
  logger.info(`🖼️ Récupération photo profil - User ID: ${req.params.id}, Requester: ${req.user?.email}`);

  try {
    const id = Number(req.params.id);

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, gymId: true, role: true, profileImage: true }
    });

    if (!targetUser) {
      logger.warn(`❌ Utilisateur non trouvé: ID ${id}`);
      return notFound(res, 'User', id);
    }

    let hasAccess = false;
    if (requester.role === 'owner') {
      hasAccess = true;
      logger.info(`👑 Owner ${getFullName(requester)} accède à photo profil user ${id}`);
    } else if (requester.role === 'admin') {
      hasAccess = targetUser.gymId === requester.gymId;
      logger.info(`👨‍💼 Admin ${getFullName(requester)} ${hasAccess ? 'accède' : 'refuse accès'} à photo profil user ${id}`);
    } else if (requester.role === 'member') {
      hasAccess = id === req.user.sub;
      logger.info(`👤 Membre ${getFullName(requester)} ${hasAccess ? 'accède' : 'refuse accès'} à sa propre photo profil`);
    }

    if (!hasAccess) {
      logger.warn(`🚫 Accès refusé à photo profil pour ${getFullName(requester)}`);
      return res.status(403).json({ error: 'Vous n\'avez pas accès à cette photo de profil' });
    }

    if (!targetUser.profileImage) {
      logger.info(`❌ Photo de profil non trouvée pour ${getFullName(targetUser)} - génération avatar par défaut`);

      // Générer un avatar par défaut avec les initiales
      const fullName = getFullName(targetUser);
      const initials = fullName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');

      const svgAvatar = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#6366f1"/>
        <text x="100" y="115" font-family="Arial, sans-serif" font-size="80" font-weight="bold" text-anchor="middle" fill="white">${initials}</text>
      </svg>`;

      const svgBuffer = Buffer.from(svgAvatar, 'utf8');

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Length', svgBuffer.length);
      res.setHeader('Cache-Control', 'private, max-age=3600');

      logger.info(`📤 Avatar par défaut généré pour ${getFullName(targetUser)}: ${initials}`);
      return res.send(svgBuffer);
    }

    logger.info(`✅ Photo de profil récupérée pour ${getFullName(targetUser)} (${targetUser.profileImage.length} bytes)`);

    // Déterminer le type MIME (par défaut JPEG si on ne peut pas le déterminer)
    let mimeType = 'image/jpeg';
    if (targetUser.profileImage.length > 4) {
      const firstBytes = targetUser.profileImage.subarray(0, 4);
      if (firstBytes[0] === 0xFF && firstBytes[1] === 0xD8) {
        mimeType = 'image/jpeg';
      } else if (firstBytes[0] === 0x89 && firstBytes[1] === 0x50) {
        mimeType = 'image/png';
      } else if (firstBytes[0] === 0x47 && firstBytes[1] === 0x49) {
        mimeType = 'image/gif';
      }
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', targetUser.profileImage.length);
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache 1 heure

    logger.info(`📤 Réponse photo profil: ${mimeType}, ${targetUser.profileImage.length} bytes`);
    res.send(targetUser.profileImage);

  } catch (e) {
    logger.error('💥 Erreur récupération photo profil:', e);
    handleError(res, e, 500);
  }
});

// Delete profile image for user
/**
 * @swagger
 * /users/{id}/profile-image:
 *   delete:
 *     summary: Delete profile image for user
 *     description: Delete the profile image for a user. Users can delete their own profile image, admins can delete images of users in their gym, owners can delete any image.
 *     tags: [Users, Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Profile image deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Photo de profil supprimée avec succès"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Vous n'avez pas les permissions pour supprimer cette photo de profil"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User with id 1 not found"
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
router.delete('/:id/profile-image', auth, async (req, res) => {
  logger.info(`🗑️ Suppression photo profil - User ID: ${req.params.id}, Requester: ${req.user?.email}`);

  try {
    const id = Number(req.params.id);

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, gymId: true, role: true, profileImage: true }
    });

    if (!targetUser) {
      logger.warn(`❌ Utilisateur non trouvé: ID ${id}`);
      return notFound(res, 'User', id);
    }

    let canDelete = false;
    if (requester.role === 'owner') {
      canDelete = true;
      logger.info(`👑 Owner ${getFullName(requester)} peut supprimer photo profil user ${id}`);
    } else if (requester.role === 'admin') {
      canDelete = targetUser.gymId === requester.gymId;
      logger.info(`👨‍💼 Admin ${getFullName(requester)} ${canDelete ? 'peut supprimer' : 'ne peut pas supprimer'} photo profil user ${id}`);
    } else if (requester.role === 'member') {
      canDelete = id === req.user.sub;
      logger.info(`👤 Membre ${getFullName(requester)} ${canDelete ? 'peut supprimer' : 'ne peut pas supprimer'} sa propre photo profil`);
    }

    if (!canDelete) {
      logger.warn(`🚫 Permissions insuffisantes pour ${getFullName(requester)}`);
      return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour supprimer cette photo de profil' });
    }

    // Supprimer la photo de profil (mettre à null)
    await prisma.user.update({
      where: { id },
      data: { profileImage: null }
    });

    logger.info(`✅ Photo de profil supprimée pour ${getFullName(targetUser)}`);
    logger.info(`📤 Réponse suppression photo profil: succès`);
    res.json({ message: 'Photo de profil supprimée avec succès' });

  } catch (e) {
    logger.error('💥 Erreur suppression photo profil:', e);
    handleError(res, e, 500);
  }
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user profile
 *     description: Get detailed information about a specific user. Owners can access all profiles, admins can access users in their gym, members can access their own profile.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *         example: 1
 *     responses:
 *       200:
 *         description: User profile information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: "user@example.com"
 *                 fullName:
 *                   type: string
 *                   example: "John Doe"
 *                 role:
 *                   type: string
 *                   enum: [owner, admin, member]
 *                   example: "member"
 *                 uniqueCode:
 *                   type: string
 *                   example: "ABC123"
 *                 gym:
 *                   $ref: '#/components/schemas/Gym'
 *                 activeSubscription:
 *                   $ref: '#/components/schemas/Subscription'
 *                 recentPayments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Payment'
 *                 permissions:
 *                   type: object
 *                   description: Only present for owner role
 *                   properties:
 *                     canManageAdmins:
 *                       type: boolean
 *                     canManageGyms:
 *                       type: boolean
 *                     canViewReports:
 *                       type: boolean
 *                     maxGymsAllowed:
 *                       type: integer
 *       403:
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Forbidden: You cannot access this user profile"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User with id 1 not found"
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
router.get('/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        Gym: { select: { id: true, name: true } },
        Member: {
          include: {
            Subscription: {
              where: { status: 'active' }
            },
            Payment: {
              orderBy: { createdAt: 'desc' },
              take: 5
            }
          }
        },
        Admin: true,
        Owner: true
      }
    });

    if (!user) return notFound(res, 'User', id);

    // Check permissions
    logger.info(`🔍 Vérification permissions GET /users/${id} - Requester: ${req.user?.email} (sub: ${req.user?.sub})`);
    
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé dans la DB: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    logger.info(`✅ Requester trouvé: ${getFullName(requester)} (role: ${requester.role}, gymId: ${requester.gymId})`);
    logger.info(`🎯 Target user: ${getFullName(user)} (role: ${user.role}, gymId: ${user.gymId})`);

    let hasAccess = false;

    if (requester.role === 'owner') {
      hasAccess = true;
      logger.info(`👑 Owner ${getFullName(requester)} a accès à tous les profils utilisateur`);
    } else if (requester.role === 'admin') {
      const admin = await prisma.admin.findUnique({ where: { userId: req.user.sub } });
      logger.info(`👨‍💼 Admin profile trouvé: ${admin ? 'oui' : 'non'}${admin ? ` (gymId: ${admin.gymId})` : ''}`);
      hasAccess = admin && user.gymId === requester.gymId;
      logger.info(`🔍 Comparaison gymIds - Admin: ${requester.gymId}, User: ${user.gymId}, Match: ${hasAccess}`);
      logger.info(`👨‍💼 Admin ${getFullName(requester)} ${hasAccess ? 'a accès' : 'n\'a PAS accès'} au profil de ${getFullName(user)}`);
    } else if (requester.role === 'member') {
      hasAccess = req.user.sub === id;
      logger.info(`👤 Membre ${getFullName(requester)} ${hasAccess ? 'accède à son propre profil' : 'tente d\'accéder au profil d\'un autre utilisateur'}`);
    }

    if (!hasAccess) {
      logger.warn(`🚫 ACCÈS REFUSÉ - ${getFullName(requester)} (${requester.role}) ne peut pas accéder au profil de ${getFullName(user)} (${user.role})`);
      logger.warn(`📊 Détails refus: requester.gymId=${requester.gymId}, user.gymId=${user.gymId}, requester.id=${requester.id}, target.id=${id}`);
      return res.status(403).json({ error: 'Forbidden: You cannot access this user profile' });
    }

    logger.info(`✅ ACCÈS AUTORISÉ - ${getFullName(requester)} peut accéder au profil de ${getFullName(user)}`);


    // Return user data based on role
    const response = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
        lastName: user.lastName,
        fullName: getFullName(user),
      role: user.role,
      displayId: user.displayId,
      gym: user.gym
    };

    if (user.role === 'member' && user.member) {
      response.activeSubscription = user.member.subscriptions.find(sub => sub.status === 'active') || null;
      response.recentPayments = user.member.payments || [];
    }

    if (user.role === 'owner' && user.owner) {
      response.permissions = {
        canManageAdmins: user.owner.canManageAdmins,
        canManageGyms: user.owner.canManageGyms,
        canViewReports: user.owner.canViewReports,
        maxGymsAllowed: user.owner.maxGymsAllowed,
      };
    }

    logger.info(`📤 Réponse user profile pour ${getFullName(user)}:`, {
      ...response,
      recentPayments: response.recentPayments ? `${response.recentPayments.length} paiements` : 'aucun'
    });
    res.json(response);

  } catch (e) {
    logger.error('Error fetching user:', e);
    handleError(res, e, 500);
  }
});

// Créer un nouvel owner (seulement pour les owners existants)
/**
 * @swagger
 * /users/create-owner:
 *   post:
 *     summary: Create a new owner (Owner only)
 *     description: Create a new owner user. Only existing owners can create new owners.
 *     tags: [Users, Owners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *               - gymId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Owner's email address
 *                 example: "owner@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: Owner's password
 *                 example: "password123"
 *               fullName:
 *                 type: string
 *                 description: Owner's full name
 *                 example: "John Owner"
 *               gymId:
 *                 type: integer
 *                 description: ID of the gym the owner belongs to
 *                 example: 1
 *               permissions:
 *                 type: object
 *                 description: Owner permissions
 *                 properties:
 *                   canManageAdmins:
 *                     type: boolean
 *                     default: true
 *                   canManageGyms:
 *                     type: boolean
 *                     default: true
 *                   canViewReports:
 *                     type: boolean
 *                     default: true
 *                   maxGymsAllowed:
 *                     type: integer
 *                     default: 5
 *     responses:
 *       201:
 *         description: Owner created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Propriétaire créé avec succès"
 *                 owner:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "owner@example.com"
 *                     fullName:
 *                       type: string
 *                       example: "John Owner"
 *                     permissions:
 *                       type: object
 *                       properties:
 *                         canManageAdmins:
 *                           type: boolean
 *                         canManageGyms:
 *                           type: boolean
 *                         canViewReports:
 *                           type: boolean
 *                         maxGymsAllowed:
 *                           type: integer
 *       400:
 *         description: Invalid input or email already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     missing_fields:
 *                       value: "Email, password, fullName et gymId requis"
 *                     email_exists:
 *                       value: "Cet email est déjà utilisé"
 *       403:
 *         description: Access denied - not an owner
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Erreur lors de la création du propriétaire"
 */
router.post('/create-owner', auth, requireOwner, apiLimiter, async (req, res) => {
  const { email, password, fullName, gymId, permissions } = req.body;
  logger.info(`👑 Création owner - Email: ${email}, Gym ID: ${gymId}, Requester: ${req.user?.email}`);

  if (!email || !password || !fullName || !gymId) {
    logger.warn(`❌ Champs manquants pour création owner`);
    return res.status(400).json({ error: 'Email, password, fullName et gymId requis' });
  }

  const sanitizedEmail = sanitizeEmail(email);

  try {
    // Vérifier que l'email n'existe pas déjà
    const existingUser = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (existingUser) {
      logger.warn(`❌ Email déjà utilisé: ${email}`);
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        password: hashedPassword,
        fullName,
        role: 'owner',
        gymId,
      }
    });

    const owner = await prisma.owner.create({
      data: {
        userId: user.id,
        canManageAdmins: permissions?.canManageAdmins ?? true,
        canManageGyms: permissions?.canManageGyms ?? true,
        canViewReports: permissions?.canViewReports ?? true,
        maxGymsAllowed: permissions?.maxGymsAllowed ?? 5,
      }
    });

    logger.info(`✅ Owner créé: ${getFullName(user)} (ID: ${user.id})`);

    // Générer et stocker le QR code
    try {
      const gym = await prisma.gym.findUnique({ where: { id: gymId } });
      const qrData = JSON.stringify({
        userId: user.id,
        displayId: user.displayId,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: getFullName(user),
        role: 'owner',
        gymName: gym.name,
        accessType: 'gym_access',
        generatedAt: new Date().toISOString()
      });

      const qrCodeBuffer = await QRCode.toBuffer(qrData, {
        type: 'png',
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { qrCode: qrCodeBuffer }
      });

      logger.info(`✅ QR code généré et stocké pour owner ${getFullName(user)}`);
    } catch (qrError) {
      logger.error(`⚠️ Erreur génération QR code pour owner ${getFullName(user)}:`, qrError);
    }

    res.status(201).json({
      message: 'Propriétaire créé avec succès',
      owner: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: getFullName(user),
        permissions: {
          canManageAdmins: owner.canManageAdmins,
          canManageGyms: owner.canManageGyms,
          canViewReports: owner.canViewReports,
          maxGymsAllowed: owner.maxGymsAllowed,
        }
      }
    });
  } catch (error) {
    logger.error('💥 Erreur création owner:', error);
    res.status(500).json({ error: 'Erreur lors de la création du propriétaire' });
  }
});

// Créer un nouvel admin (seulement pour les owners)
/**
 * @swagger
 * /users/create-admin:
 *   post:
 *     summary: Create a new admin (Owner only)
 *     description: Create a new admin user. Only owners can create admins.
 *     tags: [Users, Owners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *               - gymId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Admin's email address
 *                 example: "admin@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: Admin's password
 *                 example: "password123"
 *               fullName:
 *                 type: string
 *                 description: Admin's full name
 *                 example: "Jane Admin"
 *               gymId:
 *                 type: integer
 *                 description: ID of the gym the admin belongs to
 *                 example: 1
 *     responses:
 *       201:
 *         description: Admin created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Administrateur créé avec succès"
 *                 admin:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "admin@example.com"
 *                     fullName:
 *                       type: string
 *                       example: "Jane Admin"
 *                     gymId:
 *                       type: integer
 *                       example: 1
 *       400:
 *         description: Invalid input or email already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     missing_fields:
 *                       value: "Email, password, fullName et gymId requis"
 *                     email_exists:
 *                       value: "Cet email est déjà utilisé"
 *       403:
 *         description: Access denied - not an owner
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Erreur lors de la création de l'administrateur"
 */
router.post('/create-admin', auth, requireOwner, apiLimiter, async (req, res) => {
  const { email, password, fullName, gymId } = req.body;
  logger.info(`👨‍💼 Création admin - Email: ${email}, Gym ID: ${gymId}, Requester: ${req.user?.email}`);

  if (!email || !password || !fullName || !gymId) {
    logger.warn(`❌ Champs manquants pour création admin`);
    return res.status(400).json({ error: 'Email, password, fullName et gymId requis' });
  }

  const sanitizedEmail = sanitizeEmail(email);

  try {
    // Vérifier que l'email n'existe pas déjà
    const existingUser = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (existingUser) {
      logger.warn(`❌ Email déjà utilisé: ${email}`);
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        password: hashedPassword,
        fullName,
        role: 'admin',
        gymId,
      }
    });

    await prisma.admin.create({
      data: {
        userId: user.id,
        gymId
      }
    });

    logger.info(`✅ Admin créé: ${getFullName(user)} (ID: ${user.id})`);

    // Générer et stocker le QR code
    try {
      const gym = await prisma.gym.findUnique({ where: { id: gymId } });
      const qrData = JSON.stringify({
        userId: user.id,
        displayId: user.displayId,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: getFullName(user),
        role: 'admin',
        gymName: gym.name,
        accessType: 'gym_access',
        generatedAt: new Date().toISOString()
      });

      const qrCodeBuffer = await QRCode.toBuffer(qrData, {
        type: 'png',
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { qrCode: qrCodeBuffer }
      });

      logger.info(`✅ QR code généré et stocké pour admin ${getFullName(user)}`);
    } catch (qrError) {
      logger.error(`⚠️ Erreur génération QR code pour admin ${getFullName(user)}:`, qrError);
    }

    res.status(201).json({
      message: 'Administrateur créé avec succès',
      admin: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: getFullName(user),
        gymId
      }
    });
  } catch (error) {
    logger.error('💥 Erreur création admin:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'administrateur' });
  }
});

// Get members by gym ID
/**
 * @swagger
 * /users/gym/{gymId}/members:
 *   get:
 *     summary: Get all members of a specific gym
 *     description: Get a list of all members in a specific gym. Owners can access any gym, admins can only access their own gym.
 *     tags: [Users, Gyms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gymId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Gym ID
 *         example: 1
 *     responses:
 *       200:
 *         description: List of members in the gym
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
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       email:
 *                         type: string
 *                         example: "member@example.com"
 *                       fullName:
 *                         type: string
 *                         example: "John Doe"
 *                       uniqueCode:
 *                         type: string
 *                         example: "ABC123"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       activeSubscription:
 *                         type: object
 *                       recentPayments:
 *                         type: array
 *                         items:
 *                           $ref: '#/components/schemas/Payment'
 *       403:
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Vous n'avez pas accès aux membres de cette salle"
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
router.get('/gym/:gymId/members', auth, async (req, res) => {
  logger.debug(`📋 Liste membres par gym - User: ${req.user?.email}, Gym ID: ${req.params.gymId}`);

  try {
    const gymId = Number(req.params.gymId);
    logger.debug(`🔍 Conversion gymId: ${req.params.gymId} → ${gymId}`);

    // Vérifier que la salle existe
    logger.debug(`🔍 Recherche gym ${gymId}...`);
    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { id: true, name: true, address: true }
    });

    if (!gym) {
      logger.warn(`❌ Gym non trouvé: ID ${gymId}`);
      return res.status(404).json({ error: `Gym with id ${gymId} not found` });
    }

    logger.debug(`✅ Gym trouvé: ${gym.name} (${gymId})`);

    // Vérifier les permissions
    logger.debug(`🔍 Recherche requester - ID: ${req.user.sub}`);
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      logger.warn(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    logger.debug(`✅ Requester trouvé: ${getFullName(requester)} (${requester.role})`);
    logger.debug(`🔍 Vérification permissions selon rôle: ${requester.role}`);

    let hasAccess = false;
    
    if (requester.role === 'owner') {
      hasAccess = true;
      logger.debug(`👑 Owner ${getFullName(requester)} a accès à tous les membres de toutes les salles`);
    } else if (requester.role === 'admin') {
      hasAccess = requester.gymId === gymId;
      logger.debug(`👨‍💼 Admin ${getFullName(requester)} ${hasAccess ? 'a accès' : 'n\'a pas accès'} aux membres de gym ${gymId} (sa salle: ${requester.gymId})`);
    } else {
      logger.warn(`🚫 Membre ${getFullName(requester)} ne peut pas lister les membres`);
      hasAccess = false;
    }

    if (!hasAccess) {
      logger.warn(`🚫 Accès refusé pour ${getFullName(requester)} aux membres de gym ${gymId}`);
      return res.status(403).json({ error: 'Vous n\'avez pas accès aux membres de cette salle' });
    }

    logger.debug(`✅ Permissions validées`);
    logger.debug(`🔍 Recherche membres de gym ${gymId}...`);

    // Récupérer tous les membres de la salle
    const members = await prisma.user.findMany({
      where: {
        gymId: gymId,
        role: 'member'
      },
      include: {
        Member: {
          include: {
            Subscription: {
              where: { status: 'active' },
              include: {
                SubscriptionType: true,
                Payment: {
                  orderBy: { createdAt: 'desc' },
                  take: 1
                }
              }
            },
            Payment: {
              orderBy: { createdAt: 'desc' },
              take: 5
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    logger.info(`✅ ${members.length} membre(s) trouvé(s) pour gym ${gym.name}`);
    
    // Formater la réponse en masquant les mots de passe et en ajoutant les infos pertinentes
    const formattedMembers = members.map(user => {
      const activeSubscription = user.member?.subscriptions?.find(sub => sub.status === 'active') || null;
      
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: getFullName(user),
        displayId: user.displayId,
        createdAt: user.createdAt,
        activeSubscription: activeSubscription ? {
          id: activeSubscription.id,
          type: activeSubscription.subscriptionType.name,
          status: activeSubscription.status,
          startDate: activeSubscription.startDate,
          endDate: activeSubscription.endDate,
          lastPayment: activeSubscription.payments[0] || null
        } : null,
        recentPayments: user.member?.payments || []
      };
    });

    logger.debug(`📊 Statistiques membres:`);
    logger.debug(`   - Total: ${formattedMembers.length}`);
    logger.debug(`   - Avec abonnement actif: ${formattedMembers.filter(m => m.activeSubscription).length}`);
    logger.debug(`   - Sans abonnement: ${formattedMembers.filter(m => !m.activeSubscription).length}`);

    const responseData = {
      gym: {
        id: gym.id,
        name: gym.name,
        address: gym.address
      },
      members: formattedMembers,
      count: formattedMembers.length
    };

    logger.debug(`📤 Réponse membres gym ${gymId}: ${formattedMembers.length} résultat(s)`);
    res.json(responseData);

  } catch (e) {
    logger.error('💥 Erreur liste membres par gym:', e);
    res.status(500).json({ error: e.message });
  }
});

// Lister tous les gyms (pour les owners)
/**
 * @swagger
 * /users/gyms/all:
 *   get:
 *     summary: List all gyms (Owner only)
 *     description: Get a list of all gyms with user counts. Only owners can access this endpoint.
 *     tags: [Users, Owners, Gyms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all gyms
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gyms:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: "Fitness Center A"
 *                       address:
 *                         type: string
 *                         example: "123 Main St"
 *                       phone:
 *                         type: string
 *                         example: "+1234567890"
 *                       users:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             email:
 *                               type: string
 *                             fullName:
 *                               type: string
 *                             role:
 *                               type: string
 *                       _count:
 *                         type: object
 *                         properties:
 *                           users:
 *                             type: integer
 *                             example: 25
 *       403:
 *         description: Access denied - not an owner
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
router.get('/gyms/all', auth, requireOwner, async (req, res) => {
  logger.debug(`📋 Liste tous les gyms (Owner) - User: ${req.user?.email}`);
  try {
    const gyms = await prisma.gym.findMany({
      include: {
        User: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          }
        },
        _count: {
          select: { User: true }
        }
      }
    });

    logger.info(`✅ ${gyms.length} gyms trouvés`);
    res.json({ gyms });
  } catch (error) {
    logger.error('💥 Erreur liste tous les gyms:', error);
    res.status(500).json({ error: error.message });
  }
});

// Statistiques globales (pour les owners)
/**
 * @swagger
 * /users/stats:
 *   get:
 *     summary: Get global statistics (Owner only)
 *     description: Get comprehensive statistics about the entire system. Only owners can access this endpoint.
 *     tags: [Users, Owners, Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Global system statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalGyms:
 *                       type: integer
 *                       description: Total number of gyms
 *                       example: 5
 *                     totalUsers:
 *                       type: integer
 *                       description: Total number of users
 *                       example: 150
 *                     totalAdmins:
 *                       type: integer
 *                       description: Total number of admin users
 *                       example: 10
 *                     totalMembers:
 *                       type: integer
 *                       description: Total number of member users
 *                       example: 125
 *                     totalOwners:
 *                       type: integer
 *                       description: Total number of owner users
 *                       example: 15
 *                     totalPayments:
 *                       type: integer
 *                       description: Total number of payments
 *                       example: 450
 *                     totalRevenue:
 *                       type: number
 *                       description: Total revenue from completed payments
 *                       example: 25000.50
 *       403:
 *         description: Access denied - not an owner
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
router.get('/stats', auth, requireOwner, async (req, res) => {
  logger.debug(`📊 Statistiques globales - User: ${req.user?.email}`);
  try {
    const [
      totalGyms,
      totalUsers,
      totalAdmins,
      totalMembers,
      totalOwners,
      totalPayments,
      totalRevenue
    ] = await Promise.all([
      prisma.gym.count(),
      prisma.user.count(),
      prisma.admin.count(),
      prisma.member.count(),
      prisma.owner.count(),
      prisma.payment.count(),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'completed' }
      })
    ]);

    const stats = {
      totalGyms,
      totalUsers,
      totalAdmins,
      totalMembers,
      totalOwners,
      totalPayments,
      totalRevenue: totalRevenue._sum.amount || 0
    };

    logger.info(`✅ Statistiques récupérées:`, stats);
    res.json({ stats });
  } catch (error) {
    logger.error('💥 Erreur statistiques globales:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;