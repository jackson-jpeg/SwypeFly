import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch, USE_STUBS } from '@/api/client';
import { getStubFeed } from '@/api/stubs';
import { useUIStore } from '@/stores/uiStore';
import type { DestinationFeedPage } from '@/api/types';

export function useFeed() {
  const departureCode = useUIStore((s) => s.departureCode);

  return useInfiniteQuery({
    queryKey: ['feed', departureCode],
    queryFn: async ({ pageParam = '0' }) => {
      if (USE_STUBS) {
        return getStubFeed(Number(pageParam), 5);
      }
      return apiFetch<DestinationFeedPage>(
        `/api/feed?origin=${departureCode}&cursor=${pageParam}`,
      );
    },
    initialPageParam: '0',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
