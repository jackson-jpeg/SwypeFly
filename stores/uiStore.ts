import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';

interface UIState {
  hapticsEnabled: boolean;
  theme: 'dark' | 'light' | 'system';
  departureCity: string;
  departureCode: string;
  currency: string;
  toggleHaptics: () => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setDeparture: (city: string, code: string) => void;
  setCurrency: (currency: string) => void;
}

const webStorage = Platform.OS === 'web'
  ? createJSONStorage(() => localStorage)
  : undefined;

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      theme: 'dark',
      departureCity: 'Tampa',
      departureCode: 'TPA',
      currency: 'USD',
      toggleHaptics: () => set((state) => ({ hapticsEnabled: !state.hapticsEnabled })),
      setTheme: (theme) => set({ theme }),
      setDeparture: (city, code) => set({ departureCity: city, departureCode: code }),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'swypefly-prefs',
      storage: webStorage,
      partialize: (state) => ({
        hapticsEnabled: state.hapticsEnabled,
        theme: state.theme,
        departureCity: state.departureCity,
        departureCode: state.departureCode,
        currency: state.currency,
      }),
    },
  ),
);
