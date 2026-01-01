const express = require('express');
const router = express.Router();
const { formatUser } = require('../utils/responseFormatter');
const prisma = require('../utils/prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail, sendAccountSetupEmail } = require('../services/emailService');
const { getActiveSubscription, getSubscriptionsWithStatus } = require('../utils/subscriptionUtils');
const { getFullName, formatUserWithFullName } = require('../utils/nameUtils');
const { authLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// Protected routes middleware
const auth = require('../middleware/auth');

// Helper function to sanitize email input
const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return email;
  // Remove null bytes and control characters that can cause PostgreSQL encoding errors
  return email.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim().toLowerCase();
};

/**
 * @swagger
 * /auth/check-phone:
 *   post:
 *     summary: Vérifier si un numéro de téléphone existe
 *     description: Vérifie si un numéro de téléphone est déjà enregistré et si un mot de passe est configuré
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+33612345678"
 *     responses:
 *       200:
 *         description: Numéro vérifié avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                   example: true
 *                 hasPassword:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Ce numéro existe déjà avec un mot de passe configuré"
 *       400:
 *         description: Numéro de téléphone manquant
 *       500:
 *         description: Erreur serveur
 */
router.post('/check-phone', authLimiter, async (req, res) => {
  const { phoneNumber } = req.body;
  logger.info(`📱 Vérification numéro de téléphone - PhoneNumber: ${phoneNumber}`);
  
  if (!phoneNumber) {
    logger.warn(`❌ Numéro de téléphone manquant`);
    return res.status(400).json({ error: 'Numéro de téléphone requis' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
      select: {
        id: true,
        phoneNumber: true,
        password: true,
        email: true
      }
    });

    if (!user) {
      logger.info(`✅ Numéro ${phoneNumber} n'existe pas - Création possible`);
      return res.json({
        exists: false,
        hasPassword: false,
        message: 'Ce numéro n\'est pas encore enregistré'
      });
    }

    // Vérifier si le mot de passe est configuré
    // Un mot de passe temporaire long (généré automatiquement) indique qu'aucun mot de passe n'a été défini
    const hasPassword = user.password && user.password.length > 0;

    logger.warn(`⚠️ Numéro ${phoneNumber} existe déjà - hasPassword: ${hasPassword}`);
    
    if (hasPassword) {
      return res.status(409).json({
        exists: true,
        hasPassword: true,
        error: 'Vous avez déjà un compte avec un mot de passe. Si vous l\'avez oublié, cliquez sur "Réinitialiser le mot de passe"',
        hasEmail: !!user.email
      });
    } else {
      return res.json({
        exists: true,
        hasPassword: false,
        message: 'Ce numéro existe mais aucun mot de passe n\'est configuré'
      });
    }

  } catch (e) {
    logger.error(`💥 Erreur vérification numéro de téléphone:`, e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     description: Authentifie un utilisateur avec email ou numéro de téléphone et retourne un token JWT
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@teamfitness.com"
 *               phoneNumber:
 *                 type: string
 *                 example: "+33612345678"
 *               password:
 *                 type: string
 *                 example: "admin123"
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIs..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       example: "admin@teamfitness.com"
 *                     fullName:
 *                       type: string
 *                       example: "Admin TeamFitness"
 *                     role:
 *                       type: string
 *                       enum: [admin, member, owner]
 *                       example: "admin"
 *                     type:
 *                       type: string
 *                       enum: [admin, member, owner]
 *                       example: "admin"
 *       400:
 *         description: Données manquantes
 *       401:
 *         description: Identifiants invalides
 *       500:
 *         description: Erreur serveur
 */
// Login: expect { email or phoneNumber, password }
router.post('/login', authLimiter, async (req, res) => {
  const { email, phoneNumber, password } = req.body;
  const identifier = email || phoneNumber;
  logger.info(`🔐 Tentative de connexion - Identifiant: ${identifier}`);
  
  if ((!email && !phoneNumber) || !password) {
    logger.warn(`❌ Connexion échouée - Identifiant ou password manquant`);
    return res.status(400).json({ error: 'email or phoneNumber and password required' });
  }

  try {
    let user;
    
    // Find user by email or phoneNumber
    if (email) {
      const sanitizedEmail = sanitizeEmail(email);
      if (sanitizedEmail !== email.toLowerCase().trim()) {
        logger.warn(`⚠️  Email contenait des caractères invalides, nettoyé: ${sanitizedEmail}`);
      }
      user = await prisma.user.findUnique({
        where: { email: sanitizedEmail },
        include: {
          Admin: true,
          Member: {
            include: {
              Subscription: {
                include: {
                  Payment: true
                }
              },
              Payment: true
            }
          },
          Gym: true
        }
      });
    } else if (phoneNumber) {
      user = await prisma.user.findUnique({
        where: { phoneNumber: phoneNumber },
        include: {
          Admin: true,
          Member: {
            include: {
              Subscription: {
                include: {
                  Payment: true
                }
              },
              Payment: true
            }
          },
          Gym: true
        }
      });
    }

    if (!user) {
      logger.warn(`❌ Connexion échouée - Utilisateur non trouvé: ${identifier}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logger.info(`✅ Utilisateur trouvé: ${getFullName(user)} (${user.role}) - ID: ${user.id}`);

    // Check password
    const valid = await bcrypt.compare(password, user.password);
    logger.debug(`🔍 Vérification password: ${valid ? '✅ VALIDE' : '❌ INVALIDE'}`);

    if (!valid) {
      logger.warn(`❌ Connexion échouée - Mot de passe incorrect pour: ${identifier}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logger.info(`✅ Connexion réussie pour: ${getFullName(user)} (${user.role})`);

    // Récupérer le statut onboarding du membre (seulement pour les membres)
    const onboarding = user.role === 'member' ? (user.Member?.onboarding || false) : false;
    logger.debug(`🔔 Onboarding requis: ${onboarding ? 'OUI ✨' : 'NON'}`);

    // Mettre à jour la date de dernière connexion
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Token valid for 30 days
    const token = jwt.sign({
      sub: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      type: user.role,
      gymId: user.gymId // Ajouter gymId dans le token
    }, JWT_SECRET, { expiresIn: '30d' });

    logger.debug(`🎫 Token JWT généré pour: ${user.email}`);

    // Return different data based on user role
    if (user.role === 'admin') {
      logger.info(`👨‍💼 Réponse admin préparée pour: ${getFullName(user)}`);
      const responseData = {
        
        token,
        onboarding,
        user: {
          id: user.id,
          displayId: user.displayId,
          email: user.email,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: getFullName(user),
          role: user.role,
          gymId: user.gymId,
          gym: user.Gym,
          fcmToken: user.fcmToken,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          type: 'admin'
        }
      };
      logger.debug(`📤 Réponse login admin: ${JSON.stringify({
        token: token.substring(0, 20) + '...',
        user: responseData.user
      })}`);
      res.json(responseData);
    } else if (user.role === 'owner') {
      logger.info(`👑 Réponse owner préparée pour: ${getFullName(user)}`);
      const responseData = {
        token,
        onboarding,
        user: {
          id: user.id,
          displayId: user.displayId,
          email: user.email,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: getFullName(user),
          role: user.role,
          gymId: user.gymId,
          gym: user.Gym,
          fcmToken: user.fcmToken,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          permissions: {
            canManageAdmins: user.Owner?.canManageAdmins || false,
            canManageGyms: user.Owner?.canManageGyms || false,
            canViewReports: user.Owner?.canViewReports || false,
            maxGymsAllowed: user.Owner?.maxGymsAllowed || 0,
          },
          type: 'owner'
        }
      };
      logger.debug(`📤 Réponse login owner: ${JSON.stringify({
        token: token.substring(0, 20) + '...',
        user: responseData.user
      })}`);
      res.json(responseData);
    } else if (user.role === 'member') {
      logger.info(`👤 Réponse membre préparée pour: ${getFullName(user)}`);
      const responseData = {
        token,
        onboarding,
        user: {
          id: user.id,
          displayId: user.displayId,
          email: user.email,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: getFullName(user),
          role: user.role,
          gymId: user.gymId,
          gym: user.Gym,
          fcmToken: user.fcmToken,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          profileImage: user.profileImage ? Buffer.from(user.profileImage).toString('base64') : null,
          qrCode: user.qrCode ? Buffer.from(user.qrCode).toString('base64') : null,
          member: {
            onboarding: user.Member?.onboarding,
            birthDate: user.Member?.birthDate,
            profession: user.Member?.profession,
            fitnessLevel: user.Member?.fitnessLevel,
            preferredTrainingDays: user.Member?.preferredTrainingDays,
            joinedAt: user.Member?.joinedAt,
          },
          subscriptions: user.Member?.Subscription || [],
          payments: user.Member?.Payment || [],
          type: 'member'
        }
      };
      logger.debug(`📤 Réponse login membre: ${JSON.stringify({
        token: token.substring(0, 20) + '...',
        user: responseData.user
      })}`);
      res.json(responseData);
    } else {
      logger.warn(`❓ Rôle inconnu: ${user.role} pour ${getFullName(user)}`);
      return res.status(400).json({ error: 'Invalid user role' });
    }
  } catch (e) {
    logger.error(`💥 Erreur lors de la connexion:`, e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * @swagger
 * /auth/scan-qr:
 *   post:
 *     summary: Scanner un QR code d'accès
 *     description: Permet à un admin de scanner le QR code d'un membre pour valider l'accès à la salle
 *     tags: [QR Code]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qrCode
 *             properties:
 *               qrCode:
 *                 type: string
 *                 example: "ABC123"
 *                 description: "Code unique du membre"
 *     responses:
 *       200:
 *         description: Accès autorisé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 member:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 2
 *                     fullName:
 *                       type: string
 *                       example: "Bob Member"
 *                     email:
 *                       type: string
 *                       example: "bob@example.com"
 *                     uniqueCode:
 *                       type: string
 *                       example: "ABC123"
 *                     subscription:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                           example: "premium"
 *                         endDate:
 *                           type: string
 *                           format: date-time
 *                         lastPayment:
 *                           type: string
 *                           format: date-time
 *                 message:
 *                   type: string
 *                   example: "Access granted"
 *       400:
 *         description: QR code invalide ou pas pour un membre
 *       403:
 *         description: Permissions insuffisantes ou membre d'une autre salle
 *       404:
 *         description: Membre non trouvé
 *       500:
 *         description: Erreur serveur
 */
// Protected: scan QR code for access
router.post('/scan-qr', auth, async (req, res) => {
  // Support à la fois qrCode et qrData pour rétrocompatibilité
  let qrCodeRaw = req.body.qrCode || req.body.qrData;
  
  try {
    if (!qrCodeRaw) {
      logger.warn(`❌ QR code manquant dans la requête`);
      return res.status(400).json({ error: 'QR code is required', field: 'qrCode or qrData' });
    }

    // Parser le QR code si c'est un JSON string ou un objet
    let qrData;
    let displayId;

    if (typeof qrCodeRaw === 'string') {
      try {
        qrData = JSON.parse(qrCodeRaw);
        displayId = qrData.displayId || qrCodeRaw; // Utiliser displayId du JSON ou le string brut
      } catch (e) {
        displayId = qrCodeRaw; // Si ce n'est pas du JSON, utiliser tel quel
      }
    } else if (typeof qrCodeRaw === 'object') {
      qrData = qrCodeRaw;
      displayId = qrData.displayId;
    } else {
      displayId = String(qrCodeRaw);
    }

    logger.info(`📱 Scan QR - User ID: ${req.user?.sub}, Email: ${req.user?.email}, GymID: ${req.user?.gymId}, DisplayID: ${displayId}`);

    // Vérifier que l'utilisateur est un admin
    if (req.user.type !== 'admin') {
      logger.warn(`❌ Accès refusé: utilisateur ${req.user.email} n'est pas admin (type: ${req.user.type})`);
      return res.status(403).json({ error: 'Only admins can scan QR codes' });
    }

    // Vérifier que l'admin a un gymId
    if (!req.user.gymId) {
      logger.error(`❌ Admin ${req.user.email} n'a pas de gymId configuré - Token doit être régénéré`);
      return res.status(403).json({ 
        error: 'Admin account not properly configured - missing gymId',
        message: 'Please log in again to get a new token with gymId'
      });
    }

    // Trouver l'utilisateur par son displayId
    const member = await prisma.user.findFirst({
      where: { displayId },
      include: {
        Member: {
          include: {
            Subscription: {
              where: { status: 'active' },
              include: {
                Payment: {
                  orderBy: { createdAt: 'desc' },
                  take: 1 // Dernier paiement de l'abonnement
                }
              }
            },
          }
        },
        Gym: true
      }
    });

    if (!member) {
      logger.warn(`❌ Membre non trouvé avec displayId: ${displayId}`);
      return res.status(404).json({ error: 'Member not found', displayId });
    }

    if (member.role !== 'member') {
      logger.warn(`❌ Utilisateur trouvé mais n'est pas membre: ${getFullName(member)} (rôle: ${member.role})`);
      return res.status(400).json({ error: 'QR code is not for a member' });
    }

    // Vérifier que le membre appartient à la même salle que l'admin
    if (member.gymId !== req.user.gymId) {
      logger.warn(`❌ Membre ${getFullName(member)} n'appartient pas à la salle de l'admin (membre: ${member.gymId}, admin: ${req.user.gymId})`);
      return res.status(403).json({ error: 'Member does not belong to your gym' });
    }

    // Vérifier l'abonnement actif pour les membres
    if (member.role === 'member') {
      // Debug: vérifier ce qui est récupéré
      logger.info(`🔍 Debug member.Member: ${JSON.stringify({
        userId: member.Member?.userId,
        hasSubscription: !!member.Member?.Subscription,
        hasSubscriptions: !!member.Member?.subscriptions,
        SubscriptionLength: member.Member?.Subscription?.length,
        subscriptionsLength: member.Member?.subscriptions?.length
      })}`);
      
      if (!member.Member) {
        logger.error(`❌ Membre ${getFullName(member)} n'a pas de profil Member en base`);
        return res.status(500).json({
          error: 'Member profile not found in database',
          message: 'Please contact support'
        });
      }

      const activeSubscription = getActiveSubscription(member.Member);

      if (!activeSubscription) {
        logger.warn(`❌ Membre ${getFullName(member)} n'a pas d'abonnement actif - Subscriptions: ${member.Member.Subscription?.length || 0}`);
        return res.status(403).json({
          error: 'Accès refusé - Aucun abonnement actif',
          reason: 'no_active_subscription',
          member: {
            id: member.userId,
            fullName: getFullName(member),
            email: member.email
          }
        });
      }

      logger.info(`✅ Abonnement valide pour ${getFullName(member)} - Statut: ${activeSubscription.activeCheck.details ? 'Paiement dû dans ' + activeSubscription.activeCheck.details.daysUntilDue + ' jours' : 'Actif'}`);
    }

    logger.info(`✅ Accès autorisé pour ${getFullName(member)}`);

    // Enregistrer l'accès
    await prisma.accessLog.create({
      data: {
        memberId: member.Member.userId,
        adminId: req.user.sub,
        gymId: req.user.gymId,
        accessType: 'qr_scan'
      }
    });

    // Récupérer le quota complet de l'abonnement actif
    const activeSubscription = getActiveSubscription(member.Member);
    let quota = null;
    
    if (activeSubscription) {
      const checkInService = require('../services/checkInService');
      try {
        quota = await checkInService.getSubscriptionQuota(activeSubscription.id);
      } catch (error) {
        logger.error(`❌ Erreur lors de la récupération du quota:`, error);
      }
    }

    // Récupérer le dernier check-in du membre
    const lastCheckIn = await prisma.gymCheckIn.findFirst({
      where: { memberId: member.userId },
      orderBy: { checkInTime: 'desc' },
      include: { 
        Gym: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Générer un message contextuel
    let message = 'Accès autorisé';
    if (quota) {
      if (quota.isUnlimited) {
        message = 'Accès autorisé - Séances illimitées';
      } else if (quota.canCheckIn) {
        message = `Accès autorisé - ${quota.sessionsRemaining} séance(s) restante(s)`;
      } else {
        message = 'Quota épuisé - Renouvellement nécessaire';
      }
    }

    const responseData = {
      success: true,
      member: {
        id: member.userId,
        fullName: getFullName(member),
        email: member.email,
        displayId: member.displayId,
        profileImageUrl: member.profileImage || null,
        subscription: activeSubscription
      },
      quota: quota ? {
        sessionQuota: quota.sessionQuota,
        sessionsUsed: quota.sessionsUsed,
        sessionsRemaining: quota.sessionsRemaining,
        isUnlimited: quota.isUnlimited,
        percentageUsed: quota.percentageUsed,
        canCheckIn: quota.canCheckIn
      } : null,
      lastCheckIn: lastCheckIn ? {
        checkInTime: lastCheckIn.checkInTime,
        gymName: lastCheckIn.Gym?.name || 'N/A'
      } : null,
      message
    };

    logger.info(`📤 Réponse scan-qr: succès - ${message}`);
    res.json(responseData);

  } catch (e) {
    logger.error(`💥 Erreur dans /scan-qr:`, e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Profil utilisateur connecté
 *     description: Retourne les informations de l'utilisateur actuellement connecté
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil utilisateur
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
 *                   example: "admin@teamfitness.com"
 *                 fullName:
 *                   type: string
 *                   example: "Admin TeamFitness"
 *                 uniqueCode:
 *                   type: string
 *                   example: "ABC123"
 *                 gym:
 *                   $ref: '#/components/schemas/Gym'
 *                 type:
 *                   type: string
 *                   enum: [admin, member, owner]
 *                   example: "admin"
 *                 permissions:
 *                   type: object
 *                   description: "Uniquement pour les owners"
 *                 activeSubscription:
 *                   type: object
 *                   description: "Uniquement pour les members"
 *                 recentPayments:
 *                   type: array
 *                   description: "Uniquement pour les members"
 *       401:
 *         description: Token manquant ou invalide
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur serveur
 */
// Protected: return current user info (admin or member)
router.get('/me', auth, async (req, res) => {
  logger.info(`👤 Requête /me - User ID du token: ${req.user?.sub}, Email: ${req.user?.email}, Type: ${req.user?.type}`);

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: {
        Gym: true,
        Admin: true,
        Member: {
          include: {
            Subscription: {
              where: { status: 'active' },
              include: {
                Payment: {
                  orderBy: { createdAt: 'desc' },
                  take: 5 // Derniers 5 paiements liés à l'abonnement
                }
              }
            },
            Payment: {
              orderBy: { createdAt: 'desc' },
              take: 10 // Derniers 10 paiements du membre
            }
          }
        },
        Owner: true
      }
    });

    if (!user) {
      logger.warn(`❌ Utilisateur non trouvé en base: ID ${req.user.sub}`);
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`✅ Utilisateur trouvé: ${getFullName(user)} (${user.role}) - ID: ${user.id}`);

    if (user.role === 'admin') {
      // Pour les admins : retourner leur salle
      const responseData = {
        id: user.id,
        displayId: user.displayId,
        email: user.email,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: getFullName(user),
        uniqueCode: user.uniqueCode,
        role: user.role,
        gymId: user.gymId,
        gym: user.Gym,
        fcmToken: user.fcmToken,
        profileImage: user.profileImage ? Buffer.from(user.profileImage).toString('base64') : null,
        qrCode: user.qrCode ? Buffer.from(user.qrCode).toString('base64') : null,
        lastLoginAt: user.lastLoginAt,
        notificationsEnabled: user.notificationsEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        type: 'admin'
      };
      logger.info(`📤 Réponse /me admin envoyée`);
      res.json(responseData);
    } else if (user.role === 'owner') {
      // Pour les owners : retourner toutes les salles avec statistiques
      const allGyms = await prisma.gym.findMany({
        include: {
          User: {
            select: {
              role: true
            }
          },
          _count: {
            select: {
              User: true
            }
          }
        }
      });

      // Calculer les statistiques pour chaque salle
      const gymsWithStats = allGyms.map(gym => ({
        id: gym.id,
        name: gym.name,
        address: gym.address,
        phone: gym.phone,
        latitude: gym.latitude,
        longitude: gym.longitude,
        createdAt: gym.createdAt,
        updatedAt: gym.updatedAt,
        stats: {
          totalUsers: gym._count.User,
          members: gym.User.filter(u => u.role === 'member').length,
          admins: gym.User.filter(u => u.role === 'admin').length,
          owners: gym.User.filter(u => u.role === 'owner').length
        }
      }));

      const responseData = {
        id: user.id,
        displayId: user.displayId,
        email: user.email,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: getFullName(user),
        uniqueCode: user.uniqueCode,
        role: user.role,
        gymId: user.gymId,
        gym: user.Gym,
        gyms: gymsWithStats,
        fcmToken: user.fcmToken,
        profileImage: user.profileImage ? Buffer.from(user.profileImage).toString('base64') : null,
        qrCode: user.qrCode ? Buffer.from(user.qrCode).toString('base64') : null,
        lastLoginAt: user.lastLoginAt,
        notificationsEnabled: user.notificationsEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        permissions: {
          canManageAdmins: user.Owner?.canManageAdmins || false,
          canManageGyms: user.Owner?.canManageGyms || false,
          canViewReports: user.Owner?.canViewReports || false,
          maxGymsAllowed: user.Owner?.maxGymsAllowed || 0,
        },
        type: 'owner'
      };
      logger.info(`📤 Réponse /me owner envoyée`);
      res.json(responseData);
    } else if (user.role === 'member') {
      // Pour les membres : abonnement actif + derniers paiements
      const activeSubscription = getActiveSubscription(user.Member);
      const subscriptionsWithStatus = getSubscriptionsWithStatus(user.Member);

      const responseData = {
        id: user.id,
        displayId: user.displayId,
        email: user.email,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: getFullName(user),
        uniqueCode: user.uniqueCode,
        role: user.role,
        gymId: user.gymId,
        gym: user.Gym,
        fcmToken: user.fcmToken,
        profileImage: user.profileImage ? Buffer.from(user.profileImage).toString('base64') : null,
        qrCode: user.qrCode ? Buffer.from(user.qrCode).toString('base64') : null,
        lastLoginAt: user.lastLoginAt,
        notificationsEnabled: user.notificationsEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        member: {
          onboarding: user.Member?.onboarding,
          birthDate: user.Member?.birthDate,
          profession: user.Member?.profession,
          fitnessLevel: user.Member?.fitnessLevel,
          preferredTrainingDays: user.Member?.preferredTrainingDays,
          workoutNotificationsEnabled: user.Member?.workoutNotificationsEnabled,
          joinedAt: user.Member?.joinedAt,
        },
        activeSubscription: activeSubscription,
        subscriptions: subscriptionsWithStatus,
        recentPayments: user.Member?.Payment || [],
        type: 'member'
      };
      logger.info(`📤 Réponse /me membre envoyée`);
      res.json(responseData);
    } else {
      logger.warn(`❓ Rôle inconnu: ${user.role} pour ${getFullName(user)}`);
      return res.status(400).json({ error: 'Invalid user role' });
    }
  } catch (e) {
    logger.error(`💥 Erreur dans /me:`, e);
    res.status(500).json({ error: e.message });
  }
});

// Forgot password: expect { email or phoneNumber } - For admins and members
/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     description: Send a password reset code to the user's email address (requires email)
 *     tags: [Authentication]
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
 *                 description: User's email address
 *                 example: "user@example.com"
 *               phoneNumber:
 *                 type: string
 *                 description: User's phone number (email must exist for reset)
 *                 example: "+33612345678"
 *     responses:
 *       200:
 *         description: Reset code sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Si cet email existe, un code de réinitialisation a été envoyé"
 *       400:
 *         description: Email or phoneNumber is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Email ou phoneNumber requis"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Erreur lors de l'envoi du code"
 */
router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email, phoneNumber } = req.body;
  if (!email && !phoneNumber) return res.status(400).json({ error: 'Email ou phoneNumber requis' });

  try {
    let user;
    
    // Find user by email or phoneNumber
    if (email) {
      const sanitizedEmail = sanitizeEmail(email);
      user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    } else if (phoneNumber) {
      user = await prisma.user.findUnique({ where: { phoneNumber } });
    }
    
    if (!user) {
      // Pour sécurité, on ne révèle pas si l'identifiant existe ou pas
      return res.json({ message: 'Si cet identifiant existe, un code de réinitialisation a été envoyé' });
    }
    
    // Vérifier que l'utilisateur a un email pour recevoir le code
    if (!user.email) {
      return res.status(400).json({ error: 'Cet utilisateur n\'a pas d\'email configuré. Contactez un administrateur.' });
    }

    // Générer un token unique (6 chiffres)
    const resetToken = crypto.randomInt(100000, 999999).toString();

    // Créer le token en base avec expiration dans 1 heure
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 heure
      },
    });

    // Envoyer l'email
    await sendPasswordResetEmail(user.email, resetToken);

    const responseData = { message: 'Code de réinitialisation envoyé par email' };
    logger.info(`📤 Réponse forgot-password:`, responseData);
    res.json(responseData);
  } catch (e) {
    logger.error('Erreur forgot password:', e);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du code' });
  }
});

// Reset password: expect { email or phoneNumber, token, newPassword }
/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     description: Reset user password using the reset token sent via email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "user@example.com"
 *               phoneNumber:
 *                 type: string
 *                 description: User's phone number
 *                 example: "+33612345678"
 *               token:
 *                 type: string
 *                 description: 6-digit reset token
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: New password (minimum 6 characters)
 *                 example: "newpassword123"
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Mot de passe réinitialisé avec succès"
 *       400:
 *         description: Invalid input or token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     missing_fields:
 *                       value: "Email ou phoneNumber, token et nouveau mot de passe requis"
 *                     weak_password:
 *                       value: "Le mot de passe doit contenir au moins 6 caractères"
 *                     invalid_token:
 *                       value: "Token invalide ou expiré"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Utilisateur non trouvé"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Erreur lors de la réinitialisation"
 */
router.post('/reset-password', authLimiter, async (req, res) => {
  const { email, phoneNumber, token, newPassword } = req.body;
  if ((!email && !phoneNumber) || !token || !newPassword) {
    return res.status(400).json({ error: 'Email ou phoneNumber, token et nouveau mot de passe requis' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  try {
    let user;
    
    // Find user by email or phoneNumber
    if (email) {
      const sanitizedEmail = sanitizeEmail(email);
      user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    } else if (phoneNumber) {
      user = await prisma.user.findUnique({ where: { phoneNumber } });
    }
    
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    // Vérifier le token
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        token: token,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!resetToken) {
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Marquer le token comme utilisé
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    // Supprimer tous les autres tokens non utilisés pour cet utilisateur
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: { used: true },
    });

    const responseData = { message: 'Mot de passe réinitialisé avec succès' };
    logger.info(`📤 Réponse reset-password: ${JSON.stringify(responseData)}`);
    res.json(responseData);
  } catch (e) {
    logger.error('Erreur reset password:', e);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
  }
});

// Send account setup email (envoyer un email pour créer le mot de passe initial)
/**
 * @swagger
 * /auth/send-setup-email:
 *   post:
 *     summary: Send account setup email
 *     description: Send an email to a new user with a token to set up their password. Admins/Owners can send to any user in their gym, or specify userId.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
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
 *                 description: User's email address
 *                 example: "newuser@example.com"
 *               userId:
 *                 type: integer
 *                 description: User ID (alternative to email)
 *                 example: 5
 *     responses:
 *       200:
 *         description: Setup email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Email de configuration envoyé à newuser@example.com"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     fullName:
 *                       type: string
 *       400:
 *         description: Email or userId is required
 *       403:
 *         description: Permission denied
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/send-setup-email', auth, authLimiter, async (req, res) => {
  const { email, userId } = req.body;
  logger.info(`📧 Envoi email de configuration - Email: ${email}, UserId: ${userId}, Requester: ${req.user.email} (${req.user.type})`);

  if (!email && !userId) {
    logger.warn(`❌ Email ou userId requis`);
    return res.status(400).json({ error: 'Email ou userId requis' });
  }

  try {
    // Find user
    const whereClause = userId ? { id: userId } : { email: sanitizeEmail(email) };
    const user = await prisma.user.findUnique({ 
      where: whereClause,
      include: { Gym: true }
    });

    if (!user) {
      logger.warn(`❌ Utilisateur non trouvé`);
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier les permissions
    if (req.user.type === 'admin') {
      // Les admins peuvent seulement envoyer aux membres de leur salle
      if (user.gymId !== req.user.gymId) {
        logger.warn(`❌ Permission refusée - Utilisateur d'une autre salle`);
        return res.status(403).json({ error: 'Vous ne pouvez envoyer d\'emails qu\'aux membres de votre salle' });
      }
    } else if (req.user.type === 'member') {
      // Les membres ne peuvent envoyer qu'à eux-mêmes
      if (user.id !== req.user.sub) {
        logger.warn(`❌ Permission refusée - Les membres ne peuvent pas envoyer d'emails à d'autres`);
        return res.status(403).json({ error: 'Permission refusée' });
      }
    }
    // Les owners peuvent envoyer à n'importe qui

    // Générer un token unique (6 chiffres)
    const setupToken = crypto.randomInt(100000, 999999).toString();

    // Supprimer les anciens tokens non utilisés pour cet utilisateur
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        used: false,
      },
    });

    // Créer le token en base avec expiration dans 24 heures
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: setupToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 heures
      },
    });

    // Envoyer l'email avec le nouveau service
    await sendAccountSetupEmail(user.email, getFullName(user), setupToken);

    logger.info(`✅ Email de configuration envoyé à ${user.email}`);
    res.json({ 
      message: `Email de configuration envoyé à ${user.email}`,
      user: {
        id: user.id,
        email: user.email,
        fullName: getFullName(user),
        gym: user.Gym.name
      }
    });
  } catch (e) {
    logger.error('Erreur send-setup-email:', e);
    res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
  }
});

// Setup password (créer le mot de passe initial)
/**
 * @swagger
 * /auth/setup-password:
 *   post:
 *     summary: Setup initial password
 *     description: Set up password for a new user account using the token sent via email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "newuser@example.com"
 *               phoneNumber:
 *                 type: string
 *                 description: User's phone number
 *                 example: "+33612345678"
 *               token:
 *                 type: string
 *                 description: 6-digit setup token
 *                 example: "123456"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: New password (minimum 6 characters)
 *                 example: "mypassword123"
 *     responses:
 *       200:
 *         description: Password created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Mot de passe créé avec succès"
 *       400:
 *         description: Invalid input or token
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/setup-password', authLimiter, async (req, res) => {
  const { email, phoneNumber, token, password } = req.body;
  logger.info(`🔐 Création mot de passe initial - Email: ${email}, PhoneNumber: ${phoneNumber}`);

  if ((!email && !phoneNumber) || !token || !password) {
    logger.warn(`❌ Champs manquants`);
    return res.status(400).json({ error: 'Email ou phoneNumber, token et mot de passe requis' });
  }

  if (password.length < 6) {
    logger.warn(`❌ Mot de passe trop court`);
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  try {
    let user;
    
    // Find user by email or phoneNumber
    if (email) {
      const sanitizedEmail = sanitizeEmail(email);
      user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    } else if (phoneNumber) {
      user = await prisma.user.findUnique({ where: { phoneNumber } });
    }
    
    if (!user) {
      logger.warn(`❌ Utilisateur non trouvé: ${email || phoneNumber}`);
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier le token
    const setupToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        token: token,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!setupToken) {
      logger.warn(`❌ Token invalide ou expiré`);
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Marquer le token comme utilisé
    await prisma.passwordResetToken.update({
      where: { id: setupToken.id },
      data: { used: true },
    });

    logger.info(`✅ Mot de passe créé pour ${user.email || user.phoneNumber}`);
    res.json({ message: 'Mot de passe créé avec succès' });
  } catch (e) {
    logger.error('Erreur setup-password:', e);
    res.status(500).json({ error: 'Erreur lors de la création du mot de passe' });
  }
});

module.exports = router;
