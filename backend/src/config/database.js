const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DBNAME || 'chesshive';

let client;
let db;
let connectionPromise;

async function connectDB() {
  if (db) return db;

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
        db = client.db(dbName);
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

