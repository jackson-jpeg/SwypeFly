import { useInfiniteQuery } from '@tanstack/react-query';
import { mockDestinations } from '../data/destinations';
import { FEED_PAGE_SIZE } from '../constants/layout';
import { useUIStore } from '../stores/uiStore';
import { scoreFeed } from '../utils/scoreFeed';
import type { Destination, DestinationFeedPage } from '../types/destination';

const PRICE_PROXY = process.env.EXPO_PUBLIC_PRICE_API_URL || 'http://localhost:3001';

interface PriceData {
  price: number;
  currency: string;
  airline: string;
  duration: string;
}

// Fetch live prices from the proxy server
async function fetchLivePrices(origin: string): Promise<Map<string, PriceData> | null> {
  try {
    const res = await fetch(`${PRICE_PROXY}/api/flights?origin=${origin}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return new Map(Object.entries(data.prices || {})) as Map<string, PriceData>;
  } catch {
    return null;
  }
}

// Cache per origin — exported for use in detail page
const destinationCache = new Map<string, Destination[]>();

/** Look up a destination by ID, preferring live-price-merged data */
export function getDestinationById(id: string): Destination | undefined {
  // Check all cached origins for this ID
  for (const destinations of destinationCache.values()) {
    const found = destinations.find((d) => d.id === id);
    if (found) return found;
  }
  // Fallback to mock catalog
  return mockDestinations.find((d) => d.id === id);
}

async function loadDestinations(origin: string): Promise<Destination[]> {
  const cached = destinationCache.get(origin);
  if (cached) return cached;

  // Try to get live prices
  const prices = await fetchLivePrices(origin);

  let destinations: Destination[];
  if (prices && prices.size > 0) {
    destinations = mockDestinations.map((dest) => {
      const live = prices.get(dest.iataCode);
      if (live) {
        return {
          ...dest,
          flightPrice: live.price,
          flightDuration: live.duration || dest.flightDuration,
          livePrice: live.price,
        };
      }
      return { ...dest, livePrice: null };
    });

    // Diversity-aware sort instead of cheapest-first
    destinations = scoreFeed(destinations);
  } else {
    destinations = scoreFeed(mockDestinations.map((d) => ({ ...d, livePrice: null })));
  }

  destinationCache.set(origin, destinations);
  return destinations;
}

async function fetchPage(origin: string, cursor: string | null): Promise<DestinationFeedPage> {
  if (!cursor && !destinationCache.has(origin)) {
    await new Promise((r) => setTimeout(r, 300));
  }

  const all = await loadDestinations(origin);
  const start = cursor ? parseInt(cursor, 10) : 0;
  const destinations = all.slice(start, start + FEED_PAGE_SIZE);
  const nextIndex = start + FEED_PAGE_SIZE;
  const nextCursor = nextIndex < all.length ? String(nextIndex) : null;

  return { destinations, nextCursor };
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
