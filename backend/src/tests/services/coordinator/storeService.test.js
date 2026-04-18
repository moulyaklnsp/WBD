const { ObjectId } = require('mongodb');

function loadCoordinatorStoreServiceWithMocks(overrides = {}) {
  jest.resetModules();

  const modelsByName = {
    users: {
      findOne: jest.fn(async () => null),
      ...overrides.users
    },
    products: {
      findMany: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      insertOne: jest.fn(async () => ({ insertedId: new ObjectId() })),
      ...overrides.products
    },
    reviews: {
      findMany: jest.fn(async () => []),
      ...overrides.reviews
    },
    order_complaints: {
      aggregate: jest.fn(async () => []),
      updateOne: jest.fn(async () => ({})),
      ...overrides.order_complaints
    },
    orders: {
      findMany: jest.fn(async () => []),
      ...overrides.orders
    },
    sales: {
      aggregate: jest.fn(async () => []),
      ...overrides.sales
    },
    otps: {
      findOne: jest.fn(async () => null),
      insertOne: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({})),
      updateOne: jest.fn(async () => ({})),
      ...overrides.otps
    }
  };

  const Cache = {
    invalidateTags: jest.fn(async () => ({ deleted: 0 })),
    ...overrides.cache
  };

  const StorageModel = {
    uploadImageBuffer: jest.fn(async () => ({ secure_url: 'https://img.local/x.png', public_id: 'pid1' })),
    destroyImage: jest.fn(async () => null),
    ...overrides.storage
  };

  const OrderFilesModel = {
    ...overrides.orderFiles
  };

  const emailService = {
    sendOtpEmail: jest.fn(async () => ({ sent: true })),
    ...overrides.emailService
  };

  const coordinatorUtils = {
    safeTrim: (v) => String(v == null ? '' : v).trim(),
    escapeRegExp: (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    normalizeOrderStatus: (v) => String(v || '').trim().toLowerCase(),
    getAllowedOrderStatusTransitions: () => [],
    PLAYER_ORDER_STATUSES: [],
    getCoordinatorOwnerIdentifiers: jest.fn(async () => []),
    getCoordinatorOwnerCandidates: jest.fn(async () => []),
    requireCoordinator: (user) => {
      if (!user?.email) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
      if (user.role !== 'coordinator') throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    },
    ...overrides.coordinatorUtils
  };

  jest.doMock('../../../models', () => ({
    getModel: (name) => {
      const model = modelsByName[name];
      if (!model) throw new Error(`Unexpected model: ${name}`);
      return model;
    }
  }));
  jest.doMock('../../../utils/cache', () => Cache);
  jest.doMock('../../../models/StorageModel', () => StorageModel);
  jest.doMock('../../../models/OrderFilesModel', () => OrderFilesModel);
  jest.doMock('../../../services/emailService', () => emailService);
  jest.doMock('../../../services/coordinator/coordinatorUtils', () => coordinatorUtils);

  // eslint-disable-next-line global-require
  const StoreService = require('../../../services/coordinator/storeService');
  return { StoreService, modelsByName, Cache, StorageModel };
}

describe('coordinator/storeService', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getProducts normalizes image urls and booleans', async () => {
    const { StoreService } = loadCoordinatorStoreServiceWithMocks({
      products: {
        findMany: jest.fn(async () => [{
          _id: new ObjectId(),
          name: 'P1',
          image_urls: 'https://a/x.png, https://b/y.png',
          imageUrl: 'https://c/z.png',
          comments_enabled: 0
        }])
      }
    });

    const result = await StoreService.getProducts({}, { email: 'c@example.com', role: 'coordinator', college: 'ABC' });
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      name: 'P1',
      comments_enabled: false,
      imageUrl: expect.stringContaining('https://')
    });
    expect(result.products[0].image_urls.length).toBeGreaterThan(0);
  });

  test('addProduct validates required fields and numeric values', async () => {
    const { StoreService } = loadCoordinatorStoreServiceWithMocks();
    const user = { email: 'c@example.com', role: 'coordinator', college: 'ABC' };

    await expect(StoreService.addProduct({}, user, { body: {}, files: [] }))
      .rejects
      .toMatchObject({ statusCode: 400, message: 'All fields are required' });

    await expect(StoreService.addProduct({}, user, { body: { name: 'P', category: 'C', price: '-1', imageUrl: 'x', availability: 1 }, files: [] }))
      .rejects
      .toMatchObject({ statusCode: 400, message: 'Invalid price value' });

    await expect(StoreService.addProduct({}, user, { body: { name: 'P', category: 'C', price: '10', imageUrl: 'x', availability: '-1' }, files: [] }))
      .rejects
      .toMatchObject({ statusCode: 400, message: 'Invalid availability value' });
  });

  test('addProduct requires coordinator user in DB and college info', async () => {
    const { StoreService } = loadCoordinatorStoreServiceWithMocks({
      users: { findOne: jest.fn(async () => null) }
    });

    await expect(StoreService.addProduct({}, { email: 'c@example.com', role: 'coordinator' }, {
      body: { name: 'P', category: 'C', price: '10', imageUrl: 'x', availability: '1' },
      files: []
    })).rejects.toMatchObject({ statusCode: 401, message: 'User not logged in' });

    const { StoreService: StoreService2 } = loadCoordinatorStoreServiceWithMocks({
      users: { findOne: jest.fn(async () => ({ name: 'Coord', email: 'c@example.com', college: '' })) }
    });
    await expect(StoreService2.addProduct({}, { email: 'c@example.com', role: 'coordinator' }, {
      body: { name: 'P', category: 'C', price: '10', imageUrl: 'x', availability: '1' },
      files: []
    })).rejects.toMatchObject({ statusCode: 401, message: 'College info missing' });
  });

  test('addProduct success uploads images when provided and invalidates store tag', async () => {
    const { StoreService, modelsByName, Cache, StorageModel } = loadCoordinatorStoreServiceWithMocks({
      users: { findOne: jest.fn(async () => ({ name: 'Coord', email: 'c@example.com', college: 'ABC' })) },
      products: { insertOne: jest.fn(async () => ({ insertedId: new ObjectId() })) }
    });
    const user = { email: 'c@example.com', role: 'coordinator', username: 'Coord', college: 'ABC' };

    const result = await StoreService.addProduct({}, user, {
      body: { name: 'P', category: 'C', price: '10', imageUrl: '', availability: '1', imageUrls: [] },
      files: [{ buffer: Buffer.from('x') }]
    });

    expect(StorageModel.uploadImageBuffer).toHaveBeenCalledTimes(1);
    expect(modelsByName.products.insertOne).toHaveBeenCalledTimes(1);
    expect(Cache.invalidateTags).toHaveBeenCalledWith(['store'], expect.any(Object));
    expect(result).toMatchObject({ success: true });
  });

  test('getProductReviews validates productId and maps rows', async () => {
    const { StoreService } = loadCoordinatorStoreServiceWithMocks();
    await expect(StoreService.getProductReviews({}, { productId: 'bad' }))
      .rejects
      .toMatchObject({ statusCode: 400, message: 'Invalid product ID' });

    const pid = new ObjectId();
    const { StoreService: StoreService2 } = loadCoordinatorStoreServiceWithMocks({
      reviews: { findMany: jest.fn(async () => [{ rating: '5', comment: 'ok', created_at: new Date(), player_email: 'p@example.com' }]) }
    });
    const result = await StoreService2.getProductReviews({}, { productId: pid.toString() });
    expect(result.reviews[0]).toMatchObject({ rating: 5, comment: 'ok' });
  });

  test('resolveOrderComplaint validates id and updates status', async () => {
    const { StoreService, modelsByName } = loadCoordinatorStoreServiceWithMocks();
    await expect(StoreService.resolveOrderComplaint({}, { complaintId: 'bad', response: 'x' }))
      .rejects
      .toMatchObject({ statusCode: 400 });

    const cid = new ObjectId();
    const { StoreService: StoreService2, modelsByName: modelsByName2 } = loadCoordinatorStoreServiceWithMocks({
      order_complaints: { updateOne: jest.fn(async () => ({})) }
    });
    const result = await StoreService2.resolveOrderComplaint({}, { complaintId: cid.toString(), response: 'ok' });
    expect(result).toEqual({ success: true });
    expect(modelsByName2.order_complaints.updateOne).toHaveBeenCalledTimes(1);
  });
});
