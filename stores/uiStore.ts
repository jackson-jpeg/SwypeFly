import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createPersistStorage } from '../utils/storage';
import { useFeedStore } from './feedStore';
import { queryClient } from '../services/queryClient';

interface UIState {
  hapticsEnabled: boolean;
  theme: 'dark' | 'light' | 'system';
  departureCity: string;
  departureCode: string;
  currency: string;
  isGuest: boolean;
  toggleHaptics: () => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setDeparture: (city: string, code: string, manual?: boolean) => void;
  setCurrency: (currency: string) => void;
  setGuest: (isGuest: boolean) => void;
}

const storage = createPersistStorage();

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      theme: 'light',
      departureCity: 'Tampa',
      departureCode: 'TPA',
      currency: 'USD',
      isGuest: false,
      toggleHaptics: () => set((state) => ({ hapticsEnabled: !state.hapticsEnabled })),
      setTheme: (theme) => set({ theme }),
      setDeparture: (city, code, manual) => {
        set({ departureCity: city, departureCode: code });
        if (manual) {
          try { localStorage.setItem('sogojet-manual-departure', 'true'); } catch {}
        }
        useFeedStore.getState().reset();
        // Invalidate feed queries so new departure city takes effect
        queryClient.removeQueries({ queryKey: ['feed'] });
      },
      setCurrency: (currency) => set({ currency }),
      setGuest: (isGuest) => set({ isGuest }),
    }),
    {
      name: 'sogojet-prefs',
      storage,
      partialize: (state) => ({
        hapticsEnabled: state.hapticsEnabled,
        theme: state.theme,
        departureCity: state.departureCity,
        departureCode: state.departureCode,
        currency: state.currency,
        isGuest: state.isGuest,
      }),
    },
  ),
);
