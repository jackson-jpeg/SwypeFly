import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

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

// ─── Supabase client (service role, untyped for ai_cache) ───────────

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Use `any` schema so .from('ai_cache') works without generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabase: ReturnType<typeof createClient<any>> | null = null;

export function getSupabase() {
  if (!_supabase) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _supabase = createClient<any>(supabaseUrl, serviceRoleKey);
  }
  return _supabase;
}

// ─── Cache helpers ──────────────────────────────────────────────────

export async function readCache<T>(cacheKey: string): Promise<T | null> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('ai_cache')
      .select('response_json, created_at, ttl_seconds')
      .eq('cache_key', cacheKey)
      .single();

    if (error || !data) return null;

    const age = (Date.now() - new Date(data.created_at).getTime()) / 1000;
    if (age > data.ttl_seconds) {
      // Expired — clean up async, don't block
      sb.from('ai_cache').delete().eq('cache_key', cacheKey).then(() => {});
      return null;
    }

    return data.response_json as T;
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
    const sb = getSupabase();
    await sb.from('ai_cache').upsert({
      cache_key: cacheKey,
      response_json: responseJson,
      created_at: new Date().toISOString(),
      ttl_seconds: ttlSeconds,
    });
  } catch {
    // Cache write failure is non-fatal
  }
}
