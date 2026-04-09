import { useEffect, useRef } from 'react';
import * as Network from 'expo-network';
import { useSavedStore, type PendingSync } from '../stores/savedStore';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

/**
 * Retrieve the stored auth session token (Clerk JWT).
 * Returns null when no user is signed in (guest mode).
 *
 * Currently checks localStorage/AsyncStorage for the token set by the
 * auth flow. When client-side Clerk auth is added, this should be
 * replaced with the Clerk SDK's `getToken()`.
 */
async function getAuthToken(): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('sogojet-session-token') || null;
    }
  } catch {
    // SSR or storage unavailable
  }
  return null;
}

/** Calculate delay with exponential backoff: 1s, 2s, 4s, 8s, … capped at 60s. */
function backoffDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 60_000);
}

/**
 * Flush pending save/unsave actions to the backend.
 * Each sync is attempted individually — successful ones are cleared from the queue.
 * Failed syncs remain queued for the next connectivity event.
 *
 * Uses exponential backoff on repeated failures and includes auth headers
 * when a session token is available.
 */
async function flushPendingSyncs(
  pending: PendingSync[],
  clearSynced: (ids: string[]) => void,
): Promise<void> {
  if (pending.length === 0) return;

  // Require an auth token — the /api/saved endpoint returns 401 without one
  const token = await getAuthToken();
  if (!token) {
    // Guest mode: skip network sync entirely. Saves are persisted locally
    // in the Zustand store and will sync once the user signs in.
    return;
  }

  const synced: string[] = [];
  let consecutiveFailures = 0;

  for (const item of pending) {
    // Exponential backoff: wait before retrying after consecutive failures
    if (consecutiveFailures > 0) {
      const delay = backoffDelay(consecutiveFailures - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/saved?action=${item.action}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ destination_id: item.destinationId }),
        },
      );

      if (res.ok) {
        synced.push(item.destinationId);
        consecutiveFailures = 0;
      } else if (res.status === 401) {
        // Token expired or invalid — stop flushing until next session/refresh
        break;
      } else if (res.status === 429) {
        // Rate limited — back off and stop for now
        consecutiveFailures++;
        break;
      } else {
        // Server error (500, etc.) — increment backoff but keep trying others
        consecutiveFailures++;
        if (consecutiveFailures >= 5) {
          // Too many consecutive failures — bail out, try again later
          break;
        }
      }
    } catch {
      // Network error — increment backoff
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        // Likely still offline — stop flushing, will retry on next connectivity event
        break;
      }
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
