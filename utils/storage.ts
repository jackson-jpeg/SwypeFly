import { createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Creates an AsyncStorage-backed JSON storage adapter for Zustand persist middleware.
 */
export function createPersistStorage() {
  return createJSONStorage(() => AsyncStorage);
}
