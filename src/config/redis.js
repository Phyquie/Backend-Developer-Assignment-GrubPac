const Redis = require('ioredis');
const logger = require('../utils/logger');

let client = null;

const hasUrl    = !!process.env.REDIS_URL;
const hasParams = !!(process.env.REDIS_HOST && process.env.REDIS_PASSWORD);

if (hasUrl || hasParams) {
  const options = {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
    reconnectOnError: () => true,
    retryStrategy: (times) => Math.min(times * 200, 3000),
  };

  client = hasUrl
    ? new Redis(process.env.REDIS_URL, options)
    : new Redis({
        host:     process.env.REDIS_HOST,
        port:     parseInt(process.env.REDIS_PORT || '6379', 10),
        username: process.env.REDIS_USERNAME || 'default',
        password: process.env.REDIS_PASSWORD,
        ...options,
      });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('ready',   () => logger.info('Redis ready'));
  client.on('error',   (err) => logger.warn(`Redis error: ${err.message}`));
  client.on('close',   () => logger.warn('Redis connection closed'));
}

module.exports = client;
