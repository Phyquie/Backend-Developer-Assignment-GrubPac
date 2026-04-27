/**
 * Thin Redis wrapper with graceful no-op when Redis is not configured.
 * All methods swallow errors so a Redis outage never takes down the API.
 */
const redis = require('../config/redis');
const logger = require('./logger');

const get = async (key) => {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn(`Cache GET failed for key "${key}": ${err.message}`);
    return null;
  }
};

const set = async (key, value, ttlSeconds = 60) => {
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.warn(`Cache SET failed for key "${key}": ${err.message}`);
  }
};

const del = async (key) => {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    logger.warn(`Cache DEL failed for key "${key}": ${err.message}`);
  }
};

/**
 * Deletes all keys matching a glob pattern (e.g. "broadcast:live:teacher-id:*").
 * Uses SCAN to avoid blocking Redis with large keyspaces.
 */
const delPattern = async (pattern) => {
  if (!redis) return;
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  } catch (err) {
    logger.warn(`Cache DEL pattern "${pattern}" failed: ${err.message}`);
  }
};

const isEnabled = () => !!redis;

module.exports = { get, set, del, delPattern, isEnabled };
