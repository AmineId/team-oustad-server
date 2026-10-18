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

module.exports = router;
