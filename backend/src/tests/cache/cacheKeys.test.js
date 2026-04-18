describe('Cache Key Design', () => {
  test('keys are prefixed and user-specific keys do not collide', () => {
    jest.resetModules();
    process.env.CACHE_PREFIX = 'testprefix';

    // eslint-disable-next-line global-require
    const { keys, buildKey } = require('../../utils/cacheKeys');

    expect(buildKey('users', 'all')).toMatch(/^testprefix:users:all/);

    const a = keys.storeSuggestionsByUser('a@example.com');
    const b = keys.storeSuggestionsByUser('b@example.com');
    expect(a).not.toEqual(b);
    expect(a).toContain('a%40example.com');
    expect(b).toContain('b%40example.com');
  });

  test('normalizeSegment caps long segments and adds a short hash', () => {
    jest.resetModules();
    process.env.CACHE_PREFIX = 'testprefix';

    // eslint-disable-next-line global-require
    const { normalizeSegment } = require('../../utils/cacheKeys');

    const long = 'x'.repeat(500);
    const norm = normalizeSegment(long);
    expect(norm.length).toBeLessThan(120);
    expect(norm).toContain('~');
  });
});

