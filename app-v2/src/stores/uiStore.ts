import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIState {
  hapticsEnabled: boolean;
  theme: 'dark' | 'light' | 'system';
  departureCity: string;
  departureCode: string;
  currency: string;
  isGuest: boolean;
  hasOnboarded: boolean;
  setOnboarded: () => void;
  toggleHaptics: () => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setDeparture: (city: string, code: string) => void;
  setCurrency: (currency: string) => void;
  setGuest: (isGuest: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      theme: 'light',
      departureCity: 'New York',
      departureCode: 'JFK',
      currency: 'USD',
      isGuest: false,
      hasOnboarded: false,
      setOnboarded: () => set({ hasOnboarded: true }),
      toggleHaptics: () => set((s) => ({ hapticsEnabled: !s.hapticsEnabled })),
      setTheme: (theme) => set({ theme }),
      setDeparture: (city, code) => set({ departureCity: city, departureCode: code }),
      setCurrency: (currency) => set({ currency }),
      setGuest: (isGuest) => set({ isGuest }),
    }),
    {
      name: 'sogojet-prefs',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        hapticsEnabled: s.hapticsEnabled,
        theme: s.theme,
        departureCity: s.departureCity,
        departureCode: s.departureCode,
        currency: s.currency,
        isGuest: s.isGuest,
        hasOnboarded: s.hasOnboarded,
      }),
    },
  ),
);
