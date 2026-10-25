/**
 * Middleware pour vérifier que l'utilisateur est Manager ou Owner
 */
const requireManagerOrOwner = (req, res, next) => {
  try {
    // L'utilisateur doit être authentifié via authenticateToken d'abord
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'User must be authenticated' 
      });
    }

    const { type } = req.user;

    // Vérifier si l'utilisateur est manager ou owner
    if (type !== 'manager' && type !== 'owner') {
      return res.status(403).json({ 
        error: 'Access forbidden',
        message: 'Only managers and owners can perform this action' 
      });
    }

    // L'utilisateur est autorisé
    next();
  } catch (error) {
    console.error('Error in requireManagerOrOwner middleware:', error);
    res.status(500).json({ 
      error: 'Authorization check failed',
      message: error.message 
    });
  }
};

/**
 * Rôles V2 : l'écriture des banners (promos) est réservée à l'owner
 */
const requireBannerOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'User must be authenticated'
    });
  }

  if (req.user.type !== 'owner') {
    return res.status(403).json({
      error: 'Access forbidden',
      message: 'Only owners can manage banners'
    });
  }

  next();
};

module.exports = {
  requireManagerOrOwner,
  requireBannerOwner
};
