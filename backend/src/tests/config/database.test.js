function buildDbMock({ collectionsExist = false } = {}) {
  const collectionMap = new Map();
  const getCollection = (name) => {
    if (!collectionMap.has(name)) {
      collectionMap.set(name, {
        createIndex: jest.fn(async () => ({})),
        updateMany: jest.fn(async () => ({ modifiedCount: 0 }))
      });
    }
    return collectionMap.get(name);
  };

  const db = {
    listCollections: jest.fn(({ name }) => ({
      toArray: jest.fn(async () => (collectionsExist ? [{ name }] : []))
    })),
    createCollection: jest.fn(async () => ({})),
    command: jest.fn(async () => ({})),
    collection: jest.fn((name) => getCollection(name)),
    _collectionMap: collectionMap
  };

  return db;
}

function loadDatabaseModule({ mongoClientMock }) {
  jest.resetModules();
  jest.doMock('mongodb', () => ({
    MongoClient: mongoClientMock
  }));
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  // eslint-disable-next-line global-require
  return require('../../config/database');
}

describe('config/database connectDB', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('connectDB connects once and initializes collections', async () => {
    process.env.MONGODB_URI = 'mongodb://example:27017/chesshive';

    const dbMock = buildDbMock({ collectionsExist: false });
    const client = {
      connect: jest.fn(async () => ({})),
      db: jest.fn(() => dbMock)
    };

    const MongoClient = jest.fn(() => client);
    const { connectDB } = loadDatabaseModule({ mongoClientMock: MongoClient });

    const db1 = await connectDB();
    expect(db1).toBe(dbMock);
    expect(MongoClient).toHaveBeenCalledWith(
      'mongodb://example:27017/chesshive',
      expect.objectContaining({ maxPoolSize: 50, minPoolSize: 10 })
    );
    expect(client.connect).toHaveBeenCalledTimes(1);

    // At least a couple collections should be initialized
    expect(dbMock.listCollections).toHaveBeenCalled();
    expect(dbMock.createCollection).toHaveBeenCalled();
    expect(dbMock.collection).toHaveBeenCalled();
    // Tournament migration updateMany
    expect(dbMock.collection('tournaments').updateMany).toHaveBeenCalled();

    // Second call should return cached db without connecting again
    const db2 = await connectDB();
    expect(db2).toBe(dbMock);
    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  test('connectDB uses collMod when collections exist', async () => {
    process.env.MONGODB_URI = 'mongodb://example:27017/chesshive';

    const dbMock = buildDbMock({ collectionsExist: true });
    const client = {
      connect: jest.fn(async () => ({})),
      db: jest.fn(() => dbMock)
    };
    const MongoClient = jest.fn(() => client);
    const { connectDB } = loadDatabaseModule({ mongoClientMock: MongoClient });

    await connectDB();
    expect(dbMock.command).toHaveBeenCalled();
  });
});

