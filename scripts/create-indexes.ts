import { Client, Databases } from 'node-appwrite';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || '')
  .setProject(process.env.APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_API_KEY || '');

const databases = new Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || '';
const DESTINATIONS_ID = process.env.APPWRITE_DESTINATIONS_COLLECTION_ID || '';

async function createIndexes() {
  try {
    // Create index for price filtering
    await databases.createIndex(
      DATABASE_ID,
      DESTINATIONS_ID,
      'price_index',
      'key',
      ['price'],
      ['ASC']
    );

    // Create index for country filtering
    await databases.createIndex(
      DATABASE_ID,
      DESTINATIONS_ID,
      'country_index',
      'key',
      ['country'],
      ['ASC']
    );

    // Create index for rating sorting
    await databases.createIndex(
      DATABASE_ID,
      DESTINATIONS_ID,
      'rating_index',
      'key',
      ['rating'],
      ['DESC']
    );

    // Create index for tags array filtering
    await databases.createIndex(
      DATABASE_ID,
      DESTINATIONS_ID,
      'tags_index',
      'key',
      ['tags'],
      ['ASC']
    );

    // Create composite index for common queries
    await databases.createIndex(
      DATABASE_ID,
      DESTINATIONS_ID,
      'country_price_index',
      'key',
      ['country', 'price'],
      ['ASC', 'ASC']
    );

    console.log('Indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
}

createIndexes();