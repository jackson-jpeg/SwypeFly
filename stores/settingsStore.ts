import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createPersistStorage } from '../utils/storage';

interface SettingsState {
  departureCode: string;
  departureCity: string;
  preferredView: 'swipe' | 'board';
  usesMetric: boolean;
  notificationsEnabled: boolean;
  priceAlertsEnabled: boolean;
  hasCompletedOnboarding: boolean;

  setDeparture: (city: string, code: string) => void;
  setPreferredView: (view: 'swipe' | 'board') => void;
  setUsesMetric: (metric: boolean) => void;
  setNotifications: (enabled: boolean) => void;
  setPriceAlerts: (enabled: boolean) => void;
  setOnboarded: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      departureCode: 'TPA',
      departureCity: 'Tampa',
      preferredView: 'swipe',
      usesMetric: false,
      notificationsEnabled: false,
      priceAlertsEnabled: false,
      hasCompletedOnboarding: false,

      setDeparture: (city, code) => set({ departureCity: city, departureCode: code }),
      setPreferredView: (view) => set({ preferredView: view }),
      setUsesMetric: (metric) => set({ usesMetric: metric }),
      setNotifications: (enabled) => set({ notificationsEnabled: enabled }),
      setPriceAlerts: (enabled) => set({ priceAlertsEnabled: enabled }),
      setOnboarded: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: 'sogojet-settings',
      storage: createPersistStorage(),
    },
  ),
);
