const { MongoClient } = require('mongodb');
require('dotenv').config();

function getMongoUri() {
  return process.env.MONGODB_URI;
}

function getDbName() {
  return process.env.MONGODB_DBNAME || 'chesshive';
}

let client;
let db;
let connectionPromise;

function sameIndexKeys(existingKeys, desiredKeys) {
  const a = Object.entries(existingKeys || {});
  const b = Object.entries(desiredKeys || {});
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0]) return false;
    if (a[i][1] !== b[i][1]) return false;
  }
  return true;
}

function isIndexConflictError(err) {
  const codeName = err?.codeName || '';
  const message = (err?.message || '').toString();
  return codeName === 'IndexKeySpecsConflict'
    || codeName === 'IndexOptionsConflict'
    || codeName === 'IndexAlreadyExists'
    || message.includes('IndexKeySpecsConflict')
    || message.includes('IndexOptionsConflict')
    || message.includes('Index already exists');
}

const COLLECTION_DEFS = [
  {
    name: 'users',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        properties: {
          email: { bsonType: 'string' },
          role: { bsonType: 'string' },
          createdAt: { bsonType: 'date' }
        }
      }
    },
    indexes: [{ keys: { email: 1 }, options: { name: 'email_1' } }]
  },
  {
    name: 'tournaments',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        properties: {
          status: { bsonType: 'string' },
          date: { bsonType: 'date' },
          time: { bsonType: 'string' },
          start_at: { bsonType: 'date' },
          end_at: { bsonType: 'date' }
        }
      }
    },
    indexes: [
      { keys: { status: 1 }, options: { name: 'status_1' } },
      { keys: { start_at: 1 }, options: { name: 'start_at_1' } },
      { keys: { end_at: 1 }, options: { name: 'end_at_1' } }
    ]
  },
  {
    name: 'refresh_tokens',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        properties: {
          token: { bsonType: 'string' },
          userId: {},
          createdAt: { bsonType: 'date' },
          revoked: { bsonType: 'bool' }
        }
      }
    },
    indexes: [{ keys: { token: 1 }, options: { name: 'token_1' } }]
  },
  { name: 'otps' },
  { name: 'signup_otps' },
  { name: 'pending_coordinators' },
  { name: 'notifications' },
  { name: 'user_balances' },
  { name: 'contact' },
  { name: 'chat_messages' }
];

async function ensureCollections(dbConn) {
  for (const def of COLLECTION_DEFS) {
    const existing = await dbConn.listCollections({ name: def.name }).toArray();
    const exists = Array.isArray(existing) && existing.length > 0;

    if (!exists) {
      const options = def.validator
        ? { validator: def.validator, validationAction: 'warn', validationLevel: 'moderate' }
        : undefined;
      await dbConn.createCollection(def.name, options);
    } else if (def.validator) {
      // Keep schema up-to-date without hard-breaking existing data.
      await dbConn.command({
        collMod: def.name,
        validator: def.validator,
        validationAction: 'warn',
        validationLevel: 'moderate'
      });
    }

    const indexesToEnsure = def.indexes || [];
    if (indexesToEnsure.length > 0) {
      let existingIndexes = [];
      try {
        existingIndexes = await dbConn.collection(def.name).listIndexes().toArray();
      } catch (e) {
        existingIndexes = [];
      }

      for (const idx of indexesToEnsure) {
        const desiredName = idx?.options?.name;
        const alreadyThere = existingIndexes.some((existingIdx) => {
          if (desiredName && existingIdx?.name === desiredName) return true;
          return sameIndexKeys(existingIdx?.key, idx?.keys);
        });
        if (alreadyThere) continue;

        try {
          await dbConn.collection(def.name).createIndex(idx.keys, idx.options);
        } catch (e) {
          // If another deploy/instance created it first (or a conflicting index exists), skip silently.
          if (isIndexConflictError(e)) continue;
          // Index creation should not prevent the app from starting.
          console.error(`Index init failed for ${def.name}:`, e);
        }
      }
    }
  }
}

async function runMigrations(dbConn) {
  // Backfill derived window fields for tournaments that predate the scheduler optimization.
  // Uses pipeline updates so it can run in one round-trip.
  await dbConn.collection('tournaments').updateMany(
    { date: { $type: 'date' }, start_at: { $exists: false } },
    [
      {
        $set: {
          start_at: '$date',
          end_at: { $add: ['$date', 60 * 60 * 1000] }
        }
      }
    ]
  );

  await dbConn.collection('tournaments').updateMany(
    { start_at: { $type: 'date' }, end_at: { $exists: false } },
    [{ $set: { end_at: { $add: ['$start_at', 60 * 60 * 1000] } } }]
  );
}

async function connectDB() {
  if (db) return db;

  const uri = getMongoUri();
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }

  if (!connectionPromise) {
    connectionPromise = (async () => {
      client = new MongoClient(uri, {
        maxPoolSize: 50,
        minPoolSize: 10,
        maxIdleTimeMS: 600000,
        serverSelectionTimeoutMS: 5000
      });

      try {
        await client.connect();
        db = client.db(getDbName());

        await ensureCollections(db);
        await runMigrations(db);

        console.log('MongoDB Atlas connected');
        return db;
      } catch (err) {
        console.error('MongoDB Atlas connection error:', err);
        db = undefined;
        try { await client?.close(); } catch {}
        client = undefined;
        connectionPromise = undefined;
        throw err;
      }
    })();
  }

  return connectionPromise;
}

module.exports = { connectDB };
