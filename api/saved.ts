// User data API — dispatches on ?action=list|save|unsave|get-prefs|save-prefs
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Query, ID } from 'node-appwrite';
import { serverDatabases, DATABASE_ID, COLLECTIONS } from '../services/appwriteServer';
import { verifyClerkToken } from '../utils/clerkAuth';
import { logApiError } from '../utils/apiLogger';
import { cors } from './_cors.js';

async function handleList(userId: string, res: VercelResponse) {
  const result = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.savedTrips, [
    Query.equal('user_id', userId),
    Query.limit(100),
  ]);
  const ids = result.documents.map((d) => d['destination_id'] as string);
  return res.json({ savedIds: ids });
}

async function handleSave(userId: string, destinationId: string, res: VercelResponse) {
  // Deduplication: check if already saved
  const existing = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.savedTrips, [
    Query.equal('user_id', userId),
    Query.equal('destination_id', destinationId),
    Query.limit(1),
  ]);
  if (existing.documents.length > 0) return res.json({ ok: true });

  await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.savedTrips, ID.unique(), {
    user_id: userId,
    destination_id: destinationId,
    saved_at: new Date().toISOString(),
  });
  return res.json({ ok: true });
}

async function handleUnsave(userId: string, destinationId: string, res: VercelResponse) {
  const result = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.savedTrips, [
    Query.equal('user_id', userId),
    Query.equal('destination_id', destinationId),
    Query.limit(1),
  ]);
  if (result.documents[0]) {
    await serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.savedTrips, result.documents[0].$id);
  }
  return res.json({ ok: true });
}

// ─── User preferences ────────────────────────────────────────────────

async function handleGetPrefs(userId: string, res: VercelResponse) {
  const result = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.userPreferences, [
    Query.equal('user_id', userId),
    Query.limit(1),
  ]);
  if (result.documents.length === 0) {
    return res.json({ preferences: null });
  }
  const doc = result.documents[0];
  return res.json({
    preferences: {
      departure_city: doc.departure_city,
      departure_code: doc.departure_code,
      onboarding_completed: doc.onboarding_completed,
    },
  });
}

async function handleSavePrefs(userId: string, body: Record<string, unknown>, res: VercelResponse) {
  const updates: Record<string, unknown> = {};
  if (typeof body.departure_city === 'string') updates.departure_city = body.departure_city;
  if (typeof body.departure_code === 'string') updates.departure_code = body.departure_code;
  if (typeof body.onboarding_completed === 'boolean') updates.onboarding_completed = body.onboarding_completed;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const existing = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.userPreferences, [
    Query.equal('user_id', userId),
    Query.limit(1),
  ]);

  if (existing.documents.length > 0) {
    await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.userPreferences, existing.documents[0].$id, updates);
  } else {
    await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.userPreferences, ID.unique(), {
      user_id: userId,
      ...updates,
    });
  }
  return res.json({ ok: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  const authResult = await verifyClerkToken(req.headers.authorization);
  if (!authResult) return res.status(401).json({ error: 'Unauthorized' });

  const action = String(req.query.action || '');

  try {
    switch (action) {
      case 'list':
        return handleList(authResult.userId, res);
      case 'save': {
        const destId = String(req.body?.destination_id || '');
        if (!destId) return res.status(400).json({ error: 'Missing destination_id' });
        return handleSave(authResult.userId, destId, res);
      }
      case 'unsave': {
        const destId = String(req.body?.destination_id || '');
        if (!destId) return res.status(400).json({ error: 'Missing destination_id' });
        return handleUnsave(authResult.userId, destId, res);
      }
      case 'get-prefs':
        return handleGetPrefs(authResult.userId, res);
      case 'save-prefs':
        return handleSavePrefs(authResult.userId, req.body || {}, res);
      default:
        return res.status(400).json({ error: 'Use ?action=list|save|unsave|get-prefs|save-prefs' });
    }
  } catch (err) {
    logApiError('api/saved', err);
    return res.status(500).json({ error: 'Failed to process saved trips' });
  }
}
