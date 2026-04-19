function createDb(collections) {
  return {
    collection(name) {
      const col = collections[name];
      if (!col) throw new Error(`Unexpected collection: ${name}`);
      return col;
    }
  };
}

function loadAuthApiServiceWithMocks(overrides = {}) {
  jest.resetModules();

  const bcrypt = {
    hash: jest.fn(async () => 'hashed'),
    compare: jest.fn(async () => true),
    ...overrides.bcrypt
  };
  const emailService = {
    sendOtpEmail: jest.fn(async () => ({ sent: true })),
    sendForgotPasswordOtp: jest.fn(async () => ({ sent: true })),
    ...overrides.emailService
  };
  const jwt = {
    generateTokenPair: jest.fn(() => ({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 })),
    ...overrides.jwt
  };
  const socketService = {
    getIO: jest.fn(() => null),
    ...overrides.socketService
  };

  jest.doMock('bcryptjs', () => bcrypt);
  jest.doMock('../../services/emailService', () => emailService);
  jest.doMock('../../utils/jwt', () => jwt);
  jest.doMock('../../services/socketService', () => socketService);

  // eslint-disable-next-line global-require
  const AuthApiService = require('../../services/authApiService');

  return { AuthApiService, bcrypt, emailService, jwt, socketService };
}

describe('AuthApiService', () => {
  describe('apiSignup', () => {
    test('validation errors => throws 400 with errors', async () => {
      const { AuthApiService } = loadAuthApiServiceWithMocks();
      const db = createDb({});

      await expect(AuthApiService.apiSignup(db, { email: 'bad' }))
        .rejects
        .toMatchObject({ statusCode: 400, message: 'Validation failed', errors: expect.any(Object) });
    });

    test('existing user => 409', async () => {
      const { AuthApiService, bcrypt } = loadAuthApiServiceWithMocks();
      const users = { findOne: jest.fn(async () => ({ _id: 'u1' })) };
      const db = createDb({ users });

      await expect(AuthApiService.apiSignup(db, {
        name: 'Alice',
        dob: '2000-01-01',
        gender: 'female',
        college: 'ABC',
        email: 'alice@example.com',
        phone: '1234567890',
        password: 'Password!1',
        role: 'player'
      })).rejects.toMatchObject({ statusCode: 409, message: 'Email already registered' });

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    test('coordinator signup: active coordinator exists => 409', async () => {
      const { AuthApiService } = loadAuthApiServiceWithMocks();
      const users = {
        findOne: jest.fn()
          .mockResolvedValueOnce(null) // existing user check
          .mockResolvedValueOnce({ _id: 'c1' }) // active coordinator exists
      };
      const pending = { findOne: jest.fn() };
      const db = createDb({ users, pending_coordinators: pending });

      await expect(AuthApiService.apiSignup(db, {
        name: 'Coord User',
        dob: '2000-01-01',
        gender: 'male',
        college: 'MyCollege',
        email: 'coord@example.com',
        phone: '1234567890',
        password: 'Password!1',
        role: 'coordinator'
      })).rejects.toMatchObject({ statusCode: 409, message: 'Already a coordinator exists from this college' });
    });

    test('coordinator signup: pending request exists => 409', async () => {
      const { AuthApiService } = loadAuthApiServiceWithMocks();
      const users = {
        findOne: jest.fn()
          .mockResolvedValueOnce(null) // existing user
          .mockResolvedValueOnce(null) // active coordinator
      };
      const pending = {
        findOne: jest.fn(async () => ({ _id: 'p1' })),
        insertOne: jest.fn()
      };
      const db = createDb({ users, pending_coordinators: pending });

      await expect(AuthApiService.apiSignup(db, {
        name: 'Coord User',
        dob: '2000-01-01',
        gender: 'male',
        college: 'MyCollege',
        email: 'coord@example.com',
        phone: '1234567890',
        password: 'Password!1',
        role: 'coordinator'
      })).rejects.toMatchObject({ statusCode: 409, message: 'A coordinator signup request is already pending for this college' });
    });

    test('coordinator signup: success stores pending and emits socket event', async () => {
      const io = { to: jest.fn(() => ({ emit: jest.fn() })) };
      const { AuthApiService, socketService } = loadAuthApiServiceWithMocks({
        socketService: { getIO: jest.fn(() => io) }
      });
      const users = {
        findOne: jest.fn()
          .mockResolvedValueOnce(null) // existing user
          .mockResolvedValueOnce(null) // active coordinator
      };
      const pending = {
        findOne: jest.fn(async () => null),
        insertOne: jest.fn(async () => ({ insertedId: 'p1' }))
      };
      const db = createDb({ users, pending_coordinators: pending });

      const result = await AuthApiService.apiSignup(db, {
        name: 'Coord User',
        dob: '2000-01-01',
        gender: 'male',
        college: 'MyCollege',
        email: 'coord@example.com',
        phone: '1234567890',
        password: 'Password!1',
        role: 'coordinator'
      });

      expect(result).toMatchObject({ pendingApproval: true });
      expect(pending.insertOne).toHaveBeenCalledTimes(1);
      expect(socketService.getIO).toHaveBeenCalledTimes(1);
      expect(io.to).toHaveBeenCalledWith('organizer_room');
    });

    test('player signup: creates signup + OTP records and sends email', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0); // otp=100000
      const { AuthApiService, emailService } = loadAuthApiServiceWithMocks();

      const users = { findOne: jest.fn(async () => null) };
      const signupOtps = { insertOne: jest.fn(async () => ({ insertedId: 's1' })) };
      const otps = { insertOne: jest.fn(async () => ({ insertedId: 'o1' })) };
      const db = createDb({ users, signup_otps: signupOtps, otps });

      const result = await AuthApiService.apiSignup(db, {
        name: 'Alice',
        dob: '2000-01-01',
        gender: 'female',
        college: 'ABC',
        email: 'alice@example.com',
        phone: '1234567890',
        password: 'Password!1',
        role: 'player'
      });

      expect(result).toMatchObject({ message: expect.stringContaining('OTP sent') });
      expect(signupOtps.insertOne).toHaveBeenCalledTimes(1);
      expect(otps.insertOne).toHaveBeenCalledWith(expect.objectContaining({ email: 'alice@example.com', type: 'signup', otp: '100000' }));
      expect(emailService.sendOtpEmail).toHaveBeenCalledWith('alice@example.com', '100000');
      Math.random.mockRestore();
    });
  });

  describe('verifySignupOtp', () => {
    test('missing fields => 400', async () => {
      const { AuthApiService } = loadAuthApiServiceWithMocks();
      const db = createDb({});
      await expect(AuthApiService.verifySignupOtp(db, { email: '', otp: '' }, {}))
        .rejects
        .toMatchObject({ statusCode: 400, message: 'Email and OTP required' });
    });

    test('invalid OTP => 400', async () => {
      const { AuthApiService } = loadAuthApiServiceWithMocks();
      const otps = { findOne: jest.fn(async () => null) };
      const db = createDb({ otps });
      await expect(AuthApiService.verifySignupOtp(db, { email: 'a@example.com', otp: '000' }, {}))
        .rejects
        .toMatchObject({ statusCode: 400, message: 'Invalid OTP' });
    });

    test('success inserts user, creates refresh token and hydrates session', async () => {
      const { AuthApiService, jwt } = loadAuthApiServiceWithMocks({
        jwt: { generateTokenPair: jest.fn(() => ({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600 })) }
      });

      const insertedId = { toString: () => 'u1' };
      const otps = {
        findOne: jest.fn(async () => ({ _id: 'otp1', expires_at: new Date(Date.now() + 60000) })),
        updateOne: jest.fn(async () => ({ modifiedCount: 1 }))
      };
      const signupOtps = {
        findOne: jest.fn(async () => ({
          _id: 's1',
          data: {
            name: 'Alice',
            email: 'a@example.com',
            role: 'player',
            college: 'ABC',
            password: '$2b$10$alreadyhashed',
            aicf_id: 'A1',
            fide_id: 'F1'
          }
        })),
        deleteOne: jest.fn(async () => ({}))
      };
      const users = { insertOne: jest.fn(async () => ({ insertedId })) };
      const balances = { insertOne: jest.fn(async () => ({})) };
      const refreshTokens = { insertOne: jest.fn(async () => ({})) };
      const db = createDb({
        otps,
        signup_otps: signupOtps,
        users,
        user_balances: balances,
        refresh_tokens: refreshTokens
      });

      const session = {};
      const result = await AuthApiService.verifySignupOtp(db, { email: 'a@example.com', otp: '123' }, session);

      expect(users.insertOne).toHaveBeenCalledTimes(1);
      expect(balances.insertOne).toHaveBeenCalledTimes(1);
      expect(refreshTokens.insertOne).toHaveBeenCalledTimes(1);
      expect(jwt.generateTokenPair).toHaveBeenCalledTimes(1);
      expect(session).toMatchObject({ userEmail: 'a@example.com', userRole: 'player', username: 'Alice' });
      expect(result).toMatchObject({ redirectUrl: expect.stringContaining('/player/player_dashboard'), accessToken: 'a', refreshToken: 'r' });
    });
  });

  describe('forgotPassword', () => {
    test('invalid email => 400', async () => {
      const { AuthApiService } = loadAuthApiServiceWithMocks();
      const db = createDb({});
      await expect(AuthApiService.forgotPassword(db, { email: 'bad' }))
        .rejects
        .toMatchObject({ statusCode: 400, message: 'Valid email is required' });
    });

    test('user not found => 404', async () => {
      const { AuthApiService } = loadAuthApiServiceWithMocks();
      const users = { findOne: jest.fn(async () => null) };
      const db = createDb({ users });
      await expect(AuthApiService.forgotPassword(db, { email: 'a@example.com' }))
        .rejects
        .toMatchObject({ statusCode: 404 });
    });

    test('success creates OTP and sends email', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      const { AuthApiService, emailService } = loadAuthApiServiceWithMocks();
      const users = { findOne: jest.fn(async () => ({ _id: 'u1' })) };
      const otps = { deleteMany: jest.fn(async () => ({})), insertOne: jest.fn(async () => ({})) };
      const db = createDb({ users, otps });

      const result = await AuthApiService.forgotPassword(db, { email: 'a@example.com' });
      expect(result).toMatchObject({ message: expect.stringContaining('OTP sent') });
      expect(otps.deleteMany).toHaveBeenCalledTimes(1);
      expect(otps.insertOne).toHaveBeenCalledWith(expect.objectContaining({ type: 'forgot-password', otp: '100000' }));
      expect(emailService.sendForgotPasswordOtp).toHaveBeenCalledWith('a@example.com', '100000');
      Math.random.mockRestore();
    });
  });

  describe('apiContactus', () => {
    test('rejects too many words => 400 with errors', async () => {
      const { AuthApiService } = loadAuthApiServiceWithMocks();
      const contact = { insertOne: jest.fn(async () => ({})) };
      const db = createDb({ contact });
      const longMessage = Array.from({ length: 201 }, () => 'w').join(' ');

      await expect(AuthApiService.apiContactus(db, {
        name: 'Alice',
        email: 'a@example.com',
        message: longMessage
      }, { userEmail: 'a@example.com' })).rejects.toMatchObject({ statusCode: 400, errors: expect.any(Object) });
    });

    test('success inserts contact row', async () => {
      const { AuthApiService } = loadAuthApiServiceWithMocks();
      const contact = { insertOne: jest.fn(async () => ({})) };
      const db = createDb({ contact });

      const result = await AuthApiService.apiContactus(db, {
        name: 'Alice',
        email: 'a@example.com',
        message: 'Hello'
      }, { userEmail: 'a@example.com' });

      expect(result).toMatchObject({ message: 'Message sent successfully!' });
      expect(contact.insertOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('theme', () => {
    test('getTheme without session => theme null', async () => {
      const { AuthApiService } = loadAuthApiServiceWithMocks();
      const db = createDb({ users: { findOne: jest.fn() } });
      const result = await AuthApiService.getTheme(db, {});
      expect(result).toEqual({ theme: null });
    });

    test('setTheme validates + updates', async () => {
      const { AuthApiService } = loadAuthApiServiceWithMocks();
      const users = { updateOne: jest.fn(async () => ({})) };
      const db = createDb({ users });

      await expect(AuthApiService.setTheme(db, { theme: 'bad' }, { userEmail: 'a@example.com' }))
        .rejects
        .toMatchObject({ statusCode: 400, message: 'Invalid theme value' });

      const result = await AuthApiService.setTheme(db, { theme: 'dark' }, { userEmail: 'a@example.com' });
      expect(users.updateOne).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ message: 'Theme saved' });
    });
  });

  test('verifyReactivationOtp => 410', () => {
    const { AuthApiService } = loadAuthApiServiceWithMocks();
    expect(() => AuthApiService.verifyReactivationOtp()).toThrow(/removed/i);
    try {
      AuthApiService.verifyReactivationOtp();
    } catch (e) {
      expect(e.statusCode).toBe(410);
    }
  });
});

