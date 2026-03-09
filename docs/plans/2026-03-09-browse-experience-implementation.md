# Browse Experience Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the SoGoJet browse experience production-quality — stunning images, search + filter, and polished UX.

**Architecture:** Three pillars: (1) image refresh cron gets quality scoring + Unsplash fallback + batching, (2) feed API gets filter/search params with server-side filtering, (3) feed UI gets filter bar, search overlay, skeletons, and optimistic saves.

**Tech Stack:** TypeScript, Vercel Serverless Functions, Appwrite (node-appwrite), React (Vite), Zustand, Google Places API, Unsplash API.

---

## Task 1: Add `quality_score` attribute to `destination_images`

**Files:**
- Create: `scripts/setup-image-quality-attr.ts`

**Context:** The `destination_images` collection stores images per destination. We need a `quality_score` float field so the image refresh cron can rank images and the feed can pick the best one as primary.

**Step 1: Create the setup script**

```typescript
import { Client, Databases } from 'node-appwrite';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_API_KEY || '');

const db = new Databases(client);
const DB = 'sogojet';
const COLL = 'destination_images';

async function createAttr(key: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`✓ Created ${COLL}.${key}`);
  } catch (err: any) {
    if (err?.code === 409 || err?.message?.includes('already exists')) {
      console.log(`⊘ ${COLL}.${key} already exists`);
    } else {
      console.error(`✗ ${COLL}.${key}:`, err?.message || err);
    }
  }
}

async function main() {
  console.log('Adding quality_score to destination_images...');
  await createAttr('quality_score', () =>
    db.createFloatAttribute(DB, COLL, 'quality_score', false, undefined, undefined, 0),
  );
  // Wait for attribute to propagate
  await new Promise((r) => setTimeout(r, 3000));
  console.log('Done.');
}

main().catch(console.error);
```

**Step 2: Run the script**

```bash
npx tsx scripts/setup-image-quality-attr.ts
```

Expected: `✓ Created destination_images.quality_score` or `⊘ already exists`

**Step 3: Commit**

```bash
git add scripts/setup-image-quality-attr.ts
git commit -m "chore: add quality_score attribute to destination_images"
git push
```

---

## Task 2: Rewrite image refresh cron with quality scoring

**Files:**
- Modify: `api/images/refresh.ts`
- Modify: `services/unsplash.ts`
- Test: `__tests__/api/images-refresh.test.ts` (create if not exists)

**Context:** Current cron fetches all Google Places photos and stores them without filtering. We need to:
1. Score images by resolution, aspect ratio, and brightness
2. Reject low-quality images (< 800px, portrait, dark)
3. Fall back to Unsplash when Google Places returns < 3 quality images
4. Batch 10 destinations per run (stalest first) to fit 60s timeout
5. Store `quality_score` per image, mark highest as `is_primary`

**Step 1: Write tests for quality scoring**

Create `__tests__/api/images-refresh.test.ts`:

```typescript
// Mock setup similar to prices-refresh.test.ts
const mockDatabases = {
  listDocuments: jest.fn(),
  createDocument: jest.fn(),
  deleteDocument: jest.fn(),
};

jest.mock('../../services/appwriteServer', () => ({
  serverDatabases: mockDatabases,
  DATABASE_ID: 'sogojet',
  COLLECTIONS: { destinations: 'destinations', destinationImages: 'destination_images' },
  Query: {
    equal: jest.fn((...args: unknown[]) => `equal:${args.join(',')}`),
    limit: jest.fn((n: number) => `limit:${n}`),
    orderAsc: jest.fn((f: string) => `orderAsc:${f}`),
    orderDesc: jest.fn((f: string) => `orderDesc:${f}`),
  },
}));
jest.mock('node-appwrite', () => ({ ID: { unique: jest.fn(() => 'unique-id') } }));
jest.mock('../../utils/apiLogger', () => ({ logApiError: jest.fn() }));

const mockSearchImages = jest.fn();
jest.mock('../../services/unsplash', () => ({
  searchDestinationImages: (...args: unknown[]) => mockSearchImages(...args),
}));

import handler from '../../api/images/refresh';
// ... standard makeReq/makeRes helpers

describe('api/images/refresh', () => {
  test('returns 401 without authorization', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('processes batch of destinations with quality scoring', async () => {
    // ... test that images are stored with quality_score
    // ... test that is_primary is set on highest scored image
  });

  test('falls back to Unsplash when Google Places returns few images', async () => {
    // ... test Unsplash fallback triggers when < 3 quality images
  });
});
```

**Step 2: Implement quality scoring function**

Add to `api/images/refresh.ts`:

```typescript
interface ImageCandidate {
  url: string;
  urlSmall: string;
  width: number;
  height: number;
  blurHash?: string;
  photographer?: string;
  source: 'google_places' | 'unsplash';
  unsplashId?: string;
}

function scoreImage(img: ImageCandidate): number {
  let score = 0;
  // Resolution: prefer >= 1200px wide
  if (img.width >= 1200) score += 40;
  else if (img.width >= 800) score += 20;
  else return -1; // reject under 800px

  // Aspect ratio: prefer landscape (width > height)
  const ratio = img.width / img.height;
  if (ratio < 1.0) return -1; // reject portrait
  if (ratio >= 1.3 && ratio <= 2.0) score += 30; // ideal landscape
  else score += 15;

  // Source bonus: Google Places are real photos of the place
  if (img.source === 'google_places') score += 10;

  // Has blur hash (supports blur-up loading)
  if (img.blurHash) score += 10;

  // Randomize slightly to get variety across refreshes
  score += Math.random() * 10;

  return score;
}
```

**Step 3: Rewrite the cron handler**

Key changes to `api/images/refresh.ts`:
- Batch 10 destinations per run (stalest `fetched_at` first)
- For each destination: fetch Google Places photos, score them, reject bad ones
- If < 3 quality images, supplement with Unsplash
- Store top 5 with `quality_score`, mark best as `is_primary = true`
- Time budget: check elapsed time, stop before 55s

**Step 4: Run tests**

```bash
npx jest __tests__/api/images-refresh.test.ts --no-coverage
```

**Step 5: Commit**

```bash
git add api/images/refresh.ts services/unsplash.ts __tests__/api/images-refresh.test.ts
git commit -m "feat: add quality scoring and Unsplash fallback to image refresh"
git push
```

---

## Task 3: Add filter/search params to feed API

**Files:**
- Modify: `api/feed.ts` (lines 456-490 — query params and filtering)
- Modify: `utils/validation.ts` (feedQuerySchema)
- Test: `__tests__/api/feed.test.ts` (add filter tests)

**Context:** The feed API already supports `vibeFilter`, `regionFilter`, `maxPrice`. We need to add:
- `search` — text search on city/country name
- `minPrice` — minimum price filter
- Ensure all filters work together correctly

**Step 1: Update the Zod schema in `utils/validation.ts`**

Find `feedQuerySchema` and add:
```typescript
search: z.string().optional(),
minPrice: z.coerce.number().int().positive().optional(),
```

**Step 2: Add text search filtering in `api/feed.ts`**

After existing filters (~line 490), add:
```typescript
// Text search filter
if (query.search) {
  const searchLower = query.search.toLowerCase();
  filtered = filtered.filter((d) => {
    const city = (d.city as string || '').toLowerCase();
    const country = (d.country as string || '').toLowerCase();
    const tags = ((d.vibe_tags as string[]) || []).join(' ').toLowerCase();
    return city.includes(searchLower) || country.includes(searchLower) || tags.includes(searchLower);
  });
}

// Min price filter
if (query.minPrice) {
  filtered = filtered.filter((d) => {
    const price = d.live_price ?? d.flight_price;
    return price != null && price >= query.minPrice;
  });
}
```

**Step 3: Write tests for search and filter**

Add to `__tests__/api/feed.test.ts`:
```typescript
test('filters by search text', async () => {
  const req = makeReq({ query: { origin: 'TEST_SEARCH', search: 'paris' } });
  const res = makeRes();
  await handler(req, res);
  const data = (res.json as jest.Mock).mock.calls[0][0];
  // All results should match "paris" in city/country/tags
  for (const d of data.destinations) {
    const match = d.city.toLowerCase().includes('paris') ||
                  d.country.toLowerCase().includes('paris');
    expect(match).toBe(true);
  }
});

test('filters by price range', async () => {
  const req = makeReq({ query: { origin: 'TEST_PRICE', minPrice: '200', maxPrice: '500' } });
  const res = makeRes();
  await handler(req, res);
  const data = (res.json as jest.Mock).mock.calls[0][0];
  for (const d of data.destinations) {
    expect(d.flightPrice).toBeGreaterThanOrEqual(200);
    expect(d.flightPrice).toBeLessThanOrEqual(500);
  }
});
```

**Step 4: Run tests**

```bash
npx jest __tests__/api/feed.test.ts --no-coverage
```

**Step 5: Commit**

```bash
git add api/feed.ts utils/validation.ts __tests__/api/feed.test.ts
git commit -m "feat: add search and price range filtering to feed API"
git push
```

---

## Task 4: Expand feed store with filter and search state

**Files:**
- Modify: `app-v2/src/stores/feedStore.ts`

**Context:** The feed store currently only tracks `scrollIndex`. We need to add filter state (vibes, price range, region) and search state (query, recent searches) so the feed UI can persist filters across navigation.

**Step 1: Expand the store**

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FeedFilters {
  vibes: string[];
  region: string[];
  minPrice: number | null;
  maxPrice: number | null;
}

interface FeedState {
  scrollIndex: number;
  setScrollIndex: (index: number) => void;

  // Filters
  filters: FeedFilters;
  setFilters: (filters: Partial<FeedFilters>) => void;
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

const DEFAULT_FILTERS: FeedFilters = {
  vibes: [],
  region: [],
  minPrice: null,
  maxPrice: null,
};

export const useFeedStore = create<FeedState>()(
  persist(
    (set, get) => ({
      scrollIndex: 0,
      setScrollIndex: (index) => set({ scrollIndex: index }),

      filters: { ...DEFAULT_FILTERS },
      setFilters: (partial) =>
        set((s) => ({ filters: { ...s.filters, ...partial } })),
      clearFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
      hasActiveFilters: () => {
        const f = get().filters;
        return f.vibes.length > 0 || f.region.length > 0 || f.minPrice !== null || f.maxPrice !== null;
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
      partialize: (state) => ({
        scrollIndex: state.scrollIndex,
        recentSearches: state.recentSearches,
      }),
    },
  ),
);
```

**Step 2: Commit**

```bash
git add app-v2/src/stores/feedStore.ts
git commit -m "feat: expand feed store with filter and search state"
git push
```

---

## Task 5: Build FilterBar component

**Files:**
- Create: `app-v2/src/components/feed/FilterBar.tsx`

**Context:** Horizontal scrollable chip row at top of feed. Chips for price range, vibes, and region. Tapping a chip toggles its dropdown. Active filters show as filled chips with X to clear.

**Step 1: Create the FilterBar component**

Key elements:
- Horizontal scroll container with `overflow-x: auto`, `display: flex`, `gap: 8px`
- Each chip: pill-shaped button with label, opens dropdown on tap
- Active chip: filled background (gold/amber from theme), "X" icon
- Dropdown: positioned below chip, max-height with scroll, multi-select checkboxes
- "Clear all" chip appears when any filter is active
- Chips:
  - **Price**: "Under $300", "$300–500", "$500–1000", "$1000+" (single-select)
  - **Vibes**: beach, city, nature, culture, adventure, romantic, foodie, luxury, budget (multi-select)
  - **Region**: Americas, Europe, Asia, Africa, Middle East, Oceania (multi-select)

**Step 2: Wire to feed store**

```typescript
const { filters, setFilters, clearFilters, hasActiveFilters } = useFeedStore();
```

**Step 3: Commit**

```bash
git add app-v2/src/components/feed/FilterBar.tsx
git commit -m "feat: add FilterBar component with price, vibe, and region chips"
git push
```

---

## Task 6: Build SearchOverlay component

**Files:**
- Create: `app-v2/src/components/feed/SearchOverlay.tsx`

**Context:** Full-screen overlay triggered by search icon. Text input with autofocus, recent searches, and results list.

**Step 1: Create the SearchOverlay component**

Key elements:
- Full-screen overlay with dark semi-transparent background
- Top bar: back arrow + text input (autofocus) + clear button
- Below input: recent searches (if no query typed), or search results
- Results: compact list items with destination image thumbnail (48px), city, country, price
- Tap result → navigate to `/destination/{id}`
- Debounce search input by 300ms before calling API
- API call: `GET /api/feed?origin={origin}&search={query}&pageSize=20`
- Close on back arrow or swipe down

**Step 2: Wire to feed store**

```typescript
const { searchQuery, setSearchQuery, recentSearches, addRecentSearch, isSearchOpen, setSearchOpen } = useFeedStore();
```

**Step 3: Commit**

```bash
git add app-v2/src/components/feed/SearchOverlay.tsx
git commit -m "feat: add SearchOverlay with text search and recent searches"
git push
```

---

## Task 7: Build SkeletonCard component

**Files:**
- Create: `app-v2/src/components/feed/SkeletonCard.tsx`

**Context:** Shimmer placeholder shown while feed cards load. Matches the dimensions of a real FeedCard.

**Step 1: Create the SkeletonCard**

Key elements:
- Same dimensions as FeedCard (full viewport height, full width)
- Dark background matching feed (`#0A0F1E`)
- Shimmer animation: CSS `@keyframes shimmer` with a gradient moving left-to-right
- Placeholder shapes:
  - Large rectangle for image area (full card)
  - Bottom section: two text lines (city, tagline) as rounded rectangles
  - Price pill placeholder (bottom-left)
  - Action buttons placeholder (right side, 3 circles)
- Add keyframe to `app-v2/src/global.css` (project convention)

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

**Step 2: Commit**

```bash
git add app-v2/src/components/feed/SkeletonCard.tsx app-v2/src/global.css
git commit -m "feat: add SkeletonCard shimmer placeholder for feed loading"
git push
```

---

## Task 8: Integrate FilterBar, SearchOverlay, and SkeletonCard into FeedScreen

**Files:**
- Modify: `app-v2/src/screens/FeedScreen.tsx`

**Context:** Wire the new components into the feed. FilterBar sits at top, SearchOverlay is triggered by a search icon, SkeletonCards show during loading.

**Step 1: Add imports and state**

```typescript
import { FilterBar } from '../components/feed/FilterBar';
import { SearchOverlay } from '../components/feed/SearchOverlay';
import { SkeletonCard } from '../components/feed/SkeletonCard';
import { useFeedStore } from '../stores/feedStore';
```

**Step 2: Add filter params to feed API call**

Where the feed fetches data (the `useQuery` or `fetch` call), pass filter state as query params:
```typescript
const { filters, searchQuery } = useFeedStore();
const params = new URLSearchParams({ origin });
if (filters.vibes.length) params.set('vibeFilter', filters.vibes.join(','));
if (filters.region.length) params.set('regionFilter', filters.region.join(','));
if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
```

**Step 3: Layout changes**

```
<div style={{ position: 'relative', height: '100vh' }}>
  <FilterBar />                    {/* Fixed at top */}
  <SearchIcon onClick={...} />     {/* Fixed top-right */}
  {isLoading ? (
    <SkeletonCard />               {/* Show during load */}
  ) : destinations.length === 0 ? (
    <EmptyState />                 {/* No results */}
  ) : (
    <ScrollContainer>              {/* Existing feed cards */}
      {destinations.map(d => <FeedCard ... />)}
    </ScrollContainer>
  )}
  {isSearchOpen && <SearchOverlay />}
</div>
```

**Step 4: Reset feed on filter change**

When filters change, reset scroll to top and refetch:
```typescript
useEffect(() => {
  // Reset pagination and refetch when filters change
  scrollRef.current?.scrollTo({ top: 0 });
}, [filters.vibes, filters.region, filters.minPrice, filters.maxPrice]);
```

**Step 5: Commit**

```bash
git add app-v2/src/screens/FeedScreen.tsx
git commit -m "feat: integrate filter bar, search overlay, and skeleton loaders in feed"
git push
```

---

## Task 9: Add blur-up image loading to FeedCard

**Files:**
- Modify: `app-v2/src/screens/FeedScreen.tsx` (FeedCard component, lines 45-55)

**Context:** Currently images load with a hard pop-in. Add blur-up effect: start with blurred low-res version, fade in full image.

**Step 1: Add image loading state**

```typescript
const [imageLoaded, setImageLoaded] = useState(false);

// Preload image
useEffect(() => {
  const img = new Image();
  img.onload = () => setImageLoaded(true);
  img.src = destination.imageUrl;
}, [destination.imageUrl]);
```

**Step 2: Apply blur-up CSS**

Replace the current `backgroundImage` style with:
```typescript
style={{
  backgroundImage: `url(${destination.imageUrl})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  filter: imageLoaded ? 'none' : 'blur(20px)',
  transform: imageLoaded ? 'scale(1)' : 'scale(1.1)', // hide blur edges
  transition: 'filter 0.5s ease, transform 0.5s ease',
}}
```

**Step 3: Lazy load below-fold images**

Only load images for the current card and one card ahead:
```typescript
const shouldLoadImage = Math.abs(index - currentIndex) <= 1;
```

Pass `shouldLoadImage` to FeedCard, only set `backgroundImage` when true.

**Step 4: Commit**

```bash
git add app-v2/src/screens/FeedScreen.tsx
git commit -m "feat: add blur-up image loading and lazy load to feed cards"
git push
```

---

## Task 10: Add optimistic saves

**Files:**
- Modify: `app-v2/src/screens/FeedScreen.tsx` (save button handler)
- Modify: `app-v2/src/stores/savedStore.ts` (if needed)

**Context:** Currently the heart/save button waits for server response. Make it instant — fill heart immediately, sync in background, revert on failure with toast.

**Step 1: Update save handler in FeedCard**

```typescript
const handleSave = async () => {
  // Optimistic update
  const wasSaved = isSaved;
  toggleSaved(destination.id); // Instant UI update

  try {
    await trackSave(destination.id);
  } catch {
    // Revert on failure
    toggleSaved(destination.id);
    showToast("Couldn't save — try again");
  }
};
```

**Step 2: Commit**

```bash
git add app-v2/src/screens/FeedScreen.tsx
git commit -m "feat: optimistic save with revert on failure"
git push
```

---

## Task 11: Improve empty states

**Files:**
- Modify: `app-v2/src/screens/WishlistScreen.tsx`
- Modify: `app-v2/src/screens/FeedScreen.tsx`

**Context:** Empty states currently show minimal text. Add encouraging copy and visual cues.

**Step 1: Wishlist empty state**

Replace the current empty div with:
```typescript
<div style={{ textAlign: 'center', padding: '80px 24px' }}>
  <div style={{ fontSize: 48, marginBottom: 16 }}>✈️</div>
  <h3 style={{ color: '#fff', fontSize: 20, marginBottom: 8 }}>No saved destinations yet</h3>
  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.5 }}>
    Swipe through destinations and tap the heart to save your favorites here.
  </p>
</div>
```

**Step 2: Feed empty state (no filter results)**

```typescript
<div style={{ textAlign: 'center', padding: '80px 24px' }}>
  <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
  <h3 style={{ color: '#fff', fontSize: 20, marginBottom: 8 }}>No destinations found</h3>
  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 24 }}>
    Try adjusting your filters or searching for something else.
  </p>
  <button onClick={clearFilters} style={{ ... }}>Clear Filters</button>
</div>
```

**Step 3: Commit**

```bash
git add app-v2/src/screens/WishlistScreen.tsx app-v2/src/screens/FeedScreen.tsx
git commit -m "feat: add encouraging empty states for wishlist and filtered feed"
git push
```

---

## Task 12: End-to-end verification and deploy

**Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass.

**Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Deploy**

```bash
npx vercel --prod --yes
```

**Step 4: Trigger image refresh with new quality scoring**

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://www.sogojet.com/api/images/refresh"
```

**Step 5: Verify on live site**

- Open sogojet.com
- Verify filter bar appears at top of feed
- Tap a vibe chip → feed refreshes with filtered results
- Tap search icon → overlay opens, type "paris" → results appear
- Scroll feed → skeleton loaders shown during page load
- Images load with blur-up effect
- Save a destination → heart fills instantly
- Go to Saved → if empty, see encouraging empty state
- Apply filters that match nothing → see "No destinations found" with clear button

**Step 6: Commit any fixes, push**

```bash
git push
```

---

## Files Modified Summary

| File | Change |
|------|--------|
| `scripts/setup-image-quality-attr.ts` | NEW: Appwrite attribute setup |
| `api/images/refresh.ts` | Quality scoring, batching, Unsplash fallback |
| `services/unsplash.ts` | Minor tweaks if needed for fallback |
| `__tests__/api/images-refresh.test.ts` | NEW: Image refresh tests |
| `api/feed.ts` | Search + minPrice filter params |
| `utils/validation.ts` | Add search/minPrice to feedQuerySchema |
| `__tests__/api/feed.test.ts` | Add search/filter tests |
| `app-v2/src/stores/feedStore.ts` | Filters, search, recent searches |
| `app-v2/src/components/feed/FilterBar.tsx` | NEW: Filter chip bar |
| `app-v2/src/components/feed/SearchOverlay.tsx` | NEW: Search overlay |
| `app-v2/src/components/feed/SkeletonCard.tsx` | NEW: Shimmer placeholder |
| `app-v2/src/screens/FeedScreen.tsx` | Integrate all new components |
| `app-v2/src/screens/WishlistScreen.tsx` | Better empty state |
| `app-v2/src/global.css` | Shimmer keyframe |
