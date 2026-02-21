// ─── Shared API Helpers ──────────────────────────────────────────────────────
// Centralizes API base URL resolution and auth header injection.

import { account } from './appwrite';

/**
 * Resolves the API base URL.
 * - On Vercel (production): same origin, so '' works (relative paths).
 * - In local dev: Expo dev server doesn't serve /api, so requests fail
 *   gracefully and fall back to static data.
 */
function getApiBase(): string {
  return '';
}

export const API_BASE = getApiBase();

/**
 * Get Authorization header with current Appwrite JWT.
 * Returns empty object if no session is available.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const jwt = await account.createJWT();
    if (jwt?.jwt) {
      return { Authorization: `Bearer ${jwt.jwt}` };
    }
  } catch {
    // No auth available — that's fine for guest users
  }
  return {};
}
