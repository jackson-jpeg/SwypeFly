import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SavedState {
  savedIds: string[];
  toggle: (id: string) => void;
  isSaved: (id: string) => boolean;
  clear: () => void;
}

export const useSavedStore = create<SavedState>()(
  persist(
    (set, get) => ({
      savedIds: [],
      toggle: (id) =>
        set((s) => ({
          savedIds: s.savedIds.includes(id)
            ? s.savedIds.filter((i) => i !== id)
            : [...s.savedIds, id],
        })),
      isSaved: (id) => get().savedIds.includes(id),
      clear: () => set({ savedIds: [] }),
    }),
    {
      name: 'sogojet-saved',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = persisted as Partial<SavedState> | undefined;
        const ids = p?.savedIds;
        return {
          ...current,
          ...p,
          savedIds: Array.isArray(ids) ? ids : [],
        };
      },
    },
  ),
);
