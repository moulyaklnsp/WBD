const request = require('supertest');
const { createFakeRedisClient } = require('../mocks/fakeRedisClient');

jest.setTimeout(30000);

function flushAsync() {
  return new Promise((resolve) => setImmediate(resolve));
}

function buildAppWithMocks({ redisClient, announcements }) {
  jest.resetModules();
  process.env.CACHE_ENABLED = 'true';
  process.env.CACHE_LOGS = 'false';
  process.env.NODE_ENV = 'test';

  jest.doMock('../../config/redisClient', () => redisClient);

  const getAnnouncements = jest.fn(async () => announcements);
  jest.doMock('../../services/player/notificationsService', () => ({
    getAnnouncements
  }));

  // eslint-disable-next-line global-require
  const { app } = require('../../app');
  return { app, getAnnouncements };
}

describe('GET /player/api/announcements (cache-aside)', () => {
  test('MISS then HIT with dev auth headers', async () => {
    const redis = createFakeRedisClient({ initialStatus: 'ready' });
    const payload = [{ _id: 'a1', title: 'Notice', message: 'Hello' }];
    const { app, getAnnouncements } = buildAppWithMocks({ redisClient: redis, announcements: payload });

    const headers = { 'x-dev-role': 'player', 'x-dev-email': 'player1@example.com', 'x-dev-username': 'player1' };

    const r1 = await request(app).get('/player/api/announcements').set(headers);
    expect(r1.status).toBe(200);
    expect(r1.headers['x-cache']).toBe('MISS');
    expect(r1.body).toEqual(payload);
    expect(getAnnouncements).toHaveBeenCalledTimes(1);

    await flushAsync();

    const r2 = await request(app).get('/player/api/announcements').set(headers);
    expect(r2.status).toBe(200);
    expect(r2.headers['x-cache']).toBe('HIT');
    expect(r2.body).toEqual(payload);
    expect(getAnnouncements).toHaveBeenCalledTimes(1);
  });
});
