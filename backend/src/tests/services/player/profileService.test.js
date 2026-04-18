const { ObjectId } = require('mongodb');

function loadPlayerProfileServiceWithMocks(overrides = {}) {
  jest.resetModules();

  const modelsByName = {
    users: {
      findOne: jest.fn(async () => null),
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
      ...overrides.users
    },
    player_stats: {
      findOne: jest.fn(async () => null),
      updateOne: jest.fn(async () => ({})),
      ...overrides.player_stats
    },
    subscriptionstable: {
      findOne: jest.fn(async () => null),
      updateOne: jest.fn(async () => ({})),
      ...overrides.subscriptionstable
    },
    user_balances: {
      findOne: jest.fn(async () => ({ wallet_balance: 0 })),
      updateOne: jest.fn(async () => ({})),
      ...overrides.user_balances
    },
    sales: {
      aggregate: jest.fn(async () => []),
      updateMany: jest.fn(async () => ({})),
      ...overrides.sales
    },
    player_settings: {
      findOne: jest.fn(async () => null),
      updateOne: jest.fn(async () => ({})),
      ...overrides.player_settings
    }
  };

  const StorageModel = {
    uploadImageBuffer: jest.fn(async () => ({ secure_url: 'https://img.local/w.png', public_id: 'wallpaper_new' })),
    destroyImage: jest.fn(async () => null),
    ...overrides.storage
  };

  const playerUtils = {
    requirePlayer: jest.fn((user) => {
      if (!user?.email) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
      if (user.role !== 'player') throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    }),
    ...overrides.playerUtils
  };

  jest.doMock('../../../models', () => ({
    getModel: (name) => {
      const model = modelsByName[name];
      if (!model) throw new Error(`Unexpected model: ${name}`);
      return model;
    }
  }));
  jest.doMock('../../../models/StorageModel', () => StorageModel);
  jest.doMock('../../../services/player/playerUtils', () => playerUtils);

  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  // eslint-disable-next-line global-require
  const ProfileService = require('../../../services/player/profileService');
  return { ProfileService, modelsByName, StorageModel, playerUtils };
}

describe('player/profileService', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getProfile rejects when not logged in', async () => {
    const { ProfileService } = loadPlayerProfileServiceWithMocks();
    await expect(ProfileService.getProfile({}, { userEmail: '' }))
      .rejects
      .toMatchObject({ statusCode: 401, message: 'Please log in' });
  });

  test('getProfile rejects when player not found', async () => {
    const { ProfileService } = loadPlayerProfileServiceWithMocks({
      users: { findOne: jest.fn(async () => null) }
    });
    await expect(ProfileService.getProfile({}, { userEmail: 'a@example.com' }))
      .rejects
      .toMatchObject({ statusCode: 404 });
  });

  test('getProfile seeds player stats when missing and caps wallet balance', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const playerId = new ObjectId();
    const { ProfileService, modelsByName } = loadPlayerProfileServiceWithMocks({
      users: { findOne: jest.fn(async () => ({ _id: playerId, name: 'Alice', email: 'a@example.com', role: 'player' })) },
      player_stats: { findOne: jest.fn(async () => null), updateOne: jest.fn(async () => ({})) },
      subscriptionstable: { findOne: jest.fn(async () => ({ end_date: new Date(Date.now() + 86400000), plan: 'Basic' })) },
      user_balances: { findOne: jest.fn(async () => ({ wallet_balance: 999999 })) },
      sales: { aggregate: jest.fn(async () => [{ name: 'Prod1' }]) }
    });

    const result = await ProfileService.getProfile({}, { userEmail: 'a@example.com' });
    expect(modelsByName.player_stats.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      { player_id: playerId },
      expect.any(Object),
      { upsert: true }
    );
    expect(result.player.walletBalance).toBe(100000);
    expect(result.player.sales).toEqual(['Prod1']);
    expect(result.subscribed).toBe(true);
    Math.random.mockRestore();
  });

  test('updateProfile validates name', async () => {
    const { ProfileService } = loadPlayerProfileServiceWithMocks();
    await expect(ProfileService.updateProfile({}, { userEmail: 'a@example.com', body: { name: '' } }))
      .rejects
      .toMatchObject({ statusCode: 400, message: 'Name is required' });
  });

  test('updateSettings upserts and returns success', async () => {
    const { ProfileService, modelsByName } = loadPlayerProfileServiceWithMocks({
      player_settings: { updateOne: jest.fn(async () => ({})) }
    });
    const result = await ProfileService.updateSettings({}, { userEmail: 'a@example.com', body: { sound: false } });
    expect(modelsByName.player_settings.updateOne).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: true, message: 'Settings updated' });
  });

  test('deactivateAccount marks user deleted and requests session destroy', async () => {
    const userDoc = { _id: new ObjectId(), email: 'a@example.com', role: 'player' };
    const { ProfileService, modelsByName } = loadPlayerProfileServiceWithMocks({
      users: { findOne: jest.fn(async () => userDoc), updateOne: jest.fn(async () => ({})) }
    });
    const result = await ProfileService.deactivateAccount({}, { email: 'a@example.com', role: 'player' });
    expect(modelsByName.users.updateOne).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: true, shouldDestroySession: true });
  });

  test('uploadWallpaper validates buffer and uploads + persists settings', async () => {
    const userDoc = { _id: new ObjectId(), email: 'a@example.com', role: 'player' };
    const { ProfileService, modelsByName, StorageModel } = loadPlayerProfileServiceWithMocks({
      users: { findOne: jest.fn(async () => userDoc) },
      player_settings: {
        findOne: jest.fn(async () => ({ wallpaper_public_id: 'old_public' })),
        updateOne: jest.fn(async () => ({}))
      }
    });

    await expect(ProfileService.uploadWallpaper({}, { userEmail: 'a@example.com', fileBuffer: null }))
      .rejects
      .toMatchObject({ statusCode: 400 });

    const ok = await ProfileService.uploadWallpaper({}, { userEmail: 'a@example.com', fileBuffer: Buffer.from('x') });
    expect(StorageModel.uploadImageBuffer).toHaveBeenCalledTimes(1);
    expect(modelsByName.player_settings.updateOne).toHaveBeenCalledTimes(1);
    expect(StorageModel.destroyImage).toHaveBeenCalledTimes(1);
    expect(ok).toMatchObject({ success: true, wallpaper_url: 'https://img.local/w.png' });
  });
});
