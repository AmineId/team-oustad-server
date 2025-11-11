const express = require('express');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

console.log('🚀 Démarrage du serveur Team Fitness...');

const app = express();
const prisma = new PrismaClient();

console.log('📦 Configuration Express...');
app.use(express.json());

// Import Swagger configuration
console.log('📚 Chargement de la documentation Swagger...');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yml');

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
console.log('📖 Swagger UI configuré sur /api-docs');

// Import routes
console.log('🛣️ Chargement des routes...');
const gymsRoutes = require('./routes/gyms');
const usersRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const planningsRoutes = require('./routes/plannings');
const subscriptionsRoutes = require('./routes/subscriptions');
const subscriptionTypesRoutes = require('./routes/subscriptionTypes');

// Use routes
console.log('🔗 Configuration des routes API...');
app.use('/gyms', gymsRoutes);
app.use('/users', usersRoutes);
app.use('/auth', authRoutes);
app.use('/plannings', planningsRoutes);
app.use('/subscriptions', subscriptionsRoutes);
app.use('/subscription-types', subscriptionTypesRoutes);
console.log('✅ Routes configurées: /gyms, /users, /auth, /plannings, /subscriptions, /subscription-types');

// Health check (DB + server)
app.get('/health', async (req, res) => {
  console.log('🏥 Health check demandé');
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Base de données connectée');
    res.json({ ok: true, db: 'connected' });
  } catch (e) {
    console.error('❌ Erreur base de données:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
// Listen on all interfaces so the server is reachable from emulators and other hosts
const HOST = process.env.HOST || '0.0.0.0';

console.log(`🌐 Configuration serveur - Host: ${HOST}, Port: ${PORT}`);

// Démarrer le cron job pour la vérification quotidienne des paiements
console.log('⏰ Démarrage du job de vérification quotidienne des paiements...');
const { startDailyPaymentCheckCron } = require('./jobs/dailyPaymentCheck');
startDailyPaymentCheckCron(); // S'exécute tous les jours à 23h00

app.listen(PORT, HOST, () => {
  const localUrl = `http://localhost:${PORT}`;
  const externalUrl = `http://${HOST}:${PORT}`;
  console.log(`✅ Server is running
  - Local:    ${localUrl}
  - Network:  ${externalUrl}
  - API Docs: ${localUrl}/api-docs
  - Health:   ${localUrl}/health`);
  console.log('🎉 Serveur prêt à recevoir des requêtes!');
});