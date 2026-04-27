const { Sequelize } = require('sequelize');
const config = require('./config');
const logger = require('../utils/logger');

// When DATABASE_URL is set (Supabase / Railway / Heroku etc.), use it directly.
// Otherwise fall back to individual host/user/password/db params.
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: (msg) => logger.debug(msg),
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false, // required for Supabase managed TLS
        },
      },
      pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
      define: { underscored: true, timestamps: true },
    })
  : new Sequelize(config.db.name, config.db.user, config.db.password, {
      host: config.db.host,
      port: config.db.port,
      dialect: 'postgres',
      logging: (msg) => logger.debug(msg),
      pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
      define: { underscored: true, timestamps: true },
    });

module.exports = sequelize;
