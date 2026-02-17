// ─── Shared API Helpers ──────────────────────────────────────────────────────
// Centralizes API base URL resolution and auth header injection.

import { supabase } from './supabase';

/**
 * Resolves the API base URL.
 * - On Vercel (production): same origin, so '' works (relative paths).
 * - In local dev: Expo dev server doesn't serve /api, so we need the
 *   Vercel dev server URL or fallback gracefully.
 */
function getApiBase(): string {
  if (typeof window !== 'undefined' && window.location?.hostname !== 'localhost') {
    return '';
  }
  return '';
}

export const API_BASE = getApiBase();

/**
 * Get Authorization header with current Supabase session token.
 * Returns empty object if no session is available.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // No auth available — that's fine for guest users
  }
  return {};
}
