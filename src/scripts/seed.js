/**
 * Seed script — creates the default principal and two demo teachers.
 * Run with: npm run seed
 *
 * Safe to run multiple times (uses findOrCreate).
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../models');

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
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    console.log('Seeding users...\n');

    for (const userData of users) {
      const password_hash = await bcrypt.hash(userData.password, SALT_ROUNDS);

      const [user, created] = await User.findOrCreate({
        where: { email: userData.email },
        defaults: {
          name: userData.name,
          email: userData.email,
          password_hash,
          role: userData.role,
        },
      });

      console.log(
        `${created ? '✓ Created' : '— Already exists'}: [${user.role}] ${user.email} (id: ${user.id})`
      );
    }

    console.log('\nSeeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
