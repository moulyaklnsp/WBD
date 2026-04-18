const request = require('supertest');
const { createFakeRedisClient } = require('../mocks/fakeRedisClient');

jest.setTimeout(30000);

function flushAsync() {
  return new Promise((resolve) => setImmediate(resolve));
}

function buildAppWithMocks({ redisClient, publishedBlogsResponse }) {
  jest.resetModules();
  process.env.CACHE_ENABLED = 'true';
  process.env.CACHE_LOGS = 'false';
  process.env.NODE_ENV = 'test';

  jest.doMock('../../config/redisClient', () => redisClient);

  const getPublishedBlogsPublic = jest.fn(async () => publishedBlogsResponse);
  jest.doMock('../../services/coordinator/blogsService', () => ({
    getPublishedBlogsPublic,
    // other exports are not needed for this test suite
  }));

  // eslint-disable-next-line global-require
  const { app } = require('../../app');
  return { app, getPublishedBlogsPublic };
}

describe('GET /api/public/coordinator-blogs (cache-aside)', () => {
  test('first request MISS then second request HIT (service called once)', async () => {
    const redis = createFakeRedisClient({ initialStatus: 'ready' });
    const payload = { blogs: [{ id: 'b1', title: 'Hello' }] };
    const { app, getPublishedBlogsPublic } = buildAppWithMocks({
      redisClient: redis,
      publishedBlogsResponse: payload
    });

    const r1 = await request(app).get('/api/public/coordinator-blogs');
    expect(r1.status).toBe(200);
    expect(r1.body).toEqual(payload);
    expect(r1.headers['x-cache']).toBe('MISS');
    expect(getPublishedBlogsPublic).toHaveBeenCalledTimes(1);

    await flushAsync();

    const r2 = await request(app).get('/api/public/coordinator-blogs');
    expect(r2.status).toBe(200);
    expect(r2.body).toEqual(payload);
    expect(r2.headers['x-cache']).toBe('HIT');
    expect(getPublishedBlogsPublic).toHaveBeenCalledTimes(1);
  });

  test('Redis unavailable => BYPASS (service called on every request)', async () => {
    const payload = { blogs: [{ id: 'b1', title: 'Hello' }] };
    const { app, getPublishedBlogsPublic } = buildAppWithMocks({
      redisClient: null,
      publishedBlogsResponse: payload
    });

    const r1 = await request(app).get('/api/public/coordinator-blogs');
    expect(r1.status).toBe(200);
    expect(r1.headers['x-cache']).toBe('BYPASS');

    const r2 = await request(app).get('/api/public/coordinator-blogs');
    expect(r2.status).toBe(200);
    expect(r2.headers['x-cache']).toBe('BYPASS');

    expect(getPublishedBlogsPublic).toHaveBeenCalledTimes(2);
  });
});
