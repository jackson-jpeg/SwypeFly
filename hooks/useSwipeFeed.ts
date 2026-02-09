import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { FEED_PAGE_SIZE } from '../constants/layout';
import { useUIStore } from '../stores/uiStore';
import { supabase } from '../services/supabase';
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

async function fetchPage(origin: string, cursor: string | null): Promise<DestinationFeedPage> {
  const params = new URLSearchParams({ origin });
  if (cursor) params.set('cursor', cursor);

  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/feed?${params}`, {
    headers: authHeaders,
  });
  if (!res.ok) throw new Error(`Feed request failed: ${res.status}`);
  return res.json();
}

export function useSwipeFeed() {
  const departureCode = useUIStore((s) => s.departureCode);

  return useInfiniteQuery({
    queryKey: ['feed', departureCode],
    queryFn: ({ pageParam }) => fetchPage(departureCode, pageParam),
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
    }).catch(() => {
      // Fire-and-forget — don't block UI
    });
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

export function useDestination(id: string | undefined) {
  const departureCode = useUIStore((s) => s.departureCode);

  return useQuery({
    queryKey: ['destination', id, departureCode],
    queryFn: () => fetchDestination(id!, departureCode),
    enabled: !!id,
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
