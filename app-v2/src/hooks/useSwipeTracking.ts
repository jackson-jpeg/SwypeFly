import { useRef, useCallback } from 'react';
import { apiFetch } from '@/api/client';

/** Fire-and-forget swipe tracking — records user interactions to train the feed algorithm */
export function useSwipeTracking() {
  const viewedSet = useRef(new Set<string>());
  const viewTimers = useRef(new Map<string, number>());

  const trackView = useCallback((destinationId: string, priceShown?: number) => {
    if (viewedSet.current.has(destinationId)) return;
    viewedSet.current.add(destinationId);
    viewTimers.current.set(destinationId, Date.now());

    apiFetch('/api/swipe', {
      method: 'POST',
      body: JSON.stringify({
        destination_id: destinationId,
        action: 'viewed',
        time_spent_ms: 0,
        price_shown: priceShown ?? 0,
      }),
    }).catch(() => {}); // best-effort
  }, []);

  const trackSave = useCallback((destinationId: string, priceShown?: number) => {
    const startTime = viewTimers.current.get(destinationId);
    const timeSpent = startTime ? Date.now() - startTime : 0;

    apiFetch('/api/swipe', {
      method: 'POST',
      body: JSON.stringify({
        destination_id: destinationId,
        action: 'saved',
        time_spent_ms: timeSpent,
        price_shown: priceShown ?? 0,
      }),
    }).catch(() => {}); // best-effort
  }, []);

  return { trackView, trackSave };
}
