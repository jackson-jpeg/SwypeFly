import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createPersistStorage } from '../utils/storage';
import type { BoardDeal } from '../types/deal';

export interface PendingSync {
  destinationId: string;
  action: 'save' | 'unsave';
  timestamp: number;
}

interface SavedState {
  savedIds: string[];
  savedDeals: BoardDeal[];
  pendingSyncs: PendingSync[];
  toggle: (deal: BoardDeal) => void;
  isSaved: (id: string) => boolean;
  clear: () => void;
  clearPendingSyncs: (ids: string[]) => void;
  getPendingSyncs: () => PendingSync[];
}

export const useSavedStore = create<SavedState>()(
  persist(
    (set, get) => ({
      savedIds: [],
      savedDeals: [],
      pendingSyncs: [],

      toggle: (deal) => {
        const { savedIds, savedDeals, pendingSyncs } = get();
        const isSaving = !savedIds.includes(deal.id);

        // Deduplicate: remove any existing pending sync for this destination
        const filtered = pendingSyncs.filter((p) => p.destinationId !== deal.id);
        const newPending: PendingSync = {
          destinationId: deal.id,
          action: isSaving ? 'save' : 'unsave',
          timestamp: Date.now(),
        };

        if (isSaving) {
          set({
            savedIds: [...savedIds, deal.id],
            savedDeals: [...savedDeals, deal],
            pendingSyncs: [...filtered, newPending],
          });
        } else {
          set({
            savedIds: savedIds.filter((id) => id !== deal.id),
            savedDeals: savedDeals.filter((d) => d.id !== deal.id),
            pendingSyncs: [...filtered, newPending],
          });
        }
      },

      isSaved: (id) => get().savedIds.includes(id),

      clear: () => set({ savedIds: [], savedDeals: [], pendingSyncs: [] }),

      clearPendingSyncs: (ids) =>
        set((state) => ({
          pendingSyncs: state.pendingSyncs.filter((p) => !ids.includes(p.destinationId)),
        })),

      getPendingSyncs: () => get().pendingSyncs,
    }),
    {
      name: 'sogojet-saved',
      storage: createPersistStorage(),
      partialize: (state) => ({
        savedIds: state.savedIds,
        savedDeals: state.savedDeals,
        pendingSyncs: state.pendingSyncs,
      }),
    },
  ),
);
