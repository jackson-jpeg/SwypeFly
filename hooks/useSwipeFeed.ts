import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { queryClient } from '../services/queryClient';
import { useUIStore } from '../stores/uiStore';
import { useFeedStore } from '../stores/feedStore';
import { captureException } from '../utils/sentry';
import { API_BASE, getAuthHeaders } from '../services/apiHelpers';
import { destinations as staticDestinations } from '../data/destinations';
import { scoreFeed } from '../utils/scoreFeed';
import type { Destination, DestinationFeedPage } from '../types/destination';

// ─── Static data fallback ─────────────────────────────────────

function getStaticPage(
  cursor: string | null,
  vibeFilter: string | null,
  sortPreset: string | null,
): DestinationFeedPage {
  let dests = [...staticDestinations];

  if (vibeFilter) {
    const vibe = vibeFilter.toLowerCase();
    dests = dests.filter((d) => d.vibeTags.some((t) => t.toLowerCase() === vibe));
  }

  if (sortPreset === 'cheapest') {
    dests.sort((a, b) => a.flightPrice - b.flightPrice);
  } else if (sortPreset === 'topRated') {
    dests.sort((a, b) => b.rating - a.rating);
  } else if (sortPreset === 'trending') {
    dests.sort((a, b) => b.reviewCount - a.reviewCount);
  } else {
    dests = scoreFeed(dests);
  }

  const pageSize = 10;
  const offset = Number(cursor) || 0;
  const page = dests.slice(offset, offset + pageSize);
  const nextCursor = offset + pageSize < dests.length ? String(offset + pageSize) : null;

  return { destinations: page, nextCursor };
}

// ─── Feed ────────────────────────────────────────────────────

async function fetchPage(
  origin: string,
  cursor: string | null,
  sessionId: string,
  excludeIds: string[],
  vibeFilter: string | null,
  sortPreset: string | null,
): Promise<DestinationFeedPage> {
  try {
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
  } catch {
    // API unavailable — fall back to static data
    return getStaticPage(cursor, vibeFilter, sortPreset);
  }
}

export function useSwipeFeed() {
  const departureCode = useUIStore((s) => s.departureCode);
  const sessionId = useFeedStore((s) => s.sessionId);
  const viewedIds = useFeedStore((s) => s.viewedIds);
  const vibeFilter = useFeedStore((s) => s.vibeFilter);
  const sortPreset = useFeedStore((s) => s.sortPreset);

  return useInfiniteQuery({
    queryKey: ['feed', departureCode, sessionId, vibeFilter, sortPreset],
    queryFn: ({ pageParam }) =>
      fetchPage(
        departureCode,
        pageParam,
        sessionId,
        Array.from(viewedIds),
        vibeFilter,
        sortPreset,
      ),
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
  try {
    const res = await fetch(`${API_BASE}/api/destination?id=${id}&origin=${origin}`);
    if (!res.ok) throw new Error(`Destination request failed: ${res.status}`);
    return res.json();
  } catch {
    // Fallback: find in static data
    const found = staticDestinations.find((d) => d.id === id);
    if (found) return found;
    throw new Error(`Destination ${id} not found`);
  }
}

const VALID_ID_RE = /^[0-9a-f-]+$/i;

export function useDestination(id: string | undefined) {
  const departureCode = useUIStore((s) => s.departureCode);
  const isValidId = !!id && (VALID_ID_RE.test(id) || /^\d+$/.test(id));

  // Try to get initial data from feed cache for instant rendering
  const feedData = queryClient.getQueryData<{ pages: DestinationFeedPage[] }>({
    queryKey: ['feed'],
    exact: false,
  } as any);
  const cachedDest = feedData ? getDestinationById(id || '', feedData.pages) : undefined;

  return useQuery({
    queryKey: ['destination', id, departureCode],
    queryFn: () => fetchDestination(id!, departureCode),
    enabled: isValidId,
    staleTime: 5 * 60 * 1000,
    initialData: cachedDest,
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
