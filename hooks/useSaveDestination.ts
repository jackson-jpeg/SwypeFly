import { useCallback, useEffect, useRef } from 'react';
import { useSavedStore } from '../stores/savedStore';
import { mediumHaptic, successHaptic } from '../utils/haptics';
import { databases, DATABASE_ID, COLLECTIONS } from '../services/appwrite';
import { ID, Query, Permission, Role } from 'appwrite';
import { useAuthContext } from './AuthContext';
import { showError } from '../stores/toastStore';
import { captureException } from '../utils/sentry';

export function useSaveDestination() {
  const toggleSaved = useSavedStore((s) => s.toggleSaved);
  const savedIds = useSavedStore((s) => s.savedIds);
  const hydrate = useSavedStore((s) => s.hydrate);
  const { user } = useAuthContext();
  const hydratedRef = useRef(false);
  const inFlightRef = useRef(new Set<string>());

  // Hydrate saved IDs from Appwrite on login
  useEffect(() => {
    if (!user || hydratedRef.current) return;
    hydratedRef.current = true;

    databases
      .listDocuments(DATABASE_ID, COLLECTIONS.savedTrips, [
        Query.equal('user_id', user.id),
        Query.limit(500),
      ])
      .then((result) => {
        if (result.documents.length > 0) {
          hydrate(result.documents.map((doc) => doc.destination_id as string));
        }
      })
      .catch((err) => {
        captureException(err, { context: 'useSaveDestination.hydrate' });
      });
  }, [user, hydrate]);

  // Reset hydration flag on logout
  useEffect(() => {
    if (!user) hydratedRef.current = false;
  }, [user]);

  const toggle = useCallback(
    async (id: string) => {
      if (inFlightRef.current.has(id)) return;

      const wasSaved = useSavedStore.getState().savedIds.has(id);
      mediumHaptic();

      // Optimistic update
      toggleSaved(id);

      if (!wasSaved) successHaptic();

      // Sync to Appwrite if authenticated
      if (user) {
        inFlightRef.current.add(id);
        try {
          if (wasSaved) {
            // Find and delete the saved trip document
            const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.savedTrips, [
              Query.equal('user_id', user.id),
              Query.equal('destination_id', id),
              Query.limit(1),
            ]);
            if (result.documents.length > 0) {
              await databases.deleteDocument(
                DATABASE_ID,
                COLLECTIONS.savedTrips,
                result.documents[0].$id,
              );
            }
          } else {
            await databases.createDocument(
              DATABASE_ID,
              COLLECTIONS.savedTrips,
              ID.unique(),
              {
                user_id: user.id,
                destination_id: id,
                saved_at: new Date().toISOString(),
              },
              [Permission.read(Role.user(user.id)), Permission.delete(Role.user(user.id))],
            );
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
