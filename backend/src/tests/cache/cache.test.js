const { createFakeRedisClient } = require('../mocks/fakeRedisClient');

function createFakeRes() {
  const headers = {};
  return {
    headers,
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = String(value);
    }
  };
}

function flushAsync() {
  return new Promise((resolve) => setImmediate(resolve));
}

function loadCacheWithRedis(redisClient, env = {}) {
  jest.resetModules();
  process.env.CACHE_LOGS = 'false';
  for (const [k, v] of Object.entries(env)) process.env[k] = v;

  jest.doMock('../../config/redisClient', () => redisClient);
  // Re-require after mocking redisClient.
  // eslint-disable-next-line global-require
  return require('../../utils/cache');
}

describe('Cache Utils (Redis Cache-Aside)', () => {
  test('cacheAsideJson: first call MISS, second call HIT (Redis ready)', async () => {
    const redis = createFakeRedisClient({ initialStatus: 'ready' });
    const Cache = loadCacheWithRedis(redis, { CACHE_ENABLED: 'true' });

    const fetcher = jest.fn(async () => ({ ok: true, ts: Date.now() }));

    const res1 = createFakeRes();
    const r1 = await Cache.cacheAsideJson({
      key: 'test:key:1',
      ttlSeconds: 60,
      tags: ['unit'],
      fetcher,
      res: res1,
      label: 'unit.cacheAsideJson'
    });

    expect(r1.meta.hit).toBe(false);
    expect(res1.headers['x-cache']).toBe('MISS');
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Allow fire-and-forget cache write to complete.
    await flushAsync();

    const res2 = createFakeRes();
    const r2 = await Cache.cacheAsideJson({
      key: 'test:key:1',
      ttlSeconds: 60,
      tags: ['unit'],
      fetcher,
      res: res2,
      label: 'unit.cacheAsideJson'
    });

    expect(r2.meta.hit).toBe(true);
    expect(res2.headers['x-cache']).toBe('HIT');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('cacheAsideJson: Redis unavailable => BYPASS and still returns fresh data', async () => {
    const redis = createFakeRedisClient({ initialStatus: 'end', connectSucceeds: false });
    const Cache = loadCacheWithRedis(redis, { CACHE_ENABLED: 'true' });

    const fetcher = jest.fn(async () => ({ ok: true }));

    const res1 = createFakeRes();
    const r1 = await Cache.cacheAsideJson({
      key: 'test:key:bypass',
      ttlSeconds: 60,
      tags: ['unit'],
      fetcher,
      res: res1,
      label: 'unit.cacheAsideJson.bypass'
    });

    expect(r1.meta.hit).toBeNull();
    expect(res1.headers['x-cache']).toBe('BYPASS');
    expect(fetcher).toHaveBeenCalledTimes(1);

    const res2 = createFakeRes();
    const r2 = await Cache.cacheAsideJson({
      key: 'test:key:bypass',
      ttlSeconds: 60,
      tags: ['unit'],
      fetcher,
      res: res2,
      label: 'unit.cacheAsideJson.bypass'
    });

    expect(r2.meta.hit).toBeNull();
    expect(res2.headers['x-cache']).toBe('BYPASS');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test('invalidateTags deletes all keys registered under the tag', async () => {
    const redis = createFakeRedisClient({ initialStatus: 'ready' });
    const Cache = loadCacheWithRedis(redis, { CACHE_ENABLED: 'true' });

    const fetcherA = jest.fn(async () => ({ id: 'a' }));
    const fetcherB = jest.fn(async () => ({ id: 'b' }));

    await Cache.cacheAsideJson({ key: 'test:key:a', tags: ['tag-a'], fetcher: fetcherA });
    await Cache.cacheAsideJson({ key: 'test:key:b', tags: ['tag-a'], fetcher: fetcherB });

    await flushAsync(); // allow tag set writes (SADD/EXPIRE)

    const inv = await Cache.invalidateTags(['tag-a'], { reason: 'unit.test' });
    expect(inv.deleted).toBeGreaterThanOrEqual(2);

    const fetcherAfter = jest.fn(async () => ({ id: 'after' }));
    await Cache.cacheAsideJson({ key: 'test:key:a', tags: ['tag-a'], fetcher: fetcherAfter });
    expect(fetcherAfter).toHaveBeenCalledTimes(1);
  });
});

