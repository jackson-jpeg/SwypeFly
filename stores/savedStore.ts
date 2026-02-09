import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';

interface SavedState {
  savedIds: Set<string>;
  toggleSaved: (id: string) => void;
  isSaved: (id: string) => boolean;
  hydrate: (ids: string[]) => void;
}

const webStorage = Platform.OS === 'web'
  ? createJSONStorage(() => localStorage, {
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
    })
  : undefined;

export const useSavedStore = create<SavedState>()(
  persist(
    (set, get) => ({
      savedIds: new Set(),
      toggleSaved: (id) =>
        set((state) => {
          const next = new Set(state.savedIds);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return { savedIds: next };
        }),
      isSaved: (id) => get().savedIds.has(id),
      hydrate: (ids) =>
        set(() => ({ savedIds: new Set(ids) })),
    }),
    {
      name: 'sogojet-saved',
      storage: webStorage,
      partialize: (state) => ({ savedIds: state.savedIds }),
    },
  ),
);
