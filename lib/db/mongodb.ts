import { MongoClient, Db, Collection } from 'mongodb';
import { Room, Contestant, Question } from './schema';

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getUri(): string {
  const uri = process.env.MONGODB_URI || '';
  if (!uri) {
    throw new Error(
      'MONGODB_URI is missing. Please set MONGODB_URI in your .env.local file.'
    );
  }
  if (uri.includes('<db_password>')) {
    throw new Error(
      "MongoDB connection error: Please replace '<db_password>' in your .env.local MONGODB_URI with your actual MongoDB Atlas database password."
    );
  }
  return uri;
}

const clientOptions = {
  maxPoolSize: 30,
  minPoolSize: 5,
  maxIdleTimeMS: 60000,
  serverSelectionTimeoutMS: 5000,
};

let clientPromise: Promise<MongoClient>;

export function getMongoClientPromise(): Promise<MongoClient> {
  const uri = getUri();

  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, clientOptions);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  } else {
    if (!clientPromise) {
      const client = new MongoClient(uri, clientOptions);
      clientPromise = client.connect();
    }
    return clientPromise;
  }
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClientPromise();
  return client.db();
}

let indexesCreated = false;
async function ensureIndexes(db: Db) {
  if (indexesCreated) return;
  try {
    await Promise.all([
      db.collection('rooms').createIndex({ code: 1 }, { unique: true }),
      db.collection('rooms').createIndex({ id: 1 }, { unique: true, sparse: true }),
      db.collection('contestants').createIndex({ id: 1 }, { unique: true, sparse: true }),
      db.collection('contestants').createIndex({ roomId: 1 }),
      db.collection('contestants').createIndex({ roomId: 1, kind: 1 }),
      db.collection('questions').createIndex({ id: 1 }, { unique: true, sparse: true }),
      db.collection('questions').createIndex({ roomId: 1 }),
      db.collection('questions').createIndex({ roomId: 1, number: 1 }),
      db.collection('questions').createIndex({ roomId: 1, roundType: 1 }),
    ]);
    indexesCreated = true;
  } catch {
    // Indexes might already exist or be initializing
  }
}

export async function getRoomsCollection(): Promise<Collection<Room>> {
  const db = await getDb();
  await ensureIndexes(db);
  return db.collection<Room>('rooms');
}

export async function getContestantsCollection(): Promise<Collection<Contestant>> {
  const db = await getDb();
  await ensureIndexes(db);
  return db.collection<Contestant>('contestants');
}

export async function getQuestionsCollection(): Promise<Collection<Question>> {
  const db = await getDb();
  await ensureIndexes(db);
  return db.collection<Question>('questions');
}
