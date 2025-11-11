const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

module.exports = function (req, res, next) {
  console.log(`🔐 Auth middleware - Route: ${req.method} ${req.path}`);

  const authHeader = req.headers.authorization || req.headers.Authorization;
  console.log(`📋 Header Authorization: ${authHeader ? 'présent' : 'absent'}`);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`❌ Token manquant - Header: ${authHeader ? 'format invalide' : 'absent'}`);
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.split(' ')[1];
  console.log(`🎫 Token extrait: ${token.substring(0, 20)}...`);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    console.log(`✅ Token valide - User: ${payload.email} (${payload.type}), ID: ${payload.sub}`);
    next();
  } catch (e) {
    console.log(`❌ Token invalide - Erreur: ${e.message}`);
    return res.status(401).json({ error: 'Invalid token' });
  }
};
