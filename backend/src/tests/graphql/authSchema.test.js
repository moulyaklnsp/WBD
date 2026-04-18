function loadAuthSchemaWithMocks({ db, authService, authApiService } = {}) {
  jest.resetModules();

  const connectDB = jest.fn(async () => db);
  jest.doMock('../../config/database', () => ({ connectDB }));
  jest.doMock('../../services/authService', () => authService);
  jest.doMock('../../services/authApiService', () => authApiService);

  // eslint-disable-next-line global-require
  const authSchema = require('../../graphql/authSchema');
  return { ...authSchema, connectDB };
}

describe('graphql/authSchema rootValue', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('buildContext includes auth session info', () => {
    const db = {};
    const authService = { getSession: jest.fn(() => ({ authenticated: true, userEmail: 'a@example.com' })) };
    const { buildContext } = loadAuthSchemaWithMocks({ db, authService, authApiService: {} });

    const ctx = buildContext({ session: {} }, {});
    expect(ctx.auth).toEqual({ authenticated: true, userEmail: 'a@example.com' });
  });

  test('signup maps field errors on validation failure', async () => {
    const db = {};
    const authApiService = {
      apiSignup: jest.fn(async () => {
        const err = new Error('Validation failed');
        err.errors = { email: 'Bad email' };
        throw err;
      })
    };
    const { rootValue } = loadAuthSchemaWithMocks({ db, authService: { getSession: jest.fn() }, authApiService });

    const result = await rootValue.signup({ input: { email: 'bad' } }, {});
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([{ field: 'email', message: 'Bad email' }]);
  });

  test('refreshToken validates presence', async () => {
    const { rootValue } = loadAuthSchemaWithMocks({ db: {}, authService: { getSession: jest.fn() }, authApiService: {} });
    const result = await rootValue.refreshToken({ refreshToken: '' }, { req: { session: {} } });
    expect(result).toMatchObject({ success: false, code: 'NO_REFRESH_TOKEN' });
  });

  test('login uses formatAuthError on failure', async () => {
    const db = {};
    const authService = {
      getSession: jest.fn(() => ({})),
      login: jest.fn(async () => {
        const err = new Error('Invalid credentials');
        err.statusCode = 400;
        throw err;
      })
    };
    const { rootValue } = loadAuthSchemaWithMocks({ db, authService, authApiService: {} });

    const ctx = { req: { session: {} } };
    const result = await rootValue.login({ email: 'a', password: 'b' }, ctx);
    expect(result).toMatchObject({ success: false, message: 'Invalid credentials', restoreRequired: false });
  });

  test('myContactQueries maps ids + dates', async () => {
    const db = {};
    const authApiService = {
      getMyContactQueries: jest.fn(async () => ({
        queries: [
          {
            _id: { toString: () => 'q1' },
            name: 'Alice',
            email: 'a@example.com',
            message: 'Hi',
            submission_date: new Date('2025-01-01T00:00:00Z'),
            status: 'pending',
            status_updated_at: new Date('2025-01-02T00:00:00Z')
          }
        ]
      }))
    };
    const authService = { getSession: jest.fn(() => ({})) };
    const { rootValue } = loadAuthSchemaWithMocks({ db, authService, authApiService });

    const ctx = { req: { session: {} } };
    const result = await rootValue.myContactQueries({}, ctx);
    expect(result.success).toBe(true);
    expect(result.queries[0]).toMatchObject({ id: 'q1', submission_date: expect.stringContaining('2025-01-01') });
  });
});

