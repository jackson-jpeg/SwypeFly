// ─── Shared React Query Client ───────────────────────────────────────────────
// Extracted so stores can invalidate queries without circular imports.

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});
