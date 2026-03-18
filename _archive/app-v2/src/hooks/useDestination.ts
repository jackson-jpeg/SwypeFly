import { useQuery } from '@tanstack/react-query';
import { apiFetch, USE_STUBS } from '@/api/client';
import { getStubDestination } from '@/api/stubs';
import { useUIStore } from '@/stores/uiStore';
import type { Destination } from '@/api/types';

export function useDestination(id: string | undefined) {
  const departureCode = useUIStore((s) => s.departureCode);

  return useQuery({
    queryKey: ['destination', id, departureCode],
    queryFn: async () => {
      if (USE_STUBS) {
        const dest = getStubDestination(id!);
        if (!dest) throw new Error('Destination not found');
        return dest;
      }
      return apiFetch<Destination>(
        `/api/destination?id=${id}&origin=${departureCode}`,
      );
    },
    enabled: !!id,
  });
}
