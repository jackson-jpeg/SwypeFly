import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiFetch } from '@/api/client';

interface SavedState {
  savedIds: string[];
  toggle: (id: string, userId?: string) => void;
  isSaved: (id: string) => boolean;
  clear: () => void;
  syncFromServer: (userId?: string) => Promise<void>;
}

/** Fire-and-forget API call — errors are silently ignored to keep UX snappy */
async function syncSave(destId: string) {
  try {
    await apiFetch('/api/saved?action=save', {
      method: 'POST',
      body: JSON.stringify({ destination_id: destId }),
    });
  } catch {
    // Best-effort sync
  }
}

async function syncUnsave(destId: string) {
  try {
    await apiFetch('/api/saved?action=unsave', {
      method: 'POST',
      body: JSON.stringify({ destination_id: destId }),
    });
  } catch {
    // Best-effort sync
  }
}

export const useSavedStore = create<SavedState>()(
  persist(
    (set, get) => ({
      savedIds: [],
      toggle: (id, userId) => {
        const removing = get().savedIds.includes(id);
        set((s) => ({
          savedIds: removing
            ? s.savedIds.filter((i) => i !== id)
            : [...s.savedIds, id],
        }));
        // Async sync to server via API (non-blocking, auth token injected by apiFetch)
        if (userId) {
          if (removing) {
            syncUnsave(id);
          } else {
            syncSave(id);
          }
        }
      },
      isSaved: (id) => get().savedIds.includes(id),
      clear: () => set({ savedIds: [] }),
      syncFromServer: async () => {
        try {
          const { savedIds: serverIds } = await apiFetch<{ savedIds: string[] }>('/api/saved?action=list');
          const localIds = get().savedIds;
          const merged = [...new Set([...localIds, ...serverIds])];
          set({ savedIds: merged });

          // Upload any local-only IDs to server
          const localOnly = localIds.filter((id) => !serverIds.includes(id));
          for (const id of localOnly) {
            syncSave(id);
          }
        } catch {
          // Keep local state if server unavailable
        }
      },
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
