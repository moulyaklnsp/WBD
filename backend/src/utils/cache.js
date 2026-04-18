const redisClient = require('../config/redisClient');
const cacheConfig = require('../config/cache');
const { keys: cacheKeys } = require('./cacheKeys');

function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

function timeoutAfter(ms, message = 'Cache command timed out') {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    if (timer && typeof timer.unref === 'function') timer.unref();
  });
}

async function withTimeout(promise, ms, message) {
  return Promise.race([promise, timeoutAfter(ms, message)]);
}

function log(line, extra) {
  if (!cacheConfig.logs.enabled) return;
  try {
    if (extra !== undefined) console.log(line, extra);
    else console.log(line);
  } catch (_) {
    // ignore logging errors
  }
}

let connectPromise = null;
async function ensureRedisConnected() {
  if (!cacheConfig.enabled) return false;
  if (!redisClient) return false;
  if (redisClient.status === 'ready') return true;

  if (!connectPromise) {
    // Fire-and-forget connection attempt. Keep retries in redisClient config.
    connectPromise = redisClient.connect()
      .catch((err) => {
        log('[cache] Redis connect failed:', err?.message || err);
        return false;
      })
      .finally(() => {
        connectPromise = null;
      });
  }

  // Never block request processing for long.
  try {
    await withTimeout(connectPromise, Math.max(250, cacheConfig.timeouts.commandMs), 'Redis connect timeout');
  } catch (_) {
    // ignore
  }

  return redisClient.status === 'ready';
}

function isRedisReady() {
  return Boolean(cacheConfig.enabled && redisClient && redisClient.status === 'ready');
}

function parseJson(raw) {
  if (typeof raw !== 'string') return { ok: false, value: null };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (_) {
    return { ok: false, value: null };
  }
}

function setCacheHeaders(res, meta) {
  if (!res || typeof res.setHeader !== 'function' || !meta) return;
  try {
    if (meta.key) res.setHeader('X-Cache-Key', meta.key);
    if (meta.ttlSeconds != null) res.setHeader('X-Cache-TTL', String(meta.ttlSeconds));
    if (meta.fetchMs != null) res.setHeader('X-Cache-Fetch-Ms', String(meta.fetchMs));
    if (meta.totalMs != null) res.setHeader('X-Cache-Time', String(meta.totalMs));
    if (meta.reason) res.setHeader('X-Cache-Reason', String(meta.reason));
    if (meta.hit === true) res.setHeader('X-Cache', 'HIT');
    else if (meta.hit === false) res.setHeader('X-Cache', 'MISS');
    else res.setHeader('X-Cache', 'BYPASS');
  } catch (_) {
    // ignore header errors
  }
}

async function getJson(key, { timeoutMs } = {}) {
  const start = nowMs();
  const commandTimeout = timeoutMs || cacheConfig.timeouts.commandMs;

  if (!cacheConfig.enabled || !redisClient) {
    return { value: null, meta: { hit: null, key, reason: 'disabled', totalMs: nowMs() - start } };
  }

  if (redisClient.status !== 'ready') {
    // Attempt to connect but do not block.
    void ensureRedisConnected();
    return { value: null, meta: { hit: null, key, reason: `redis_${redisClient.status}`, totalMs: nowMs() - start } };
  }

  try {
    const raw = await withTimeout(redisClient.get(key), commandTimeout, 'Redis GET timeout');
    if (raw == null) {
      return { value: null, meta: { hit: false, key, reason: 'miss', totalMs: nowMs() - start } };
    }

    const parsed = parseJson(raw);
    if (!parsed.ok) {
      // Corrupt cache entry - delete it.
      try { await withTimeout(redisClient.del(key), commandTimeout, 'Redis DEL timeout'); } catch (_) {}
      return { value: null, meta: { hit: false, key, reason: 'parse_error', totalMs: nowMs() - start } };
    }

    // Treat cached `null` as a miss (we generally avoid caching nulls).
    if (parsed.value === null) {
      return { value: null, meta: { hit: false, key, reason: 'null', totalMs: nowMs() - start } };
    }

    return { value: parsed.value, meta: { hit: true, key, totalMs: nowMs() - start } };
  } catch (err) {
    log(`[cache] GET error key=${key} msg=${err?.message || err}`);
    return { value: null, meta: { hit: null, key, reason: 'redis_error', totalMs: nowMs() - start } };
  }
}

async function setJson(key, value, { ttlSeconds, tags = [], timeoutMs } = {}) {
  const commandTimeout = timeoutMs || cacheConfig.timeouts.commandMs;
  const ttl = Number.isFinite(ttlSeconds) ? Math.max(1, ttlSeconds) : cacheConfig.ttl.defaultSeconds;

  if (!isRedisReady()) {
    void ensureRedisConnected();
    return { ok: false, key, ttlSeconds: ttl, reason: 'redis_not_ready' };
  }

  let payload;
  try {
    payload = JSON.stringify(value);
    if (typeof payload !== 'string') {
      // JSON.stringify(undefined) returns undefined, and functions/symbols are not serializable.
      throw new Error('Value is not JSON-serializable');
    }
  } catch (err) {
    log(`[cache] SET serialize error key=${key} msg=${err?.message || err}`);
    return { ok: false, key, ttlSeconds: ttl, reason: 'serialize_error' };
  }

  try {
    await withTimeout(redisClient.set(key, payload, 'EX', ttl), commandTimeout, 'Redis SET timeout');
  } catch (err) {
    log(`[cache] SET error key=${key} msg=${err?.message || err}`);
    return { ok: false, key, ttlSeconds: ttl, reason: 'redis_error' };
  }

  if (tags && tags.length > 0) {
    const uniqTags = Array.from(new Set(tags.map(t => String(t || '').trim()).filter(Boolean)));
    const ops = [];
    for (const tag of uniqTags) {
      const tagKey = cacheKeys.tag(tag);
      ops.push(withTimeout(redisClient.sadd(tagKey, key), commandTimeout, 'Redis SADD timeout').catch(() => null));
      // Keep the tag set around slightly longer than cached entries.
      ops.push(withTimeout(redisClient.expire(tagKey, ttl + 120), commandTimeout, 'Redis EXPIRE timeout').catch(() => null));
    }
    void Promise.allSettled(ops);
  }

  return { ok: true, key, ttlSeconds: ttl };
}

async function delKeys(keys, { timeoutMs } = {}) {
  const commandTimeout = timeoutMs || cacheConfig.timeouts.commandMs;

  if (!isRedisReady()) {
    void ensureRedisConnected();
    return { ok: false, deleted: 0, keys: keys || [], reason: 'redis_not_ready' };
  }

  const list = Array.isArray(keys) ? keys.filter(Boolean) : [];
  if (list.length === 0) return { ok: true, deleted: 0, keys: [] };

  let deleted = 0;
  const chunkSize = 250;
  for (let i = 0; i < list.length; i += chunkSize) {
    const chunk = list.slice(i, i + chunkSize);
    try {
      const n = await withTimeout(redisClient.del(...chunk), commandTimeout, 'Redis DEL timeout');
      deleted += Number(n || 0);
    } catch (err) {
      log(`[cache] DEL error msg=${err?.message || err}`);
    }
  }

  return { ok: true, deleted, keys: list };
}

async function invalidateTags(tags, { reason } = {}) {
  const uniqueTags = Array.from(new Set((Array.isArray(tags) ? tags : []).map(t => String(t || '').trim()).filter(Boolean)));
  if (uniqueTags.length === 0) return { ok: true, deleted: 0, keys: [], tags: [] };

  if (!isRedisReady()) {
    void ensureRedisConnected();
    log(`[cache] INVALIDATE bypass tags=${uniqueTags.join(',')} reason=redis_not_ready`);
    return { ok: false, deleted: 0, keys: [], tags: uniqueTags, reason: 'redis_not_ready' };
  }

  const commandTimeout = cacheConfig.timeouts.commandMs;
  const keysToDelete = new Set();
  const tagSetKeys = [];

  for (const tag of uniqueTags) {
    const tagKey = cacheKeys.tag(tag);
    tagSetKeys.push(tagKey);
    try {
      const members = await withTimeout(redisClient.smembers(tagKey), commandTimeout, 'Redis SMEMBERS timeout');
      for (const k of (members || [])) keysToDelete.add(k);
    } catch (err) {
      log(`[cache] SMEMBERS error tag=${tag} msg=${err?.message || err}`);
    }
  }

  const keysList = Array.from(keysToDelete);
  const delResult = await delKeys(keysList);

  // Delete tag sets too so future invalidations stay fast.
  try {
    if (tagSetKeys.length > 0) {
      await withTimeout(redisClient.del(...tagSetKeys), commandTimeout, 'Redis DEL timeout');
    }
  } catch (_) {}

  log(`[cache] INVALIDATE tags=${uniqueTags.join(',')} deleted=${delResult.deleted} reason=${reason || 'n/a'} keys=${keysList.length}`);
  if (keysList.length > 0) {
    const sample = keysList.slice(0, 10);
    const suffix = keysList.length > 10 ? '...' : '';
    log(`[cache] INVALIDATE sample${suffix}:`, sample.join(','));
  }

  return { ok: delResult.ok, deleted: delResult.deleted, keys: keysList, tags: uniqueTags };
}

async function cacheAsideJson({ key, ttlSeconds, tags = [], fetcher, cacheWhen, res, label } = {}) {
  const ttl = Number.isFinite(ttlSeconds) ? Math.max(1, ttlSeconds) : cacheConfig.ttl.defaultSeconds;
  const start = nowMs();

  const read = await getJson(key);
  if (read.meta && read.meta.hit === true && read.value !== null) {
    const meta = { hit: true, key, ttlSeconds: ttl, totalMs: nowMs() - start, source: 'cache' };
    setCacheHeaders(res, meta);
    log(`[cache] HIT label=${label || 'n/a'} key=${key} ms=${meta.totalMs}`);
    return { value: read.value, meta };
  }

  const freshStart = nowMs();
  const fresh = await fetcher();
  const fetchMs = nowMs() - freshStart;

  let shouldCache = fresh != null;
  if (typeof cacheWhen === 'function') {
    try {
      shouldCache = Boolean(cacheWhen(fresh));
    } catch (_) {
      // keep default
    }
  }

  const canWrite = isRedisReady();
  const willCache = Boolean(shouldCache && canWrite);

  if (willCache) {
    void setJson(key, fresh, { ttlSeconds: ttl, tags });
  }

  const bypass = read.meta && read.meta.hit === null;
  const meta = {
    hit: bypass ? null : false,
    key,
    ttlSeconds: ttl,
    totalMs: nowMs() - start,
    fetchMs,
    source: 'db',
    cached: willCache,
    reason: read.meta ? read.meta.reason : undefined
  };

  setCacheHeaders(res, meta);

  const prefix = bypass ? 'BYPASS' : 'MISS';
  const reasonPart = meta.reason ? ` reason=${meta.reason}` : '';
  log(`[cache] ${prefix} label=${label || 'n/a'} key=${key} fetchMs=${fetchMs} totalMs=${meta.totalMs}${reasonPart}`);

  return { value: fresh, meta };
}

module.exports = {
  cacheAsideJson,
  invalidateTags,
  delKeys,
  ensureRedisConnected,
  isRedisReady,
  keys: cacheKeys,
  config: cacheConfig
};
