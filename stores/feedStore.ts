import { create } from 'zustand';

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface FeedState {
  sessionId: string;
  currentIndex: number;
  viewedIds: Set<string>;
  setCurrentIndex: (index: number) => void;
  markViewed: (id: string) => void;
  reset: () => void;
  refreshFeed: () => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  sessionId: generateSessionId(),
  currentIndex: 0,
  viewedIds: new Set(),
  setCurrentIndex: (index) => set({ currentIndex: index }),
  markViewed: (id) =>
    set((state) => {
      const next = new Set(state.viewedIds);
      next.add(id);
      return { viewedIds: next };
    }),
  reset: () => set({ currentIndex: 0, viewedIds: new Set() }),
  refreshFeed: () =>
    set({
      sessionId: generateSessionId(),
      currentIndex: 0,
      viewedIds: new Set(),
    }),
}));
