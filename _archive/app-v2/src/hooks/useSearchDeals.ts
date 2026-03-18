import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { Destination } from '@/api/types';

export interface Deal {
  destinationId: string;
  city: string;
  country: string;
  iataCode: string;
  imageUrl: string;
  vibeTags: string[];
  price: number;
  currency: string;
  airline: string;
  departureDate: string;
  returnDate: string;
  tripDurationDays: number;
  priceDirection: string | null;
  previousPrice: number | null;
  priceSource: string;
  offerJson: string | null;
  offerExpiresAt: string | null;
}

interface FeedResponse {
  destinations: Destination[];
  nextCursor: string | null;
}

interface SearchDealsResponse {
  deals: Deal[];
  nextCursor: number | null;
  total: number;
}

interface SearchDealsParams {
  origin: string;
  search?: string;
  region?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'cheapest' | 'trending' | 'newest';
}

function destToDeal(d: Destination): Deal {
  return {
    destinationId: d.id,
    city: d.city,
    country: d.country,
    iataCode: d.iataCode,
    imageUrl: d.imageUrl || '',
    vibeTags: d.vibeTags || [],
    price: d.livePrice ?? d.flightPrice,
    currency: d.currency || 'USD',
    airline: d.airline || '',
    departureDate: d.departureDate || '',
    returnDate: d.returnDate || '',
    tripDurationDays: d.tripDurationDays || 0,
    priceDirection: d.priceDirection || null,
    previousPrice: d.previousPrice ?? null,
    priceSource: d.priceSource || 'estimate',
    offerJson: d.offerJson || null,
    offerExpiresAt: d.offerExpiresAt || null,
  };
}

// Map sort values: search uses 'newest', feed uses 'default'
const SORT_MAP: Record<string, string> = {
  cheapest: 'cheapest',
  trending: 'trending',
  newest: 'default',
};

export function useSearchDeals(params: SearchDealsParams) {
  return useInfiniteQuery<SearchDealsResponse>({
    queryKey: ['search-deals', params],
    queryFn: async ({ pageParam }) => {
      // Call /api/feed with mapped params
      const qs = new URLSearchParams();
      qs.set('origin', params.origin);
      if (params.search) qs.set('search', params.search);
      if (params.region) qs.set('regionFilter', params.region);
      if (params.minPrice != null) qs.set('minPrice', String(params.minPrice));
      if (params.maxPrice != null) qs.set('maxPrice', String(params.maxPrice));
      qs.set('sortPreset', SORT_MAP[params.sort || 'cheapest'] || 'cheapest');
      if (pageParam) qs.set('cursor', String(pageParam));

      const data = await apiFetch<FeedResponse>(`/api/feed?${qs}`);

      // Transform Destination[] → Deal[], filtering to only those with live prices
      const deals = data.destinations
        .filter((d) => d.livePrice != null || d.flightPrice > 0)
        .map(destToDeal);

      return {
        deals,
        nextCursor: data.nextCursor ? parseInt(data.nextCursor, 10) : null,
        total: deals.length,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000,
  });
}
