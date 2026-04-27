require('dotenv').config();

// Force IPv4 DNS resolution — prevents ENETUNREACH on Render/Railway when
// cloud DB hostnames (Supabase, Redis Cloud) resolve to IPv6 addresses.
require('dns').setDefaultResultOrder('ipv4first');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const config = require('./config/config');
const logger = require('./utils/logger');
const { sequelize } = require('./models');
const { defaultLimiter } = require('./middlewares/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

// Ensure upload and log directories exist
const fs = require('fs');
['uploads', 'logs'].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();

// ─── Security & parsing ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Static file serving (uploaded content) ──────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Global rate limiter ─────────────────────────────────────────────────────
app.use(defaultLimiter);

// ─── API routes ──────────────────────────────────────────────────────────────
app.use('/api/v1', require('./routes'));

// ─── 404 & error handling ────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Database sync & server start ────────────────────────────────────────────
const startServer = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');

    await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' });
    logger.info('Database synced');

    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} [${config.nodeEnv}]`);
      logger.info(`API base: http://localhost:${config.port}/api/v1`);
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
};

startServer();

module.exports = app;
