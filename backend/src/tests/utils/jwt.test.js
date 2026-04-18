const jwt = require('jsonwebtoken');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  extractTokenFromHeader
} = require('../../utils/jwt'); // Assume jwt.js exports these functions properly

describe('JWT Utility', () => {
  const mockUser = {
    _id: '60d21b4667d0d8992e610c85',
    email: 'test@college.edu',
    role: 'Player',
    isSuperAdmin: false,
    name: 'Test User',
    college: 'Engineering College'
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Generation', () => {
    it('should generate an access token with correct payload', () => {
      const token = generateAccessToken(mockUser);
      expect(typeof token).toBe('string');
      // Decode and check
      const decodedPayload = verifyAccessToken(token);
      expect(decodedPayload.userId).toBe(mockUser._id);
      expect(decodedPayload.email).toBe(mockUser.email);
      expect(decodedPayload.role).toBe(mockUser.role);
      expect(decodedPayload.type).toBe('access');
    });

    it('should generate a refresh token with correct payload', () => {
      const token = generateRefreshToken(mockUser);
      expect(typeof token).toBe('string');
      // Decode and check
      const decodedPayload = verifyRefreshToken(token);
      expect(decodedPayload.userId).toBe(mockUser._id);
      expect(decodedPayload.email).toBe(mockUser.email);
      expect(decodedPayload.role).toBe(mockUser.role);
      expect(decodedPayload.type).toBe('refresh');
    });

    it('should return null for invalid access token verification', () => {
      const invalidToken = 'invalid.token.here';
      const result = verifyAccessToken(invalidToken);
      expect(result).toBeNull();
    });

    it('should return null for invalid refresh token verification', () => {
      const invalidToken = 'invalid.token.here';
      const result = verifyRefreshToken(invalidToken);
      expect(result).toBeNull();
    });

    it('should generate a token pair', () => {
      const pair = generateTokenPair(mockUser);
      expect(pair).toHaveProperty('accessToken');
      expect(pair).toHaveProperty('refreshToken');
      expect(pair).toHaveProperty('expiresIn');
      expect(pair.expiresIn).toBe(1800); // 30 minutes
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from Bearer schema', () => {
      const req = { headers: { authorization: 'Bearer test-token' } };
      const token = extractTokenFromHeader(req);
      expect(token).toBe('test-token');
    });

    it('should return null if no token is provided', () => {
      const req = { headers: {} };
      const token = extractTokenFromHeader(req);
      expect(token).toBeNull();
    });
  });
});
