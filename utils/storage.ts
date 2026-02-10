// ─── Cross-Platform Zustand Storage Adapter ──────────────────────────────────
// Uses localStorage on web and expo-secure-store on native.

import { Platform } from 'react-native';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

function createNativeStorage(): StateStorage {
  // Lazy-load SecureStore to avoid import issues on web
  let SecureStore: typeof import('expo-secure-store') | null = null;

  const getStore = async () => {
    if (!SecureStore) {
      SecureStore = await import('expo-secure-store');
    }
    return SecureStore;
  };

  return {
    getItem: async (name: string): Promise<string | null> => {
      try {
        const store = await getStore();
        return await store.getItemAsync(name);
      } catch {
        return null;
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        const store = await getStore();
        await store.setItemAsync(name, value);
      } catch {
        // SecureStore has a ~2KB limit per key on some platforms.
        // Fall back silently if the value is too large.
      }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        const store = await getStore();
        await store.deleteItemAsync(name);
      } catch {
        // Ignore removal errors
      }
    },
  };
}

/**
 * Creates a cross-platform JSON storage adapter for Zustand persist middleware.
 * Accepts optional reviver/replacer for custom serialization (e.g. Set ↔ Array).
 */
export function createPersistStorage(options?: {
  reviver?: (key: string, value: unknown) => unknown;
  replacer?: (key: string, value: unknown) => unknown;
}) {
  if (Platform.OS === 'web') {
    return createJSONStorage(() => localStorage, options);
  }

  return createJSONStorage(() => createNativeStorage(), options);
}
