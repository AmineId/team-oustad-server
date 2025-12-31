const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const storeService = require('../services/storeService');
const { generateStoreProductId, generateStoreReservationId } = require('../utils/idGenerator');
const multer = require('multer');
const path = require('path');

// Middleware pour gérer l'upload et conversion en base64
const handleProductUpload = (req, res, next) => {
  const storage = multer.memoryStorage(); // Stocker en mémoire pour conversion base64

  const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
    fileFilter: (req, file, cb) => {
      const filetypes = /jpeg|jpg|png|webp/;
      const mimetype = filetypes.test(file.mimetype);
      const extname = path.extname(file.originalname).toLowerCase();
      const hasValidExtension = extname === '' || filetypes.test(extname);
      
      // Accepter si le MIME type est valide OU si l'extension est valide
      if (mimetype || hasValidExtension) {
        return cb(null, true);
      }
      
      console.error('Fichier rejeté:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        extname: extname
      });
      
      cb(new Error('Seules les images sont autorisées (jpeg, jpg, png, webp)'));
    }
  });

  // Exécuter multer avec max 5 images
  upload.array('images', 5)(req, res, (err) => {
    if (err) return next(err);
    
    // Convertir les fichiers en base64
    if (req.files && req.files.length > 0) {
      req.imagesBase64 = req.files.map(file => {
        const base64 = file.buffer.toString('base64');
        const mimeType = file.mimetype;
        return `data:${mimeType};base64,${base64}`;
      });
    }
    
    next();
  });
};

// ============= ROUTES PUBLIQUES (tous les membres) =============

/**
 * @route GET /store/products
 * @desc Récupérer tous les produits disponibles
 */
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const { gymId, category, available } = req.query;
    
    const filters = {
      gymId: gymId ? parseInt(gymId) : req.user.gymId,
      category: category || undefined,
      isActive: true
    };

    // Si available=true, filtrer seulement ceux avec stock disponible
    if (available === 'true') {
      filters.hasStock = true;
    }

    const products = await storeService.getProducts(filters);
    res.json({ success: true, products });
  } catch (error) {
    console.error('Erreur récupération produits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /store/products/:id
 * @desc Récupérer un produit spécifique
 */
router.get('/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await storeService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Produit non trouvé' });
    }
    res.json({ success: true, product });
  } catch (error) {
    console.error('Erreur récupération produit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /store/reservations
 * @desc Créer une réservation de produit
 */
router.post('/reservations', authenticateToken, async (req, res) => {
  try {
    const { productId, quantity, notes } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({ 
        success: false, 
        error: 'productId et quantity sont requis' 
      });
    }

    const memberId = req.user.role === 'member' ? req.user.id : req.body.memberId;
    if (!memberId) {
      return res.status(400).json({ 
        success: false, 
        error: 'memberId requis pour les non-membres' 
      });
    }

    const reservation = await storeService.createReservation({
      productId: parseInt(productId),
      memberId,
      quantity: parseInt(quantity),
      notes
    });

    res.status(201).json({ success: true, reservation });
  } catch (error) {
    console.error('Erreur création réservation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /store/reservations/my
 * @desc Récupérer les réservations du membre connecté
 */
router.get('/reservations/my', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'member') {
      return res.status(403).json({ 
        success: false, 
        error: 'Accessible uniquement aux membres' 
      });
    }

    const { status } = req.query;
    const reservations = await storeService.getMemberReservations(
      req.user.id, 
      status
    );
    res.json({ success: true, reservations });
  } catch (error) {
    console.error('Erreur récupération réservations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route PATCH /store/reservations/:id/cancel
 * @desc Annuler une réservation
 */
router.patch('/reservations/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const reservation = await storeService.cancelReservation(
      req.params.id,
      req.user.id,
      req.user.role
    );
    res.json({ success: true, reservation });
  } catch (error) {
    console.error('Erreur annulation réservation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= ROUTES STAFF (admin/owner) =============

/**
 * @route POST /store/products
 * @desc Créer un nouveau produit
 */
router.post('/products', authenticateToken, handleProductUpload, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin ou owner
    if (!['admin', 'owner'].includes(req.user.type)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Accessible uniquement aux admin et owner' 
      });
    }

    const { name, description, price, stock, category, gymId } = req.body;

    if (!name || !price || stock === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'name, price et stock sont requis' 
      });
    }

    // Déterminer le gymId: depuis le body pour admin, depuis req.user pour owner
    let finalGymId = gymId || req.user.gymId;
    
    // Si pas de gymId, récupérer le gym lié au user
    if (!finalGymId) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.sub },
        include: { Gym: true }
      });
      
      if (user?.Gym?.id) {
        finalGymId = user.Gym.id;
      } else {
        return res.status(400).json({ 
          success: false, 
          error: 'Impossible de déterminer le gym. Veuillez fournir un gymId.' 
        });
      }
    }
    
    // Pour les owners, imposer leur propre gym
    if (req.user.type === 'owner' && finalGymId !== req.user.gymId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Un owner ne peut créer des produits que pour sa propre salle' 
      });
    }

    // Générer l'ID du produit
    const productId = generateStoreProductId();
    
    // Récupérer les images converties en base64
    const imagesBase64 = req.imagesBase64 || [];

    const product = await storeService.createProduct({
      displayId: productId,
      name,
      description,
      imagesBase64,
      price: parseFloat(price),
      stock: parseInt(stock),
      category,
      gymId: finalGymId,
      createdBy: req.user.sub
    });

    res.status(201).json({ success: true, product });
  } catch (error) {
    console.error('Erreur création produit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route PUT /store/products/:id
 * @desc Mettre à jour un produit
 */
router.put('/products/:id', authenticateToken, handleProductUpload, async (req, res) => {
  try {
    if (!['admin', 'owner'].includes(req.user.type)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Accessible uniquement aux admin et owner' 
      });
    }

    const updates = { ...req.body };
    
    // Récupérer le produit existant
    const existingProduct = await storeService.getProductById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({ success: false, error: 'Produit non trouvé' });
    }
    
    // Ajouter les nouvelles images en base64 si uploadées
    if (req.imagesBase64 && req.imagesBase64.length > 0) {
      // Combiner avec les images existantes
      updates.imagesBase64 = [...(existingProduct.imagesBase64 || []), ...req.imagesBase64];
    }

    if (updates.price) updates.price = parseFloat(updates.price);
    if (updates.stock !== undefined) updates.stock = parseInt(updates.stock);

    const product = await storeService.updateProduct(req.params.id, updates);
    res.json({ success: true, product });
  } catch (error) {
    console.error('Erreur mise à jour produit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route DELETE /store/products/:id
 * @desc Supprimer un produit
 */
router.delete('/products/:id', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'owner'].includes(req.user.type)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Accessible uniquement aux admin et owner' 
      });
    }

    // Récupérer le produit existant
    const product = await storeService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Produit non trouvé' });
    }

    // Supprimer le produit de la BDD (les images base64 sont dans la BDD)
    await storeService.deleteProduct(req.params.id);
    
    res.json({ success: true, message: 'Produit supprimé' });
  } catch (error) {
    console.error('Erreur suppression produit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /store/reservations
 * @desc Récupérer toutes les réservations (staff)
 */
router.get('/reservations', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'owner'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Accessible uniquement aux admin et owner' 
      });
    }

    const { status, productId } = req.query;
    const reservations = await storeService.getAllReservations({
      gymId: req.user.gymId,
      status,
      productId: productId ? parseInt(productId) : undefined
    });

    res.json({ success: true, reservations });
  } catch (error) {
    console.error('Erreur récupération réservations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route PATCH /store/reservations/:id/complete
 * @desc Marquer une réservation comme retirée
 */
router.patch('/reservations/:id/complete', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'owner'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Accessible uniquement aux admin et owner' 
      });
    }

    const reservation = await storeService.completeReservation(req.params.id);
    res.json({ success: true, reservation });
  } catch (error) {
    console.error('Erreur finalisation réservation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /store/stats
 * @desc Statistiques du store
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'owner'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Accessible uniquement aux admin et owner' 
      });
    }

    const stats = await storeService.getStoreStats(req.user.gymId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
