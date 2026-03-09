# Search Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Search tab with a 2-column deal grid, full filtering (region, price range, text search, sort), inline card expansion, and Travelpayouts→Duffel booking handoff.

**Architecture:** New `/api/search-deals` endpoint queries `cached_prices` + `destinations` from Appwrite. New `SearchScreen` renders a filterable grid of deal cards. Tapping a card expands inline with flight details + "Book This Deal" button that stores route/dates in `bookingStore` and navigates to the existing FlightSelectionScreen.

**Tech Stack:** React, TypeScript, Zustand, TanStack Query, Zod, Vercel Serverless Functions, Appwrite

---

### Task 1: Add Zod schema for search-deals endpoint

**Files:**
- Modify: `utils/validation.ts`
- Modify: `__tests__/validation.test.ts`

**Step 1: Write the failing test**

Add to `__tests__/validation.test.ts`:

```typescript
import { searchDealsQuerySchema } from '../utils/validation';

// ─── searchDealsQuerySchema ─────────────────────────────────────────

describe('searchDealsQuerySchema', () => {
  it('accepts valid query with origin', () => {
    const result = validateRequest(searchDealsQuerySchema, { origin: 'TPA' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.origin).toBe('TPA');
      expect(result.data.sort).toBe('cheapest');
    }
  });

  it('defaults origin to TPA and sort to cheapest', () => {
    const result = validateRequest(searchDealsQuerySchema, {});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.origin).toBe('TPA');
      expect(result.data.sort).toBe('cheapest');
    }
  });

  it('accepts all filter params', () => {
    const result = validateRequest(searchDealsQuerySchema, {
      origin: 'JFK',
      search: 'paris',
      region: 'europe',
      minPrice: '100',
      maxPrice: '500',
      sort: 'trending',
      cursor: '10',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.search).toBe('paris');
      expect(result.data.region).toBe('europe');
      expect(result.data.minPrice).toBe(100);
      expect(result.data.maxPrice).toBe(500);
      expect(result.data.sort).toBe('trending');
      expect(result.data.cursor).toBe(10);
    }
  });

  it('rejects invalid sort value', () => {
    const result = validateRequest(searchDealsQuerySchema, { sort: 'alphabetical' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid region', () => {
    const result = validateRequest(searchDealsQuerySchema, { region: 'mars' });
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=validation`
Expected: FAIL — `searchDealsQuerySchema` is not exported

**Step 3: Write minimal implementation**

Add to `utils/validation.ts` after the `feedQuerySchema`:

```typescript
// ─── Search deals endpoint ──────────────────────────────────────────

export const searchDealsQuerySchema = z.object({
  origin: iataCode.default('TPA'),
  search: z.string().max(100).optional(),
  region: z.enum(['all', 'domestic', 'caribbean', 'latam', 'europe', 'asia', 'africa-me', 'oceania']).optional(),
  minPrice: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(1).max(10000)).optional(),
  maxPrice: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(1).max(10000)).optional(),
  sort: z.enum(['cheapest', 'trending', 'newest']).default('cheapest'),
  cursor: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(0)).optional(),
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern=validation`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add utils/validation.ts __tests__/validation.test.ts
git commit -m "feat: add searchDealsQuerySchema for search-deals endpoint"
```

---

### Task 2: Create `/api/search-deals` endpoint

**Files:**
- Create: `api/search-deals.ts`
- Reference: `api/feed.ts` (for `getRegion()` pattern, Appwrite query patterns)
- Reference: `services/appwriteServer.ts` (for DB access)

**Step 1: Write the failing test**

Create `__tests__/search-deals.test.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock appwriteServer
jest.mock('../services/appwriteServer', () => {
  const Query = {
    equal: jest.fn((field: string, value: string) => `${field}=${value}`),
    limit: jest.fn((n: number) => `limit=${n}`),
    offset: jest.fn((n: number) => `offset=${n}`),
    orderAsc: jest.fn((f: string) => `asc=${f}`),
    orderDesc: jest.fn((f: string) => `desc=${f}`),
  };
  const mockListDocuments = jest.fn();
  return {
    serverDatabases: { listDocuments: mockListDocuments },
    DATABASE_ID: 'test-db',
    COLLECTIONS: { destinations: 'destinations', cached_prices: 'cached_prices' },
    Query,
  };
});

jest.mock('../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

import handler from '../api/search-deals';
import { serverDatabases } from '../services/appwriteServer';

const mockList = serverDatabases.listDocuments as jest.Mock;

function makeReq(query: Record<string, string> = {}): Partial<VercelRequest> {
  return { method: 'GET', query, headers: {} };
}

function makeRes() {
  const res: Partial<VercelResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res as VercelResponse;
}

const mockDest = (id: string, city: string, iata: string, country: string) => ({
  $id: id,
  city,
  iata_code: iata,
  country,
  tagline: `Visit ${city}`,
  image_url: `https://img.test/${city.toLowerCase()}.jpg`,
  vibe_tags: ['beach'],
  flight_price: 300,
  hotel_price_per_night: 80,
  currency: 'USD',
  continent: 'Europe',
  latitude: 40.0,
  longitude: -3.0,
});

const mockPrice = (destIata: string, price: number, source = 'duffel') => ({
  $id: `price-${destIata}`,
  destination_iata: destIata,
  origin: 'JFK',
  price,
  currency: 'USD',
  airline: 'Delta',
  source,
  departure_date: '2026-04-15',
  return_date: '2026-04-22',
  trip_duration_days: 7,
  fetched_at: '2026-03-09T06:00:00Z',
  previous_price: price + 50,
  price_direction: 'down',
  offer_json: null,
  offer_expires_at: null,
});

describe('GET /api/search-deals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns deals sorted by cheapest', async () => {
    mockList
      .mockResolvedValueOnce({ documents: [mockDest('1', 'Barcelona', 'BCN', 'Spain'), mockDest('2', 'Paris', 'CDG', 'France')] })
      .mockResolvedValueOnce({ documents: [mockPrice('BCN', 250), mockPrice('CDG', 400)] });

    const req = makeReq({ origin: 'JFK' });
    const res = makeRes();
    await handler(req as VercelRequest, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.deals).toHaveLength(2);
    expect(body.deals[0].city).toBe('Barcelona');
    expect(body.deals[0].price).toBe(250);
    expect(body.deals[1].city).toBe('Paris');
  });

  it('filters by search text', async () => {
    mockList
      .mockResolvedValueOnce({ documents: [mockDest('1', 'Barcelona', 'BCN', 'Spain'), mockDest('2', 'Paris', 'CDG', 'France')] })
      .mockResolvedValueOnce({ documents: [mockPrice('BCN', 250), mockPrice('CDG', 400)] });

    const req = makeReq({ origin: 'JFK', search: 'paris' });
    const res = makeRes();
    await handler(req as VercelRequest, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.deals).toHaveLength(1);
    expect(body.deals[0].city).toBe('Paris');
  });

  it('filters by maxPrice', async () => {
    mockList
      .mockResolvedValueOnce({ documents: [mockDest('1', 'Barcelona', 'BCN', 'Spain'), mockDest('2', 'Paris', 'CDG', 'France')] })
      .mockResolvedValueOnce({ documents: [mockPrice('BCN', 250), mockPrice('CDG', 400)] });

    const req = makeReq({ origin: 'JFK', maxPrice: '300' });
    const res = makeRes();
    await handler(req as VercelRequest, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.deals).toHaveLength(1);
    expect(body.deals[0].city).toBe('Barcelona');
  });

  it('returns 405 for non-GET', async () => {
    const req = makeReq();
    (req as any).method = 'POST';
    const res = makeRes();
    await handler(req as VercelRequest, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns empty deals when no cached prices', async () => {
    mockList
      .mockResolvedValueOnce({ documents: [mockDest('1', 'Barcelona', 'BCN', 'Spain')] })
      .mockResolvedValueOnce({ documents: [] });

    const req = makeReq({ origin: 'JFK' });
    const res = makeRes();
    await handler(req as VercelRequest, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.deals).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=search-deals`
Expected: FAIL — cannot find module `../api/search-deals`

**Step 3: Write minimal implementation**

Create `api/search-deals.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../services/appwriteServer';
import { searchDealsQuerySchema, validateRequest } from '../utils/validation';
import { logApiError } from '../utils/apiLogger';
import { cors } from './_cors.js';

const PAGE_SIZE = 20;

// Region detection (same logic as feed.ts)
function getRegion(country: string, continent?: string): string {
  if (continent) {
    const c = continent.toLowerCase();
    if (c.includes('caribbean')) return 'caribbean';
    if (c.includes('south america') || c.includes('central america')) return 'latam';
    if (c.includes('europe')) return 'europe';
    if (c.includes('asia')) return 'asia';
    if (c.includes('africa') || c.includes('middle east')) return 'africa-me';
    if (c.includes('north america')) {
      return country.toLowerCase() === 'usa' ? 'domestic' : 'americas';
    }
    if (c.includes('oceania')) return 'oceania';
    return 'other';
  }
  const ct = country.toLowerCase();
  if (['indonesia', 'japan', 'thailand', 'singapore', 'south korea', 'vietnam', 'maldives'].includes(ct)) return 'asia';
  if (['greece', 'croatia', 'italy', 'portugal', 'iceland', 'switzerland', 'spain', 'france'].includes(ct)) return 'europe';
  if (['morocco', 'south africa', 'uae'].includes(ct)) return 'africa-me';
  if (['peru', 'argentina', 'brazil', 'colombia', 'costa rica'].includes(ct)) return 'latam';
  if (['jamaica', 'dominican republic', 'bahamas', 'cuba', 'puerto rico'].includes(ct)) return 'caribbean';
  if (ct === 'usa') return 'domestic';
  if (['new zealand', 'australia'].includes(ct)) return 'oceania';
  if (['canada', 'mexico'].includes(ct)) return 'americas';
  return 'other';
}

interface Deal {
  destinationId: string;
  city: string;
  country: string;
  iataCode: string;
  imageUrl: string;
  vibeTags: string[];
  price: number;
  currency: string;
  airline: string;
  departureDate: string;
  returnDate: string;
  tripDurationDays: number;
  priceDirection: string | null;
  previousPrice: number | null;
  priceSource: string;
  offerJson: string | null;
  offerExpiresAt: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const v = validateRequest(searchDealsQuerySchema, req.query);
    if (!v.success) return res.status(400).json({ error: v.error });

    const { origin, search, region, minPrice, maxPrice, sort, cursor } = v.data;
    const offset = cursor ?? 0;

    // Fetch destinations and cached prices in parallel
    const [destResult, priceResult] = await Promise.all([
      serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.destinations, [Query.limit(5000)]),
      serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cached_prices, [
        Query.equal('origin', origin),
        Query.limit(5000),
      ]),
    ]);

    // Index prices by destination IATA
    const priceMap = new Map<string, typeof priceResult.documents[0]>();
    for (const p of priceResult.documents) {
      priceMap.set(p.destination_iata as string, p);
    }

    // Join destinations with their cached prices
    let deals: Deal[] = [];
    for (const d of destResult.documents) {
      const p = priceMap.get(d.iata_code as string);
      if (!p) continue; // No cached price = no deal to show

      deals.push({
        destinationId: d.$id,
        city: d.city as string,
        country: d.country as string,
        iataCode: d.iata_code as string,
        imageUrl: (d.image_url as string) || '',
        vibeTags: (d.vibe_tags as string[]) || [],
        price: p.price as number,
        currency: (p.currency as string) || 'USD',
        airline: (p.airline as string) || '',
        departureDate: (p.departure_date as string) || '',
        returnDate: (p.return_date as string) || '',
        tripDurationDays: (p.trip_duration_days as number) || 7,
        priceDirection: (p.price_direction as string) || null,
        previousPrice: (p.previous_price as number) ?? null,
        priceSource: (p.source as string) || 'estimate',
        offerJson: (p.offer_json as string) || null,
        offerExpiresAt: (p.offer_expires_at as string) || null,
      });
    }

    // Apply filters
    if (search) {
      const q = search.toLowerCase();
      deals = deals.filter(
        (d) =>
          d.city.toLowerCase().includes(q) ||
          d.country.toLowerCase().includes(q) ||
          d.iataCode.toLowerCase().includes(q),
      );
    }

    if (region && region !== 'all') {
      deals = deals.filter((d) => {
        const dest = destResult.documents.find((doc) => doc.$id === d.destinationId);
        return getRegion(d.country, dest?.continent as string | undefined) === region;
      });
    }

    if (minPrice != null) {
      deals = deals.filter((d) => d.price >= minPrice);
    }
    if (maxPrice != null) {
      deals = deals.filter((d) => d.price <= maxPrice);
    }

    // Sort
    switch (sort) {
      case 'cheapest':
        deals.sort((a, b) => a.price - b.price);
        break;
      case 'trending':
        // Sort by price drop percentage (biggest drops first)
        deals.sort((a, b) => {
          const dropA = a.previousPrice && a.previousPrice > 0
            ? (a.previousPrice - a.price) / a.previousPrice
            : 0;
          const dropB = b.previousPrice && b.previousPrice > 0
            ? (b.previousPrice - b.price) / b.previousPrice
            : 0;
          return dropB - dropA;
        });
        break;
      case 'newest':
        // Most recently fetched prices first (freshest deals)
        deals.sort((a, b) => {
          const dateA = a.departureDate || '';
          const dateB = b.departureDate || '';
          return dateA.localeCompare(dateB);
        });
        break;
    }

    // Paginate
    const total = deals.length;
    const page = deals.slice(offset, offset + PAGE_SIZE);
    const nextCursor = offset + PAGE_SIZE < total ? offset + PAGE_SIZE : null;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ deals: page, nextCursor, total });
  } catch (err) {
    logApiError('search-deals', err);
    return res.status(500).json({ error: 'Failed to load deals' });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern=search-deals`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add api/search-deals.ts __tests__/search-deals.test.ts
git commit -m "feat: add /api/search-deals endpoint with filtering and sorting"
```

---

### Task 3: Add Search route and BottomNav tab

**Files:**
- Create: `app-v2/src/screens/SearchScreen.tsx` (empty shell)
- Modify: `app-v2/src/App.tsx`
- Modify: `app-v2/src/components/BottomNav.tsx`

**Step 1: Create empty SearchScreen shell**

Create `app-v2/src/screens/SearchScreen.tsx`:

```tsx
import { colors, typography, fonts } from '@/tokens';

export default function SearchScreen() {
  return (
    <div
      className="screen"
      style={{ background: colors.duskSand, minHeight: '100dvh', padding: 16 }}
    >
      <h1 style={{ ...typography.pageTitle, fontFamily: `"${fonts.display}", system-ui, sans-serif`, color: colors.deepDusk }}>
        Search Deals
      </h1>
    </div>
  );
}
```

**Step 2: Add route to App.tsx**

In `app-v2/src/App.tsx`, add lazy import:

```typescript
const SearchScreen = lazy(() => import('@/screens/SearchScreen'));
```

Add route after the `/` route:

```tsx
<Route path="/search" element={needsAuth ? <Navigate to="/login" /> : <SearchScreen />} />
```

**Step 3: Add Search tab to BottomNav.tsx**

In `app-v2/src/components/BottomNav.tsx`:

Update the `Tab` type:
```typescript
type Tab = 'explore' | 'search' | 'trips' | 'saved' | 'settings';
```

Update the `tabs` array — insert search after explore:
```typescript
const tabs: { key: Tab; label: string; path: string }[] = [
  { key: 'explore', label: 'Explore', path: '/' },
  { key: 'search', label: 'Search', path: '/search' },
  { key: 'trips', label: 'Trips', path: '/trips' },
  { key: 'saved', label: 'Saved', path: '/wishlist' },
  { key: 'settings', label: 'Settings', path: '/settings' },
];
```

Add search icon case in `tabIcon()`:
```typescript
case 'search':
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
```

Add detection in `activeTab`:
```typescript
const activeTab: Tab =
  location.pathname === '/search'
    ? 'search'
    : location.pathname === '/wishlist' || location.pathname === '/saved'
      ? 'saved'
      : location.pathname === '/trips'
        ? 'trips'
        : location.pathname === '/settings'
          ? 'settings'
          : 'explore';
```

**Step 4: Verify — start dev server, navigate to /search, see the shell**

Run: `cd app-v2 && npm run dev`
Navigate to `http://localhost:5173/search` — should see "Search Deals" heading with duskSand background.
Verify the Search tab appears in the bottom nav between Explore and Trips.

**Step 5: Commit**

```bash
git add app-v2/src/screens/SearchScreen.tsx app-v2/src/App.tsx app-v2/src/components/BottomNav.tsx
git commit -m "feat: add Search tab route and bottom nav entry"
```

---

### Task 4: Build the SearchScreen filter bar

**Files:**
- Modify: `app-v2/src/screens/SearchScreen.tsx`

**Step 1: Implement filter bar UI**

Replace the SearchScreen shell with the full filter bar + state:

```tsx
import { useState, useMemo, useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { colors, typography, fonts, spacing, radius, surfaces } from '@/tokens';
import BottomNav from '@/components/BottomNav';

const REGIONS = [
  { value: '', label: 'All Regions' },
  { value: 'domestic', label: 'Domestic' },
  { value: 'caribbean', label: 'Caribbean' },
  { value: 'latam', label: 'Latin America' },
  { value: 'europe', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
  { value: 'africa-me', label: 'Africa & ME' },
  { value: 'oceania', label: 'Oceania' },
] as const;

const SORTS = [
  { value: 'cheapest', label: 'Cheapest' },
  { value: 'trending', label: 'Trending' },
  { value: 'newest', label: 'Newest' },
] as const;

export default function SearchScreen() {
  const departureCode = useUIStore((s) => s.departureCode);

  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState<'cheapest' | 'trending' | 'newest'>('cheapest');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);

  return (
    <div className="screen" style={{ background: colors.duskSand, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: `${spacing.sm}px ${spacing.sm}px 0` }}>
        <h1 style={{ ...typography.pageTitle, fontFamily: `"${fonts.display}", system-ui, sans-serif`, color: colors.deepDusk, margin: 0 }}>
          Deals from {departureCode}
        </h1>
      </div>

      {/* Filter Bar */}
      <div style={{ padding: spacing.sm, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Search input */}
        <input
          type="text"
          placeholder="Search destinations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            ...surfaces.card,
            padding: '10px 14px',
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 15,
            color: colors.deepDusk,
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />

        {/* Region + Sort row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            style={{
              ...surfaces.card,
              padding: '8px 12px',
              fontFamily: `"${fonts.body}", system-ui, sans-serif`,
              fontSize: 13,
              color: colors.deepDusk,
              flex: 1,
              cursor: 'pointer',
              borderRadius: radius.md,
            }}
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 4 }}>
            {SORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: radius.pill,
                  border: sort === s.value ? `1.5px solid ${colors.sageDrift}` : `1px solid ${colors.borderTint}`,
                  background: sort === s.value ? '#A8C4B830' : colors.offWhite,
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  fontSize: 12,
                  fontWeight: sort === s.value ? 600 : 400,
                  color: sort === s.value ? colors.darkerGreen : colors.bodyText,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price range slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...typography.sectionLabel, fontFamily: `"${fonts.body}", system-ui, sans-serif`, color: colors.mutedText }}>
            ${priceRange[0]}
          </span>
          <input
            type="range"
            min={0}
            max={5000}
            step={50}
            value={priceRange[1]}
            onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
            style={{ flex: 1, accentColor: colors.sageDrift }}
          />
          <span style={{ ...typography.sectionLabel, fontFamily: `"${fonts.body}", system-ui, sans-serif`, color: colors.mutedText }}>
            ${priceRange[1]}
          </span>
        </div>
      </div>

      {/* Deal grid placeholder */}
      <div style={{ flex: 1, padding: spacing.sm, color: colors.mutedText, textAlign: 'center' }}>
        Deal grid coming next...
      </div>

      <BottomNav />
    </div>
  );
}
```

**Step 2: Verify — dev server, navigate to /search, filter bar renders**

Run: `cd app-v2 && npm run dev`
Verify: search input, region dropdown, sort pills, price slider all render and are interactive.

**Step 3: Commit**

```bash
git add app-v2/src/screens/SearchScreen.tsx
git commit -m "feat: SearchScreen filter bar with region, sort, price range, text search"
```

---

### Task 5: Add TanStack Query hook for search-deals

**Files:**
- Create: `app-v2/src/hooks/useSearchDeals.ts`

**Step 1: Create the hook**

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { API_BASE } from '@/api/client';

interface Deal {
  destinationId: string;
  city: string;
  country: string;
  iataCode: string;
  imageUrl: string;
  vibeTags: string[];
  price: number;
  currency: string;
  airline: string;
  departureDate: string;
  returnDate: string;
  tripDurationDays: number;
  priceDirection: string | null;
  previousPrice: number | null;
  priceSource: string;
  offerJson: string | null;
  offerExpiresAt: string | null;
}

interface SearchDealsResponse {
  deals: Deal[];
  nextCursor: number | null;
  total: number;
}

interface SearchDealsParams {
  origin: string;
  search?: string;
  region?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'cheapest' | 'trending' | 'newest';
}

export type { Deal };

export function useSearchDeals(params: SearchDealsParams) {
  return useInfiniteQuery<SearchDealsResponse>({
    queryKey: ['search-deals', params],
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams();
      qs.set('origin', params.origin);
      if (params.search) qs.set('search', params.search);
      if (params.region) qs.set('region', params.region);
      if (params.minPrice != null) qs.set('minPrice', String(params.minPrice));
      if (params.maxPrice != null) qs.set('maxPrice', String(params.maxPrice));
      if (params.sort) qs.set('sort', params.sort);
      if (pageParam) qs.set('cursor', String(pageParam));

      const res = await fetch(`${API_BASE}/api/search-deals?${qs}`);
      if (!res.ok) throw new Error('Failed to fetch deals');
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

**Step 2: Commit**

```bash
git add app-v2/src/hooks/useSearchDeals.ts
git commit -m "feat: useSearchDeals TanStack Query hook with infinite pagination"
```

---

### Task 6: Build the deal card grid with inline expansion

**Files:**
- Modify: `app-v2/src/screens/SearchScreen.tsx`

**Step 1: Import hook and render deal grid**

Replace the "Deal grid placeholder" section in SearchScreen with the full grid implementation. Update imports and add:

```tsx
import { useSearchDeals, type Deal } from '@/hooks/useSearchDeals';
import { useBookingStore } from '@/stores/bookingStore';
import { useNavigate } from 'react-router-dom';
import { getAirlineName } from '@/utils/airlines';
```

Add after filter state:

```tsx
const navigate = useNavigate();
const setDestination = useBookingStore((s) => s.setDestination);
const setCachedOffer = useBookingStore((s) => s.setCachedOffer);

const [expandedId, setExpandedId] = useState<string | null>(null);

// Debounced search params
const queryParams = useMemo(() => ({
  origin: departureCode,
  search: search || undefined,
  region: region || undefined,
  minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
  maxPrice: priceRange[1] < 5000 ? priceRange[1] : undefined,
  sort,
}), [departureCode, search, region, priceRange, sort]);

const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useSearchDeals(queryParams);

const deals = useMemo(
  () => data?.pages.flatMap((p) => p.deals) ?? [],
  [data],
);

const total = data?.pages[0]?.total ?? 0;

const handleBookDeal = useCallback((deal: Deal) => {
  setDestination(deal.destinationId, deal.price);
  if (deal.offerJson) setCachedOffer(deal.offerJson);
  navigate('/booking/flights', {
    state: {
      fromSearch: true,
      departureDate: deal.departureDate,
      returnDate: deal.returnDate,
      destinationIata: deal.iataCode,
    },
  });
}, [setDestination, setCachedOffer, navigate]);
```

Replace the placeholder div with:

```tsx
{/* Deal grid */}
<div style={{ flex: 1, overflow: 'auto', padding: `0 ${spacing.sm}px ${spacing.sm}px` }}>
  {isLoading ? (
    <div style={{ textAlign: 'center', padding: 40, color: colors.mutedText }}>Loading deals...</div>
  ) : deals.length === 0 ? (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <p style={{ ...typography.body, fontFamily: `"${fonts.body}", system-ui, sans-serif`, color: colors.mutedText }}>
        No deals found{search ? ` for "${search}"` : ''}.
      </p>
      <p style={{ ...typography.secondary, fontFamily: `"${fonts.body}", system-ui, sans-serif`, color: colors.borderTint }}>
        Try adjusting your filters or changing your home airport in Settings.
      </p>
    </div>
  ) : (
    <>
      <p style={{ ...typography.sectionLabel, fontFamily: `"${fonts.body}", system-ui, sans-serif`, color: colors.mutedText, marginBottom: 10 }}>
        {total} deal{total !== 1 ? 's' : ''} from {departureCode}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {deals.map((deal) => {
          const isExpanded = expandedId === deal.destinationId;
          return (
            <div
              key={deal.destinationId}
              onClick={() => setExpandedId(isExpanded ? null : deal.destinationId)}
              style={{
                ...surfaces.card,
                overflow: 'hidden',
                cursor: 'pointer',
                gridColumn: isExpanded ? '1 / -1' : undefined,
                transition: 'all 0.25s ease',
              }}
            >
              {/* Image */}
              <div style={{
                height: isExpanded ? 180 : 120,
                background: deal.imageUrl
                  ? `url(${deal.imageUrl}) center/cover`
                  : 'linear-gradient(135deg, #1a2a3a 0%, #2d1b3d 40%, #1a3a2a 70%, #0A0F1E 100%)',
                transition: 'height 0.25s ease',
              }} />

              {/* Info */}
              <div style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <p style={{
                      ...typography.subheadline,
                      fontFamily: `"${fonts.display}", system-ui, sans-serif`,
                      color: colors.deepDusk,
                      margin: 0,
                    }}>
                      {deal.city}
                    </p>
                    <p style={{
                      ...typography.secondary,
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      color: colors.mutedText,
                      margin: 0,
                    }}>
                      {deal.country}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{
                      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                      fontWeight: 800,
                      fontSize: 18,
                      color: colors.deepDusk,
                      margin: 0,
                    }}>
                      ${deal.price}
                    </p>
                    {deal.priceDirection === 'down' && deal.previousPrice && (
                      <p style={{
                        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                        fontSize: 11,
                        color: colors.confirmGreen,
                        margin: 0,
                        fontWeight: 600,
                      }}>
                        was ${deal.previousPrice}
                      </p>
                    )}
                  </div>
                </div>

                {/* Airline + dates (always shown, compact) */}
                <p style={{
                  ...typography.secondary,
                  fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                  color: colors.mutedText,
                  margin: '4px 0 0',
                  fontSize: 11,
                }}>
                  {getAirlineName(deal.airline)} · {deal.departureDate ? new Date(deal.departureDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  {deal.returnDate ? ` – ${new Date(deal.returnDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                </p>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${colors.borderTint}40`, paddingTop: 12 }}>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                      <div>
                        <p style={{ ...typography.sectionLabel, fontFamily: `"${fonts.body}", system-ui, sans-serif`, color: colors.mutedText, margin: 0 }}>Airline</p>
                        <p style={{ ...typography.body, fontFamily: `"${fonts.body}", system-ui, sans-serif`, color: colors.deepDusk, margin: 0, fontSize: 14 }}>{getAirlineName(deal.airline)}</p>
                      </div>
                      <div>
                        <p style={{ ...typography.sectionLabel, fontFamily: `"${fonts.body}", system-ui, sans-serif`, color: colors.mutedText, margin: 0 }}>Duration</p>
                        <p style={{ ...typography.body, fontFamily: `"${fonts.body}", system-ui, sans-serif`, color: colors.deepDusk, margin: 0, fontSize: 14 }}>{deal.tripDurationDays} days</p>
                      </div>
                      <div>
                        <p style={{ ...typography.sectionLabel, fontFamily: `"${fonts.body}", system-ui, sans-serif`, color: colors.mutedText, margin: 0 }}>Source</p>
                        <p style={{ ...typography.body, fontFamily: `"${fonts.body}", system-ui, sans-serif`, color: colors.deepDusk, margin: 0, fontSize: 14 }}>{deal.priceSource === 'duffel' ? 'Live' : 'Cached'}</p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBookDeal(deal);
                      }}
                      style={{
                        width: '100%',
                        height: 44,
                        borderRadius: radius.md,
                        background: colors.deepDusk,
                        color: colors.paleHorizon,
                        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
                        fontWeight: 600,
                        fontSize: 15,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Book This Deal →
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          style={{
            display: 'block',
            margin: '16px auto',
            padding: '10px 24px',
            borderRadius: radius.pill,
            border: `1px solid ${colors.borderTint}`,
            background: colors.offWhite,
            fontFamily: `"${fonts.body}", system-ui, sans-serif`,
            fontSize: 14,
            color: colors.deepDusk,
            cursor: 'pointer',
          }}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </>
  )}
</div>
```

**Step 2: Verify — dev server, navigate to /search, grid renders with real data**

Run: `cd app-v2 && npm run dev`
Navigate to `/search`. Verify:
- Cards render in 2-column grid
- Tapping a card expands it (spans full width, shows details + Book button)
- Tapping again collapses it
- Filters work (type in search, change region, adjust price slider, toggle sort)

**Step 3: Commit**

```bash
git add app-v2/src/screens/SearchScreen.tsx
git commit -m "feat: SearchScreen deal grid with inline expansion and booking handoff"
```

---

### Task 7: Wire FlightSelectionScreen to accept Search handoff

**Files:**
- Modify: `app-v2/src/screens/FlightSelectionScreen.tsx`

**Step 1: Read location state from Search tab**

In FlightSelectionScreen, near the top where state is initialized, add:

```typescript
import { useLocation } from 'react-router-dom';

// Inside component:
const location = useLocation();
const searchState = location.state as {
  fromSearch?: boolean;
  departureDate?: string;
  returnDate?: string;
  destinationIata?: string;
} | null;
```

**Step 2: Use search state to pre-fill dates and destination**

Where `departureDate` and `returnDate` are initialized (look for the useMemo or useState that calculates default dates), add the search state as a priority override:

```typescript
// If coming from Search tab, use those dates
const initialDepartureDate = searchState?.departureDate || /* existing default logic */;
const initialReturnDate = searchState?.returnDate || /* existing default logic */;
```

Similarly, if `searchState?.destinationIata` is available, use it to override the destination code lookup.

**Step 3: Verify — click "Book This Deal" from Search tab, FlightSelectionScreen pre-fills dates**

1. Go to `/search`
2. Tap a deal card, expand it
3. Click "Book This Deal"
4. FlightSelectionScreen should show with correct destination and dates from the deal

**Step 4: Commit**

```bash
git add app-v2/src/screens/FlightSelectionScreen.tsx
git commit -m "feat: FlightSelectionScreen accepts pre-filled dates from Search tab"
```

---

### Task 8: Add `getAirlineName` import to SearchScreen

**Files:**
- Modify: `app-v2/src/screens/SearchScreen.tsx`

**Note:** The `getAirlineName` utility already exists at `app-v2/src/utils/airlines.ts` (created in previous session). This task is just ensuring the import is correct in SearchScreen. If the import was already added in Task 6, verify it works. If `airlines.ts` is missing, create it:

```typescript
// app-v2/src/utils/airlines.ts
const AIRLINE_NAMES: Record<string, string> = {
  AA: 'American Airlines', DL: 'Delta', UA: 'United', WN: 'Southwest',
  B6: 'JetBlue', NK: 'Spirit', F9: 'Frontier', AS: 'Alaska',
  G4: 'Allegiant', SY: 'Sun Country', HA: 'Hawaiian', BA: 'British Airways',
  LH: 'Lufthansa', AF: 'Air France', KL: 'KLM', IB: 'Iberia',
  EK: 'Emirates', QR: 'Qatar Airways', SQ: 'Singapore Airlines', CX: 'Cathay Pacific',
  NH: 'ANA', JL: 'Japan Airlines', TK: 'Turkish Airlines', LX: 'Swiss',
  AZ: 'ITA Airways', TP: 'TAP Portugal', SK: 'SAS', AY: 'Finnair',
  EI: 'Aer Lingus', VS: 'Virgin Atlantic', AC: 'Air Canada', AM: 'Aeromexico',
  CM: 'Copa Airlines', AV: 'Avianca', LA: 'LATAM', AR: 'Aerolineas Argentinas',
};

export function getAirlineName(code: string): string {
  if (!code || code.length > 3) return code || 'Airline';
  return AIRLINE_NAMES[code.toUpperCase()] || code;
}
```

**Commit (if changes needed):**

```bash
git add app-v2/src/utils/airlines.ts app-v2/src/screens/SearchScreen.tsx
git commit -m "chore: ensure getAirlineName import in SearchScreen"
```

---

### Task 9: TypeScript check + test pass + push

**Step 1: Run TypeScript check**

Run: `cd /Users/jackson/SwypeFly && npx tsc --noEmit`
Expected: 0 errors

**Step 2: Run tests**

Run: `npm test`
Expected: ALL suites pass (including new `search-deals.test.ts`)

**Step 3: Fix any issues found**

If TypeScript or test errors, fix them now.

**Step 4: Push to main**

```bash
git push origin main
```

**Step 5: Verify on production**

After deploy, navigate to `https://sogojet.com/search` and verify:
- Page loads
- Deal cards render with real cached prices
- Filters work
- Tapping a card expands with details
- "Book This Deal" navigates to flight selection with correct params

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `utils/validation.ts` | Modify | Add `searchDealsQuerySchema` |
| `__tests__/validation.test.ts` | Modify | Tests for new schema |
| `api/search-deals.ts` | Create | New API endpoint |
| `__tests__/search-deals.test.ts` | Create | Tests for API endpoint |
| `app-v2/src/screens/SearchScreen.tsx` | Create | Search tab UI |
| `app-v2/src/hooks/useSearchDeals.ts` | Create | TanStack Query hook |
| `app-v2/src/App.tsx` | Modify | Add `/search` route |
| `app-v2/src/components/BottomNav.tsx` | Modify | Add Search tab |
| `app-v2/src/screens/FlightSelectionScreen.tsx` | Modify | Accept search handoff state |
| `app-v2/src/utils/airlines.ts` | Verify/Create | Airline name resolver |
