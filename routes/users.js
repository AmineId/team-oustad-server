const express = require('express');
const { PrismaClient } = require('@prisma/client');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../services/emailService');

const router = express.Router();
const prisma = new PrismaClient();
const auth = require('../middleware/auth');

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
  console.log(`👑 Vérification rôle Owner - User: ${req.user?.email} (${req.user?.type})`);

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
router.post('/', auth, async (req, res) => {
  try {
    const { email, password, fullName, role, gymId, permissions, sendSetupEmail = true } = req.body;
    console.log(`👤 Création utilisateur - Email: ${email}, Role: ${role}, Gym: ${gymId}`);

    if (!email || !fullName || !role || !gymId) {
      console.log(`❌ Champs manquants pour création utilisateur`);
      return res.status(400).json({ error: 'Email, fullName, role et gymId requis' });
    }

    // Vérifier les permissions selon le rôle du créateur
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
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
      console.log(`🚫 Permissions insuffisantes - ${requester.role} ne peut pas créer ${role}`);
      return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour créer cet utilisateur' });
    }

    // Sanitize email
    const sanitizedEmail = sanitizeEmail(email);

    // Vérifier que l'email n'existe pas déjà
    const existingUser = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (existingUser) {
      console.log(`❌ Email déjà utilisé: ${email}`);
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Si pas de mot de passe fourni, on génère un mot de passe temporaire
    // et on enverra un email pour que l'utilisateur crée son propre mot de passe
    let hashedPassword;
    let shouldSendSetupEmail = false;
    
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
      console.log(`🔐 Mot de passe fourni et hashé`);
    } else {
      // Générer un mot de passe temporaire aléatoire
      const tempPassword = crypto.randomBytes(32).toString('hex');
      hashedPassword = await bcrypt.hash(tempPassword, 10);
      shouldSendSetupEmail = sendSetupEmail !== false; // Par défaut, on envoie l'email
      console.log(`🔐 Mot de passe temporaire généré, email sera envoyé: ${shouldSendSetupEmail}`);
    }

    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        password: hashedPassword,
        fullName,
        role,
        gymId,
      }
    });

    // Générer et stocker le QR code immédiatement après création
    try {
      const qrData = JSON.stringify({
        userId: user.id,
        uniqueCode: user.uniqueCode,
        fullName: user.fullName,
        role: user.role,
        gymName: user.gym.name,
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

      console.log(`✅ QR code généré et stocké pour ${user.fullName} (${qrCodeBuffer.length} bytes)`);
    } catch (qrError) {
      console.error(`⚠️ Erreur génération QR code pour ${user.fullName}:`, qrError);
      // Ne pas échouer la création utilisateur si le QR code échoue
    }

    // Créer le profil spécifique selon le rôle
    if (role === 'admin') {
      await prisma.admin.create({
        data: { userId: user.id }
      });
      console.log(`✅ Profil admin créé pour ${user.fullName}`);
    } else if (role === 'member') {
      await prisma.member.create({
        data: { userId: user.id }
      });
      console.log(`✅ Profil member créé pour ${user.fullName}`);
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
      console.log(`✅ Profil owner créé pour ${user.fullName}`);
    }

    // Si pas de mot de passe fourni, envoyer l'email d'activation
    if (shouldSendSetupEmail) {
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

        console.log(`📧 Email d'activation envoyé à ${email}`);
      } catch (emailError) {
        console.error(`⚠️ Erreur envoi email d'activation:`, emailError);
        // Ne pas échouer la création si l'email échoue
      }
    }

    // Retourner l'utilisateur sans le mot de passe
    const { password: _, ...safeUser } = user;
    res.status(201).json({
      message: shouldSendSetupEmail 
        ? 'Utilisateur créé avec succès. Un email d\'activation a été envoyé.'
        : 'Utilisateur créé avec succès',
      user: safeUser,
      setupEmailSent: shouldSendSetupEmail
    });

  } catch (e) {
    console.error('💥 Erreur création utilisateur:', e);
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
        gym: { select: { id: true, name: true } },
        member: {
          include: {
            subscriptions: { where: { status: 'active' } },
            payments: { orderBy: { createdAt: 'desc' }, take: 3 }
          }
        },
        admin: true,
        owner: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Masquer les mots de passe
    const safeUsers = users.map(({ password, ...rest }) => rest);

    res.json({ users: safeUsers });

  } catch (e) {
    console.error('Erreur list utilisateurs:', e);
    handleError(res, e, 500);
  }
});
router.get('/:id/qr', auth, async (req, res) => {
  console.log(`🎨 Génération QR - User ID: ${req.user?.sub}, Email: ${req.user?.email}, Target User ID: ${req.params.id}`);

  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        gym: { select: { id: true, name: true } },
        member: true,
        admin: true,
        owner: true
      }
    });

    if (!user) {
      console.log(`❌ Utilisateur non trouvé: ID ${id}`);
      return notFound(res, 'User', id);
    }

    console.log(`✅ Utilisateur trouvé: ${user.fullName} (${user.role}) - uniqueCode: ${user.uniqueCode}`);

    // Check permissions: user can access their own QR, admin can access QR of users in their gym, owner can access all
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    console.log(`👤 Requester: ${requester.fullName} (${requester.role})`);

    let hasAccess = false;

    if (requester.role === 'owner') {
      hasAccess = true; // Owner can access all QR codes
      console.log(`👑 Owner ${requester.fullName} a accès à tous les QR codes`);
    } else if (requester.role === 'admin') {
      // Admin can only access QR codes of users in their gym
      const admin = await prisma.admin.findUnique({ where: { userId: req.user.sub } });
      hasAccess = admin && user.gymId === admin.gymId;
      console.log(`👨‍💼 Admin ${requester.fullName} - Accès: ${hasAccess} (admin.gymId: ${admin?.gymId}, user.gymId: ${user.gymId})`);
    } else if (requester.role === 'member') {
      // Member can only access their own QR code
      hasAccess = req.user.sub === id;
      console.log(`👤 Membre ${requester.fullName} - Accès: ${hasAccess} (own QR: ${req.user.sub === id})`);
    }

    if (!hasAccess) {
      console.log(`❌ Accès refusé pour ${requester.fullName} vers QR de ${user.fullName}`);
      return res.status(403).json({ error: 'Forbidden: You cannot access this QR code' });
    }

    // Récupérer le QR code stocké en base
    if (!user.qrCode) {
      console.log(`⚠️ QR code non trouvé pour ${user.fullName}, régénération...`);
      
      // Fallback: régénérer le QR code si non stocké
      const qrData = JSON.stringify({
        userId: user.id,
        uniqueCode: user.uniqueCode,
        fullName: user.fullName,
        role: user.role,
        gymName: user.gym.name,
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

      console.log(`✅ QR code régénéré et stocké pour ${user.fullName} (${qrCodeBuffer.length} bytes)`);

      // Set response headers for PNG image
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `inline; filename="${user.role}-${user.uniqueCode}-qr.png"`);
      res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
      return res.send(qrCodeBuffer);
    }

    console.log(`✅ QR code récupéré depuis base pour ${user.fullName} (${user.qrCode.length} bytes)`);

    // Set response headers for PNG image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="${user.role}-${user.uniqueCode}-qr.png"`);
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

    // Send the stored QR code image
    res.send(user.qrCode);

  } catch (e) {
    console.error(`💥 Erreur dans génération QR:`, e);
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
router.put('/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { email, fullName, password, permissions } = req.body;

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
    if (fullName) updateData.fullName = fullName;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        gym: { select: { id: true, name: true } },
        member: true,
        admin: true,
        owner: true
      }
    });

    // Régénérer le QR code si le nom ou l'email a changé
    if (email || fullName) {
      try {
        const qrData = JSON.stringify({
          userId: updatedUser.id,
          uniqueCode: updatedUser.uniqueCode,
          fullName: updatedUser.fullName,
          role: updatedUser.role,
          gymName: updatedUser.gym.name,
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

        console.log(`🔄 QR code régénéré pour ${updatedUser.fullName} après mise à jour`);
      } catch (qrError) {
        console.error(`⚠️ Erreur régénération QR code pour ${updatedUser.fullName}:`, qrError);
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
    console.error('Erreur update utilisateur:', e);
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
router.delete('/:id', auth, async (req, res) => {
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

    res.json({ message: 'Utilisateur supprimé avec succès', deletedId: id });

  } catch (e) {
    if (e.code === 'P2025') return notFound(res, 'User', req.params.id);
    console.error('Erreur delete utilisateur:', e);
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
  console.log(`🖼️ Upload photo profil - User ID: ${req.params.id}, Requester: ${req.user?.email}`);

  try {
    const id = Number(req.params.id);
    const { imageData } = req.body;

    if (!imageData) {
      console.log(`❌ Données image manquantes pour user ${id}`);
      return res.status(400).json({ error: 'Données d\'image requises' });
    }

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      console.log(`❌ Utilisateur non trouvé: ID ${id}`);
      return notFound(res, 'User', id);
    }

    let canUpdate = false;
    if (requester.role === 'owner') {
      canUpdate = true;
      console.log(`👑 Owner ${requester.fullName} peut modifier photo profil user ${id}`);
    } else if (requester.role === 'admin') {
      canUpdate = targetUser.gymId === requester.gymId;
      console.log(`👨‍💼 Admin ${requester.fullName} ${canUpdate ? 'peut modifier' : 'ne peut pas modifier'} photo profil user ${id}`);
    } else if (requester.role === 'member') {
      canUpdate = id === req.user.sub;
      console.log(`👤 Membre ${requester.fullName} ${canUpdate ? 'peut modifier' : 'ne peut pas modifier'} sa propre photo profil`);
    }

    if (!canUpdate) {
      console.log(`🚫 Permissions insuffisantes pour ${requester.fullName}`);
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
      console.log(`✅ Image décodée: ${imageBuffer.length} bytes`);
    } catch (error) {
      console.log(`❌ Erreur décodage image: ${error.message}`);
      return res.status(400).json({ error: 'Données d\'image invalides' });
    }

    // Mettre à jour la photo de profil
    await prisma.user.update({
      where: { id },
      data: { profileImage: imageBuffer }
    });

    console.log(`✅ Photo de profil mise à jour pour ${targetUser.fullName}`);
    console.log(`📤 Réponse upload photo profil: succès`);
    res.json({ message: 'Photo de profil mise à jour avec succès' });

  } catch (e) {
    console.error('💥 Erreur upload photo profil:', e);
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
  console.log(`🖼️ Récupération photo profil - User ID: ${req.params.id}, Requester: ${req.user?.email}`);

  try {
    const id = Number(req.params.id);

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, fullName: true, gymId: true, role: true, profileImage: true }
    });

    if (!targetUser) {
      console.log(`❌ Utilisateur non trouvé: ID ${id}`);
      return notFound(res, 'User', id);
    }

    let hasAccess = false;
    if (requester.role === 'owner') {
      hasAccess = true;
      console.log(`👑 Owner ${requester.fullName} accède à photo profil user ${id}`);
    } else if (requester.role === 'admin') {
      hasAccess = targetUser.gymId === requester.gymId;
      console.log(`👨‍💼 Admin ${requester.fullName} ${hasAccess ? 'accède' : 'refuse accès'} à photo profil user ${id}`);
    } else if (requester.role === 'member') {
      hasAccess = id === req.user.sub;
      console.log(`👤 Membre ${requester.fullName} ${hasAccess ? 'accède' : 'refuse accès'} à sa propre photo profil`);
    }

    if (!hasAccess) {
      console.log(`🚫 Accès refusé à photo profil pour ${requester.fullName}`);
      return res.status(403).json({ error: 'Vous n\'avez pas accès à cette photo de profil' });
    }

    if (!targetUser.profileImage) {
      console.log(`❌ Photo de profil non trouvée pour ${targetUser.fullName} - génération avatar par défaut`);

      // Générer un avatar par défaut avec les initiales
      const initials = targetUser.fullName
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

      console.log(`📤 Avatar par défaut généré pour ${targetUser.fullName}: ${initials}`);
      return res.send(svgBuffer);
    }

    console.log(`✅ Photo de profil récupérée pour ${targetUser.fullName} (${targetUser.profileImage.length} bytes)`);

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

    console.log(`📤 Réponse photo profil: ${mimeType}, ${targetUser.profileImage.length} bytes`);
    res.send(targetUser.profileImage);

  } catch (e) {
    console.error('💥 Erreur récupération photo profil:', e);
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
  console.log(`🗑️ Suppression photo profil - User ID: ${req.params.id}, Requester: ${req.user?.email}`);

  try {
    const id = Number(req.params.id);

    // Vérifier les permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) {
      console.log(`❌ Requester non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, fullName: true, gymId: true, role: true, profileImage: true }
    });

    if (!targetUser) {
      console.log(`❌ Utilisateur non trouvé: ID ${id}`);
      return notFound(res, 'User', id);
    }

    let canDelete = false;
    if (requester.role === 'owner') {
      canDelete = true;
      console.log(`👑 Owner ${requester.fullName} peut supprimer photo profil user ${id}`);
    } else if (requester.role === 'admin') {
      canDelete = targetUser.gymId === requester.gymId;
      console.log(`👨‍💼 Admin ${requester.fullName} ${canDelete ? 'peut supprimer' : 'ne peut pas supprimer'} photo profil user ${id}`);
    } else if (requester.role === 'member') {
      canDelete = id === req.user.sub;
      console.log(`👤 Membre ${requester.fullName} ${canDelete ? 'peut supprimer' : 'ne peut pas supprimer'} sa propre photo profil`);
    }

    if (!canDelete) {
      console.log(`🚫 Permissions insuffisantes pour ${requester.fullName}`);
      return res.status(403).json({ error: 'Vous n\'avez pas les permissions pour supprimer cette photo de profil' });
    }

    // Supprimer la photo de profil (mettre à null)
    await prisma.user.update({
      where: { id },
      data: { profileImage: null }
    });

    console.log(`✅ Photo de profil supprimée pour ${targetUser.fullName}`);
    console.log(`📤 Réponse suppression photo profil: succès`);
    res.json({ message: 'Photo de profil supprimée avec succès' });

  } catch (e) {
    console.error('💥 Erreur suppression photo profil:', e);
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
        gym: { select: { id: true, name: true } },
        member: {
          include: {
            subscriptions: {
              where: { status: 'active' }
            },
            payments: {
              orderBy: { createdAt: 'desc' },
              take: 5
            }
          }
        },
        admin: true,
        owner: true
      }
    });

    if (!user) return notFound(res, 'User', id);

    // Check permissions
    const requester = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!requester) return res.status(403).json({ error: 'Forbidden' });

    let hasAccess = false;

    if (requester.role === 'owner') {
      hasAccess = true;
    } else if (requester.role === 'admin') {
      const admin = await prisma.admin.findUnique({ where: { userId: req.user.sub } });
      hasAccess = admin && user.gymId === admin.gymId;
    } else if (requester.role === 'member') {
      hasAccess = req.user.sub === id;
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: You cannot access this user profile' });
    }

    // Return user data based on role
    const response = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      uniqueCode: user.uniqueCode,
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

    console.log(`📤 Réponse user profile pour ${user.fullName}:`, {
      ...response,
      recentPayments: response.recentPayments ? `${response.recentPayments.length} paiements` : 'aucun'
    });
    res.json(response);

  } catch (e) {
    console.error('Error fetching user:', e);
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
router.post('/create-owner', requireOwner, async (req, res) => {
  const { email, password, fullName, gymId, permissions } = req.body;

  if (!email || !password || !fullName || !gymId) {
    return res.status(400).json({ error: 'Email, password, fullName et gymId requis' });
  }

  const sanitizedEmail = sanitizeEmail(email);

  try {
    // Vérifier que l'email n'existe pas déjà
    const existingUser = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (existingUser) {
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

    // Générer et stocker le QR code
    try {
      const gym = await prisma.gym.findUnique({ where: { id: gymId } });
      const qrData = JSON.stringify({
        userId: user.id,
        uniqueCode: user.uniqueCode,
        fullName: user.fullName,
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

      console.log(`✅ QR code généré et stocké pour owner ${user.fullName}`);
    } catch (qrError) {
      console.error(`⚠️ Erreur génération QR code pour owner ${user.fullName}:`, qrError);
    }

    res.status(201).json({
      message: 'Propriétaire créé avec succès',
      owner: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        permissions: {
          canManageAdmins: owner.canManageAdmins,
          canManageGyms: owner.canManageGyms,
          canViewReports: owner.canViewReports,
          maxGymsAllowed: owner.maxGymsAllowed,
        }
      }
    });
  } catch (error) {
    console.error('Erreur création owner:', error);
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
 *                   example: "Admin créé avec succès"
 *                 admin:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 2
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "admin@example.com"
 *                     fullName:
 *                       type: string
 *                       example: "Jane Admin"
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
 *                   example: "Erreur lors de la création de l'admin"
 */
router.post('/create-admin', requireOwner, async (req, res) => {
  const { email, password, fullName, gymId } = req.body;

  if (!email || !password || !fullName || !gymId) {
    return res.status(400).json({ error: 'Email, password, fullName et gymId requis' });
  }

  const sanitizedEmail = sanitizeEmail(email);

  try {
    // Vérifier que l'email n'existe pas déjà
    const existingUser = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (existingUser) {
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
      data: { userId: user.id }
    });

    // Générer et stocker le QR code
    try {
      const gym = await prisma.gym.findUnique({ where: { id: gymId } });
      const qrData = JSON.stringify({
        userId: user.id,
        uniqueCode: user.uniqueCode,
        fullName: user.fullName,
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

      console.log(`✅ QR code généré et stocké pour admin ${user.fullName}`);
    } catch (qrError) {
      console.error(`⚠️ Erreur génération QR code pour admin ${user.fullName}:`, qrError);
    }

    res.status(201).json({
      message: 'Admin créé avec succès',
      admin: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      }
    });
  } catch (error) {
    console.error('Erreur création admin:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'admin' });
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
router.get('/gyms/all', requireOwner, async (req, res) => {
  try {
    const gyms = await prisma.gym.findMany({
      include: {
        users: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          }
        },
        _count: {
          select: { users: true }
        }
      }
    });

    res.json({ gyms });
  } catch (error) {
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
router.get('/stats', requireOwner, async (req, res) => {
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

    res.json({
      stats: {
        totalGyms,
        totalUsers,
        totalAdmins,
        totalMembers,
        totalOwners,
        totalPayments,
        totalRevenue: totalRevenue._sum.amount || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;