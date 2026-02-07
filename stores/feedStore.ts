import { create } from 'zustand';

interface FeedState {
  currentIndex: number;
  viewedIds: Set<string>;
  setCurrentIndex: (index: number) => void;
  markViewed: (id: string) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  currentIndex: 0,
  viewedIds: new Set(),
  setCurrentIndex: (index) => set({ currentIndex: index }),
  markViewed: (id) =>
    set((state) => {
      const next = new Set(state.viewedIds);
      next.add(id);
      return { viewedIds: next };
    }),
}));
