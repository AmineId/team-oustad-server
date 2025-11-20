const express = require('express');
const router = express.Router();
const { formatUser } = require('../utils/responseFormatter');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail, sendAccountSetupEmail } = require('../services/emailService');
const { getActiveSubscription, getSubscriptionsWithStatus } = require('../utils/subscriptionUtils');

const prisma = new PrismaClient();

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
router.post('/check-phone', async (req, res) => {
  const { phoneNumber } = req.body;
  console.log(`📱 Vérification numéro de téléphone - PhoneNumber: ${phoneNumber}`);
  
  if (!phoneNumber) {
    console.log(`❌ Numéro de téléphone manquant`);
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
      console.log(`✅ Numéro ${phoneNumber} n'existe pas - Création possible`);
      return res.json({
        exists: false,
        hasPassword: false,
        message: 'Ce numéro n\'est pas encore enregistré'
      });
    }

    // Vérifier si le mot de passe est configuré
    // Un mot de passe temporaire long (généré automatiquement) indique qu'aucun mot de passe n'a été défini
    const hasPassword = user.password && user.password.length > 0;

    console.log(`⚠️ Numéro ${phoneNumber} existe déjà - hasPassword: ${hasPassword}`);
    
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
    console.error(`💥 Erreur vérification numéro de téléphone:`, e);
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
router.post('/login', async (req, res) => {
  const { email, phoneNumber, password } = req.body;
  const identifier = email || phoneNumber;
  console.log(`🔐 Tentative de connexion - Identifiant: ${identifier}`);
  
  if ((!email && !phoneNumber) || !password) {
    console.log(`❌ Connexion échouée - Identifiant ou password manquant`);
    return res.status(400).json({ error: 'email or phoneNumber and password required' });
  }

  try {
    let user;
    
    // Find user by email or phoneNumber
    if (email) {
      const sanitizedEmail = sanitizeEmail(email);
      if (sanitizedEmail !== email.toLowerCase().trim()) {
        console.log(`⚠️  Email contenait des caractères invalides, nettoyé: ${sanitizedEmail}`);
      }
      user = await prisma.user.findUnique({
        where: { email: sanitizedEmail },
        include: {
          admin: true,
          member: {
            include: {
              subscriptions: {
                include: {
                  payments: true
                }
              },
              payments: true
            }
          },
          gym: true
        }
      });
    } else if (phoneNumber) {
      user = await prisma.user.findUnique({
        where: { phoneNumber: phoneNumber },
        include: {
          admin: true,
          member: {
            include: {
              subscriptions: {
                include: {
                  payments: true
                }
              },
              payments: true
            }
          },
          gym: true
        }
      });
    }

    if (!user) {
      console.log(`❌ Connexion échouée - Utilisateur non trouvé: ${identifier}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`✅ Utilisateur trouvé: ${user.fullName} (${user.role}) - ID: ${user.id}`);

    // Check password
    const valid = await bcrypt.compare(password, user.password);
    console.log(`🔍 Vérification password: ${valid ? '✅ VALIDE' : '❌ INVALIDE'}`);

    if (!valid) {
      console.log(`❌ Connexion échouée - Mot de passe incorrect pour: ${identifier}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`✅ Connexion réussie pour: ${user.fullName} (${user.role})`);

    // Récupérer le statut onboarding du membre (seulement pour les membres)
    const onboarding = user.role === 'member' ? (user.member?.onboarding || false) : false;
    console.log(`🔔 Onboarding requis: ${onboarding ? 'OUI ✨' : 'NON'}`);

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
      type: user.role
    }, JWT_SECRET, { expiresIn: '30d' });

    console.log(`🎫 Token JWT généré pour: ${user.email || user.phoneNumber}`);

    // Return different data based on user role
    if (user.role === 'admin') {
      console.log(`👨‍💼 Réponse admin préparée pour: ${user.fullName}`);
      const responseData = {
        
        token,
        onboarding,
        user: {
          id: user.id,
          displayId: user.displayId,
          email: user.email,
          phoneNumber: user.phoneNumber,
          fullName: user.fullName,
          role: user.role,
          gymId: user.gymId,
          gym: user.gym,
          fcmToken: user.fcmToken,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          type: 'admin'
        }
      };
      console.log(`📤 Réponse login admin:`, {
        token: token.substring(0, 20) + '...',
        user: responseData.user
      });
      res.json(responseData);
    } else if (user.role === 'owner') {
      console.log(`👑 Réponse owner préparée pour: ${user.fullName}`);
      const responseData = {
        token,
        onboarding,
        user: {
          id: user.id,
          displayId: user.displayId,
          email: user.email,
          phoneNumber: user.phoneNumber,
          fullName: user.fullName,
          role: user.role,
          gymId: user.gymId,
          gym: user.gym,
          fcmToken: user.fcmToken,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          permissions: {
            canManageAdmins: user.owner?.canManageAdmins || false,
            canManageGyms: user.owner?.canManageGyms || false,
            canViewReports: user.owner?.canViewReports || false,
            maxGymsAllowed: user.owner?.maxGymsAllowed || 0,
          },
          type: 'owner'
        }
      };
      console.log(`📤 Réponse login owner:`, {
        token: token.substring(0, 20) + '...',
        user: responseData.user
      });
      res.json(responseData);
    } else if (user.role === 'member') {
      console.log(`👤 Réponse membre préparée pour: ${user.fullName}`);
      const responseData = {
        token,
        onboarding,
        user: {
          id: user.id,
          displayId: user.displayId,
          email: user.email,
          phoneNumber: user.phoneNumber,
          fullName: user.fullName,
          role: user.role,
          gymId: user.gymId,
          gym: user.gym,
          fcmToken: user.fcmToken,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          member: {
            onboarding: user.member?.onboarding,
            birthDate: user.member?.birthDate,
            phone: user.member?.phone,
            profession: user.member?.profession,
            fitnessLevel: user.member?.fitnessLevel,
            preferredTrainingDays: user.member?.preferredTrainingDays,
            joinedAt: user.member?.joinedAt,
          },
          subscriptions: user.member?.subscriptions || [],
          payments: user.member?.payments || [],
          type: 'member'
        }
      };
      console.log(`📤 Réponse login membre:`, {
        token: token.substring(0, 20) + '...',
        user: responseData.user
      });
      res.json(responseData);
    } else {
      console.log(`❓ Rôle inconnu: ${user.role} pour ${user.fullName}`);
      return res.status(400).json({ error: 'Invalid user role' });
    }
  } catch (e) {
    console.error(`💥 Erreur lors de la connexion:`, e);
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
  const { qrCode } = req.body;
  console.log(`📱 Scan QR - User ID: ${req.user?.sub}, Email: ${req.user?.email}, QR Code: ${qrCode}`);

  try {
    // Vérifier que l'utilisateur est un admin
    if (req.user.type !== 'admin') {
      console.log(`❌ Accès refusé: utilisateur ${req.user.email} n'est pas admin (type: ${req.user.type})`);
      return res.status(403).json({ error: 'Only admins can scan QR codes' });
    }

    // Trouver l'utilisateur par son displayId
    const member = await prisma.user.findFirst({
      where: { displayId: qrCode },
      include: {
        member: {
          include: {
            subscriptions: {
              where: { status: 'active' },
              include: {
                payments: {
                  orderBy: { createdAt: 'desc' },
                  take: 1 // Dernier paiement de l'abonnement
                }
              }
            },
          }
        },
        gym: true
      }
    });

    if (!member) {
      console.log(`❌ Membre non trouvé avec QR code: ${qrCode}`);
      return res.status(404).json({ error: 'Member not found' });
    }

    if (member.role !== 'member') {
      console.log(`❌ Utilisateur trouvé mais n'est pas membre: ${member.fullName} (rôle: ${member.role})`);
      return res.status(400).json({ error: 'QR code is not for a member' });
    }

    // Vérifier que le membre appartient à la même salle que l'admin
    if (member.gymId !== req.user.gymId) {
      console.log(`❌ Membre ${member.fullName} n'appartient pas à la salle de l'admin (membre: ${member.gymId}, admin: ${req.user.gymId})`);
      return res.status(403).json({ error: 'Member does not belong to your gym' });
    }

    // Vérifier l'abonnement actif pour les membres
    if (member.role === 'member') {
      const activeSubscription = getActiveSubscription(member.member);

      if (!activeSubscription) {
        console.log(`❌ Membre ${member.fullName} n'a pas d'abonnement actif`);
        return res.status(403).json({
          error: 'Accès refusé - Aucun abonnement actif',
          reason: 'no_active_subscription',
          member: {
            id: member.userId,
            fullName: member.fullName,
            email: member.email
          }
        });
      }

      console.log(`✅ Abonnement valide pour ${member.fullName} - Statut: ${activeSubscription.activeCheck.details ? 'Paiement dû dans ' + activeSubscription.activeCheck.details.daysUntilDue + ' jours' : 'Actif'}`);
    }

    console.log(`✅ Accès autorisé pour ${member.fullName} - Abonnement valide jusqu'au ${activeSubscription.endDate}`);

    // Enregistrer l'accès
    await prisma.accessLog.create({
      data: {
        memberId: member.member.userId,
        adminId: req.user.sub,
        gymId: req.user.gymId,
        accessType: 'qr_scan'
      }
    });

    const responseData = {
      success: true,
      member: {
        id: member.userId,
        fullName: member.fullName,
        email: member.email,
        displayId: member.displayId,
        subscription: activeSubscription ? {
          id: activeSubscription.id,
          plan: activeSubscription.plan,
          membership: activeSubscription.membership,
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

  } catch (e) {
    console.error(`💥 Erreur dans /scan-qr:`, e);
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
  console.log(`👤 Requête /me - User ID du token: ${req.user?.sub}, Email: ${req.user?.email}, Type: ${req.user?.type}`);

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: {
        gym: true,
        admin: true,
        member: {
          include: {
            subscriptions: {
              where: { status: 'active' },
              include: {
                payments: {
                  orderBy: { createdAt: 'desc' },
                  take: 5 // Derniers 5 paiements liés à l'abonnement
                }
              }
            },
            payments: {
              orderBy: { createdAt: 'desc' },
              take: 10 // Derniers 10 paiements du membre
            }
          }
        },
        owner: true
      }
    });

    if (!user) {
      console.log(`❌ Utilisateur non trouvé en base: ID ${req.user.sub}`);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`✅ Utilisateur trouvé: ${user.fullName} (${user.role}) - ID: ${user.id}, uniqueCode: ${user.uniqueCode}`);

    if (user.role === 'admin') {
      console.log(`👨‍💼 Réponse admin pour: ${user.fullName}`);
      // Pour les admins : retourner leur salle
      const responseData = formatUser({
        id: user.id,
        displayId: user.displayId,
        email: user.email,
        fullName: user.fullName,
        uniqueCode: user.uniqueCode,
        gym: user.gym,
        type: 'admin'
      });
      console.log(`📤 Réponse /me admin:`, responseData);
      res.json(responseData);
    } else if (user.role === 'owner') {
      console.log(`👑 Réponse owner pour: ${user.fullName}`);
      // Pour les owners : retourner toutes les salles avec statistiques
      const allGyms = await prisma.gym.findMany({
        include: {
          users: {
            select: {
              role: true
            }
          },
          _count: {
            select: {
              users: true
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
          totalUsers: gym._count.users,
          members: gym.users.filter(u => u.role === 'member').length,
          admins: gym.users.filter(u => u.role === 'admin').length,
          owners: gym.users.filter(u => u.role === 'owner').length
        }
      }));

      const responseData = formatUser({
        id: user.id,
        displayId: user.displayId,
        email: user.email,
        fullName: user.fullName,
        uniqueCode: user.uniqueCode,
        gyms: gymsWithStats,
        permissions: {
          canManageAdmins: user.owner?.canManageAdmins || false,
          canManageGyms: user.owner?.canManageGyms || false,
          canViewReports: user.owner?.canViewReports || false,
          maxGymsAllowed: user.owner?.maxGymsAllowed || 0,
        },
        type: 'owner'
      });
      console.log(`📤 Réponse /me owner:`, {
        ...responseData,
        gyms: `${gymsWithStats.length} salles trouvées`
      });
      res.json(responseData);
    } else if (user.role === 'member') {
      console.log(`👤 Réponse membre pour: ${user.fullName}`);
      // Pour les membres : abonnement actif + derniers paiements
      const activeSubscription = getActiveSubscription(user.member);
      const subscriptionsWithStatus = getSubscriptionsWithStatus(user.member);

      const responseData = formatUser({
        id: user.id,
        displayId: user.displayId,
        email: user.email,
        fullName: user.fullName,
        uniqueCode: user.uniqueCode,
        gym: user.gym,
        activeSubscription: activeSubscription,
        subscriptions: subscriptionsWithStatus,
        recentPayments: user.member?.payments || [],
        type: 'member'
      });
      console.log(`📤 Réponse /me membre:`, {
        ...responseData,
        recentPayments: `${responseData.recentPayments.length} paiements récents`,
        subscriptions: `${responseData.subscriptions.length} abonnements`
      });
      res.json(responseData);
    } else {
      console.log(`❓ Rôle inconnu: ${user.role} pour ${user.fullName}`);
      return res.status(400).json({ error: 'Invalid user role' });
    }
  } catch (e) {
    console.error(`💥 Erreur dans /me:`, e);
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
router.post('/forgot-password', async (req, res) => {
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
    console.log(`📤 Réponse forgot-password:`, responseData);
    res.json(responseData);
  } catch (e) {
    console.error('Erreur forgot password:', e);
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
router.post('/reset-password', async (req, res) => {
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
router.post('/send-setup-email', auth, async (req, res) => {
  const { email, userId } = req.body;
  console.log(`📧 Envoi email de configuration - Email: ${email}, UserId: ${userId}, Requester: ${req.user.email} (${req.user.type})`);

  if (!email && !userId) {
    console.log(`❌ Email ou userId requis`);
    return res.status(400).json({ error: 'Email ou userId requis' });
  }

  try {
    // Find user
    const whereClause = userId ? { id: userId } : { email: sanitizeEmail(email) };
    const user = await prisma.user.findUnique({ 
      where: whereClause,
      include: { gym: true }
    });

    if (!user) {
      console.log(`❌ Utilisateur non trouvé`);
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier les permissions
    if (req.user.type === 'admin') {
      // Les admins peuvent seulement envoyer aux membres de leur salle
      if (user.gymId !== req.user.gymId) {
        console.log(`❌ Permission refusée - Utilisateur d'une autre salle`);
        return res.status(403).json({ error: 'Vous ne pouvez envoyer d\'emails qu\'aux membres de votre salle' });
      }
    } else if (req.user.type === 'member') {
      // Les membres ne peuvent envoyer qu'à eux-mêmes
      if (user.id !== req.user.sub) {
        console.log(`❌ Permission refusée - Les membres ne peuvent pas envoyer d'emails à d'autres`);
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
    await sendAccountSetupEmail(user.email, user.fullName, setupToken);

    console.log(`✅ Email de configuration envoyé à ${user.email}`);
    res.json({ 
      message: `Email de configuration envoyé à ${user.email}`,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        gym: user.gym.name
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
router.post('/setup-password', async (req, res) => {
  const { email, phoneNumber, token, password } = req.body;
  console.log(`🔐 Création mot de passe initial - Email: ${email}, PhoneNumber: ${phoneNumber}`);

  if ((!email && !phoneNumber) || !token || !password) {
    console.log(`❌ Champs manquants`);
    return res.status(400).json({ error: 'Email ou phoneNumber, token et mot de passe requis' });
  }

  if (password.length < 6) {
    console.log(`❌ Mot de passe trop court`);
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

    console.log(`✅ Mot de passe créé pour ${user.email || user.phoneNumber}`);
    res.json({ message: 'Mot de passe créé avec succès' });
  } catch (e) {
    console.error('Erreur setup-password:', e);
    res.status(500).json({ error: 'Erreur lors de la création du mot de passe' });
  }
});

module.exports = router;
