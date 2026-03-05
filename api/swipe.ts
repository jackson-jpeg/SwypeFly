import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, Databases, Query, ID } from 'node-appwrite';
import { swipeBodySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
import { verifyClerkToken } from '../utils/clerkAuth';
import { cors } from './_cors.js';

const DATABASE_ID = 'sogojet';

const COLLECTIONS = {
  destinations: 'destinations',
  swipeHistory: 'swipe_history',
  userPreferences: 'user_preferences',
} as const;

// ─── Learning rates per swipe action ────────────────────────────────

const LEARNING_RATES: Record<string, number> = {
  saved: 0.2,
  viewed: 0.1,
  skipped: -0.05,
};

const FEATURE_KEYS = [
  'beach_score',
  'city_score',
  'adventure_score',
  'culture_score',
  'nightlife_score',
  'nature_score',
  'food_score',
] as const;

const PREF_KEYS = [
  'pref_beach',
  'pref_city',
  'pref_adventure',
  'pref_culture',
  'pref_nightlife',
  'pref_nature',
  'pref_food',
] as const;

// ─── Handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require auth
  const authResult = await verifyClerkToken(req.headers.authorization);
  if (!authResult) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = { $id: authResult.userId };

    const v = validateRequest(swipeBodySchema, req.body);
    if (!v.success) return res.status(400).json({ error: v.error });
    const { destination_id, action, time_spent_ms, price_shown } = v.data;

    // Use admin client for database writes
    const adminClient = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '')
      .setProject(
        process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '',
      )
      .setKey(process.env.APPWRITE_API_KEY ?? '');

    const db = new Databases(adminClient);

    // 1. Insert swipe history
    try {
      await db.createDocument(DATABASE_ID, COLLECTIONS.swipeHistory, ID.unique(), {
        user_id: user.$id,
        destination_id,
        action,
        time_spent_ms: time_spent_ms ?? 0,
        price_shown: price_shown ?? 0,
      });
    } catch (err) {
      logApiError('api/swipe/history', err);
    }

    // 2. Update user preference vectors
    const lr = LEARNING_RATES[action];
    if (lr !== undefined && lr !== 0) {
      try {
        // Fetch destination feature vector
        const dest = await db.getDocument(DATABASE_ID, COLLECTIONS.destinations, destination_id);

        // Fetch current user prefs
        const prefsResult = await db.listDocuments(DATABASE_ID, COLLECTIONS.userPreferences, [
          Query.equal('user_id', user.$id),
          Query.limit(1),
        ]);

        if (dest && prefsResult.documents.length > 0) {
          const prefs = prefsResult.documents[0];
          const updates: Record<string, number> = {};

          for (let i = 0; i < FEATURE_KEYS.length; i++) {
            const destFeature = (dest[FEATURE_KEYS[i]] as number) ?? 0;
            const oldPref = (prefs[PREF_KEYS[i]] as number) ?? 0.5;
            const newPref = Math.max(0, Math.min(1, oldPref + lr * (destFeature - oldPref)));
            updates[PREF_KEYS[i]] = Math.round(newPref * 1000) / 1000;
          }

          await db.updateDocument(DATABASE_ID, COLLECTIONS.userPreferences, prefs.$id, updates);
        }
      } catch (err) {
        logApiError('api/swipe/pref-update', err);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    logApiError('api/swipe', err);
    return res.status(500).json({ error: 'Failed to record swipe' });
  }
}
