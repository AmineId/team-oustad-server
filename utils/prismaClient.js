const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const globalForPrisma = global;

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: ['error', 'warn'],
    errorFormat: 'pretty',
  });
}

const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Handle connection errors and reconnect
prisma.$connect()
  .then(() => {
    console.log('✅ Prisma connecté à la base de données');
  })
  .catch((error) => {
    console.error('❌ Erreur de connexion Prisma:', error);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  console.log('🔌 Fermeture de la connexion Prisma...');
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  console.log('🔌 Fermeture de la connexion Prisma (SIGINT)...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔌 Fermeture de la connexion Prisma (SIGTERM)...');
  await prisma.$disconnect();
  process.exit(0);
});

// Helper function to handle connection errors and retry
async function executeWithRetry(operation, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Test connection before operation
      await prisma.$queryRaw`SELECT 1`;
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (error.code === 'P1001' || error.message.includes('closed the connection')) {
        console.log(`⚠️  Tentative de reconnexion ${attempt}/${maxRetries}...`);
        
        try {
          await prisma.$disconnect();
          await prisma.$connect();
          console.log('✅ Reconnexion réussie');
        } catch (reconnectError) {
          console.error(`❌ Échec de reconnexion (tentative ${attempt}):`, reconnectError.message);
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      } else {
        // If it's not a connection error, throw immediately
        throw error;
      }
    }
  }
  
  throw lastError;
}

// Export both prisma and the retry helper
module.exports = prisma;
module.exports.executeWithRetry = executeWithRetry;
