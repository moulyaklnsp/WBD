const request = require('supertest');
const { createFakeRedisClient } = require('../mocks/fakeRedisClient');

jest.setTimeout(30000);

function flushAsync() {
  return new Promise((resolve) => setImmediate(resolve));
}

function buildAppWithMocks({ redisClient, streamsResponse }) {
  jest.resetModules();
  process.env.CACHE_ENABLED = 'true';
  process.env.CACHE_LOGS = 'false';
  process.env.NODE_ENV = 'test';

  jest.doMock('../../config/redisClient', () => redisClient);

  const getPlayerStreams = jest.fn(async () => streamsResponse);
  jest.doMock('../../services/player/streamsService', () => ({
    getPlayerStreams
  }));

  // eslint-disable-next-line global-require
  const { app } = require('../../app');
  return { app, getPlayerStreams };
}

describe('GET /player/api/streams (auth + cache-aside)', () => {
  test('rejects request without auth (role middleware)', async () => {
    const redis = createFakeRedisClient({ initialStatus: 'ready' });
    const { app } = buildAppWithMocks({ redisClient: redis, streamsResponse: [] });

    const r = await request(app).get('/player/api/streams');
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ success: false });
  });

  test('first request MISS then second request HIT with dev auth headers', async () => {
    const redis = createFakeRedisClient({ initialStatus: 'ready' });
    const payload = [
      { _id: 's1', title: 'Match', url: 'https://example.com', featured: true, isLive: true }
    ];
    const { app, getPlayerStreams } = buildAppWithMocks({ redisClient: redis, streamsResponse: payload });

    const headers = { 'x-dev-role': 'player', 'x-dev-email': 'player1@example.com', 'x-dev-username': 'player1' };

    const r1 = await request(app).get('/player/api/streams').set(headers);
    expect(r1.status).toBe(200);
    expect(r1.headers['x-cache']).toBe('MISS');
    expect(r1.body).toEqual(payload);
    expect(getPlayerStreams).toHaveBeenCalledTimes(1);

    await flushAsync();

    const r2 = await request(app).get('/player/api/streams').set(headers);
    expect(r2.status).toBe(200);
    expect(r2.headers['x-cache']).toBe('HIT');
    expect(r2.body).toEqual(payload);
    expect(getPlayerStreams).toHaveBeenCalledTimes(1);
  });
});
