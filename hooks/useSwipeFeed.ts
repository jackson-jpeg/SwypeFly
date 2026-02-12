import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useUIStore } from '../stores/uiStore';
import { useFeedStore } from '../stores/feedStore';
import { supabase } from '../services/supabase';
import { captureException } from '../utils/sentry';
import type { Destination, DestinationFeedPage } from '../types/destination';

/**
 * Resolves the API base URL.
 * - On Vercel (production): same origin, so '' works (relative paths).
 * - In local dev: Expo dev server doesn't serve /api, so we need the
 *   Vercel dev server URL or fallback gracefully.
 */
function getApiBase(): string {
  // In production (web) the API is same-origin
  if (typeof window !== 'undefined' && window.location?.hostname !== 'localhost') {
    return '';
  }
  // Local dev: try Vercel dev server or fall back to empty string
  return '';
}

const API_BASE = getApiBase();

// ─── Auth token helper ──────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // No auth available — that's fine
  }
  return {};
}

// ─── Feed ────────────────────────────────────────────────────────────

async function fetchPage(
  origin: string,
  cursor: string | null,
  sessionId: string,
  excludeIds: string[],
  vibeFilter: string | null,
  sortPreset: string | null,
): Promise<DestinationFeedPage> {
  const params = new URLSearchParams({ origin });
  if (cursor) params.set('cursor', cursor);
  params.set('sessionId', sessionId);
  if (excludeIds.length > 0) {
    params.set('excludeIds', excludeIds.join(','));
  }
  if (vibeFilter) {
    params.set('vibeFilter', vibeFilter);
  }
  if (sortPreset && sortPreset !== 'default') {
    params.set('sortPreset', sortPreset);
  }

  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/feed?${params}`, {
    headers: authHeaders,
  });
  if (!res.ok) throw new Error(`Feed request failed: ${res.status}`);
  return res.json();
}

export function useSwipeFeed() {
  const departureCode = useUIStore((s) => s.departureCode);
  const sessionId = useFeedStore((s) => s.sessionId);
  const viewedIds = useFeedStore((s) => s.viewedIds);
  const vibeFilter = useFeedStore((s) => s.vibeFilter);
  const sortPreset = useFeedStore((s) => s.sortPreset);

  return useInfiniteQuery({
    queryKey: ['feed', departureCode, sessionId],
    queryFn: ({ pageParam }) =>
      fetchPage(departureCode, pageParam, sessionId, Array.from(viewedIds), vibeFilter, sortPreset),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

// ─── Swipe tracking (fire-and-forget) ───────────────────────────────

export async function recordSwipe(
  destinationId: string,
  action: 'viewed' | 'skipped' | 'saved',
  timeSpentMs?: number,
  priceShown?: number,
): Promise<void> {
  try {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.Authorization) return; // No auth = anonymous, skip tracking

    fetch(`${API_BASE}/api/swipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        destination_id: destinationId,
        action,
        time_spent_ms: timeSpentMs,
        price_shown: priceShown,
      }),
    }).catch((err) => captureException(err, { context: 'recordSwipe' }));
  } catch {
    // Silently fail
  }
}

// ─── Single Destination ──────────────────────────────────────────────

async function fetchDestination(id: string, origin: string): Promise<Destination> {
  const res = await fetch(`${API_BASE}/api/destination?id=${id}&origin=${origin}`);
  if (!res.ok) throw new Error(`Destination request failed: ${res.status}`);
  return res.json();
}

const VALID_ID_RE = /^[0-9a-f-]+$/i;

export function useDestination(id: string | undefined) {
  const departureCode = useUIStore((s) => s.departureCode);
  const isValidId = !!id && VALID_ID_RE.test(id);

  return useQuery({
    queryKey: ['destination', id, departureCode],
    queryFn: () => fetchDestination(id!, departureCode),
    enabled: isValidId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Legacy helper — looks up a destination from the feed cache.
 * Used by components that already have the feed data loaded.
 */
export function getDestinationById(
  id: string,
  pages?: DestinationFeedPage[],
): Destination | undefined {
  if (!pages) return undefined;
  for (const page of pages) {
    const found = page.destinations.find((d) => d.id === id);
    if (found) return found;
  }
  return undefined;
}
