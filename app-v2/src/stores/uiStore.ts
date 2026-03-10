import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { queryClient } from '@/api/client';

export type TravelStyle = 'budget' | 'comfort' | 'luxury';
export type BudgetLevel = 'low' | 'medium' | 'high';
export type PreferredSeason = 'spring' | 'summer' | 'fall' | 'winter';

interface UIState {
  hapticsEnabled: boolean;
  theme: 'dark' | 'light' | 'system';
  departureCity: string;
  departureCode: string;
  currency: string;
  tempUnit: '°F' | '°C';
  notifications: boolean;
  priceAlerts: boolean;
  vibePrefs: string[];
  travelStyle: TravelStyle | null;
  budgetLevel: BudgetLevel | null;
  preferredSeason: PreferredSeason | null;
  isGuest: boolean;
  hasOnboarded: boolean;
  setVibePrefs: (vibes: string[]) => void;
  setTravelStyle: (style: TravelStyle | null) => void;
  setBudgetLevel: (level: BudgetLevel | null) => void;
  setPreferredSeason: (season: PreferredSeason | null) => void;
  setOnboarded: () => void;
  toggleHaptics: () => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setDeparture: (city: string, code: string) => void;
  setCurrency: (currency: string) => void;
  setTempUnit: (unit: '°F' | '°C') => void;
  toggleNotifications: () => void;
  togglePriceAlerts: () => void;
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
      tempUnit: '°F',
      notifications: true,
      priceAlerts: false,
      vibePrefs: [],
      travelStyle: null,
      budgetLevel: null,
      preferredSeason: null,
      isGuest: false,
      hasOnboarded: false,
      setVibePrefs: (vibes) => set({ vibePrefs: vibes }),
      setTravelStyle: (style) => set({ travelStyle: style }),
      setBudgetLevel: (level) => set({ budgetLevel: level }),
      setPreferredSeason: (season) => set({ preferredSeason: season }),
      setOnboarded: () => set({ hasOnboarded: true }),
      toggleHaptics: () => set((s) => ({ hapticsEnabled: !s.hapticsEnabled })),
      setTheme: (theme) => set({ theme }),
      setDeparture: (city, code) => {
        set({ departureCity: city, departureCode: code });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        queryClient.invalidateQueries({ queryKey: ['booking-search'] });
      },
      setCurrency: (currency) => set({ currency }),
      setTempUnit: (unit) => set({ tempUnit: unit }),
      toggleNotifications: () => set((s) => ({ notifications: !s.notifications })),
      togglePriceAlerts: () => set((s) => ({ priceAlerts: !s.priceAlerts })),
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
        tempUnit: s.tempUnit,
        notifications: s.notifications,
        priceAlerts: s.priceAlerts,
        vibePrefs: s.vibePrefs,
        travelStyle: s.travelStyle,
        budgetLevel: s.budgetLevel,
        preferredSeason: s.preferredSeason,
        isGuest: s.isGuest,
        hasOnboarded: s.hasOnboarded,
      }),
    },
  ),
);
