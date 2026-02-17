import { useCallback, useEffect, useRef } from 'react';
import { useSavedStore } from '../stores/savedStore';
import { mediumHaptic, successHaptic } from '../utils/haptics';
import { supabase } from '../services/supabase';
import { useAuthContext } from './AuthContext';
import { showError } from '../stores/toastStore';
import { captureException } from '../utils/sentry';

export function useSaveDestination() {
  const toggleSaved = useSavedStore((s) => s.toggleSaved);
  const savedIds = useSavedStore((s) => s.savedIds);
  const hydrate = useSavedStore((s) => s.hydrate);
  const { user } = useAuthContext();
  const hydratedRef = useRef(false);
  // Per-destination in-flight lock to prevent rapid toggle race conditions
  const inFlightRef = useRef(new Set<string>());

  // Hydrate saved IDs from Supabase on login
  useEffect(() => {
    if (!user || hydratedRef.current) return;
    hydratedRef.current = true;

    supabase
      .from('saved_trips')
      .select('destination_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error) {
          captureException(error, { context: 'useSaveDestination.hydrate' });
          return;
        }
        if (data && data.length > 0) {
          hydrate(data.map((row) => row.destination_id));
        }
      });
  }, [user, hydrate]);

  // Reset hydration flag on logout
  useEffect(() => {
    if (!user) hydratedRef.current = false;
  }, [user]);

  const toggle = useCallback(
    async (id: string) => {
      // Prevent rapid double-toggle on same destination
      if (inFlightRef.current.has(id)) return;

      // Read directly from store to avoid stale closure
      const wasSaved = useSavedStore.getState().savedIds.has(id);
      mediumHaptic();

      // Optimistic update
      toggleSaved(id);

      // Success haptic on save (not unsave)
      if (!wasSaved) successHaptic();

      // Sync to Supabase if authenticated
      if (user) {
        inFlightRef.current.add(id);
        try {
          if (wasSaved) {
            const { error } = await supabase
              .from('saved_trips')
              .delete()
              .eq('user_id', user.id)
              .eq('destination_id', id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('saved_trips')
              .upsert(
                { user_id: user.id, destination_id: id },
                { onConflict: 'user_id,destination_id' },
              );
            if (error) throw error;
          }
        } catch (err) {
          // Rollback optimistic update
          toggleSaved(id);
          showError('Failed to save. Please try again.');
          captureException(err, { context: 'useSaveDestination.toggle', destinationId: id });
        } finally {
          inFlightRef.current.delete(id);
        }
      }
    },
    [toggleSaved, user],
  );

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  return { toggle, isSaved };
}
