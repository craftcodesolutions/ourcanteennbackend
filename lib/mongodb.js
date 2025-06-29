import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {};

let client;
let clientPromise;

if (!uri) {
  throw new Error('Please add your MongoDB URI to .env as MONGODB_URI');
}

if (process.env.NODE_ENV === 'development') {
  // Reuse the client in dev to avoid hot reload problems
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production, don't use global
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
