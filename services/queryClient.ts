// ─── Shared React Query Client ───────────────────────────────────────────────
// Extracted so stores can invalidate queries without circular imports.

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000, // Keep cached data for 30 min (offline viewing)
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
    },
    mutations: {
      retry: 1,
    },
  },
});
