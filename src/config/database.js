const { PrismaClient } = require('@prisma/client');

const dbUrl = process.env.DATABASE_URL || '';
const isPrismaPostgres = dbUrl.startsWith('prisma+postgres://');

let prisma;

if (isPrismaPostgres) {
  const { withAccelerate } = require('@prisma/extension-accelerate');
  prisma = new PrismaClient().$extends(withAccelerate());
} else {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

module.exports = prisma;
