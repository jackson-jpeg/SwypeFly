import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type DurationFilter = 'any' | 'weekend' | 'week' | 'extended';

export interface FeedFilters {
  vibes: string[];
  region: string[];
  minPrice: number | null;
  maxPrice: number | null;
  durationFilter: DurationFilter;
}

const DEFAULT_FILTERS: FeedFilters = {
  vibes: [],
  region: [],
  minPrice: null,
  maxPrice: null,
  durationFilter: 'any',
};

interface FeedState {
  scrollIndex: number;
  setScrollIndex: (index: number) => void;

  // Filters
  filters: FeedFilters;
  setFilters: (filters: Partial<FeedFilters>) => void;
  setDurationFilter: (duration: DurationFilter) => void;
  clearFilters: () => void;
  hasActiveFilters: () => boolean;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  isSearchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set, get) => ({
      scrollIndex: 0,
      setScrollIndex: (index) => set({ scrollIndex: index }),

      filters: { ...DEFAULT_FILTERS },
      setFilters: (partial) =>
        set((s) => ({ filters: { ...s.filters, ...partial } })),
      setDurationFilter: (duration) =>
        set((s) => ({ filters: { ...s.filters, durationFilter: duration } })),
      clearFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
      hasActiveFilters: () => {
        const f = get().filters;
        return (
          f.vibes.length > 0 ||
          f.region.length > 0 ||
          f.minPrice !== null ||
          f.maxPrice !== null ||
          f.durationFilter !== 'any'
        );
      },

      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      recentSearches: [],
      addRecentSearch: (query) =>
        set((s) => ({
          recentSearches: [query, ...s.recentSearches.filter((q) => q !== query)].slice(0, 10),
        })),
      clearRecentSearches: () => set({ recentSearches: [] }),
      isSearchOpen: false,
      setSearchOpen: (open) => set({ isSearchOpen: open }),
    }),
    {
      name: 'sogojet-feed',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        scrollIndex: state.scrollIndex,
        recentSearches: state.recentSearches,
      }),
    },
  ),
);
