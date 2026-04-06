import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createPersistStorage } from '../utils/storage';

interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastLoginDate: string | null; // ISO date string (YYYY-MM-DD)
  recordLogin: () => void;
}

function todayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isYesterday(dateStr: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  return dateStr === yStr;
}

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      currentStreak: 0,
      longestStreak: 0,
      lastLoginDate: null,

      recordLogin: () => {
        const today = todayDateStr();
        const { lastLoginDate, currentStreak, longestStreak } = get();

        // Already recorded today
        if (lastLoginDate === today) return;

        let newStreak: number;
        if (lastLoginDate && isYesterday(lastLoginDate)) {
          // Consecutive day
          newStreak = currentStreak + 1;
        } else {
          // Gap or first login
          newStreak = 1;
        }

        set({
          currentStreak: newStreak,
          longestStreak: Math.max(longestStreak, newStreak),
          lastLoginDate: today,
        });
      },
    }),
    {
      name: 'sogojet-streak',
      storage: createPersistStorage(),
    },
  ),
);
