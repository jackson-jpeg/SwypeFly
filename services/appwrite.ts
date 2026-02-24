/**
 * Appwrite client SDK — used in the React Native / web client.
 * Handles auth and client-side database operations.
 */
import { Client, Account, Databases } from 'appwrite';

const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '';
const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '';

const client = new Client();

if (endpoint && projectId) {
  client.setEndpoint(endpoint).setProject(projectId);
}

export const account = new Account(client);
export const databases = new Databases(client);
export const appwriteClient = client;

export const DATABASE_ID = 'sogojet';

export const COLLECTIONS = {
  destinations: 'destinations',
  savedTrips: 'saved_trips',
  userPreferences: 'user_preferences',
  swipeHistory: 'swipe_history',
  cachedPrices: 'cached_prices',
  priceAlerts: 'price_alerts',
} as const;
