const Redis = require('ioredis');
const cacheConfig = require('./cache');

const redisURI = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

if (!cacheConfig.enabled) {
  module.exports = null;
} else {

  const connectTimeout = (() => {
    const raw = process.env.REDIS_CONNECT_TIMEOUT_MS;
    const parsed = raw ? parseInt(String(raw), 10) : 1000;
    return Number.isFinite(parsed) ? Math.max(250, parsed) : 1000;
  })();

  const MAX_RETRIES = 5;
  let retryCount = 0;
  let finished = false;

  const redisClient = new Redis(redisURI, {
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout,
    maxRetriesPerRequest: 1,

    retryStrategy(times) {
      retryCount = times;

      if (times >= MAX_RETRIES) {
        if (!finished) {
          finished = true;
          console.error('[cache] Redis unavailable after max retries. Disabling cache.');
        }
        return null; // ⛔ stops ALL further reconnect attempts
      }

      return Math.min(1000, times * 200);
    }
  });

  redisClient.on('ready', () => {
    if (!finished) {
      finished = true;
      console.log('[cache] Redis connected');
    }
  });

  redisClient.on('reconnecting', () => {
    if (cacheConfig.logs.enabled && retryCount < MAX_RETRIES) {
      console.warn('[cache] Redis reconnecting...');
    }
  });

  redisClient.on('error', (err) => {
    if (cacheConfig.logs.enabled && retryCount < MAX_RETRIES) {
      console.warn('[cache] Redis error:', err?.message || err);
    }
  });

  module.exports = redisClient;
}