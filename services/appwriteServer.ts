/**
 * Appwrite server SDK — used in Vercel serverless functions.
 * Uses API key for full database access (no RLS restrictions).
 */
import { Client, Databases, Users, Query } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '';
const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '';
const apiKey = process.env.APPWRITE_API_KEY ?? '';

const client = new Client();

if (endpoint && projectId && apiKey) {
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
}

export const serverDatabases = new Databases(client);
export const serverUsers = new Users(client);
export const serverClient = client;
export { Query };

export const DATABASE_ID = 'sogojet';

export const COLLECTIONS = {
  destinations: 'destinations',
  savedTrips: 'saved_trips',
  userPreferences: 'user_preferences',
  swipeHistory: 'swipe_history',
  cachedPrices: 'cached_prices',
  cachedHotelPrices: 'cached_hotel_prices',
  destinationImages: 'destination_images',
  aiCache: 'ai_cache',
} as const;
