import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createPersistStorage } from '../utils/storage';

interface SavedState {
  savedIds: Set<string>;
  savedAt: Record<string, number>; // id → timestamp
  toggleSaved: (id: string) => void;
  isSaved: (id: string) => boolean;
  getSavedAt: (id: string) => number | undefined;
  hydrate: (ids: string[]) => void;
}

const storage = createPersistStorage({
  reviver: (_key: string, value: unknown) => {
    if (typeof value === 'object' && value !== null && (value as Record<string, unknown>).__set === true) {
      return new Set((value as { items: string[] }).items);
    }
    return value;
  },
  replacer: (_key: string, value: unknown) => {
    if (value instanceof Set) {
      return { __set: true, items: [...value] };
    }
    return value;
  },
});

export const useSavedStore = create<SavedState>()(
  persist(
    (set, get) => ({
      savedIds: new Set(),
      savedAt: {},
      toggleSaved: (id) =>
        set((state) => {
          const next = new Set(state.savedIds);
          const nextAt = { ...state.savedAt };
          if (next.has(id)) {
            next.delete(id);
            delete nextAt[id];
          } else {
            next.add(id);
            nextAt[id] = Date.now();
          }
          return { savedIds: next, savedAt: nextAt };
        }),
      isSaved: (id) => get().savedIds.has(id),
      getSavedAt: (id) => get().savedAt[id],
      hydrate: (ids) =>
        set((state) => {
          // Merge server IDs with any locally saved IDs (preserves guest saves on login)
          const merged = new Set(state.savedIds);
          const mergedAt = { ...state.savedAt };
          const now = Date.now();
          for (const id of ids) {
            merged.add(id);
            if (!mergedAt[id]) mergedAt[id] = now;
          }
          return { savedIds: merged, savedAt: mergedAt };
        }),
    }),
    {
      name: 'sogojet-saved',
      storage,
      partialize: (state) => ({ savedIds: state.savedIds, savedAt: state.savedAt }),
    },
  ),
);
