function createRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function createReq({ session, headers } = {}) {
  const lower = {};
  for (const [k, v] of Object.entries(headers || {})) lower[String(k).toLowerCase()] = v;
  return {
    session,
    user: undefined,
    get(name) {
      return lower[String(name).toLowerCase()];
    }
  };
}

function loadRoleAuthWithJwtMocks({ token, decoded }) {
  jest.resetModules();
  const verifyAccessToken = jest.fn(() => decoded);
  const extractTokenFromHeader = jest.fn(() => token);
  jest.doMock('../../utils/jwt', () => ({
    verifyAccessToken,
    extractTokenFromHeader
  }));

  // eslint-disable-next-line global-require
  const roleAuth = require('../../middlewares/roleAuth');
  return { roleAuth, verifyAccessToken, extractTokenFromHeader };
}

describe('roleAuth middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('authenticateJWT', () => {
    test('token present + valid => next() and hydrates req.user + session', () => {
      const decoded = {
        userId: 'u1',
        email: 'a@example.com',
        role: 'player',
        isSuperAdmin: true,
        username: 'alice',
        college: 'ABC'
      };
      const { roleAuth } = loadRoleAuthWithJwtMocks({ token: 'token', decoded });

      const req = createReq({ session: {} });
      const res = createRes();
      const next = jest.fn();

      roleAuth.authenticateJWT(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toMatchObject({
        userId: 'u1',
        email: 'a@example.com',
        role: 'player',
        isSuperAdmin: true,
        username: 'alice',
        college: 'ABC'
      });
      expect(req.session).toMatchObject({
        userID: 'u1',
        userEmail: 'a@example.com',
        userRole: 'player',
        username: 'alice',
        userCollege: 'ABC',
        isSuperAdmin: true
      });
      expect(res.status).not.toHaveBeenCalled();
    });

    test('token present + invalid => 401 TOKEN_EXPIRED', () => {
      const { roleAuth } = loadRoleAuthWithJwtMocks({ token: 'token', decoded: null });
      const req = createReq({ session: {} });
      const res = createRes();
      const next = jest.fn();

      roleAuth.authenticateJWT(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    });

    test('no token + session present => next() and populates req.user', () => {
      const { roleAuth } = loadRoleAuthWithJwtMocks({ token: null, decoded: null });
      const req = createReq({
        session: {
          userID: 'u2',
          userEmail: 'b@example.com',
          userRole: 'coordinator',
          username: 'bob',
          userCollege: 'XYZ',
          isSuperAdmin: false
        }
      });
      const res = createRes();
      const next = jest.fn();

      roleAuth.authenticateJWT(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toMatchObject({
        userId: 'u2',
        email: 'b@example.com',
        role: 'coordinator',
        isSuperAdmin: false,
        username: 'bob',
        college: 'XYZ'
      });
    });

    test('no token + no session => 401 NO_AUTH', () => {
      const { roleAuth } = loadRoleAuthWithJwtMocks({ token: null, decoded: null });
      const req = createReq({ session: {} });
      const res = createRes();
      const next = jest.fn();

      roleAuth.authenticateJWT(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Authentication required', code: 'NO_AUTH' });
    });
  });

  describe('isPlayer', () => {
    test('token valid + role player => next()', () => {
      const decoded = { userId: 'u1', email: 'a@example.com', role: 'player', username: 'alice' };
      const { roleAuth } = loadRoleAuthWithJwtMocks({ token: 'token', decoded });
      const req = createReq({ session: {} });
      const res = createRes();
      const next = jest.fn();

      roleAuth.isPlayer(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('token valid + wrong role => 403', () => {
      const decoded = { userId: 'u1', email: 'a@example.com', role: 'admin', username: 'alice' };
      const { roleAuth } = loadRoleAuthWithJwtMocks({ token: 'token', decoded });
      const req = createReq({ session: {} });
      const res = createRes();
      const next = jest.fn();

      roleAuth.isPlayer(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Unauthorized' });
    });

    test('token invalid => 401 TOKEN_EXPIRED', () => {
      const { roleAuth } = loadRoleAuthWithJwtMocks({ token: 'token', decoded: null });
      const req = createReq({ session: {} });
      const res = createRes();
      const next = jest.fn();

      roleAuth.isPlayer(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    });

    test('dev headers => bypass and hydrates session', () => {
      const { roleAuth } = loadRoleAuthWithJwtMocks({ token: null, decoded: null });
      const req = createReq({
        session: undefined,
        headers: {
          'x-dev-role': 'player',
          'x-dev-email': 'dev@example.com',
          'x-dev-username': 'devuser'
        }
      });
      const res = createRes();
      const next = jest.fn();

      roleAuth.isPlayer(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.session).toMatchObject({
        userRole: 'player',
        userEmail: 'dev@example.com',
        username: 'devuser'
      });
    });

    test('session role player (production) => next()', () => {
      process.env.NODE_ENV = 'production';
      const { roleAuth } = loadRoleAuthWithJwtMocks({ token: null, decoded: null });
      const req = createReq({
        session: {
          userRole: 'player',
          userEmail: 'sess@example.com',
          username: 'sessuser'
        }
      });
      const res = createRes();
      const next = jest.fn();

      roleAuth.isPlayer(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('no auth => 403', () => {
      const { roleAuth } = loadRoleAuthWithJwtMocks({ token: null, decoded: null });
      const req = createReq({ session: {} });
      const res = createRes();
      const next = jest.fn();

      roleAuth.isPlayer(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Unauthorized' });
    });
  });

  test('getUserRole/getUserEmail read from req.user then session', () => {
    const { roleAuth } = loadRoleAuthWithJwtMocks({ token: null, decoded: null });

    const req1 = createReq({ session: { userRole: 'player', userEmail: 's@example.com' } });
    expect(roleAuth.getUserRole(req1)).toBe('player');
    expect(roleAuth.getUserEmail(req1)).toBe('s@example.com');

    const req2 = createReq({ session: {}, headers: {} });
    req2.user = { role: 'admin', email: 'u@example.com' };
    expect(roleAuth.getUserRole(req2)).toBe('admin');
    expect(roleAuth.getUserEmail(req2)).toBe('u@example.com');
  });
});

