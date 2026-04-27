const { PrismaClient } = require('@prisma/client');

const dbUrl = process.env.DATABASE_URL || '';
const isPrismaPostgres = dbUrl.startsWith('prisma+postgres://');

let prisma;

if (isPrismaPostgres) {
  const { withAccelerate } = require('@prisma/extension-accelerate');
  prisma = new PrismaClient({ accelerateUrl: dbUrl }).$extends(withAccelerate());
} else {
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');

  const adapter = new PrismaPg(new Pool({ connectionString: dbUrl }));

  prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

module.exports = prisma;
