import { create } from 'zustand';
import type { BoardDeal } from '../types/deal';
import { generateStubDeals } from '../utils/stubs';

const STUB_MODE = process.env.EXPO_PUBLIC_STUB_MODE === 'true';
const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

interface DealState {
  deals: BoardDeal[];
  isLoading: boolean;
  error: string | null;
  activeFilters: string[];

  // Board-specific
  boardIndex: number;
  advanceBoard: () => void;
  jumpToBoard: (index: number) => void;

  // Shared
  setFilters: (vibes: string[]) => void;
  clearFilters: () => void;
  fetchDeals: (origin: string) => Promise<void>;
  fetchMore: (origin: string) => Promise<void>;
}

let cursor = 0;

export const useDealStore = create<DealState>()((set, get) => ({
  deals: [],
  isLoading: false,
  error: null,
  activeFilters: [],

  boardIndex: 0,
  advanceBoard: () => {
    const { boardIndex, deals } = get();
    if (boardIndex < deals.length - 1) {
      set({ boardIndex: boardIndex + 1 });
    }
  },
  jumpToBoard: (index) => set({ boardIndex: index }),

  setFilters: (vibes) => set({ activeFilters: vibes }),
  clearFilters: () => set({ activeFilters: [] }),

  fetchDeals: async (origin) => {
    set({ isLoading: true, error: null });
    cursor = 0;

    try {
      if (STUB_MODE || !API_BASE) {
        const deals = generateStubDeals(origin);
        set({ deals, isLoading: false });
        return;
      }

      const vibes = get().activeFilters.join(',');
      const params = new URLSearchParams({ origin, cursor: '0', ...(vibes && { vibes }) });
      const res = await fetch(`${API_BASE}/api/feed?${params}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      set({ deals: data.deals || data, isLoading: false });
    } catch (e) {
      // Fallback to stubs on API failure
      const deals = generateStubDeals(origin);
      set({ deals, isLoading: false, error: (e as Error).message });
    }
  },

  fetchMore: async (origin) => {
    if (get().isLoading) return;

    if (STUB_MODE || !API_BASE) return; // stubs are all loaded at once

    cursor += 20;
    try {
      const vibes = get().activeFilters.join(',');
      const params = new URLSearchParams({
        origin,
        cursor: String(cursor),
        ...(vibes && { vibes }),
      });
      const res = await fetch(`${API_BASE}/api/feed?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const newDeals = data.deals || data;
      if (newDeals.length > 0) {
        set({ deals: [...get().deals, ...newDeals] });
      }
    } catch {
      // Silently fail on pagination errors
    }
  },
}));
