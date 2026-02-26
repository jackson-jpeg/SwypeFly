import { create } from 'zustand';

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type SortPreset = 'default' | 'cheapest' | 'trending' | 'topRated';
export type RegionFilter = 'all' | 'domestic' | 'caribbean' | 'latam' | 'europe' | 'asia' | 'africa-me' | 'oceania';

export const REGION_OPTIONS: { key: RegionFilter; label: string; emoji: string }[] = [
  { key: 'all', label: 'Everywhere', emoji: '🌍' },
  { key: 'domestic', label: 'USA', emoji: '🇺🇸' },
  { key: 'caribbean', label: 'Caribbean', emoji: '🏝️' },
  { key: 'latam', label: 'Latin America', emoji: '🌎' },
  { key: 'europe', label: 'Europe', emoji: '🇪🇺' },
  { key: 'asia', label: 'Asia', emoji: '🌏' },
  { key: 'africa-me', label: 'Africa & Middle East', emoji: '🌍' },
  { key: 'oceania', label: 'Oceania', emoji: '🏄' },
];

interface FeedState {
  sessionId: string;
  currentIndex: number;
  viewedIds: Set<string>;
  vibeFilter: string | null;
  regionFilter: RegionFilter;
  sortPreset: SortPreset;
  maxPrice: number | null;
  setCurrentIndex: (index: number) => void;
  markViewed: (id: string) => void;
  setVibeFilter: (vibe: string | null) => void;
  setRegionFilter: (region: RegionFilter) => void;
  setSortPreset: (preset: SortPreset) => void;
  setMaxPrice: (price: number | null) => void;
  reset: () => void;
  refreshFeed: () => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  sessionId: generateSessionId(),
  currentIndex: 0,
  viewedIds: new Set(),
  vibeFilter: null,
  regionFilter: 'all',
  sortPreset: 'default',
  maxPrice: null,
  setCurrentIndex: (index) => set({ currentIndex: index }),
  markViewed: (id) =>
    set((state) => {
      const next = new Set(state.viewedIds);
      next.add(id);
      return { viewedIds: next };
    }),
  setVibeFilter: (vibe) =>
    set({
      vibeFilter: vibe,
      sessionId: generateSessionId(),
      currentIndex: 0,
      viewedIds: new Set(),
    }),
  setRegionFilter: (region) =>
    set({
      regionFilter: region,
      sessionId: generateSessionId(),
      currentIndex: 0,
      viewedIds: new Set(),
    }),
  setSortPreset: (preset) =>
    set((state) => ({
      sortPreset: state.sortPreset === preset ? 'default' : preset,
      sessionId: generateSessionId(),
      currentIndex: 0,
      viewedIds: new Set(),
    })),
  setMaxPrice: (price) =>
    set({
      maxPrice: price,
      sessionId: generateSessionId(),
      currentIndex: 0,
      viewedIds: new Set(),
    }),
  reset: () => set({ currentIndex: 0, viewedIds: new Set() }),
  refreshFeed: () =>
    set({
      sessionId: generateSessionId(),
      currentIndex: 0,
      viewedIds: new Set(),
    }),
}));
