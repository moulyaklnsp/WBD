const request = require('supertest');
const { createFakeRedisClient } = require('../mocks/fakeRedisClient');

jest.setTimeout(30000);

function flushAsync() {
  return new Promise((resolve) => setImmediate(resolve));
}

function buildAppWithMocks({ redisClient, blogResponse }) {
  jest.resetModules();
  process.env.CACHE_ENABLED = 'true';
  process.env.CACHE_LOGS = 'false';
  process.env.NODE_ENV = 'test';

  jest.doMock('../../config/redisClient', () => redisClient);

  const getBlogByIdPublic = jest.fn(async () => blogResponse);
  jest.doMock('../../services/coordinator/blogsService', () => ({
    getBlogByIdPublic
  }));

  // eslint-disable-next-line global-require
  const { app } = require('../../app');
  return { app, getBlogByIdPublic };
}

describe('GET /api/public/coordinator-blogs/:id (conditional caching)', () => {
  test('draft blog is NOT cached (MISS every time)', async () => {
    const redis = createFakeRedisClient({ initialStatus: 'ready' });
    const blog = { blog: { _id: 'b1', title: 'Draft', status: 'draft', published: false } };
    const { app, getBlogByIdPublic } = buildAppWithMocks({ redisClient: redis, blogResponse: blog });

    const r1 = await request(app).get('/api/public/coordinator-blogs/b1');
    expect(r1.status).toBe(200);
    expect(r1.headers['x-cache']).toBe('MISS');
    expect(getBlogByIdPublic).toHaveBeenCalledTimes(1);

    await flushAsync();

    const r2 = await request(app).get('/api/public/coordinator-blogs/b1');
    expect(r2.status).toBe(200);
    expect(r2.headers['x-cache']).toBe('MISS');
    expect(getBlogByIdPublic).toHaveBeenCalledTimes(2);
  });

  test('published blog is cached (MISS then HIT)', async () => {
    const redis = createFakeRedisClient({ initialStatus: 'ready' });
    const blog = { blog: { _id: 'b2', title: 'Pub', status: 'published', published: true } };
    const { app, getBlogByIdPublic } = buildAppWithMocks({ redisClient: redis, blogResponse: blog });

    const r1 = await request(app).get('/api/public/coordinator-blogs/b2');
    expect(r1.status).toBe(200);
    expect(r1.headers['x-cache']).toBe('MISS');
    expect(getBlogByIdPublic).toHaveBeenCalledTimes(1);

    await flushAsync();

    const r2 = await request(app).get('/api/public/coordinator-blogs/b2');
    expect(r2.status).toBe(200);
    expect(r2.headers['x-cache']).toBe('HIT');
    expect(getBlogByIdPublic).toHaveBeenCalledTimes(1);
  });
});
