const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetNotification } = require('../services/notificationService');
const { getActiveSubscription, getSubscriptionsWithStatus } = require('../utils/subscriptionUtils');
const prisma = require('../utils/prismaClient');
const { authLimiter } = require('../middleware/rateLimiter');

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
 * /auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     description: Authentifie un utilisateur et retourne un token JWT
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@teamfitness.com"
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
 *                     firstName, lastName:
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
// Login: expect { email, password } or { phoneNumber, password }
router.post('/login', authLimiter, async (req, res) => {
  const { email, phoneNumber, password } = req.body;
  console.log(`🔐 Tentative de connexion - Email: ${email}, Phone: ${phoneNumber}`);
  
  if ((!email && !phoneNumber) || !password) {
    console.log(`❌ Connexion échouée - Email/Phone ou password manquant`);
    return res.status(400).json({ error: 'email or phoneNumber and password required' });
  }

  // Sanitize email to remove any null bytes or control characters
  const sanitizedEmail = email ? sanitizeEmail(email) : null;
  
  if (email && sanitizedEmail !== email.toLowerCase().trim()) {
    console.log(`⚠️  Email contenait des caractères invalides, nettoyé: ${sanitizedEmail}`);
  }

  try {
    // Find user by email or phoneNumber
    const user = await prisma.user.findFirst({
      where: email ? { email: sanitizedEmail } : { phoneNumber },
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

    if (!user) {
      console.log(`❌ Connexion échouée - Utilisateur non trouvé: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`✅ Utilisateur trouvé: ${user.firstName} ${user.lastName} (${user.role}) - ID: ${user.id}`);

    // Check password
    const valid = await bcrypt.compare(password, user.password);
    console.log(`🔍 Vérification password: ${valid ? '✅ VALIDE' : '❌ INVALIDE'}`);

    if (!valid) {
      console.log(`❌ Connexion échouée - Mot de passe incorrect pour: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`✅ Connexion réussie pour: ${user.firstName} ${user.lastName} (${user.role})`);

    // Generate a unique session ID — invalidates any previous session on another device
    const sessionId = crypto.randomUUID();

    // Persist session ID so the auth middleware can verify single-device constraint
    await prisma.user.update({
      where: { id: user.id },
      data: { currentSessionId: sessionId, lastLoginAt: new Date() }
    });

    // Token valid for 30 days
    const token = jwt.sign({
      sub: user.id,
      email: user.email,
      type: user.role,
      sessionId
    }, JWT_SECRET, { expiresIn: '30d' });

    console.log(`🎫 Token JWT généré pour: ${user.email}`);

    // Return different data based on user role
    if (user.role === 'admin') {
      console.log(`👨‍💼 Réponse admin préparée pour: ${user.firstName} ${user.lastName}`);
      const responseData = {
        token,
        user: {
          id: user.id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName, lastName: user.lastName,
          role: 'admin',
          gymId: user.gymId,
          gym: user.Gym,
          type: 'admin'
        }
      };
      console.log(`📤 Réponse login admin:`, {
        token: token.substring(0, 20) + '...',
        user: responseData.user
      });
      res.json(responseData);
    } else if (user.role === 'owner') {
      console.log(`👑 Réponse owner préparée pour: ${user.firstName} ${user.lastName}`);
      const responseData = {
        token,
        user: {
          id: user.id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName, lastName: user.lastName,
          role: 'owner',
          gymId: user.gymId,
          gym: user.Gym,
          permissions: {
            canManageAdmins: user.owner?.canManageAdmins || false,
            canManageGyms: user.owner?.canManageGyms || false,
            canViewReports: user.owner?.canViewReports || false,
            maxGymsAllowed: user.owner?.maxGymsAllowed || 0,
          },
          type: 'owner'
        }
      };
      console.log(`� Réponse login owner:`, {
        token: token.substring(0, 20) + '...',
        user: responseData.user
      });
      res.json(responseData);
    } else if (user.role === 'member') {
      console.log(`👤 Réponse membre préparée pour: ${user.firstName} ${user.lastName}`);
      const responseData = {
        token,
        user: {
          id: user.id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName, lastName: user.lastName,
          role: 'member',
          gymId: user.gymId,
          gym: user.Gym,
          member: user.Member,
          subscriptions: user.Member?.Subscription || [],
          payments: user.Member?.Payment || [],
          type: 'member'
        }
      };
      console.log(`📤 Réponse login membre:`, {
        token: token.substring(0, 20) + '...',
        user: responseData.user
      });
      res.json(responseData);
    } else {
      console.log(`❓ Rôle inconnu: ${user.role} pour ${user.firstName} ${user.lastName}`);
      return res.status(400).json({ error: 'Invalid user role' });
    }
  } catch (e) {
    console.error(`💥 Erreur lors de la connexion:`, e);
    res.status(500).json({ error: 'Internal server error' });
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
 *                     firstName, lastName:
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
  const { qrCode } = req.body;
  console.log(`📱 Scan QR - User ID: ${req.user?.sub}, Email: ${req.user?.email}, QR Code: ${qrCode}`);

  try {
    // Vérifier que l'utilisateur est un admin
    if (req.user.type !== 'admin') {
      console.log(`❌ Accès refusé: utilisateur ${req.user.email} n'est pas admin (type: ${req.user.type})`);
      return res.status(403).json({ error: 'Only admins can scan QR codes' });
    }

    // Récupérer l'admin avec sa gymId
    const adminUser = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, gymId: true, firstName: true, lastName: true }
    });

    if (!adminUser) {
      console.log(`❌ Admin non trouvé: ID ${req.user.sub}`);
      return res.status(403).json({ error: 'Admin not found' });
    }

    console.log(`✅ Admin trouvé: ${adminUser.firstName} ${adminUser.lastName} (Gym: ${adminUser.gymId})`);

    // Trouver l'utilisateur par son uniqueCode
    const member = await prisma.user.findFirst({
      where: { uniqueCode: qrCode },
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
      console.log(`❌ Membre non trouvé avec QR code: ${qrCode}`);
      return res.status(404).json({ error: 'Member not found' });
    }

    if (member.role !== 'member') {
      console.log(`❌ Utilisateur trouvé mais n'est pas membre: ${member.firstName} ${member.lastName} (rôle: ${member.role})`);
      return res.status(400).json({ error: 'QR code is not for a member' });
    }

    // Vérifier que le membre appartient à la même salle que l'admin
    if (member.gymId !== adminUser.gymId) {
      console.log(`❌ Membre ${member.firstName} ${member.lastName} n'appartient pas à la salle de l'admin (membre: ${member.gymId}, admin: ${adminUser.gymId})`);
      return res.status(403).json({ error: 'Member does not belong to your gym' });
    }

    // Vérifier l'abonnement actif pour les membres
    if (member.role === 'member') {
      const activeSubscription = getActiveSubscription(member.Member);

      if (!activeSubscription) {
        console.log(`❌ Membre ${member.firstName} ${member.lastName} n'a pas d'abonnement actif`);
        return res.status(403).json({
          error: 'Accès refusé - Aucun abonnement actif',
          reason: 'no_active_subscription',
          member: {
            id: member.id,
            firstName: member.firstName, lastName: member.lastName,
            email: member.email
          }
        });
      }

      console.log(`✅ Abonnement valide pour ${member.firstName} ${member.lastName} - Statut: ${activeSubscription.activeCheck.details ? 'Paiement dû dans ' + activeSubscription.activeCheck.details.daysUntilDue + ' jours' : 'Actif'}`);

      console.log(`✅ Accès autorisé pour ${member.firstName} ${member.lastName} - Abonnement valide jusqu'au ${activeSubscription.endDate}`);

      const responseData = {
        success: true,
        member: {
          id: member.id,
          firstName: member.firstName, lastName: member.lastName,
          email: member.email,
          uniqueCode: member.uniqueCode,
          subscription: activeSubscription ? {
            id: activeSubscription.id,
            status: activeSubscription.status,
            endDate: activeSubscription.endDate,
            isActive: activeSubscription.activeCheck.isActive,
            nextPaymentDue: activeSubscription.activeCheck.details?.nextPaymentDue,
            daysUntilDue: activeSubscription.activeCheck.details?.daysUntilDue
          } : null
        },
        message: 'Access granted'
      };

      console.log(`📤 Réponse scan-qr:`, responseData);
      res.json(responseData);
    }

  } catch (e) {
    console.error(`💥 Erreur dans /scan-qr:`, e);
    res.status(500).json({ error: 'Internal server error' });
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
 *                 firstName, lastName:
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
  console.log(`👤 Requête /me - User ID du token: ${req.user?.sub}, Email: ${req.user?.email}, Type: ${req.user?.type}`);

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
      console.log(`❌ Utilisateur non trouvé en base: ID ${req.user.sub}`);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`✅ Utilisateur trouvé: ${user.firstName} ${user.lastName} (${user.role}) - ID: ${user.id}, uniqueCode: ${user.uniqueCode}`);

    if (user.role === 'admin') {
      console.log(`👨‍💼 Réponse admin pour: ${user.firstName} ${user.lastName}`);
      // Pour les admins : retourner leur salle
      const responseData = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        uniqueCode: user.uniqueCode,
        phoneNumber: user.phoneNumber,
        address: user.address,
        profileImage: user.profileImage,
        displayId: user.displayId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        notificationsEnabled: user.notificationsEnabled,
        fcmToken: user.fcmToken,
        role: user.role,
        gymId: user.gymId,
        gym: user.Gym,
        type: 'admin'
      };
      console.log(`📤 Réponse /me admin:`, responseData);
      res.json(responseData);
    } else if (user.role === 'owner') {
      console.log(`👑 Réponse owner pour: ${user.firstName} ${user.lastName}`);
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
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        uniqueCode: user.uniqueCode,
        phoneNumber: user.phoneNumber,
        address: user.address,
        profileImage: user.profileImage,
        displayId: user.displayId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        notificationsEnabled: user.notificationsEnabled,
        fcmToken: user.fcmToken,
        role: user.role,
        gymId: user.gymId,
        gyms: gymsWithStats,
        permissions: {
          canManageAdmins: user.owner?.canManageAdmins || false,
          canManageGyms: user.owner?.canManageGyms || false,
          canViewReports: user.owner?.canViewReports || false,
          maxGymsAllowed: user.owner?.maxGymsAllowed || 0,
        },
        type: 'owner'
      };
      console.log(`📤 Réponse /me owner:`, {
        ...responseData,
        gyms: `${gymsWithStats.length} salles trouvées`
      });
      res.json(responseData);
    } else if (user.role === 'member') {
      console.log(`👤 Réponse membre pour: ${user.firstName} ${user.lastName}`);
      // Pour les membres : abonnement actif + derniers paiements
      const activeSubscription = getActiveSubscription(user.Member);
      const subscriptionsWithStatus = getSubscriptionsWithStatus(user.Member);

      const responseData = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        uniqueCode: user.uniqueCode,
        phoneNumber: user.phoneNumber,
        address: user.address,
        profileImage: user.profileImage,
        displayId: user.displayId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        notificationsEnabled: user.notificationsEnabled,
        fcmToken: user.fcmToken,
        role: user.role,
        gymId: user.gymId,
        gym: user.Gym,
        member: user.Member,
        activeSubscription: activeSubscription,
        subscriptions: subscriptionsWithStatus,
        Subscription: subscriptionsWithStatus,
        recentPayments: user.Member?.Payment || [],
        type: 'member'
      };
      console.log(`📤 Réponse /me membre:`, {
        ...responseData,
        recentPayments: `${responseData.recentPayments?.length || 0} paiements récents`,
        Subscription: `${responseData.Subscription?.length || 0} abonnements`
      });
      res.json(responseData);
    } else {
      console.log(`❓ Rôle inconnu: ${user.role} pour ${user.firstName} ${user.lastName}`);
      return res.status(400).json({ error: 'Invalid user role' });
    }
  } catch (e) {
    console.error(`💥 Erreur dans /me:`, e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password: expect { email } - For admins and members
/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     description: Send a password reset code to the user's email address
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "user@example.com"
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
 *         description: Email is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Email requis"
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
router.post('/forgot-password', async (req, res) => {
  const { email, phoneNumber } = req.body;
  if (!email && !phoneNumber) return res.status(400).json({ error: 'Email or phoneNumber required' });

  const sanitizedEmail = email ? sanitizeEmail(email) : null;

  try {
    // Find user by email or phoneNumber
    const user = await prisma.user.findFirst({ 
      where: email ? { email: sanitizedEmail } : { phoneNumber }
    });
    if (!user) {
      // Pour sécurité, on ne révèle pas si l'email existe ou pas
      return res.json({ message: 'Si cet email existe, un code de réinitialisation a été envoyé' });
    }
    
    if (!user.email) {
      return res.status(400).json({ error: 'User has no email address configured' });
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

    await sendPasswordResetNotification(user, resetToken);

    const responseData = { message: 'Password reset code sent successfully' };
    console.log(`📤 Réponse forgot-password:`, responseData);
    res.json(responseData);
  } catch (e) {
    console.error('Erreur forgot password:', e);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du code' });
  }
});

// Reset password: expect { email, token, newPassword }
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
 *               - email
 *               - token
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "user@example.com"
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
 *                       value: "Email, token et nouveau mot de passe requis"
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
router.post('/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) {
    return res.status(400).json({ error: 'Email, token et nouveau mot de passe requis' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  const sanitizedEmail = sanitizeEmail(email);

  try {
    // Find user by email
    const user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
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
    console.log(`📤 Réponse reset-password:`, responseData);
    res.json(responseData);
  } catch (e) {
    console.error('Erreur reset password:', e);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
  }
});

// Send account setup email (envoyer un email pour créer le mot de passe initial)
/**
 * @swagger
 * /auth/send-setup-email:
 *   post:
 *     summary: Send account setup email
 *     description: Send an email to a new user with a token to set up their password
 *     tags: [Authentication]
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
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "newuser@example.com"
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
 *                   example: "Email d'activation envoyé"
 *       400:
 *         description: Email is required
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/send-setup-email', auth, async (req, res) => {
  const { email, userId } = req.body;
  console.log(`📧 Envoi email d'activation - Email: ${email}, UserId: ${userId}`);

  if (!email && !userId) {
    console.log(`❌ Email ou userId requis`);
    return res.status(400).json({ error: 'Email or userId required' });
  }

  const sanitizedEmail = email ? sanitizeEmail(email) : null;

  try {
    // Find user by email or userId
    const user = await prisma.user.findFirst({ 
      where: email ? { email: sanitizedEmail } : { id: userId },
      include: { Member: true, Admin: true }
    });
    if (!user) {
      console.log(`❌ Utilisateur non trouvé: ${email || userId}`);
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Check permissions
    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { Admin: true }
    });

    // If requesting user is admin, verify target user is in same gym
    if (requestingUser.role === 'admin') {
      if (user.gymId !== requestingUser.gymId) {
        console.log(`❌ Admin ${requestingUser.email} trying to access user from different gym`);
        return res.status(403).json({ error: 'Cannot send setup email to user from different gym' });
      }
    }

    // If requesting user is member, can only send to themselves
    if (requestingUser.role === 'member' && user.id !== requestingUser.id) {
      console.log(`❌ Member ${requestingUser.email} trying to send to another user`);
      return res.status(403).json({ error: 'Members can only send setup email to themselves' });
    }

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

    await sendPasswordResetNotification(user, setupToken, true);

    console.log(`✅ Notification d'activation envoyée à ${user.email}`);
    res.json({ 
      message: "Email d'activation envoyé",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (e) {
    console.error('Erreur send-setup-email:', e);
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
 *               - email
 *               - token
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "newuser@example.com"
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
router.post('/setup-password', async (req, res) => {
  const { email, phoneNumber, token, password } = req.body;
  console.log(`🔐 Création mot de passe initial - Email: ${email}, Phone: ${phoneNumber}`);

  if ((!email && !phoneNumber) || !token || !password) {
    console.log(`❌ Champs manquants`);
    return res.status(400).json({ error: 'Email or phoneNumber, token et mot de passe requis' });
  }

  if (password.length < 6) {
    console.log(`❌ Mot de passe trop court`);
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  const sanitizedEmail = email ? sanitizeEmail(email) : null;

  try {
    // Find user by email or phoneNumber
    const user = await prisma.user.findFirst({ 
      where: email ? { email: sanitizedEmail } : { phoneNumber }
    });
    if (!user) {
      console.log(`❌ Utilisateur non trouvé: ${email || phoneNumber}`);
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
      console.log(`❌ Token invalide ou expiré`);
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

    console.log(`✅ Mot de passe créé pour ${email}`);
    res.json({ message: 'Mot de passe créé avec succès' });
  } catch (e) {
    console.error('Erreur setup-password:', e);
    res.status(500).json({ error: 'Erreur lors de la création du mot de passe' });
  }
});

module.exports = router;
