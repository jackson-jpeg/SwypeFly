import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createPersistStorage } from '../utils/storage';
import { useFeedStore } from './feedStore';
import { supabase } from '../services/supabase';
import { queryClient } from '../services/queryClient';
import { captureException } from '../utils/sentry';

interface UIState {
  hapticsEnabled: boolean;
  theme: 'dark' | 'light' | 'system';
  departureCity: string;
  departureCode: string;
  currency: string;
  isGuest: boolean;
  toggleHaptics: () => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setDeparture: (city: string, code: string) => void;
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
      setDeparture: (city, code) => {
        set({ departureCity: city, departureCode: code });
        useFeedStore.getState().reset();
        // Invalidate feed queries so new departure city takes effect
        queryClient.removeQueries({ queryKey: ['feed'] });
        // Fire-and-forget sync to Supabase
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            supabase.from('user_preferences').upsert({
              user_id: session.user.id,
              departure_city: city,
              departure_code: code,
            }).then(({ error }) => {
              if (error) captureException(error, { context: 'uiStore.setDeparture' });
            });
          }
        }).catch((err) => captureException(err, { context: 'uiStore.setDeparture.getSession' }));
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
