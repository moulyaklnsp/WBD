function createFakeRedisClient(options = {}) {
  const initialStatus = options.initialStatus || 'ready';
  const connectSucceeds = options.connectSucceeds !== false;

  const kv = new Map();
  const sets = new Map();

  const client = {
    status: initialStatus,

    // ioredis-like
    on() { /* no-op for tests */ },

    async connect() {
      if (!connectSucceeds) {
        client.status = 'end';
        throw new Error('Redis connect failed (fake)');
      }
      client.status = 'ready';
      return true;
    },

    async get(key) {
      return kv.has(key) ? kv.get(key) : null;
    },

    async set(key, value) {
      kv.set(String(key), value);
      return 'OK';
    },

    async del(...keys) {
      let deleted = 0;
      for (const k of keys.flat()) {
        const key = String(k);
        if (kv.delete(key)) deleted += 1;
        // If a tag set itself is deleted, remove it from sets map too.
        if (sets.delete(key)) deleted += 1;
      }
      return deleted;
    },

    async sadd(setKey, member) {
      const key = String(setKey);
      const m = String(member);
      const existing = sets.get(key) || new Set();
      const before = existing.size;
      existing.add(m);
      sets.set(key, existing);
      return existing.size > before ? 1 : 0;
    },

    async smembers(setKey) {
      const key = String(setKey);
      const set = sets.get(key);
      return set ? Array.from(set) : [];
    },

    async expire() {
      // TTL not simulated in unit tests.
      return 1;
    },

    __reset() {
      kv.clear();
      sets.clear();
      client.status = initialStatus;
    },

    __debugDump() {
      return {
        status: client.status,
        kv: Array.from(kv.entries()),
        sets: Array.from(sets.entries()).map(([k, v]) => [k, Array.from(v)])
      };
    }
  };

  return client;
}

module.exports = { createFakeRedisClient };

