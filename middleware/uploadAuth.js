const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

/**
 * Middleware d'authentification spécifique pour les uploads APK
 * Vérifie :
 * 1. Présence du token JWT
 * 2. Validité du token
 * 3. Rôle utilisateur (admin ou owner uniquement)
 * 4. (Optionnel) Token API spécial pour CI/CD
 */
module.exports = function (req, res, next) {
  console.log(`🔐 Upload Auth - Route: ${req.method} ${req.path}`);

  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`❌ Upload denied - Missing or invalid Authorization header`);
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please provide a valid JWT token with Bearer authentication'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    
    // Vérifier le rôle (seuls admin et owner peuvent uploader)
    if (!payload.type || !['admin', 'owner'].includes(payload.type)) {
      console.log(`❌ Upload denied - Insufficient permissions (role: ${payload.type})`);
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: 'Only admin and owner roles can upload APK files',
        required_role: ['admin', 'owner'],
        current_role: payload.type
      });
    }

    req.user = payload;
    console.log(`✅ Upload authorized - User: ${payload.email} (${payload.type}), ID: ${payload.sub}`);
    next();
  } catch (e) {
    console.log(`❌ Upload denied - Invalid token: ${e.message}`);
    
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Your authentication token has expired. Please login again.'
      });
    }
    
    return res.status(401).json({ 
      error: 'Invalid token',
      message: 'The provided token is invalid or malformed'
    });
  }
};
