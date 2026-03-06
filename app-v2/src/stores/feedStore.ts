import { create } from 'zustand';

interface FeedState {
  scrollIndex: number;
  setScrollIndex: (index: number) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  scrollIndex: 0,
  setScrollIndex: (index) => set({ scrollIndex: index }),
}));
