import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch, USE_STUBS } from '@/api/client';
import { getStubFeed } from '@/api/stubs';
import { useUIStore } from '@/stores/uiStore';
import type { DestinationFeedPage } from '@/api/types';

export function useFeed() {
  const departureCode = useUIStore((s) => s.departureCode);
  const vibePrefs = useUIStore((s) => s.vibePrefs);
  const vibeFilter = vibePrefs.join(',');

  return useInfiniteQuery({
    queryKey: ['feed', departureCode, vibeFilter],
    queryFn: async ({ pageParam = '0' }) => {
      if (USE_STUBS) {
        return getStubFeed(Number(pageParam), 5);
      }
      const params = new URLSearchParams({ origin: departureCode, cursor: pageParam as string });
      if (vibeFilter) params.set('vibeFilter', vibeFilter);
      return apiFetch<DestinationFeedPage>(`/api/feed?${params.toString()}`);
    },
    initialPageParam: '0',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
