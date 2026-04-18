const request = require('supertest');
const { createFakeRedisClient } = require('../mocks/fakeRedisClient');

jest.setTimeout(30000);

function flushAsync() {
  return new Promise((resolve) => setImmediate(resolve));
}

function buildAppWithMocks({ redisClient }) {
  jest.resetModules();
  process.env.CACHE_ENABLED = 'true';
  process.env.CACHE_LOGS = 'false';
  process.env.NODE_ENV = 'test';

  jest.doMock('../../config/redisClient', () => redisClient);

  const getStoreSuggestions = jest.fn(async (_db, user) => ({
    user: user?.email,
    mostOrdered: [{ _id: 'p1', name: 'Prod', count: 10 }],
    suggested: [{ _id: 'p2', name: 'Other', price: 99 }]
  }));

  jest.doMock('../../services/player/storeService', () => ({
    getStoreSuggestions
  }));

  // eslint-disable-next-line global-require
  const { app } = require('../../app');
  return { app, getStoreSuggestions };
}

describe('GET /player/api/store/suggestions (per-user cache key)', () => {
  test('cache keys are per-user: HIT for same user, MISS for different user', async () => {
    const redis = createFakeRedisClient({ initialStatus: 'ready' });
    const { app, getStoreSuggestions } = buildAppWithMocks({ redisClient: redis });

    const user1 = { 'x-dev-role': 'player', 'x-dev-email': 'u1@example.com', 'x-dev-username': 'u1' };
    const user2 = { 'x-dev-role': 'player', 'x-dev-email': 'u2@example.com', 'x-dev-username': 'u2' };

    const r1 = await request(app).get('/player/api/store/suggestions').set(user1);
    expect(r1.status).toBe(200);
    expect(r1.headers['x-cache']).toBe('MISS');
    expect(r1.headers['x-cache-key']).toContain('u1%40example.com');
    expect(r1.body.user).toBe('u1@example.com');
    expect(getStoreSuggestions).toHaveBeenCalledTimes(1);

    await flushAsync();

    const r2 = await request(app).get('/player/api/store/suggestions').set(user1);
    expect(r2.status).toBe(200);
    expect(r2.headers['x-cache']).toBe('HIT');
    expect(r2.body.user).toBe('u1@example.com');
    expect(getStoreSuggestions).toHaveBeenCalledTimes(1);

    const r3 = await request(app).get('/player/api/store/suggestions').set(user2);
    expect(r3.status).toBe(200);
    expect(r3.headers['x-cache']).toBe('MISS');
    expect(r3.headers['x-cache-key']).toContain('u2%40example.com');
    expect(r3.body.user).toBe('u2@example.com');
    expect(getStoreSuggestions).toHaveBeenCalledTimes(2);
  });
});
