const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const prisma = require('../utils/prismaClient');
const whatsappService = require('../services/whatsappService');

const requireOwner = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user || user.role !== 'owner') {
      return res.status(403).json({ error: 'Accès réservé aux propriétaires' });
    }
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * @swagger
 * /whatsapp/status:
 *   get:
 *     summary: Statut de la connexion WhatsApp
 *     description: Retourne si le client WhatsApp est connecté et le numéro expéditeur actif. Réservé aux propriétaires.
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Statut de connexion
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connected:
 *                   type: boolean
 *                   example: true
 *                 phone:
 *                   type: string
 *                   nullable: true
 *                   example: "212600123456"
 *       '403':
 *         description: Accès réservé aux propriétaires
 */
router.get('/status', auth, requireOwner, (req, res) => {
  res.json(whatsappService.getStatus());
});

/**
 * @swagger
 * /whatsapp/qr:
 *   get:
 *     summary: QR code de connexion WhatsApp
 *     description: Retourne le QR code à scanner pour connecter un numéro WhatsApp. Disponible uniquement si le client n'est pas encore connecté. Réservé aux propriétaires.
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: QR code en base64
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qr:
 *                   type: string
 *                   description: Image PNG encodée en base64 (data URL)
 *                   example: "data:image/png;base64,iVBORw0KGgo..."
 *       '204':
 *         description: WhatsApp déjà connecté, pas de QR disponible
 *       '503':
 *         description: QR pas encore généré, réessayez dans quelques secondes
 *       '403':
 *         description: Accès réservé aux propriétaires
 */
router.get('/qr', auth, requireOwner, async (req, res) => {
  const { connected } = whatsappService.getStatus();
  if (connected) {
    return res.status(204).send();
  }

  const qr = await whatsappService.getQrBase64();
  if (!qr) {
    return res.status(503).json({ error: 'QR pas encore disponible, réessayez dans quelques secondes' });
  }

  res.json({ qr });
});

/**
 * @swagger
 * /whatsapp/session:
 *   delete:
 *     summary: Déconnecter WhatsApp
 *     description: Déconnecte le client WhatsApp et supprime la session. Un nouveau scan QR sera nécessaire. Réservé aux propriétaires.
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Session supprimée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Session WhatsApp supprimée"
 *       '403':
 *         description: Accès réservé aux propriétaires
 *       '500':
 *         description: Erreur lors de la déconnexion
 */
router.delete('/session', auth, requireOwner, async (req, res) => {
  try {
    await whatsappService.logout();
    res.json({ message: 'Session WhatsApp supprimée' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @swagger
 * /whatsapp/pairing-code:
 *   post:
 *     summary: Obtenir un code de couplage WhatsApp
 *     description: |
 *       Génère un code à 8 caractères pour coupler WhatsApp sans scanner de QR.
 *       L'owner ouvre WhatsApp → Appareils couplés → Coupler un appareil → Coupler avec un numéro, puis entre ce code.
 *       Réservé aux propriétaires. Impossible si WhatsApp est déjà connecté.
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: Numéro WhatsApp de l'expéditeur (format international, sans +)
 *                 example: "212600123456"
 *     responses:
 *       '200':
 *         description: Code de couplage généré
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   description: Code à 8 caractères à entrer dans WhatsApp
 *                   example: "ABC1-2DEF"
 *       '400':
 *         description: phoneNumber manquant
 *       '409':
 *         description: WhatsApp déjà connecté
 *       '403':
 *         description: Accès réservé aux propriétaires
 *       '500':
 *         description: Erreur génération du code
 */
router.post('/pairing-code', auth, requireOwner, async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber requis' });

  const { connected } = whatsappService.getStatus();
  if (connected) return res.status(409).json({ error: 'WhatsApp déjà connecté' });

  try {
    const code = await whatsappService.getPairingCode(phoneNumber);
    res.json({ code });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @swagger
 * /whatsapp/display-name:
 *   put:
 *     summary: Définir le nom d'affichage WhatsApp
 *     description: |
 *       Change le nom affiché aux destinataires des messages WhatsApp (pushName).
 *       Le nom est persisté et réappliqué automatiquement à chaque reconnexion.
 *       Passer `null` ou une chaîne vide remet le nom par défaut du compte.
 *       Réservé aux propriétaires.
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [displayName]
 *             properties:
 *               displayName:
 *                 type: string
 *                 nullable: true
 *                 description: Nom à afficher aux destinataires. Null ou vide pour revenir au nom du compte.
 *                 example: "Team Fitness"
 *     responses:
 *       '200':
 *         description: Nom mis à jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 displayName:
 *                   type: string
 *                   nullable: true
 *                   example: "Team Fitness"
 *                 applied:
 *                   type: boolean
 *                   description: true si appliqué immédiatement, false si sera appliqué à la prochaine connexion
 *                   example: true
 *       '403':
 *         description: Accès réservé aux propriétaires
 *       '500':
 *         description: Erreur lors du changement de nom
 */
router.put('/display-name', auth, requireOwner, async (req, res) => {
  const { displayName } = req.body;
  try {
    const applied = await whatsappService.setCustomDisplayName(displayName || null);
    res.json({ displayName: displayName || null, applied });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @swagger
 * /whatsapp/profile-picture:
 *   put:
 *     summary: Définir la photo de profil WhatsApp
 *     description: |
 *       Change la photo de profil du compte WhatsApp connecté.
 *       L'image doit être envoyée en base64 dans le corps JSON.
 *       Réservé aux propriétaires. WhatsApp doit être connecté.
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 description: Image encodée en base64 (sans le préfixe data:image/...)
 *                 example: "/9j/4AAQSkZJRgABAQEASABIAAD..."
 *               mimeType:
 *                 type: string
 *                 description: Type MIME de l'image (défaut image/jpeg)
 *                 example: "image/jpeg"
 *                 enum: [image/jpeg, image/png, image/webp]
 *     responses:
 *       '200':
 *         description: Photo de profil mise à jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       '400':
 *         description: Image manquante ou WhatsApp non connecté
 *       '403':
 *         description: Accès réservé aux propriétaires
 *       '500':
 *         description: Erreur lors du changement de photo
 */
router.put('/profile-picture', auth, requireOwner, async (req, res) => {
  const { image, mimeType } = req.body;
  if (!image) return res.status(400).json({ error: 'image (base64) requise' });

  const { connected } = whatsappService.getStatus();
  if (!connected) return res.status(400).json({ error: 'WhatsApp non connecté' });

  try {
    const success = await whatsappService.setProfilePicture(image, mimeType || 'image/jpeg');
    res.json({ success });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
