import { create } from 'zustand';

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type SortPreset = 'default' | 'cheapest' | 'trending' | 'topRated';

interface FeedState {
  sessionId: string;
  currentIndex: number;
  viewedIds: Set<string>;
  vibeFilter: string | null;
  sortPreset: SortPreset;
  setCurrentIndex: (index: number) => void;
  markViewed: (id: string) => void;
  setVibeFilter: (vibe: string | null) => void;
  setSortPreset: (preset: SortPreset) => void;
  reset: () => void;
  refreshFeed: () => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  sessionId: generateSessionId(),
  currentIndex: 0,
  viewedIds: new Set(),
  vibeFilter: null,
  sortPreset: 'default',
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
  setSortPreset: (preset) =>
    set((state) => ({
      sortPreset: state.sortPreset === preset ? 'default' : preset,
      sessionId: generateSessionId(),
      currentIndex: 0,
      viewedIds: new Set(),
    })),
  reset: () => set({ currentIndex: 0, viewedIds: new Set() }),
  refreshFeed: () =>
    set({
      sessionId: generateSessionId(),
      currentIndex: 0,
      viewedIds: new Set(),
    }),
}));
