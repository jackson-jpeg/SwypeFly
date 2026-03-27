import { create } from 'zustand';

type PriceRange = 'under300' | '300to500' | '500to1k' | 'over1k' | null;
type Duration = 'weekend' | 'week' | 'extended' | null;

const PRICE_MAP: Record<string, { minPrice?: string; maxPrice?: string }> = {
  under300: { maxPrice: '300' },
  '300to500': { minPrice: '300', maxPrice: '500' },
  '500to1k': { minPrice: '500', maxPrice: '1000' },
  over1k: { minPrice: '1000' },
};

interface FilterState {
  priceRange: PriceRange;
  regions: string[];
  vibes: string[];
  duration: Duration;
  search: string;
  isOpen: boolean;

  setPriceRange: (range: PriceRange) => void;
  toggleRegion: (region: string) => void;
  toggleVibe: (vibe: string) => void;
  setDuration: (duration: Duration) => void;
  setSearch: (query: string) => void;
  clearAll: () => void;
  open: () => void;
  close: () => void;
  activeCount: () => number;
  toQueryParams: () => Record<string, string>;
}

export const useFilterStore = create<FilterState>()((set, get) => ({
  priceRange: null,
  regions: [],
  vibes: [],
  duration: null,
  search: '',
  isOpen: false,

  setPriceRange: (range) => {
    set({ priceRange: get().priceRange === range ? null : range });
  },

  toggleRegion: (region) => {
    const current = get().regions;
    set({
      regions: current.includes(region)
        ? current.filter((r) => r !== region)
        : [...current, region],
    });
  },

  toggleVibe: (vibe) => {
    const current = get().vibes;
    set({
      vibes: current.includes(vibe) ? current.filter((v) => v !== vibe) : [...current, vibe],
    });
  },

  setDuration: (duration) => {
    set({ duration: get().duration === duration ? null : duration });
  },

  setSearch: (query) => set({ search: query }),

  clearAll: () => set({ priceRange: null, regions: [], vibes: [], duration: null, search: '' }),

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  activeCount: () => {
    const { priceRange, regions, vibes, duration, search } = get();
    let count = 0;
    if (priceRange) count++;
    count += regions.length;
    count += vibes.length;
    if (duration) count++;
    if (search.trim()) count++;
    return count;
  },

  toQueryParams: () => {
    const { priceRange, regions, vibes, duration, search } = get();
    const params: Record<string, string> = {};

    if (priceRange) {
      const mapped = PRICE_MAP[priceRange];
      if (mapped.minPrice) params.minPrice = mapped.minPrice;
      if (mapped.maxPrice) params.maxPrice = mapped.maxPrice;
    }

    if (regions.length > 0) params.regionFilter = regions.join(',');
    if (vibes.length > 0) params.vibeFilter = vibes.join(',');
    if (duration) params.durationFilter = duration;
    if (search.trim()) params.search = search.trim();

    return params;
  },
}));
