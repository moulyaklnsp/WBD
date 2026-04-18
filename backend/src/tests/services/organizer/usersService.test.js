function loadOrganizerUsersServiceWithMocks(overrides = {}) {
  jest.resetModules();

  const UserModel = {
    findOne: jest.fn(async () => null),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
    findMany: jest.fn(async () => []),
    ...overrides.userModel
  };

  const StorageModel = {
    uploadImageBuffer: jest.fn(async () => ({ secure_url: 'https://img.local/p.png', public_id: 'pid1' })),
    ...overrides.storage
  };

  const organizerUtils = {
    safeTrim: (v) => String(v == null ? '' : v).trim(),
    isValidName: (v) => Boolean(v && /^[A-Za-z]+(?: [A-Za-z]+)*$/.test(String(v))),
    isSelfDeletedUser: (u) => String(u?.deleted_by || '').toLowerCase() === String(u?.email || '').toLowerCase(),
    requireOrganizer: (user) => {
      if (!user?.email) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
      if (user.role !== 'organizer') throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    },
    ...overrides.organizerUtils
  };

  const sendOtpEmail = jest.fn(async () => ({ sent: true }));
  const emailService = { sendOtpEmail, ...overrides.emailService };

  const io = { to: jest.fn(() => ({ emit: jest.fn() })) };
  const socketService = { getIO: jest.fn(() => io), ...overrides.socketService };

  const collections = overrides.collections || {};
  const db = {
    collection: (name) => {
      const col = collections[name];
      if (!col) throw new Error(`Unexpected collection: ${name}`);
      return col;
    }
  };

  const connectDB = jest.fn(async () => db);

  jest.doMock('../../../config/database', () => ({ connectDB }));
  jest.doMock('../../../models', () => ({ getModel: () => UserModel }));
  jest.doMock('../../../models/StorageModel', () => StorageModel);
  jest.doMock('../../../services/organizer/organizerUtils', () => organizerUtils);
  jest.doMock('../../../services/emailService', () => emailService);
  jest.doMock('../../../services/socketService', () => socketService);

  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});

  // eslint-disable-next-line global-require
  const UsersService = require('../../../services/organizer/usersService');
  return { UsersService, UserModel, StorageModel, connectDB, db, io, sendOtpEmail };
}

describe('organizer/usersService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getOrganizerProfile throws 404 when organizer not found', async () => {
    const { UsersService } = loadOrganizerUsersServiceWithMocks({
      userModel: { findOne: jest.fn(async () => null) }
    });

    await expect(UsersService.getOrganizerProfile({}, { email: 'o@example.com', role: 'organizer' }))
      .rejects
      .toMatchObject({ statusCode: 404 });
  });

  test('updateOrganizerProfile validates fields and updates user', async () => {
    const organizer = { _id: 'id1', email: 'o@example.com', role: 'organizer' };
    const { UsersService, UserModel } = loadOrganizerUsersServiceWithMocks({
      userModel: {
        findOne: jest.fn(async () => organizer),
        updateOne: jest.fn(async () => ({ modifiedCount: 1 }))
      }
    });

    await expect(UsersService.updateOrganizerProfile({}, { email: 'o@example.com', role: 'organizer' }, { gender: 'nope' }))
      .rejects
      .toMatchObject({ statusCode: 400, message: 'Invalid gender value' });

    const result = await UsersService.updateOrganizerProfile({}, { email: 'o@example.com', role: 'organizer' }, { name: 'Alice' });
    expect(result).toEqual({ success: true, message: 'Profile updated successfully' });
    expect(UserModel.updateOne).toHaveBeenCalledTimes(1);
  });

  test('updateOrganizerPhoto validates buffer and uploads + persists', async () => {
    const { UsersService, StorageModel, UserModel } = loadOrganizerUsersServiceWithMocks({
      userModel: { updateOne: jest.fn(async () => ({ modifiedCount: 1 })) }
    });

    await expect(UsersService.updateOrganizerPhoto({}, { email: 'o@example.com', role: 'organizer' }, null))
      .rejects
      .toMatchObject({ statusCode: 400 });

    const result = await UsersService.updateOrganizerPhoto({}, { email: 'o@example.com', role: 'organizer' }, Buffer.from('x'));
    expect(StorageModel.uploadImageBuffer).toHaveBeenCalledTimes(1);
    expect(UserModel.updateOne).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: true, profile_photo_url: 'https://img.local/p.png' });
  });

  test('approvePendingCoordinator approves and emits socket event', async () => {
    const pendingDoc = { _id: 'p1', email: 'c@example.com', data: { email: 'c@example.com' }, status: 'pending' };
    const pending = {
      findOne: jest.fn(async () => pendingDoc),
      updateOne: jest.fn(async () => ({}))
    };
    const signupOtps = { insertOne: jest.fn(async () => ({})) };
    const otps = { insertOne: jest.fn(async () => ({})) };

    const { UsersService, sendOtpEmail, io } = loadOrganizerUsersServiceWithMocks({
      collections: {
        pending_coordinators: pending,
        signup_otps: signupOtps,
        otps
      }
    });

    const result = await UsersService.approvePendingCoordinator('c@example.com', true);
    expect(signupOtps.insertOne).toHaveBeenCalledTimes(1);
    expect(otps.insertOne).toHaveBeenCalledTimes(1);
    expect(sendOtpEmail).toHaveBeenCalledTimes(1);
    expect(io.to).toHaveBeenCalledWith('signup_c@example.com');
    expect(pending.updateOne).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: true });
  });

  test('approvePendingCoordinator rejects and emits socket event', async () => {
    const pendingDoc = { _id: 'p1', email: 'c@example.com', data: { email: 'c@example.com' }, status: 'pending' };
    const pending = {
      findOne: jest.fn(async () => pendingDoc),
      updateOne: jest.fn(async () => ({}))
    };

    const { UsersService, io } = loadOrganizerUsersServiceWithMocks({
      collections: {
        pending_coordinators: pending,
        signup_otps: { insertOne: jest.fn() },
        otps: { insertOne: jest.fn() }
      }
    });

    const result = await UsersService.approvePendingCoordinator('c@example.com', false);
    expect(io.to).toHaveBeenCalledWith('signup_c@example.com');
    expect(pending.updateOne).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: true, message: 'Coordinator rejected.' });
  });

  test('restoreCoordinator blocks restoring self-deleted accounts', async () => {
    const coord = { _id: 'c1', email: 'c@example.com', deleted_by: 'c@example.com', isDeleted: 1, role: 'coordinator' };
    const { UsersService } = loadOrganizerUsersServiceWithMocks({
      userModel: { findOne: jest.fn(async () => coord) }
    });

    await expect(UsersService.restoreCoordinator({}, { email: 'o@example.com', role: 'organizer' }, 'c@example.com'))
      .rejects
      .toMatchObject({ statusCode: 403 });
  });
});

