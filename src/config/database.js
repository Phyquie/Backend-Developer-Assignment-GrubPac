const { Sequelize } = require('sequelize');
const config = require('./config');
const logger = require('../utils/logger');

// Detect Supabase connection pooler URL (Transaction mode, port 6543).
// The pooler requires prepared statements to be disabled (no_prepare=true).
const dbUrl = process.env.DATABASE_URL || '';
const isPooler = dbUrl.includes('pooler.supabase.com');

const dialectOptions = {
  ssl: {
    require: true,
    rejectUnauthorized: false, // required for Supabase managed TLS
  },
  // Force IPv4 — prevents ENETUNREACH when host resolves to IPv6 on Render
  family: 4,
};

// Supabase Transaction-mode pooler does not support prepared statements
if (isPooler) {
  dialectOptions.prepare = false;
}

const sequelize = dbUrl
  ? new Sequelize(dbUrl, {
      dialect: 'postgres',
      logging: (msg) => logger.debug(msg),
      dialectOptions,
      pool: {
        max: isPooler ? 2 : 10, // pooler already manages connections externally
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      define: { underscored: true, timestamps: true },
    })
  : new Sequelize(config.db.name, config.db.user, config.db.password, {
      host: config.db.host,
      port: config.db.port,
      dialect: 'postgres',
      logging: (msg) => logger.debug(msg),
      dialectOptions: { family: 4 },
      pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
      define: { underscored: true, timestamps: true },
    });

module.exports = sequelize;
