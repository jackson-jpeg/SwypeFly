import { Client, Account, Databases } from 'appwrite';

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT ?? '';
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID ?? '';

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
