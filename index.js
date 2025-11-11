const express = require('express');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

console.log('🚀 Démarrage du serveur Team Fitness...');

const app = express();
const prisma = new PrismaClient();

console.log('📦 Configuration Express...');
app.use(express.json());

// Servir les fichiers statiques (page HTML de configuration)
console.log('📁 Configuration des fichiers statiques...');
app.use(express.static('public'));
console.log('✅ Fichiers statiques disponibles depuis /public');

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

// Vérifier la configuration Firebase
console.log('🔔 Vérification de la configuration Firebase...');
const firebaseServiceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!firebaseServiceAccountPath) {
  console.warn('⚠️  FIREBASE NON CONFIGURÉ');
  console.warn('    Les notifications push sont désactivées.');
  console.warn('    Pour activer les notifications:');
  console.warn('    1. Téléchargez votre clé de service depuis Firebase Console');
  console.warn('    2. Ajoutez FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json dans .env');
  console.warn('    3. Consultez docs/FIREBASE_SETUP.md pour plus de détails');
} else {
  try {
    const fs = require('fs');
    const path = require('path');
    const resolvedPath = path.resolve(firebaseServiceAccountPath);
    
    if (fs.existsSync(resolvedPath)) {
      console.log(`✅ Firebase configuré: ${firebaseServiceAccountPath}`);
      console.log('📲 Les notifications push sont activées');
    } else {
      console.error(`❌ Fichier Firebase introuvable: ${resolvedPath}`);
      console.warn('    Les notifications push sont désactivées.');
      console.warn('    Vérifiez le chemin dans FIREBASE_SERVICE_ACCOUNT_PATH');
    }
  } catch (error) {
    console.error(`❌ Erreur vérification Firebase: ${error.message}`);
    console.warn('    Les notifications push sont désactivées.');
  }
}

// Démarrer les cron jobs
console.log('⏰ Démarrage des jobs planifiés...');

// Job de vérification quotidienne des paiements (23h00)
const { startDailyPaymentCheckCron } = require('./jobs/dailyPaymentCheck');
startDailyPaymentCheckCron();
console.log('✅ Job de vérification des paiements: tous les jours à 23h00');

// Job de notification quotidienne des plannings (6h00)
const { dailyPlanningNotification } = require('./jobs/dailyPlanningNotification');
dailyPlanningNotification.start();
console.log('✅ Job de notification des plannings: tous les jours à 6h00');

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