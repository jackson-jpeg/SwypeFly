import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch, USE_STUBS } from '@/api/client';
import { getStubFeed } from '@/api/stubs';
import { useUIStore } from '@/stores/uiStore';
import { useFeedStore } from '@/stores/feedStore';
import type { DestinationFeedPage } from '@/api/types';

// Stable per browser session — resets on refresh, consistent across paginated requests
const SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function useFeed() {
  const departureCode = useUIStore((s) => s.departureCode);
  const vibePrefs = useUIStore((s) => s.vibePrefs);
  const travelStyle = useUIStore((s) => s.travelStyle);
  const budgetLevel = useUIStore((s) => s.budgetLevel);
  const preferredSeason = useUIStore((s) => s.preferredSeason);
  const { filters, searchQuery } = useFeedStore();

  // Feed store vibes override UI store vibePrefs when active
  const vibeFilter = filters.vibes.length > 0 ? filters.vibes.join(',') : vibePrefs.join(',');
  const regionFilter = filters.region.join(',');
  const { minPrice, maxPrice, durationFilter } = filters;

  // Quiz-based personalization params (comma-separated vibes from quiz)
  const preferredVibes = vibePrefs.length > 0 ? vibePrefs.join(',') : '';

  return useInfiniteQuery({
    queryKey: ['feed', departureCode, vibeFilter, regionFilter, minPrice, maxPrice, searchQuery, durationFilter, travelStyle, budgetLevel, preferredSeason, preferredVibes],
    queryFn: async ({ pageParam = '0' }) => {
      if (USE_STUBS) {
        return getStubFeed(Number(pageParam), 5);
      }
      const params = new URLSearchParams({
        origin: departureCode,
        cursor: pageParam as string,
        sessionId: SESSION_ID,
      });
      if (vibeFilter) params.set('vibeFilter', vibeFilter);
      if (regionFilter) params.set('regionFilter', regionFilter);
      if (minPrice !== null) params.set('minPrice', String(minPrice));
      if (maxPrice !== null) params.set('maxPrice', String(maxPrice));
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (durationFilter && durationFilter !== 'any') params.set('durationFilter', durationFilter);
      // Quiz personalization params
      if (travelStyle) params.set('travelStyle', travelStyle);
      if (budgetLevel) params.set('budgetLevel', budgetLevel);
      if (preferredSeason) params.set('preferredSeason', preferredSeason);
      if (preferredVibes) params.set('preferredVibes', preferredVibes);
      return apiFetch<DestinationFeedPage>(`/api/feed?${params.toString()}`);
    },
    initialPageParam: '0',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
