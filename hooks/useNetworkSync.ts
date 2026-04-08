import { useEffect, useRef } from 'react';
import * as Network from 'expo-network';
import { useSavedStore, type PendingSync } from '../stores/savedStore';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

/**
 * Flush pending save/unsave actions to the backend.
 * Each sync is attempted individually — successful ones are cleared from the queue.
 * Failed syncs remain queued for the next connectivity event.
 */
async function flushPendingSyncs(
  pending: PendingSync[],
  clearSynced: (ids: string[]) => void,
): Promise<void> {
  if (pending.length === 0) return;

  const synced: string[] = [];

  for (const item of pending) {
    try {
      const res = await fetch(
        `${API_BASE}/api/saved?action=${item.action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destination_id: item.destinationId }),
        },
      );

      if (res.ok) {
        synced.push(item.destinationId);
      } else if (res.status === 401) {
        // User not authenticated — stop trying until next session
        break;
      }
      // Other errors (429, 500): leave in queue for retry
    } catch {
      // Network error — stop flushing, will retry on next connectivity event
      break;
    }
  }

  if (synced.length > 0) {
    clearSynced(synced);
  }
}

/**
 * Hook that monitors network connectivity and flushes pending
 * save/unsave actions to the backend when connection is restored.
 *
 * Call this once in the root layout.
 */
export function useNetworkSync(): void {
  const pendingSyncs = useSavedStore((s) => s.pendingSyncs);
  const clearPendingSyncs = useSavedStore((s) => s.clearPendingSyncs);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Attempt to flush on mount and whenever pendingSyncs changes
  useEffect(() => {
    if (pendingSyncs.length === 0) return;

    let cancelled = false;

    async function tryFlush() {
      try {
        const state = await Network.getNetworkStateAsync();
        if (state.isConnected && state.isInternetReachable !== false && !cancelled) {
          await flushPendingSyncs(pendingSyncs, clearPendingSyncs);
        }
      } catch {
        // expo-network unavailable (e.g. SSR) — silently skip
      }
    }

    tryFlush();

    return () => {
      cancelled = true;
    };
  }, [pendingSyncs, clearPendingSyncs]);

  // Poll connectivity every 30s when there are pending syncs
  useEffect(() => {
    if (pendingSyncs.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (state.isConnected && state.isInternetReachable !== false) {
          const current = useSavedStore.getState();
          if (current.pendingSyncs.length > 0) {
            await flushPendingSyncs(current.pendingSyncs, current.clearPendingSyncs);
          }
        }
      } catch {
        // ignore
      }
    }, 30_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pendingSyncs.length > 0]);
}
