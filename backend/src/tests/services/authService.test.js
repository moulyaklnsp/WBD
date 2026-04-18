function loadAuthServiceWithMocks(overrides = {}) {
  jest.resetModules();

  const UserModel = {
    findByEmail: jest.fn(),
    verifyPassword: jest.fn(),
    isSelfDeleted: jest.fn(() => false),
    findOne: jest.fn(),
    findByIdAndEmail: jest.fn(),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
    ...overrides.userModel
  };

  const TokenModel = {
    create: jest.fn(async () => ({})),
    revokeByToken: jest.fn(async () => ({})),
    findByToken: jest.fn(async () => null),
    revoke: jest.fn(async () => ({})),
    revokeAll: jest.fn(async () => ({})),
    ...overrides.tokenModel
  };

  const jwtMocks = {
    generateTokenPair: jest.fn(() => ({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 3600
    })),
    verifyRefreshToken: jest.fn(() => null),
    verifyAccessToken: jest.fn(() => null),
    extractTokenFromHeader: jest.fn(() => null),
    ...overrides.jwt
  };

  jest.doMock('../../models', () => ({
    getModel: (name) => {
      if (name === 'users') return UserModel;
      if (name === 'refresh_tokens') return TokenModel;
      throw new Error(`Unexpected model name: ${name}`);
    }
  }));

  jest.doMock('../../utils/jwt', () => jwtMocks);

  // eslint-disable-next-line global-require
  const AuthService = require('../../services/authService');
  return { AuthService, UserModel, TokenModel, jwtMocks };
}

describe('AuthService', () => {
  describe('login', () => {
    test('throws 400 when user not found', async () => {
      const { AuthService, UserModel } = loadAuthServiceWithMocks();
      UserModel.findByEmail.mockResolvedValueOnce(null);

      await expect(AuthService.login({}, 'a@example.com', 'pw', {}))
        .rejects
        .toMatchObject({ statusCode: 400, message: 'Invalid credentials' });
    });

    test('throws 400 when password invalid', async () => {
      const { AuthService, UserModel } = loadAuthServiceWithMocks();
      UserModel.findByEmail.mockResolvedValueOnce({ _id: { toString: () => 'u1' }, email: 'a@example.com' });
      UserModel.verifyPassword.mockResolvedValueOnce(false);

      await expect(AuthService.login({}, 'a@example.com', 'pw', {}))
        .rejects
        .toMatchObject({ statusCode: 400, message: 'Invalid credentials' });
    });

    test('deleted by admin => 403', async () => {
      const { AuthService, UserModel } = loadAuthServiceWithMocks({
        userModel: {
          isSelfDeleted: jest.fn(() => false)
        }
      });
      UserModel.findByEmail.mockResolvedValueOnce({
        _id: { toString: () => 'u1' },
        email: 'a@example.com',
        role: 'player',
        isDeleted: 1,
        isSuperAdmin: false
      });
      UserModel.verifyPassword.mockResolvedValueOnce(true);

      await expect(AuthService.login({}, 'a@example.com', 'pw', {}))
        .rejects
        .toMatchObject({ statusCode: 403 });
    });

    test('self-deleted => 403 restoreRequired payload', async () => {
      const { AuthService, UserModel } = loadAuthServiceWithMocks({
        userModel: {
          isSelfDeleted: jest.fn(() => true)
        }
      });
      UserModel.findByEmail.mockResolvedValueOnce({
        _id: { toString: () => 'u1' },
        email: 'a@example.com',
        role: 'player',
        isDeleted: 1
      });
      UserModel.verifyPassword.mockResolvedValueOnce(true);

      await expect(AuthService.login({}, 'a@example.com', 'pw', {}))
        .rejects
        .toMatchObject({ statusCode: 403, restoreRequired: true, deletedUserId: 'u1', deletedUserRole: 'player' });
    });

    test('success => returns tokens + redirect and hydrates session', async () => {
      const { AuthService, UserModel, TokenModel, jwtMocks } = loadAuthServiceWithMocks();
      const user = {
        _id: { toString: () => 'u1' },
        email: 'a@example.com',
        role: 'player',
        isSuperAdmin: true,
        name: 'Alice',
        college: 'ABC',
        isDeleted: 0
      };
      UserModel.findByEmail.mockResolvedValueOnce(user);
      UserModel.verifyPassword.mockResolvedValueOnce(true);

      const session = {};
      const result = await AuthService.login({}, 'a@example.com', 'pw', session);

      expect(jwtMocks.generateTokenPair).toHaveBeenCalledTimes(1);
      expect(TokenModel.create).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        redirectUrl: expect.stringContaining('/player/player_dashboard'),
        tokens: expect.objectContaining({ accessToken: 'access', refreshToken: 'refresh' }),
        user: expect.objectContaining({ email: 'a@example.com', role: 'player', isSuperAdmin: true, username: 'Alice', college: 'ABC' })
      });
      expect(session).toMatchObject({
        userEmail: 'a@example.com',
        userRole: 'player',
        username: 'Alice',
        userCollege: 'ABC',
        isSuperAdmin: true
      });
    });

    test('unknown role => 400 Invalid Role', async () => {
      const { AuthService, UserModel } = loadAuthServiceWithMocks();
      UserModel.findByEmail.mockResolvedValueOnce({
        _id: { toString: () => 'u1' },
        email: 'a@example.com',
        role: 'unknown',
        isDeleted: 0,
        name: 'Alice'
      });
      UserModel.verifyPassword.mockResolvedValueOnce(true);

      await expect(AuthService.login({}, 'a@example.com', 'pw', {}))
        .rejects
        .toMatchObject({ statusCode: 400, message: 'Invalid Role' });
    });
  });

  describe('rotateRefreshToken', () => {
    test('invalid refresh token => 401 INVALID_REFRESH_TOKEN', async () => {
      const { AuthService } = loadAuthServiceWithMocks({
        jwt: { verifyRefreshToken: jest.fn(() => null) }
      });

      await expect(AuthService.rotateRefreshToken({}, 'bad', {}))
        .rejects
        .toMatchObject({ statusCode: 401, code: 'INVALID_REFRESH_TOKEN' });
    });

    test('revoked refresh token => 401 REVOKED_REFRESH_TOKEN', async () => {
      const { AuthService } = loadAuthServiceWithMocks({
        jwt: { verifyRefreshToken: jest.fn(() => ({ email: 'a@example.com' })) },
        tokenModel: { findByToken: jest.fn(async () => null) }
      });

      await expect(AuthService.rotateRefreshToken({}, 'refresh', {}))
        .rejects
        .toMatchObject({ statusCode: 401, code: 'REVOKED_REFRESH_TOKEN' });
    });

    test('success rotates token and hydrates session', async () => {
      const { AuthService, TokenModel, UserModel } = loadAuthServiceWithMocks({
        jwt: { verifyRefreshToken: jest.fn(() => ({ email: 'a@example.com' })) },
        tokenModel: {
          findByToken: jest.fn(async () => ({ _id: 't1', token: 'refresh' }))
        }
      });
      UserModel.findOne.mockResolvedValueOnce({
        _id: { toString: () => 'u1' },
        email: 'a@example.com',
        role: 'player',
        isSuperAdmin: false,
        name: 'Alice',
        college: 'ABC'
      });

      const session = {};
      const result = await AuthService.rotateRefreshToken({}, 'refresh', session);

      expect(TokenModel.revoke).toHaveBeenCalledWith({}, 't1');
      expect(TokenModel.create).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        tokens: expect.any(Object),
        user: expect.objectContaining({ email: 'a@example.com', role: 'player' })
      });
      expect(session.userEmail).toBe('a@example.com');
    });
  });

  describe('revokeAllTokens', () => {
    test('no token and no session => 401', async () => {
      const { AuthService } = loadAuthServiceWithMocks();
      await expect(AuthService.revokeAllTokens({}, { session: {} }))
        .rejects
        .toMatchObject({ statusCode: 401, message: 'Authentication required' });
    });

    test('session email => revokeAll called', async () => {
      const { AuthService, TokenModel } = loadAuthServiceWithMocks();
      await AuthService.revokeAllTokens({}, { session: { userEmail: 'a@example.com' } });
      expect(TokenModel.revokeAll).toHaveBeenCalledWith({}, 'a@example.com');
    });
  });

  describe('restoreAccount', () => {
    test('invalid id => 400', async () => {
      const { AuthService } = loadAuthServiceWithMocks();
      await expect(AuthService.restoreAccount({}, { id: 'bad', email: 'a@example.com', password: 'pw' }, {}))
        .rejects
        .toMatchObject({ statusCode: 400, message: 'Invalid user id' });
    });
  });

  describe('getSession', () => {
    test('token decodes => authenticated true', () => {
      const { AuthService } = loadAuthServiceWithMocks({
        jwt: {
          extractTokenFromHeader: jest.fn(() => 'token'),
          verifyAccessToken: jest.fn(() => ({
            email: 'a@example.com',
            role: 'player',
            isSuperAdmin: true,
            username: 'alice',
            userId: 'u1',
            college: 'ABC'
          }))
        }
      });

      const result = AuthService.getSession({ session: {} });
      expect(result).toMatchObject({ authenticated: true, userEmail: 'a@example.com', userRole: 'player', username: 'alice' });
    });

    test('no token => falls back to session', () => {
      const { AuthService } = loadAuthServiceWithMocks({
        jwt: {
          extractTokenFromHeader: jest.fn(() => null)
        }
      });

      const result = AuthService.getSession({ session: { userEmail: 's@example.com', userRole: 'admin', username: 's' } });
      expect(result).toMatchObject({ authenticated: true, userEmail: 's@example.com', userRole: 'admin', username: 's' });
    });
  });
});

