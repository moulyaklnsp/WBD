const Redis = require('ioredis');
const cacheConfig = require('./cache');

// Connect to local Redis or remote depending on ENV
const redisURI = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Allow disabling Redis completely (APIs must still work without it)
if (!cacheConfig.enabled) {
  module.exports = null;
} else {
  const connectTimeout = (() => {
    const raw = process.env.REDIS_CONNECT_TIMEOUT_MS;
    const parsed = raw ? parseInt(String(raw), 10) : 1000;
    return Number.isFinite(parsed) ? Math.max(250, parsed) : 1000;
  })();

  const redisClient = new Redis(redisURI, {
    // Cache should never block API responses; fail fast when Redis is unavailable.
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      // Keep retrying with backoff so Redis can come online later (docker-compose, etc).
      return Math.min(2000, Math.max(250, times * 200));
    }
  });

  redisClient.on('ready', () => {
    if (cacheConfig.logs.enabled) console.log('[cache] Redis ready');
  });

  redisClient.on('reconnecting', () => {
    if (cacheConfig.logs.enabled) console.warn('[cache] Redis reconnecting...');
  });

  redisClient.on('error', (err) => {
    if (cacheConfig.logs.enabled) console.warn('[cache] Redis error:', err?.message || err);
  });

  module.exports = redisClient;
}
