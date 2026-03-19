# Feed Filter Bottom Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a filter bottom sheet to the swipe feed with Price, Region, Vibe, and Duration filter categories styled in the app's vintage air-travel aesthetic.

**Architecture:** New `filterStore` (Zustand) holds filter state, new `FilterSheet` component renders the bottom sheet with pill selectors, `dealStore` is updated to accept filter params. One small backend change adds a `countOnly` mode to the feed endpoint for the live result count.

**Tech Stack:** React Native, Zustand, Zod, Vercel Serverless Functions, Jest

**Spec:** `docs/superpowers/specs/2026-03-19-feed-filters-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `stores/filterStore.ts` | Create | Filter state: price, regions, vibes, duration, sheet open/close, toQueryParams() |
| `components/swipe/FilterPill.tsx` | Create | Single pill button with selected/unselected styling |
| `components/swipe/FilterButton.tsx` | Create | Header icon button with active count badge |
| `components/swipe/FilterSheet.tsx` | Create | Bottom sheet with four filter sections, count preview, clear all |
| `utils/validation.ts` | Modify (line 12-33) | Add `countOnly` param to feedQuerySchema |
| `api/feed.ts` | Modify (line 917-965) | Short-circuit response when `countOnly=true` |
| `stores/dealStore.ts` | Modify (lines 87-175) | Accept filter params, fix `vibes`→`vibeFilter` bug, remove old filter state |
| `app/(tabs)/index.tsx` | Modify (lines 1-116) | Add FilterButton to header, wire filters to fetchDeals |
| `__tests__/filterStore.test.ts` | Create | Store unit tests |
| `__tests__/api/feed-countOnly.test.ts` | Create | countOnly endpoint test |

---

### Task 1: Filter Store

**Files:**
- Create: `stores/filterStore.ts`
- Create: `__tests__/filterStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/filterStore.test.ts
import { useFilterStore } from '../stores/filterStore';

beforeEach(() => {
  useFilterStore.getState().clearAll();
});

describe('filterStore', () => {
  it('starts with no filters active', () => {
    const state = useFilterStore.getState();
    expect(state.priceRange).toBeNull();
    expect(state.regions).toEqual([]);
    expect(state.vibes).toEqual([]);
    expect(state.duration).toBeNull();
    expect(state.isOpen).toBe(false);
    expect(state.activeCount()).toBe(0);
  });

  it('sets and clears price range (single-select)', () => {
    const store = useFilterStore.getState();
    store.setPriceRange('under300');
    expect(useFilterStore.getState().priceRange).toBe('under300');
    expect(useFilterStore.getState().activeCount()).toBe(1);

    // Setting same value deselects
    store.setPriceRange('under300');
    expect(useFilterStore.getState().priceRange).toBeNull();
  });

  it('toggles regions (multi-select)', () => {
    const store = useFilterStore.getState();
    store.toggleRegion('europe');
    store.toggleRegion('asia');
    expect(useFilterStore.getState().regions).toEqual(['europe', 'asia']);
    expect(useFilterStore.getState().activeCount()).toBe(2);

    store.toggleRegion('europe');
    expect(useFilterStore.getState().regions).toEqual(['asia']);
  });

  it('toggles vibes (multi-select)', () => {
    const store = useFilterStore.getState();
    store.toggleVibe('beach');
    store.toggleVibe('city');
    expect(useFilterStore.getState().vibes).toEqual(['beach', 'city']);

    store.toggleVibe('beach');
    expect(useFilterStore.getState().vibes).toEqual(['city']);
  });

  it('sets and clears duration (single-select)', () => {
    const store = useFilterStore.getState();
    store.setDuration('weekend');
    expect(useFilterStore.getState().duration).toBe('weekend');

    store.setDuration('weekend');
    expect(useFilterStore.getState().duration).toBeNull();
  });

  it('clearAll resets everything', () => {
    const store = useFilterStore.getState();
    store.setPriceRange('over1k');
    store.toggleRegion('europe');
    store.toggleVibe('beach');
    store.setDuration('week');
    store.clearAll();

    const state = useFilterStore.getState();
    expect(state.priceRange).toBeNull();
    expect(state.regions).toEqual([]);
    expect(state.vibes).toEqual([]);
    expect(state.duration).toBeNull();
  });

  it('toQueryParams builds correct API params', () => {
    const store = useFilterStore.getState();
    store.setPriceRange('300to500');
    store.toggleRegion('europe');
    store.toggleRegion('asia');
    store.toggleVibe('beach');
    store.toggleVibe('culture');
    store.setDuration('weekend');

    const params = useFilterStore.getState().toQueryParams();
    expect(params).toEqual({
      minPrice: '300',
      maxPrice: '500',
      regionFilter: 'europe,asia',
      vibeFilter: 'beach,culture',
      durationFilter: 'weekend',
    });
  });

  it('toQueryParams omits empty values', () => {
    const params = useFilterStore.getState().toQueryParams();
    expect(params).toEqual({});
  });

  it('toQueryParams handles under300 (no minPrice)', () => {
    useFilterStore.getState().setPriceRange('under300');
    const params = useFilterStore.getState().toQueryParams();
    expect(params).toEqual({ maxPrice: '300' });
  });

  it('toQueryParams handles over1k (no maxPrice)', () => {
    useFilterStore.getState().setPriceRange('over1k');
    const params = useFilterStore.getState().toQueryParams();
    expect(params).toEqual({ minPrice: '1000' });
  });

  it('open/close toggles isOpen', () => {
    const store = useFilterStore.getState();
    store.open();
    expect(useFilterStore.getState().isOpen).toBe(true);
    store.close();
    expect(useFilterStore.getState().isOpen).toBe(false);
  });

  it('activeCount sums all active filter categories', () => {
    const store = useFilterStore.getState();
    store.setPriceRange('under300');       // +1
    store.toggleRegion('europe');          // +1
    store.toggleRegion('asia');            // +1
    store.toggleVibe('beach');             // +1
    store.setDuration('weekend');          // +1
    expect(useFilterStore.getState().activeCount()).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/filterStore.test.ts --no-coverage`
Expected: FAIL — `Cannot find module '../stores/filterStore'`

- [ ] **Step 3: Implement filterStore**

```typescript
// stores/filterStore.ts
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
  isOpen: boolean;

  setPriceRange: (range: PriceRange) => void;
  toggleRegion: (region: string) => void;
  toggleVibe: (vibe: string) => void;
  setDuration: (duration: Duration) => void;
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
      vibes: current.includes(vibe)
        ? current.filter((v) => v !== vibe)
        : [...current, vibe],
    });
  },

  setDuration: (duration) => {
    set({ duration: get().duration === duration ? null : duration });
  },

  clearAll: () =>
    set({ priceRange: null, regions: [], vibes: [], duration: null }),

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  activeCount: () => {
    const { priceRange, regions, vibes, duration } = get();
    let count = 0;
    if (priceRange) count++;
    count += regions.length;
    count += vibes.length;
    if (duration) count++;
    return count;
  },

  toQueryParams: () => {
    const { priceRange, regions, vibes, duration } = get();
    const params: Record<string, string> = {};

    if (priceRange) {
      const mapped = PRICE_MAP[priceRange];
      if (mapped.minPrice) params.minPrice = mapped.minPrice;
      if (mapped.maxPrice) params.maxPrice = mapped.maxPrice;
    }

    if (regions.length > 0) params.regionFilter = regions.join(',');
    if (vibes.length > 0) params.vibeFilter = vibes.join(',');
    if (duration) params.durationFilter = duration;

    return params;
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/filterStore.test.ts --no-coverage`
Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add stores/filterStore.ts __tests__/filterStore.test.ts
git commit -m "feat: add filterStore for feed filter state management"
```

---

### Task 2: Backend `countOnly` Support

**Files:**
- Modify: `utils/validation.ts` (line 12-33)
- Modify: `api/feed.ts` (line 917-965)
- Create: `__tests__/api/feed-countOnly.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/api/feed-countOnly.test.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const mockListDocuments = jest.fn();

jest.mock('node-appwrite', () => ({
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
  })),
  Databases: jest.fn().mockImplementation(() => ({
    listDocuments: mockListDocuments,
  })),
  Users: jest.fn().mockImplementation(() => ({})),
  Query: {
    equal: jest.fn((...args: unknown[]) => `equal:${args.join(',')}`),
    orderAsc: jest.fn((field: string) => `orderAsc:${field}`),
    limit: jest.fn((n: number) => `limit:${n}`),
    search: jest.fn((field: string, value: string) => `search:${field},${value}`),
  },
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

import handler from '../../api/feed';

function makeDest(overrides: Record<string, unknown> = {}) {
  return {
    $id: overrides.$id ?? 'dest-1',
    iata_code: 'BCN',
    city: 'Barcelona',
    country: 'Spain',
    continent: 'Europe',
    tagline: 'Gothic quarter vibes',
    description: 'A beautiful city',
    image_url: 'https://example.com/bcn.jpg',
    image_urls: ['https://example.com/bcn.jpg'],
    flight_price: 450,
    hotel_price_per_night: 120,
    currency: 'USD',
    vibe_tags: ['city', 'culture', 'foodie'],
    rating: 4.7,
    review_count: 1200,
    best_months: ['May', 'June'],
    average_temp: 72,
    flight_duration: '8h 30m',
    is_active: true,
    beach_score: 0.6,
    city_score: 0.9,
    adventure_score: 0.3,
    culture_score: 0.8,
    nightlife_score: 0.7,
    nature_score: 0.2,
    food_score: 0.8,
    popularity_score: 0.85,
    trip_duration_days: 5,
    ...overrides,
  };
}

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: {},
    body: {},
    query: {},
    ...overrides,
  } as unknown as VercelRequest;
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
  };
}

describe('feed countOnly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APPWRITE_ENDPOINT = 'https://test.appwrite.io/v1';
    process.env.APPWRITE_PROJECT_ID = 'test-project';
    process.env.APPWRITE_API_KEY = 'test-key';
  });

  it('returns count instead of full results when countOnly=true', async () => {
    const dests = [
      makeDest({ $id: 'co-1', flight_price: 200, vibe_tags: ['beach'] }),
      makeDest({ $id: 'co-2', flight_price: 600, vibe_tags: ['city'] }),
      makeDest({ $id: 'co-3', flight_price: 100, vibe_tags: ['beach'] }),
    ];

    // destinations collection
    mockListDocuments.mockResolvedValueOnce({ documents: dests, total: 3 });
    // cached_prices — empty
    mockListDocuments.mockResolvedValueOnce({ documents: [], total: 0 });
    // destination_images — empty
    mockListDocuments.mockResolvedValueOnce({ documents: [], total: 0 });
    // cached_hotel_prices — empty
    mockListDocuments.mockResolvedValueOnce({ documents: [], total: 0 });

    const req = makeReq({ query: { origin: 'QQQ', countOnly: 'true', maxPrice: '300' } });
    const res = makeRes();
    await handler(req, res as unknown as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ count: 2 }); // $200 and $100 match maxPrice<=300
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/feed-countOnly.test.ts --no-coverage`
Expected: FAIL — `countOnly` not recognized or response includes `destinations` not `count`

- [ ] **Step 3: Add `countOnly` to Zod schema**

In `utils/validation.ts`, add to `feedQuerySchema` (after the `durationFilter` field on line 27):

```typescript
  countOnly: z.literal('true').optional(),
```

- [ ] **Step 4: Add countOnly short-circuit to feed endpoint**

In `api/feed.ts`, after the `excludeIds` filter block (line 922) and before the scoring section (line 924), insert:

```typescript
    // countOnly mode — return just the count for filter preview
    if (v.data.countOnly === 'true') {
      return res.status(200).json({ count: destinations.length });
    }
```

This goes right after all filters are applied but before the expensive scoring/auth/pagination logic.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/api/feed-countOnly.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 6: Run full test suite to confirm no regressions**

Run: `npx jest --no-coverage`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add utils/validation.ts api/feed.ts __tests__/api/feed-countOnly.test.ts
git commit -m "feat: add countOnly param to feed endpoint for filter count preview"
```

---

### Task 3: Update dealStore to Accept Filter Params

**Files:**
- Modify: `stores/dealStore.ts` (lines 87-175)

- [ ] **Step 1: Remove old filter state from DealState interface**

In `stores/dealStore.ts`, remove from the interface (lines 91, 99-100):
- `activeFilters: string[];`
- `setFilters: (vibes: string[]) => void;`
- `clearFilters: () => void;`

And remove from the implementation (lines 112, 123-124):
- `activeFilters: [],`
- `setFilters: (vibes) => set({ activeFilters: vibes }),`
- `clearFilters: () => set({ activeFilters: [] }),`

- [ ] **Step 2: Update `fetchDeals` signature and fix `vibes` → `vibeFilter` bug**

Change `fetchDeals` (line 133-148) to:

```typescript
  fetchDeals: async (origin, filters?: Record<string, string>) => {
    set({ isLoading: true, error: null, boardIndex: 0 });
    cursor = 0;

    try {
      const params = new URLSearchParams({ origin, cursor: '0', ...filters });
      const res = await fetch(`${API_BASE}/api/feed?${params}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const raw: ApiDestination[] = data.destinations || data.deals || data;
      const deals = raw.map((d) => apiToBoardDeal(d, origin));
      set({ deals, isLoading: false });
    } catch (e) {
      set({ deals: [], isLoading: false, error: (e as Error).message });
    }
  },
```

- [ ] **Step 3: Update `fetchMore` similarly**

Change `fetchMore` (line 151-174) to:

```typescript
  fetchMore: async (origin, filters?: Record<string, string>) => {
    if (get().isLoading) return;
    if (!API_BASE) return;

    cursor += PAGE_SIZE;
    try {
      const params = new URLSearchParams({
        origin,
        cursor: String(cursor),
        ...filters,
      });
      const res = await fetch(`${API_BASE}/api/feed?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const raw: ApiDestination[] = data.destinations || data.deals || data;
      if (raw.length > 0) {
        const newDeals = raw.map((d) => apiToBoardDeal(d, origin));
        set({ deals: [...get().deals, ...newDeals] });
      }
    } catch {
      // Silently fail on pagination errors
    }
  },
```

- [ ] **Step 4: Update the DealState interface to match**

```typescript
  fetchDeals: (origin: string, filters?: Record<string, string>) => Promise<void>;
  fetchMore: (origin: string, filters?: Record<string, string>) => Promise<void>;
```

- [ ] **Step 5: Run existing tests to confirm no regressions**

Run: `npx jest --no-coverage`
Expected: All pass. (No existing tests directly test dealStore, but the feed tests and others should still pass.)

- [ ] **Step 6: Commit**

```bash
git add stores/dealStore.ts
git commit -m "refactor: dealStore accepts filter params, fix vibes→vibeFilter bug"
```

---

### Task 4: FilterPill Component

**Files:**
- Create: `components/swipe/FilterPill.tsx`

- [ ] **Step 1: Create the FilterPill component**

```typescript
// components/swipe/FilterPill.tsx
import { useRef } from 'react';
import { Pressable, Text, StyleSheet, Animated } from 'react-native';
import { colors, fonts } from '../../theme/tokens';

interface FilterPillProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

export default function FilterPill({ label, isActive, onPress, accessibilityLabel }: FilterPillProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.pill, isActive && styles.pillActive]}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={accessibilityLabel || label}
      >
        <Text style={[styles.text, isActive && styles.textActive]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  pillActive: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
  },
  textActive: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFF8F0',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/swipe/FilterPill.tsx
git commit -m "feat: add FilterPill component with vintage tag styling"
```

---

### Task 5: FilterButton Component

**Files:**
- Create: `components/swipe/FilterButton.tsx`

- [ ] **Step 1: Create the FilterButton component**

```typescript
// components/swipe/FilterButton.tsx
import { Pressable, View, Text, StyleSheet, Animated } from 'react-native';
import { useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFilterStore } from '../../stores/filterStore';
import { colors, fonts } from '../../theme/tokens';

export default function FilterButton() {
  const activeCount = useFilterStore((s) => s.activeCount);
  const open = useFilterStore((s) => s.open);
  const count = activeCount();
  const hasFilters = count > 0;
  const badgeScale = useRef(new Animated.Value(hasFilters ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(badgeScale, {
      toValue: hasFilters ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 12,
    }).start();
  }, [hasFilters]);

  return (
    <Pressable
      onPress={open}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel="Open filters"
      accessibilityHint={count > 0 ? `${count} filters active` : 'No filters active'}
    >
      <Ionicons name="compass-outline" size={22} color={hasFilters ? colors.orange : colors.muted} />
      {hasFilters && (
        <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
          <Text style={styles.badgeText}>{count}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    backgroundColor: colors.orange,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: '#FFF8F0',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/swipe/FilterButton.tsx
git commit -m "feat: add FilterButton with compass icon and count badge"
```

---

### Task 6: FilterSheet Component

**Files:**
- Create: `components/swipe/FilterSheet.tsx`

This is the largest component. It renders the bottom sheet overlay with all four filter sections, the live count preview, and the clear/apply actions.

- [ ] **Step 1: Create the FilterSheet component**

```typescript
// components/swipe/FilterSheet.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { useFilterStore } from '../../stores/filterStore';
import { useSettingsStore } from '../../stores/settingsStore';
import FilterPill from './FilterPill';
import { colors, fonts, spacing } from '../../theme/tokens';

const SCREEN_H = Dimensions.get('window').height;
const SHEET_MAX_H = SCREEN_H * 0.7;
const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

// ─── Filter option definitions ──────────────────────────────────────

const PRICE_OPTIONS = [
  { key: 'under300' as const, label: '<$300' },
  { key: '300to500' as const, label: '$300–500' },
  { key: '500to1k' as const, label: '$500–1K' },
  { key: 'over1k' as const, label: '$1K+' },
];

const REGION_OPTIONS = [
  { key: 'domestic', label: 'Domestic' },
  { key: 'caribbean', label: 'Caribbean' },
  { key: 'latam', label: 'Lat. Am.' },
  { key: 'europe', label: 'Europe' },
  { key: 'asia', label: 'Asia' },
  { key: 'africa-me', label: 'Africa/ME' },
  { key: 'oceania', label: 'Oceania' },
];

const VIBE_OPTIONS = [
  { key: 'beach', label: 'Beach' },
  { key: 'city', label: 'City' },
  { key: 'nature', label: 'Nature' },
  { key: 'culture', label: 'Culture' },
  { key: 'adventure', label: 'Adventure' },
  { key: 'romantic', label: 'Romantic' },
  { key: 'foodie', label: 'Foodie' },
  { key: 'luxury', label: 'Luxury' },
  { key: 'historic', label: 'Historic' },
];

const DURATION_OPTIONS = [
  { key: 'weekend' as const, label: 'Weekend' },
  { key: 'week' as const, label: 'Week' },
  { key: 'extended' as const, label: 'Extended' },
];

export default function FilterSheet() {
  const isOpen = useFilterStore((s) => s.isOpen);
  const close = useFilterStore((s) => s.close);
  const priceRange = useFilterStore((s) => s.priceRange);
  const regions = useFilterStore((s) => s.regions);
  const vibes = useFilterStore((s) => s.vibes);
  const duration = useFilterStore((s) => s.duration);
  const activeCountFn = useFilterStore((s) => s.activeCount);
  const activeCount = activeCountFn();
  const setPriceRange = useFilterStore((s) => s.setPriceRange);
  const toggleRegion = useFilterStore((s) => s.toggleRegion);
  const toggleVibe = useFilterStore((s) => s.toggleVibe);
  const setDuration = useFilterStore((s) => s.setDuration);
  const clearAll = useFilterStore((s) => s.clearAll);
  const toQueryParams = useFilterStore((s) => s.toQueryParams);
  const departureCode = useSettingsStore((s) => s.departureCode);

  const [count, setCount] = useState<number | null>(null);
  const slideAnim = useRef(new Animated.Value(SHEET_MAX_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate sheet in/out
  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          speed: 14,
          bounciness: 4,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      // Fetch initial count
      fetchCount();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_MAX_H,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  // Debounced count fetch when filters change
  const fetchCount = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          origin: departureCode,
          countOnly: 'true',
          ...toQueryParams(),
        });
        const res = await fetch(`${API_BASE}/api/feed?${params}`);
        if (res.ok) {
          const data = await res.json();
          setCount(data.count);
        }
      } catch {
        // Non-fatal — leave count as last known
      }
    }, 300);
  }, [departureCode, toQueryParams]);

  // Refetch count when any filter changes
  useEffect(() => {
    if (isOpen) fetchCount();
  }, [priceRange, regions, vibes, duration, isOpen]);

  const handleApply = () => {
    close();
  };

  // Web: escape key
  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const sheetContent = (
    <>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* Handle */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header row: first section label + clear all */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>PRICE</Text>
            {activeCount > 0 && (
              <Pressable onPress={clearAll}>
                <Text style={styles.clearAll}>Clear all</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.pillRow}>
            {PRICE_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.key}
                label={opt.label}
                isActive={priceRange === opt.key}
                onPress={() => setPriceRange(opt.key)}
                accessibilityLabel={`${opt.label} price filter`}
              />
            ))}
          </View>

          <Text style={styles.sectionLabel}>REGION</Text>
          <View style={styles.pillRow}>
            {REGION_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.key}
                label={opt.label}
                isActive={regions.includes(opt.key)}
                onPress={() => toggleRegion(opt.key)}
                accessibilityLabel={`${opt.label} region filter`}
              />
            ))}
          </View>

          <Text style={styles.sectionLabel}>VIBE</Text>
          <View style={styles.pillRow}>
            {VIBE_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.key}
                label={opt.label}
                isActive={vibes.includes(opt.key)}
                onPress={() => toggleVibe(opt.key)}
                accessibilityLabel={`${opt.label} vibe filter`}
              />
            ))}
          </View>

          <Text style={styles.sectionLabel}>DURATION</Text>
          <View style={styles.pillRow}>
            {DURATION_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.key}
                label={opt.label}
                isActive={duration === opt.key}
                onPress={() => setDuration(opt.key)}
                accessibilityLabel={`${opt.label} duration filter`}
              />
            ))}
          </View>
        </ScrollView>

        {/* Apply button */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleApply}
            style={[styles.applyButton, count === 0 && styles.applyButtonDisabled]}
            disabled={count === 0}
            accessibilityRole="button"
            accessibilityLabel={
              count != null ? `Show ${count} destinations` : 'Show destinations'
            }
          >
            <Text style={[styles.applyText, count === 0 && styles.applyTextDisabled]}>
              {count != null ? `Show ${count} destinations` : 'Show destinations'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </>
  );

  // On web, render inline (position fixed via styles). On native, use Modal.
  if (Platform.OS === 'web') {
    return <View style={styles.overlay}>{sheetContent}</View>;
  }

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={close}
    >
      {sheetContent}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...Platform.select({
      web: {
        position: 'fixed' as unknown as 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
      },
      default: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
      },
    }),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SHEET_MAX_H,
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.sheetHandle,
  },
  scroll: {
    maxHeight: SHEET_MAX_H - 120, // leave room for handle + footer
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.yellow,
    letterSpacing: 2,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  clearAll: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: spacing.md,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  applyButton: {
    backgroundColor: colors.orange,
    borderRadius: 8,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonDisabled: {
    opacity: 0.4,
  },
  applyText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: '#FFF8F0',
  },
  applyTextDisabled: {
    color: '#FFF8F080',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/swipe/FilterSheet.tsx
git commit -m "feat: add FilterSheet bottom sheet component"
```

---

### Task 7: Wire Everything into FeedScreen

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Update FeedScreen imports and add FilterButton + FilterSheet**

Replace the full content of `app/(tabs)/index.tsx`:

```typescript
import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDealStore } from '../../stores/dealStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useFilterStore } from '../../stores/filterStore';
import SwipeFeed from '../../components/swipe/SwipeFeed';
import SkeletonCard from '../../components/swipe/SkeletonCard';
import SplitFlapRow from '../../components/board/SplitFlapRow';
import FilterButton from '../../components/swipe/FilterButton';
import FilterSheet from '../../components/swipe/FilterSheet';
import { colors, fonts } from '../../theme/tokens';

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { deals, isLoading, error, fetchDeals } = useDealStore();
  const departureCode = useSettingsStore((s) => s.departureCode);
  const toQueryParams = useFilterStore((s) => s.toQueryParams);
  const clearFilters = useFilterStore((s) => s.clearAll);
  const isSheetOpen = useFilterStore((s) => s.isOpen);
  const prevDepartureRef = useRef(departureCode);

  // Clear filters when departure city changes (fresh context)
  useEffect(() => {
    if (prevDepartureRef.current !== departureCode) {
      prevDepartureRef.current = departureCode;
      clearFilters();
    }
  }, [departureCode]);

  // Refetch when filters change (sheet closes) or departure changes
  useEffect(() => {
    if (!isSheetOpen) {
      fetchDeals(departureCode, toQueryParams());
    }
  }, [departureCode, isSheetOpen]);

  return (
    <View style={styles.container}>
      {/* Floating header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.logo}>✈ SOGOJET</Text>
        <FilterButton />
        <View style={styles.airportBadge}>
          <Text style={styles.airportText}>{departureCode}</Text>
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <SkeletonCard />
      ) : deals.length === 0 ? (
        <View style={styles.empty}>
          <SplitFlapRow
            text="NO FLIGHTS"
            maxLength={12}
            size="lg"
            color={colors.muted}
            align="left"
            startDelay={0}
            staggerMs={50}
            animate={true}
          />
          <Text style={styles.emptySubtitle}>
            {error
              ? 'Check your connection and try again'
              : 'Try a different departure city or adjust filters'}
          </Text>
        </View>
      ) : (
        <SwipeFeed />
      )}

      {/* Filter sheet overlay */}
      <FilterSheet />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    ...Platform.select({
      web: { pointerEvents: 'box-none' as const },
      default: {},
    }),
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.white,
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  airportBadge: {
    backgroundColor: 'rgba(10,8,6,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.green + '60',
  },
  airportText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.green,
    letterSpacing: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.faint,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
```

- [ ] **Step 2: Update SwipeFeed to pass filters to fetchMore**

In `components/swipe/SwipeFeed.tsx`, add the filterStore import and pass filters to `fetchMore`:

At the top, add:
```typescript
import { useFilterStore } from '../../stores/filterStore';
```

Inside the component, add:
```typescript
const toQueryParams = useFilterStore((s) => s.toQueryParams);
```

Update the `onEndReached` handler (wherever `fetchMore` is called) to pass filters:
```typescript
fetchMore(departureCode, toQueryParams());
```

- [ ] **Step 3: Run full test suite**

Run: `npx jest --no-coverage`
Expected: All tests pass

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/index.tsx components/swipe/SwipeFeed.tsx
git commit -m "feat: wire filter sheet into FeedScreen with auto-refetch on close"
```

---

### Deferred Items

The following spec requirements are intentionally deferred to a follow-up task to keep this plan focused on core functionality:

- **Drag-to-dismiss gesture**: The sheet currently dismisses via backdrop tap, Escape key (web), and the Apply button. Adding `PanResponder` or `react-native-gesture-handler` based swipe-down detection is a polish item.
- **Web focus trapping**: On web, focus should be trapped within the sheet while open. This requires a focus trap utility (e.g., `focus-trap-react` or manual implementation). Not blocking for initial release.

---

### Task 8: Manual Verification

- [ ] **Step 1: Start the dev server**

Run: `npm run web`

- [ ] **Step 2: Verify filter flow**

1. Confirm compass icon appears centered in the feed header
2. Tap the icon — bottom sheet slides up with 4 sections
3. Tap a price pill — it fills terracotta, count updates
4. Tap a vibe pill — same behavior, count updates
5. Tap "Show X destinations" — sheet closes, feed reloads with filtered results
6. Confirm badge shows active count on the compass icon
7. Reopen sheet, tap "Clear all" — all pills deselect, count resets
8. Dismiss sheet — feed shows all destinations again

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No new errors

- [ ] **Step 4: Final commit and push**

```bash
git push origin main
```
