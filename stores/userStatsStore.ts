import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createPersistStorage } from '../utils/storage';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  total_saves: number;
  avg_savings_percent: number;
  score: number;
  top_destination: string | null;
}

interface UserStatsState {
  leaderboard: LeaderboardEntry[];
  total: number;
  lastFetched: string | null;
  isLoading: boolean;
  error: string | null;
  fetchLeaderboard: (apiBase: string) => Promise<void>;
}

export const useUserStatsStore = create<UserStatsState>()(
  persist(
    (set) => ({
      leaderboard: [],
      total: 0,
      lastFetched: null,
      isLoading: false,
      error: null,

      fetchLeaderboard: async (apiBase: string) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${apiBase}/api/leaderboard?limit=50`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          if (!json.ok) throw new Error(json.error?.message || 'Failed to fetch');
          set({
            leaderboard: json.data.leaderboard,
            total: json.data.total,
            lastFetched: new Date().toISOString(),
            isLoading: false,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      },
    }),
    {
      name: 'sogojet-user-stats',
      storage: createPersistStorage(),
      partialize: (state) => ({
        leaderboard: state.leaderboard,
        total: state.total,
        lastFetched: state.lastFetched,
      }),
    },
  ),
);
