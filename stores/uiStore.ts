import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import { useFeedStore } from './feedStore';
import { supabase } from '../services/supabase';

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
      theme: 'light',
      departureCity: 'Tampa',
      departureCode: 'TPA',
      currency: 'USD',
      toggleHaptics: () => set((state) => ({ hapticsEnabled: !state.hapticsEnabled })),
      setTheme: (theme) => set({ theme }),
      setDeparture: (city, code) => {
        set({ departureCity: city, departureCode: code });
        useFeedStore.getState().reset();
        // Fire-and-forget sync to Supabase
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            supabase.from('user_preferences').upsert({
              user_id: session.user.id,
              departure_city: city,
              departure_code: code,
            }).then(() => {});
          }
        });
      },
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'sogojet-prefs',
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
