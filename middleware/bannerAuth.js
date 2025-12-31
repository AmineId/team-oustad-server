/**
 * Middleware pour vérifier que l'utilisateur est Admin ou Owner
 */
const requireAdminOrOwner = (req, res, next) => {
  try {
    // L'utilisateur doit être authentifié via authenticateToken d'abord
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'User must be authenticated' 
      });
    }

    const { role } = req.user;

    // Vérifier si l'utilisateur est admin ou owner
    if (role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ 
        error: 'Access forbidden',
        message: 'Only admins and owners can perform this action' 
      });
    }

    // L'utilisateur est autorisé
    next();
  } catch (error) {
    console.error('Error in requireAdminOrOwner middleware:', error);
    res.status(500).json({ 
      error: 'Authorization check failed',
      message: error.message 
    });
  }
};

module.exports = {
  requireAdminOrOwner
};
