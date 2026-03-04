import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { databases, DATABASE_ID, COLLECTIONS } from '@/services/appwrite';
import { Query, ID, Permission, Role } from 'appwrite';

interface SavedState {
  savedIds: string[];
  toggle: (id: string, userId?: string) => void;
  isSaved: (id: string) => boolean;
  clear: () => void;
  syncFromServer: (userId: string) => Promise<void>;
}

/** Fire-and-forget Appwrite write — errors are silently ignored to keep UX snappy */
async function syncSave(destId: string, userId: string) {
  try {
    await databases.createDocument(DATABASE_ID, COLLECTIONS.savedTrips, ID.unique(), {
      user_id: userId,
      destination_id: destId,
      saved_at: new Date().toISOString(),
    }, [
      Permission.read(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ]);
  } catch {
    // Best-effort sync
  }
}

async function syncUnsave(destId: string, userId: string) {
  try {
    const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.savedTrips, [
      Query.equal('user_id', userId),
      Query.equal('destination_id', destId),
      Query.limit(1),
    ]);
    if (result.documents[0]) {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.savedTrips, result.documents[0].$id);
    }
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
        // Async sync to Appwrite (non-blocking)
        if (userId) {
          if (removing) {
            syncUnsave(id, userId);
          } else {
            syncSave(id, userId);
          }
        }
      },
      isSaved: (id) => get().savedIds.includes(id),
      clear: () => set({ savedIds: [] }),
      syncFromServer: async (userId) => {
        try {
          const result = await databases.listDocuments(DATABASE_ID, COLLECTIONS.savedTrips, [
            Query.equal('user_id', userId),
            Query.limit(100),
          ]);
          const serverIds = result.documents.map((d) => d['destination_id'] as string);
          const localIds = get().savedIds;
          // Merge: union of local + server IDs
          const merged = [...new Set([...localIds, ...serverIds])];
          set({ savedIds: merged });

          // Upload any local-only IDs to server
          const localOnly = localIds.filter((id) => !serverIds.includes(id));
          for (const id of localOnly) {
            syncSave(id, userId);
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
