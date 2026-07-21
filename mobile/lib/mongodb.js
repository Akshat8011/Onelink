/**
 * MongoDB connection helper for Vercel serverless.
 * Reuses a single MongoClient across warm invocations.
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error(
    'Missing MONGODB_URI environment variable. Add your MongoDB Atlas connection string to Vercel project settings.',
  );
}

const options = {
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 30_000,
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
};

/** @type {import('mongodb').MongoClient | undefined} */
let cachedClient = global._mongoClient;

/** @type {Promise<import('mongodb').MongoClient> | undefined} */
let cachedClientPromise = global._mongoClientPromise;

if (!cachedClientPromise) {
  cachedClient = new MongoClient(uri, options);
  cachedClientPromise = cachedClient.connect().then((client) => {
    global._mongoClient = client;
    global._mongoClientPromise = cachedClientPromise;
    return client;
  });
  global._mongoClientPromise = cachedClientPromise;
}

async function getMongoClient() {
  return cachedClientPromise;
}

async function getDb(dbName = process.env.MONGODB_DB_NAME || 'onelink') {
  const client = await getMongoClient();
  return client.db(dbName);
}

module.exports = { getMongoClient, getDb };
