import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch, USE_STUBS } from '@/api/client';
import { getStubFeed } from '@/api/stubs';
import { useUIStore } from '@/stores/uiStore';
import type { DestinationFeedPage } from '@/api/types';

export function useFeed() {
  const departureCode = useUIStore((s) => s.departureCode);
  const vibePrefs = useUIStore((s) => s.vibePrefs);
  const primaryVibe = vibePrefs[0] ?? '';

  return useInfiniteQuery({
    queryKey: ['feed', departureCode, primaryVibe],
    queryFn: async ({ pageParam = '0' }) => {
      if (USE_STUBS) {
        return getStubFeed(Number(pageParam), 5);
      }
      const params = new URLSearchParams({ origin: departureCode, cursor: pageParam as string });
      if (primaryVibe) params.set('vibeFilter', primaryVibe);
      return apiFetch<DestinationFeedPage>(`/api/feed?${params.toString()}`);
    },
    initialPageParam: '0',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
