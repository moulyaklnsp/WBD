/**
 * Cache configuration (Redis-backed).
 * Defaults are tuned for "safe-by-default" caching:
 * - Cache is optional: APIs must work even if Redis is down.
 * - TTLs are short unless explicitly overridden.
 */
function parseIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const value = parseInt(String(raw), 10);
  return Number.isFinite(value) ? value : fallback;
}

function parseBoolEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  return fallback;
}

const CACHE_ENABLED = parseBoolEnv('CACHE_ENABLED', true);
const CACHE_PREFIX = (process.env.CACHE_PREFIX || 'chesshive').toString().trim() || 'chesshive';

// TTLs (seconds)
const CACHE_DEFAULT_TTL_SECONDS = parseIntEnv('CACHE_DEFAULT_TTL_SECONDS', 120);
const CACHE_LONG_TTL_SECONDS = parseIntEnv('CACHE_LONG_TTL_SECONDS', 900);

// Per-command soft timeout so Redis issues never hang HTTP responses.
const CACHE_COMMAND_TIMEOUT_MS = parseIntEnv('CACHE_COMMAND_TIMEOUT_MS', 150);

// Log cache hits/misses and invalidations (defaults to on in development).
const CACHE_LOGS = parseBoolEnv('CACHE_LOGS', (process.env.NODE_ENV || 'development') !== 'production');

module.exports = {
  enabled: CACHE_ENABLED,
  prefix: CACHE_PREFIX,
  ttl: {
    defaultSeconds: Math.max(1, CACHE_DEFAULT_TTL_SECONDS),
    longSeconds: Math.max(1, CACHE_LONG_TTL_SECONDS)
  },
  timeouts: {
    commandMs: Math.max(1, CACHE_COMMAND_TIMEOUT_MS)
  },
  logs: {
    enabled: CACHE_LOGS
  }
};

