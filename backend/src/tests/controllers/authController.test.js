function createRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.redirect = jest.fn(() => res);
  return res;
}

function createReq({ body, session } = {}) {
  return { body: body || {}, session: session || {} };
}

function createDbMock(collections = {}) {
  return {
    collection(name) {
      const col = collections[name];
      if (!col) throw new Error(`Unexpected collection: ${name}`);
      return col;
    }
  };
}

function loadAuthControllerWithMocks({ db, authApiService, authService } = {}) {
  jest.resetModules();

  const connectDB = jest.fn(async () => db);
  jest.doMock('../../config/database', () => ({ connectDB }));
  jest.doMock('../../services/authApiService', () => authApiService);
  jest.doMock('../../services/authService', () => authService);

  // eslint-disable-next-line global-require
  const authController = require('../../controllers/authController');
  return { authController, connectDB };
}

describe('authController', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('apiSignup success + error formatting', async () => {
    const db = createDbMock();
    const authApiService = {
      apiSignup: jest.fn(async () => ({ message: 'OTP sent', pendingApproval: false, emailSent: true }))
    };
    const { authController } = loadAuthControllerWithMocks({ db, authApiService, authService: {} });

    const req1 = createReq({ body: { email: 'a@example.com' }, session: {} });
    const res1 = createRes();
    await authController.apiSignup(req1, res1);
    expect(res1.json).toHaveBeenCalledWith({ success: true, message: 'OTP sent', pendingApproval: false, emailSent: true });

    authApiService.apiSignup.mockRejectedValueOnce(Object.assign(new Error('Validation failed'), { statusCode: 400, errors: { email: 'bad' } }));
    const req2 = createReq({ body: {}, session: {} });
    const res2 = createRes();
    await authController.apiSignup(req2, res2);
    expect(res2.status).toHaveBeenCalledWith(400);
    expect(res2.json).toHaveBeenCalledWith({ success: false, message: 'Validation failed', errors: { email: 'bad' } });
  });

  test('apiContactus returns success + propagates validation errors', async () => {
    const db = createDbMock();
    const authApiService = {
      apiContactus: jest.fn(async () => ({ message: 'Message sent successfully!' }))
    };
    const { authController } = loadAuthControllerWithMocks({ db, authApiService, authService: {} });

    const req1 = createReq({ body: { name: 'A', email: 'a@example.com', message: 'Hi' }, session: {} });
    const res1 = createRes();
    await authController.apiContactus(req1, res1);
    expect(res1.json).toHaveBeenCalledWith({ success: true, message: 'Message sent successfully!' });

    authApiService.apiContactus.mockRejectedValueOnce(Object.assign(new Error('Validation failed'), { statusCode: 400, errors: { message: 'too long' } }));
    const req2 = createReq({ body: { name: 'A' }, session: {} });
    const res2 = createRes();
    await authController.apiContactus(req2, res2);
    expect(res2.status).toHaveBeenCalledWith(400);
    expect(res2.json).toHaveBeenCalledWith({ success: false, message: 'Validation failed', errors: { message: 'too long' } });
  });

  test('login handles success + restoreRequired errors', async () => {
    const db = createDbMock();
    const authService = {
      login: jest.fn(async () => ({
        redirectUrl: '/player',
        tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 3600 },
        user: { id: 'u1', email: 'a@example.com', role: 'player', username: 'A' }
      }))
    };
    const { authController } = loadAuthControllerWithMocks({ db, authApiService: {}, authService });

    const req1 = createReq({ body: { email: 'a@example.com', password: 'pw' }, session: {} });
    const res1 = createRes();
    await authController.login(req1, res1);
    expect(res1.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, redirectUrl: '/player', accessToken: 'a' }));

    authService.login.mockRejectedValueOnce(
      Object.assign(new Error('Restore required'), { statusCode: 403, restoreRequired: true, deletedUserId: 'u1', deletedUserRole: 'player' })
    );
    const req2 = createReq({ body: { email: 'a@example.com', password: 'pw' }, session: {} });
    const res2 = createRes();
    await authController.login(req2, res2);
    expect(res2.status).toHaveBeenCalledWith(403);
    expect(res2.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, restoreRequired: true, deletedUserId: 'u1' }));
  });

  test('refreshToken validates presence and forwards authService errors', async () => {
    const db = createDbMock();
    const authService = {
      rotateRefreshToken: jest.fn(async () => ({
        tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 1 },
        user: { id: 'u1' }
      }))
    };
    const { authController } = loadAuthControllerWithMocks({ db, authApiService: {}, authService });

    const res1 = createRes();
    await authController.refreshToken(createReq({ body: {}, session: {} }), res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    authService.rotateRefreshToken.mockRejectedValueOnce(Object.assign(new Error('Bad token'), { statusCode: 401, code: 'INVALID_REFRESH_TOKEN' }));
    const res2 = createRes();
    await authController.refreshToken(createReq({ body: { refreshToken: 'x' }, session: {} }), res2);
    expect(res2.status).toHaveBeenCalledWith(401);
    expect(res2.json).toHaveBeenCalledWith({ success: false, message: 'Bad token', code: 'INVALID_REFRESH_TOKEN' });
  });

  test('logout returns success even when authService fails', async () => {
    const db = createDbMock();
    const authService = {
      logout: jest.fn(async () => {
        throw new Error('fail');
      })
    };
    const { authController } = loadAuthControllerWithMocks({ db, authApiService: {}, authService });

    const res = createRes();
    await authController.logout(createReq({ body: { refreshToken: 'r' }, session: {} }), res);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Logged out' });
  });

  test('restoreAccount validates required fields and returns redirectUrl', async () => {
    const db = createDbMock();
    const authService = {
      restoreAccount: jest.fn(async () => ({ redirectUrl: '/player' }))
    };
    const { authController } = loadAuthControllerWithMocks({ db, authApiService: {}, authService });

    const res1 = createRes();
    await authController.restoreAccount(createReq({ body: {}, session: {} }), res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = createRes();
    await authController.restoreAccount(createReq({ body: { id: 'u1', email: 'a@example.com', password: 'pw' }, session: {} }), res2);
    expect(res2.json).toHaveBeenCalledWith({ success: true, message: 'Account restored successfully!', redirectUrl: '/player' });
  });

  test('theme + verifyReactivationOtp endpoints', async () => {
    const db = createDbMock();
    const authApiService = {
      verifyReactivationOtp: jest.fn(() => {
        throw Object.assign(new Error('Removed'), { statusCode: 410 });
      }),
      getTheme: jest.fn(async () => ({ theme: 'dark' })),
      setTheme: jest.fn(async () => ({ message: 'Theme saved' }))
    };
    const { authController } = loadAuthControllerWithMocks({ db, authApiService, authService: {} });

    const res1 = createRes();
    await authController.verifyReactivationOtp(createReq({}), res1);
    expect(res1.status).toHaveBeenCalledWith(410);

    const res2 = createRes();
    await authController.getTheme(createReq({ session: {} }), res2);
    expect(res2.json).toHaveBeenCalledWith({ success: true, theme: 'dark' });

    authApiService.setTheme.mockRejectedValueOnce(Object.assign(new Error('Invalid theme value'), { statusCode: 400 }));
    const res3 = createRes();
    await authController.setTheme(createReq({ body: { theme: 'bad' }, session: {} }), res3);
    expect(res3.status).toHaveBeenCalledWith(400);
  });

  test('addFunds redirects on invalid conditions and success', async () => {
    const users = { findOne: jest.fn(async () => ({ _id: 'u1', email: 'p@example.com' })) };
    const balances = { updateOne: jest.fn(async () => ({})) };
    const db = createDbMock({ users, user_balances: balances });

    const { authController } = loadAuthControllerWithMocks({ db, authApiService: {}, authService: {} });

    const res1 = createRes();
    await authController.addFunds(createReq({ session: {}, body: { amount: '10', redirectTo: '/player/store' } }), res1);
    expect(res1.redirect).toHaveBeenCalledWith('/player/store?error-message=Please log in to add funds');

    const res2 = createRes();
    await authController.addFunds(createReq({ session: { userEmail: 'p@example.com' }, body: { amount: '0', redirectTo: '/player/store' } }), res2);
    expect(res2.redirect).toHaveBeenCalledWith('/player/store?error-message=Please enter a valid amount greater than 0');

    users.findOne.mockResolvedValueOnce(null);
    const res3 = createRes();
    await authController.addFunds(createReq({ session: { userEmail: 'p@example.com' }, body: { amount: '10', redirectTo: '/player/store' } }), res3);
    expect(res3.redirect).toHaveBeenCalledWith('/player/store?error-message=User not found');

    users.findOne.mockResolvedValueOnce({ _id: 'u1', email: 'p@example.com' });
    balances.updateOne.mockRejectedValueOnce(new Error('db'));
    const res4 = createRes();
    await authController.addFunds(createReq({ session: { userEmail: 'p@example.com' }, body: { amount: '10', redirectTo: '/player/store' } }), res4);
    expect(res4.redirect).toHaveBeenCalledWith('/player/store?error-message=Failed to add funds due to a server error');

    balances.updateOne.mockResolvedValueOnce({});
    const res5 = createRes();
    await authController.addFunds(createReq({ session: { userEmail: 'p@example.com' }, body: { amount: '10', redirectTo: '/player/store' } }), res5);
    expect(res5.redirect).toHaveBeenCalledWith('/player/store?success-message=Funds added successfully');
  });
});

