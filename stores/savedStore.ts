import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createPersistStorage } from '../utils/storage';
import type { BoardDeal } from '../types/deal';

interface SavedState {
  savedIds: string[];
  savedDeals: BoardDeal[];
  toggle: (deal: BoardDeal) => void;
  isSaved: (id: string) => boolean;
  clear: () => void;
}

export const useSavedStore = create<SavedState>()(
  persist(
    (set, get) => ({
      savedIds: [],
      savedDeals: [],

      toggle: (deal) => {
        const { savedIds, savedDeals } = get();
        if (savedIds.includes(deal.id)) {
          set({
            savedIds: savedIds.filter((id) => id !== deal.id),
            savedDeals: savedDeals.filter((d) => d.id !== deal.id),
          });
        } else {
          set({
            savedIds: [...savedIds, deal.id],
            savedDeals: [...savedDeals, deal],
          });
        }
      },

      isSaved: (id) => get().savedIds.includes(id),

      clear: () => set({ savedIds: [], savedDeals: [] }),
    }),
    {
      name: 'sogojet-saved',
      storage: createPersistStorage(),
    },
  ),
);
