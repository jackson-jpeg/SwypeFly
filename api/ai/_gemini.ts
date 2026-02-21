import { GoogleGenAI } from '@google/genai';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../../services/appwriteServer';
import { ID } from 'node-appwrite';

// ─── Gemini client ──────────────────────────────────────────────────

let _ai: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY is not set');
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

// ─── Cache helpers (Appwrite) ───────────────────────────────────────

export async function readCache<T>(cacheKey: string): Promise<T | null> {
  try {
    const result = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.aiCache, [
      Query.equal('cache_key', cacheKey),
      Query.limit(1),
    ]);

    if (result.documents.length === 0) return null;

    const doc = result.documents[0];
    const age = (Date.now() - new Date(doc.created_at as string).getTime()) / 1000;
    if (age > (doc.ttl_seconds as number)) {
      // Expired — clean up async, don't block
      serverDatabases.deleteDocument(DATABASE_ID, COLLECTIONS.aiCache, doc.$id).catch(() => {});
      return null;
    }

    return JSON.parse(doc.response_json as string) as T;
  } catch {
    return null;
  }
}

export async function writeCache(
  cacheKey: string,
  responseJson: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    // Check if doc exists for this cache_key
    const existing = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.aiCache, [
      Query.equal('cache_key', cacheKey),
      Query.limit(1),
    ]);

    const data = {
      cache_key: cacheKey,
      response_json: JSON.stringify(responseJson),
      created_at: new Date().toISOString(),
      ttl_seconds: ttlSeconds,
    };

    if (existing.documents.length > 0) {
      await serverDatabases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.aiCache,
        existing.documents[0].$id,
        data,
      );
    } else {
      await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.aiCache, ID.unique(), data);
    }
  } catch {
    // Cache write failure is non-fatal
  }
}
