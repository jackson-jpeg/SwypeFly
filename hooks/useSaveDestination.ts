import { useCallback } from 'react';
import { useSavedStore } from '../stores/savedStore';
import { mediumHaptic } from '../utils/haptics';

export function useSaveDestination() {
  const toggleSaved = useSavedStore((s) => s.toggleSaved);
  const savedIds = useSavedStore((s) => s.savedIds);

  const toggle = useCallback(
    (id: string) => {
      mediumHaptic();
      toggleSaved(id);
    },
    [toggleSaved],
  );

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  return { toggle, isSaved };
}
