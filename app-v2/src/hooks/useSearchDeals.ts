import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';

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

export function useSearchDeals(params: SearchDealsParams) {
  return useInfiniteQuery<SearchDealsResponse>({
    queryKey: ['search-deals', params],
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams();
      qs.set('origin', params.origin);
      if (params.search) qs.set('search', params.search);
      if (params.region) qs.set('region', params.region);
      if (params.minPrice != null) qs.set('minPrice', String(params.minPrice));
      if (params.maxPrice != null) qs.set('maxPrice', String(params.maxPrice));
      if (params.sort) qs.set('sort', params.sort);
      if (pageParam) qs.set('cursor', String(pageParam));

      return apiFetch<SearchDealsResponse>(`/api/search-deals?${qs}`);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000,
  });
}
