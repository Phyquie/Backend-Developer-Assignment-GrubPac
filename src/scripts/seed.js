/**
 * Seed script — creates the default principal and two demo teachers.
 * Run with: npm run seed
 *
 * Safe to run multiple times (uses upsert).
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const SALT_ROUNDS = 12;

const users = [
  {
    name: process.env.PRINCIPAL_NAME || 'Principal Admin',
    email: process.env.PRINCIPAL_EMAIL || 'principal@school.com',
    password: process.env.PRINCIPAL_PASSWORD || 'Principal@123',
    role: 'principal',
  },
  {
    name: 'Teacher One',
    email: 'teacher1@school.com',
    password: 'Teacher@123',
    role: 'teacher',
  },
  {
    name: 'Teacher Two',
    email: 'teacher2@school.com',
    password: 'Teacher@123',
    role: 'teacher',
  },
];

const seed = async () => {
  try {
    await prisma.$connect();
    console.log('Seeding users...\n');

    for (const userData of users) {
      const passwordHash = await bcrypt.hash(userData.password, SALT_ROUNDS);

      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: {
          name: userData.name,
          email: userData.email,
          passwordHash,
          role: userData.role,
        },
      });

      console.log(`✓ [${user.role}] ${user.email} (id: ${user.id})`);
    }

    console.log('\nSeeding complete.');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seed();
