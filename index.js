require('dotenv').config();
const express = require('express');
const prisma = require('./utils/prismaClient');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const logger = require('./utils/logger');

logger.info('🚀 Démarrage du serveur Team Fitness...');

const rateLimit = require('express-rate-limit');

const app = express();

// Trust proxy (nécessaire quand derrière nginx/reverse proxy)
app.set('trust proxy', 1);

logger.info('📦 Configuration Express...');

// Rate limiting global — bloque les scanners et abus
app.use(rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Too Many Requests' }),
}));

// Security Middleware avec CSP personnalisée pour permettre Tailwind CDN
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Nécessaire pour Tailwind CDN
        "https://cdn.tailwindcss.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Nécessaire pour les styles inline
        "https://cdn.tailwindcss.com",
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:"
      ],
      connectSrc: ["'self'"]
    }
  }
}));
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:8088', 'http://localhost:8088'];

const teamOustadOrigin = /^https?:\/\/([a-z0-9-]+\.)?team-oustad\.com$/;
const cfPagesOrigin = /^https:\/\/[a-z0-9-]+\.team-fitness-[a-z0-9-]+\.pages\.dev$/;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (teamOustadOrigin.test(origin)) return callback(null, true);
    if (cfPagesOrigin.test(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(compression());

// Logging Middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Historique (AuditLog) : chaque requête porte son contexte d'audit
const { auditContextMiddleware, runAsSystem } = require('./utils/auditContext');
app.use(auditContextMiddleware);

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
const androidRoutes = require('./routes/android');
const membersRoutes = require('./routes/members');
const bannersRoutes = require('./routes/banners');
const checkInRoutes = require('./routes/checkIn');
const storeRoutes = require('./routes/store');
const whatsappRoutes = require('./routes/whatsapp');
const publicRoutes = require('./routes/public');
const showcaseRoutes = require('./routes/showcase');
const coachesRoutes = require('./routes/coaches');
const programsRoutes = require('./routes/programs');
const programAssignmentsRoutes = require('./routes/programAssignments');
const sessionsRoutes = require('./routes/sessions');
const incidentsRoutes = require('./routes/incidents');
const auditLogsRoutes = require('./routes/auditLogs');

// Use routes
console.log('🔗 Configuration des routes API...');
app.use('/gyms', gymsRoutes);
app.use('/users', usersRoutes);
app.use('/auth', authRoutes);
app.use('/plannings', planningsRoutes);
app.use('/subscriptions', subscriptionsRoutes);
app.use('/subscription-types', subscriptionTypesRoutes);
app.use('/android', androidRoutes);
app.use('/members', membersRoutes);
app.use('/banners', bannersRoutes);
app.use('/check-in', checkInRoutes);
app.use('/store', storeRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/public', publicRoutes);
app.use('/showcase', showcaseRoutes);
app.use('/coaches', coachesRoutes);
app.use('/programs', programsRoutes);
app.use('/program-assignments', programAssignmentsRoutes);
app.use('/sessions', sessionsRoutes);
app.use('/incidents', incidentsRoutes);
app.use('/audit-logs', auditLogsRoutes);
console.log('✅ Routes configurées: /gyms, /users, /auth, /plannings, /subscriptions, /subscription-types, /android, /members, /banners, /check-in, /store, /whatsapp, /public, /showcase, /coaches, /programs, /program-assignments, /sessions, /incidents');

// Redirection Beta Download vers Google Play Internal Testing
app.get('/beta/download', (req, res) => {
  console.log('🔄 Redirection /beta/download vers Google Play Internal Testing');
  res.redirect(301, 'https://play.google.com/store/apps/details?id=team.fitness.team_fitness_app');
});

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
const API_URL = process.env.API_URL || `http://localhost:${PORT}`;

console.log(`🌐 Configuration serveur`);
console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   - Host: ${HOST}`);
console.log(`   - Port: ${PORT}`);
console.log(`   - API_URL (emails): ${API_URL}`);

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
    // Résoudre le chemin relatif au répertoire de travail courant (process.cwd())
    const resolvedPath = path.resolve(process.cwd(), firebaseServiceAccountPath);
    
    // Vérifier avec fs.existsSync qui suit les liens symboliques
    if (fs.existsSync(resolvedPath)) {
      // Vérifier également que c'est un fichier valide et lisible
      const stats = fs.lstatSync(resolvedPath);
      if (stats.isSymbolicLink()) {
        const realPath = fs.realpathSync(resolvedPath);
        console.log(`✅ Firebase configuré: ${firebaseServiceAccountPath} -> ${path.basename(realPath)}`);
      } else {
        console.log(`✅ Firebase configuré: ${firebaseServiceAccountPath}`);
      }
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

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled Error: ${err.message}`, { stack: err.stack });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : 'Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : message
  });
});

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

// Job de mise à jour automatique des bannières selon dates (toutes les heures)
const cron = require('node-cron');
const bannerService = require('./services/bannerService');
cron.schedule('0 * * * *', async () => {
  console.log('🔄 Mise à jour des bannières programmées...');
  try {
    await runAsSystem('bannerSchedule', () => bannerService.updateScheduledBanners());
    console.log('✅ Bannières programmées mises à jour');
  } catch (error) {
    console.error('❌ Erreur mise à jour bannières:', error);
  }
});
console.log('✅ Job de mise à jour des bannières: toutes les heures');

// Job d'auto checkout à minuit (00:01 tous les jours)
const checkInService = require('./services/checkInService');
cron.schedule('1 0 * * *', async () => {
  console.log('🔄 Auto checkout des check-ins de la veille...');
  try {
    const count = await runAsSystem('autoCheckOut', () => checkInService.autoCheckOutYesterday());
    console.log(`✅ ${count} check-ins de la veille fermés automatiquement`);
  } catch (error) {
    console.error('❌ Erreur auto checkout:', error);
  }
});
console.log('✅ Job d\'auto checkout: tous les jours à 00:01');

// Job de vérification des quotas bas (tous les jours à 10h00)
const { checkLowQuotaSubscriptions } = require('./jobs/lowQuotaNotification');
cron.schedule('0 10 * * *', async () => {
  console.log('🔍 Vérification des quotas de séances bas...');
  try {
    const result = await runAsSystem('lowQuotaNotification', () => checkLowQuotaSubscriptions());
    console.log(`✅ Vérification quotas terminée: ${result.notificationsSent} notifications, ${result.emailsSent} emails`);
  } catch (error) {
    console.error('❌ Erreur vérification quotas:', error);
  }
});
console.log('✅ Job de vérification des quotas: tous les jours à 10h00');

// Rôles V2 : rappels de séance (~1 h avant) et clôture des séances passées (toutes les 15 min)
const { sendSessionReminders, closePastSessions } = require('./jobs/sessionReminder');
cron.schedule('*/15 * * * *', async () => {
  try {
    const { reminders, closed } = await runAsSystem('sessionJobs', async () => ({
      reminders: await sendSessionReminders(),
      closed: await closePastSessions(),
    }));
    if (reminders.sessions || closed.closed) {
      console.log(`✅ Séances : ${reminders.sent} rappel(s), ${closed.closed} clôturée(s), ${closed.absent} absent(s)`);
    }
  } catch (error) {
    console.error('❌ Erreur job séances:', error);
  }
});
console.log('✅ Job des séances (rappels + clôture): toutes les 15 minutes');

app.listen(PORT, HOST, () => {
  const localUrl = `http://localhost:${PORT}`;
  const externalUrl = `http://${HOST}:${PORT}`;
  const apiUrl = API_URL;
  
  console.log(`\n✅ Serveur Team Fitness démarré avec succès!`);
  console.log(`\n📍 URLs d'accès:`);
  console.log(`   - Local:      ${localUrl}`);
  console.log(`   - Network:    ${externalUrl}`);
  console.log(`   - API_URL:    ${apiUrl} (utilisé dans les emails)`);
  console.log(`\n📚 Documentation et endpoints:`);
  console.log(`   - API Docs:   ${localUrl}/api-docs`);
  console.log(`   - Health:     ${localUrl}/health`);
  console.log(`   - Setup Page: ${apiUrl}/setup-password.html`);
  console.log(`\n🎉 Prêt à recevoir des requêtes!\n`);
});