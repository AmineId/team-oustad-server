const { PrismaClient } = require('@prisma/client');

// Prevent multiple instances of Prisma Client in development
// This attaches the Prisma instance to the global object so it persists across reloads
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
