# Price Calendar System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stale/fake feed prices with a Travelpayouts-backed price calendar so every card price is real and the booking calendar shows per-day prices.

**Architecture:** New `price_calendar` Appwrite collection populated by a cron every 2 hours using Travelpayouts bulk discovery + daily calendar APIs. Feed reads cheapest-per-destination from this collection. Booking calendar reads from it too (replacing live TP calls). Duffel live search still handles final booking.

**Tech Stack:** Travelpayouts API, Appwrite (node-appwrite), Vercel Serverless Functions, Zustand, Jest

**Spec:** `docs/superpowers/specs/2026-03-19-price-calendar-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `services/appwriteServer.ts` | Modify (line 26-39) | Add `priceCalendar` to COLLECTIONS |
| `api/prices/refresh-calendar.ts` | Create | Cron: populate price_calendar from Travelpayouts |
| `api/feed.ts` | Modify (lines 506-558) | Read cheapest prices from price_calendar instead of cached_prices |
| `api/destination.ts` | Modify (lines 10-34) | Read calendar from price_calendar collection with TP fallback |
| `stores/dealStore.ts` | Modify (lines 11-83) | Add cheapestDate fields to ApiDestination and BoardDeal transform |
| `types/deal.ts` | Modify | Add cheapestDate, cheapestReturnDate to BoardDeal |
| `components/swipe/SwipeFeed.tsx` | Modify (lines 43-52) | Pass cheapestDate into bookingFlowStore on book |
| `vercel.json` | Modify (lines 40-57) | Add refresh-calendar cron |
| `__tests__/api/refresh-calendar.test.ts` | Create | Cron tests |
| `__tests__/api/feed-calendar.test.ts` | Create | Feed + calendar price tests |

---

### Task 1: Add `priceCalendar` Collection Reference

**Files:**
- Modify: `services/appwriteServer.ts` (line 26-39)

- [ ] **Step 1: Add the collection constant**

In `services/appwriteServer.ts`, add to the `COLLECTIONS` object (after line 38, before the closing `}`):

```typescript
  priceCalendar: 'price_calendar',
```

- [ ] **Step 2: Create the collection in Appwrite**

Run this script to create the collection with required attributes and indexes:

```bash
npx tsx -e "
const { Client, Databases, ID } = require('node-appwrite');
const c = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
const db = new Databases(c);
const DB = 'sogojet';
const COL = 'price_calendar';

async function setup() {
  try {
    await db.createCollection(DB, COL, COL);
    console.log('Collection created');
  } catch (e) { console.log('Collection may exist:', e.message); }

  const attrs = [
    ['string', 'origin', 3, true],
    ['string', 'destination_iata', 4, true],
    ['string', 'date', 10, true],
    ['float', 'price', true],
    ['string', 'return_date', 10, false],
    ['integer', 'trip_days', false],
    ['string', 'airline', 10, false],
    ['string', 'source', 20, false],
    ['string', 'fetched_at', 30, false],
  ];

  for (const [type, key, ...args] of attrs) {
    try {
      if (type === 'string') await db.createStringAttribute(DB, COL, key, args[0], args[1]);
      else if (type === 'float') await db.createFloatAttribute(DB, COL, key, args[0]);
      else if (type === 'integer') await db.createIntegerAttribute(DB, COL, key, args[0]);
      console.log('Created attr:', key);
    } catch (e) { console.log('Attr exists:', key, e.message); }
  }

  // Wait for attributes to be available
  await new Promise(r => setTimeout(r, 3000));

  // Indexes
  try { await db.createIndex(DB, COL, 'idx_origin_dest', 'key', ['origin', 'destination_iata']); } catch(e) { console.log('Index exists:', e.message); }
  try { await db.createIndex(DB, COL, 'idx_origin_price', 'key', ['origin', 'price'], ['ASC', 'ASC']); } catch(e) { console.log('Index exists:', e.message); }
  try { await db.createIndex(DB, COL, 'idx_origin_dest_date', 'unique', ['origin', 'destination_iata', 'date']); } catch(e) { console.log('Index exists:', e.message); }

  console.log('Done');
}
setup();
"
```

Note: If this script approach doesn't work, create the collection manually in the Appwrite console. The collection needs: `origin` (string, 3 chars, required), `destination_iata` (string, 4 chars, required), `date` (string, 10 chars, required), `price` (float, required), `return_date` (string, 10 chars), `trip_days` (integer), `airline` (string, 10 chars), `source` (string, 20 chars), `fetched_at` (string, 30 chars). Plus a unique index on `[origin, destination_iata, date]`.

- [ ] **Step 3: Run tests to confirm no regressions**

Run: `npx jest --no-coverage`
Expected: All 201 tests pass

- [ ] **Step 4: Commit**

```bash
git add services/appwriteServer.ts
git commit -m "feat: add priceCalendar collection reference"
```

---

### Task 2: Price Calendar Cron

**Files:**
- Create: `api/prices/refresh-calendar.ts`
- Create: `__tests__/api/refresh-calendar.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/api/refresh-calendar.test.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const mockListDocuments = jest.fn();
const mockCreateDocument = jest.fn();
const mockUpdateDocument = jest.fn();

jest.mock('node-appwrite', () => ({
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
  })),
  Databases: jest.fn().mockImplementation(() => ({
    listDocuments: mockListDocuments,
    createDocument: mockCreateDocument,
    updateDocument: mockUpdateDocument,
  })),
  Users: jest.fn().mockImplementation(() => ({})),
  Query: {
    equal: jest.fn((...args: unknown[]) => `equal:${args.join(',')}`),
    greaterThanEqual: jest.fn((...args: unknown[]) => `gte:${args.join(',')}`),
    orderAsc: jest.fn((field: string) => `orderAsc:${field}`),
    limit: jest.fn((n: number) => `limit:${n}`),
  },
  ID: { unique: jest.fn(() => 'test-id') },
}));

const mockFetchAllCheapPrices = jest.fn();
const mockFetchPriceCalendar = jest.fn();

jest.mock('../../services/travelpayouts', () => ({
  fetchAllCheapPrices: (...args: unknown[]) => mockFetchAllCheapPrices(...args),
  fetchPriceCalendar: (...args: unknown[]) => mockFetchPriceCalendar(...args),
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

import handler from '../../api/prices/refresh-calendar';

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
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

describe('refresh-calendar cron', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APPWRITE_ENDPOINT = 'https://test.appwrite.io/v1';
    process.env.APPWRITE_PROJECT_ID = 'test-project';
    process.env.APPWRITE_API_KEY = 'test-key';
    process.env.CRON_SECRET = 'test-secret';
  });

  it('rejects requests without CRON_SECRET', async () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    await handler(req, res as unknown as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('fetches bulk prices then calendar for each destination', async () => {
    // No existing calendar entries (empty user_preferences too)
    mockListDocuments.mockResolvedValue({ documents: [], total: 0 });

    // Bulk discovery returns 2 destinations
    mockFetchAllCheapPrices.mockResolvedValue(
      new Map([
        ['BCN', { destination: 'BCN', price: 300, airline: 'IB', departureAt: '2026-04-10', returnAt: '2026-04-17', foundAt: '' }],
        ['CDG', { destination: 'CDG', price: 250, airline: 'AF', departureAt: '2026-04-12', returnAt: '2026-04-19', foundAt: '' }],
      ])
    );

    // Calendar returns daily prices
    mockFetchPriceCalendar.mockResolvedValue([
      { date: '2026-04-10', price: 300, airline: 'IB', transferCount: 0 },
      { date: '2026-04-11', price: 350, airline: 'IB', transferCount: 0 },
    ]);

    // createDocument succeeds
    mockCreateDocument.mockResolvedValue({ $id: 'test-id' });

    const req = makeReq({ query: { origin: 'JFK' } });
    const res = makeRes();
    await handler(req, res as unknown as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockFetchAllCheapPrices).toHaveBeenCalledWith('JFK');
    expect(mockFetchPriceCalendar).toHaveBeenCalledTimes(2); // BCN + CDG
    // 2 destinations × 2 calendar days = 4 upserts
    expect(mockCreateDocument.mock.calls.length + mockUpdateDocument.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/refresh-calendar.test.ts --no-coverage`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement the cron**

Create `api/prices/refresh-calendar.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../../services/appwriteServer';
import { ID } from 'node-appwrite';
import { fetchAllCheapPrices, fetchPriceCalendar } from '../../services/travelpayouts';
import { logApiError } from '../../utils/apiLogger';

export const maxDuration = 300;

const DEFAULT_ORIGINS = ['TPA', 'LAX', 'JFK', 'ORD', 'ATL', 'SFO', 'MIA', 'DFW', 'SEA', 'BOS'];
const CONCURRENCY = 5;
const DELAY_BETWEEN_BATCHES = 1200; // ms — respects TP 60 req/min

// ─── Helpers ──────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Upsert a single calendar entry ──────────────────────────────────

async function upsertCalendarEntry(
  origin: string,
  destinationIata: string,
  date: string,
  price: number,
  airline: string,
  source: string,
): Promise<void> {
  const returnDate = addDays(date, 7);
  const data = {
    origin,
    destination_iata: destinationIata,
    date,
    price,
    return_date: returnDate,
    trip_days: 7,
    airline,
    source,
    fetched_at: new Date().toISOString(),
  };

  try {
    // Check if entry exists
    const existing = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.priceCalendar,
      [
        Query.equal('origin', origin),
        Query.equal('destination_iata', destinationIata),
        Query.equal('date', date),
        Query.limit(1),
      ],
    );

    if (existing.documents.length > 0) {
      await serverDatabases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.priceCalendar,
        existing.documents[0].$id,
        data,
      );
    } else {
      await serverDatabases.createDocument(
        DATABASE_ID,
        COLLECTIONS.priceCalendar,
        ID.unique(),
        data,
      );
    }
  } catch (err) {
    // Non-fatal — log and continue
    console.warn(`[refresh-calendar] upsert failed ${origin}->${destinationIata} ${date}:`, err);
  }
}

// ─── Process one destination's calendar ──────────────────────────────

async function refreshDestCalendar(
  origin: string,
  destinationIata: string,
): Promise<number> {
  const calendar = await fetchPriceCalendar(origin, destinationIata);
  if (calendar.length === 0) return 0;

  let upserted = 0;
  for (const entry of calendar) {
    if (!entry.date || entry.price <= 0) continue;
    await upsertCalendarEntry(
      origin,
      destinationIata,
      entry.date,
      entry.price,
      entry.airline,
      'travelpayouts',
    );
    upserted++;
  }
  return upserted;
}

// ─── Pick stalest origins ────────────────────────────────────────────

async function getActiveOrigins(): Promise<string[]> {
  const origins = new Set(DEFAULT_ORIGINS);
  try {
    const prefs = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.userPreferences,
      [Query.limit(500)],
    );
    for (const doc of prefs.documents) {
      const code = doc.departure_code as string;
      if (code && /^[A-Z]{3}$/.test(code)) origins.add(code);
    }
  } catch {
    // Use defaults only
  }
  return Array.from(origins);
}

async function pickStalestOrigins(count: number): Promise<string[]> {
  const allOrigins = await getActiveOrigins();

  // Find the most recent fetched_at for each origin in price_calendar
  const stalenessMap = new Map<string, number>();
  for (const o of allOrigins) stalenessMap.set(o, 0);

  try {
    const recent = await serverDatabases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.priceCalendar,
      [Query.orderAsc('fetched_at'), Query.limit(1)],
    );
    // Simplified: just get any entry to check if collection has data
    // Origins not in calendar yet are stalest (timestamp 0)
    for (const doc of recent.documents) {
      const origin = doc.origin as string;
      const ts = new Date(doc.fetched_at as string).getTime() || 0;
      if (!stalenessMap.has(origin) || ts > (stalenessMap.get(origin) || 0)) {
        stalenessMap.set(origin, ts);
      }
    }
  } catch {
    // Empty collection — all origins are equally stale
  }

  return allOrigins
    .sort((a, b) => (stalenessMap.get(a) || 0) - (stalenessMap.get(b) || 0))
    .slice(0, count);
}

// ─── Main handler ────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'CRON_SECRET not configured' });
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Determine origins to process
    const explicitOrigin = req.query.origin as string | undefined;
    const origins = explicitOrigin && /^[A-Z]{3}$/.test(explicitOrigin)
      ? [explicitOrigin]
      : await pickStalestOrigins(2);

    let totalUpserted = 0;
    const summary: { origin: string; destinations: number; entries: number }[] = [];

    for (const origin of origins) {
      console.log(`[refresh-calendar] Processing ${origin}...`);

      // Step 1: Bulk discovery
      const bulkPrices = await fetchAllCheapPrices(origin);
      if (bulkPrices.size === 0) {
        console.log(`[refresh-calendar] No bulk prices for ${origin}, skipping`);
        continue;
      }

      // Step 2: Calendar fill — batch by CONCURRENCY with delay
      const destinations = Array.from(bulkPrices.keys());
      let originEntries = 0;

      for (let i = 0; i < destinations.length; i += CONCURRENCY) {
        const chunk = destinations.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          chunk.map((dest) => refreshDestCalendar(origin, dest)),
        );
        originEntries += results.reduce((sum, n) => sum + n, 0);

        // Rate limit delay between chunks
        if (i + CONCURRENCY < destinations.length) {
          await sleep(DELAY_BETWEEN_BATCHES);
        }
      }

      totalUpserted += originEntries;
      summary.push({
        origin,
        destinations: destinations.length,
        entries: originEntries,
      });
      console.log(`[refresh-calendar] ${origin}: ${destinations.length} dests, ${originEntries} entries`);
    }

    return res.status(200).json({
      success: true,
      origins: summary,
      totalEntries: totalUpserted,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logApiError('api/prices/refresh-calendar', err);
    return res.status(500).json({ error: 'Calendar refresh failed' });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/api/refresh-calendar.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Add cron to vercel.json**

In `vercel.json`, add to the `crons` array (after the last cron entry):

```json
    {
      "path": "/api/prices/refresh-calendar",
      "schedule": "0 */2 * * *"
    }
```

- [ ] **Step 6: Run full test suite**

Run: `npx jest --no-coverage`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add api/prices/refresh-calendar.ts __tests__/api/refresh-calendar.test.ts vercel.json
git commit -m "feat: add price calendar cron — Travelpayouts bulk + daily prices"
```

---

### Task 3: Feed Reads from price_calendar

**Files:**
- Modify: `api/feed.ts` (lines 506-558)
- Create: `__tests__/api/feed-calendar.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/api/feed-calendar.test.ts
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
    greaterThanEqual: jest.fn((...args: unknown[]) => `gte:${args.join(',')}`),
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
    description: 'Beautiful',
    image_url: 'https://example.com/bcn.jpg',
    image_urls: ['https://example.com/bcn.jpg'],
    flight_price: 999,
    hotel_price_per_night: 120,
    currency: 'USD',
    vibe_tags: ['city', 'culture'],
    rating: 4.7,
    review_count: 1200,
    best_months: ['May'],
    average_temp: 72,
    flight_duration: '8h 30m',
    is_active: true,
    beach_score: 0.6, city_score: 0.9, adventure_score: 0.3,
    culture_score: 0.8, nightlife_score: 0.7, nature_score: 0.2, food_score: 0.8,
    popularity_score: 0.85,
    trip_duration_days: 7,
    ...overrides,
  };
}

function makeCalendarEntry(overrides: Record<string, unknown> = {}) {
  return {
    origin: 'ZZZ',
    destination_iata: 'BCN',
    date: '2026-04-10',
    price: 310,
    return_date: '2026-04-17',
    trip_days: 7,
    airline: 'IB',
    source: 'travelpayouts',
    fetched_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET', headers: {}, body: {}, query: {},
    ...overrides,
  } as unknown as VercelRequest;
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & { status: jest.Mock; json: jest.Mock };
}

describe('feed with price_calendar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APPWRITE_ENDPOINT = 'https://test.appwrite.io/v1';
    process.env.APPWRITE_PROJECT_ID = 'test-project';
    process.env.APPWRITE_API_KEY = 'test-key';
  });

  it('uses price_calendar prices for feed cards', async () => {
    const dest = makeDest({ $id: 'pc-1', iata_code: 'BCN', flight_price: 999 });
    const calEntry = makeCalendarEntry({ destination_iata: 'BCN', price: 310, date: '2026-04-10' });

    // Call order: destinations, priceCalendar, cachedPrices, hotelPrices, images
    mockListDocuments
      .mockResolvedValueOnce({ documents: [dest], total: 1 }) // destinations
      .mockResolvedValueOnce({ documents: [calEntry], total: 1 }) // price_calendar
      .mockResolvedValueOnce({ documents: [], total: 0 }) // cached_prices
      .mockResolvedValueOnce({ documents: [], total: 0 }) // hotel prices
      .mockResolvedValueOnce({ documents: [], total: 0 }); // images

    const req = makeReq({ query: { origin: 'ZZZ' } });
    const res = makeRes();
    await handler(req, res as unknown as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0];
    const bcn = data.destinations[0];
    // Price should come from calendar (310), not static flight_price (999)
    expect(bcn.flightPrice).toBe(310);
    expect(bcn.priceSource).toBe('travelpayouts');
    expect(bcn.cheapestDate).toBe('2026-04-10');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/feed-calendar.test.ts --no-coverage`
Expected: FAIL — flightPrice is 999 (from static DB), not 310 (from calendar)

- [ ] **Step 3: Modify feed.ts to read from price_calendar**

In `api/feed.ts`, in the `getDestinationsWithPrices` function (around line 506), add a price_calendar query to the `Promise.all`:

**Before the existing priceResult query (line 507), add a new query:**

```typescript
    serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.priceCalendar, [
      Query.equal('origin', origin),
      Query.greaterThanEqual('date', new Date().toISOString().split('T')[0]),
      Query.orderAsc('price'),
      Query.limit(500),
    ]).catch(() => ({ documents: [] })),
```

Update the destructuring to include it:
```typescript
const [calendarResult, priceResult, hotelPriceResult, imageResult] = await Promise.all([
  // price_calendar (new)
  serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.priceCalendar, [
    Query.equal('origin', origin),
    Query.greaterThanEqual('date', new Date().toISOString().split('T')[0]),
    Query.orderAsc('price'),
    Query.limit(500),
  ]).catch(() => ({ documents: [] })),
  // cached_prices (existing — still needed for offer_json)
  serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedPrices, [
    Query.equal('origin', origin), Query.orderAsc('price'), Query.limit(500),
  ]).catch(() => ({ documents: [] })),
  // ... hotel and images unchanged
```

**Build a calendarPriceMap before the existing priceMap (around line 520):**

```typescript
  // Build calendar price map — cheapest future date per destination
  const calendarPriceMap = new Map<string, {
    price: number;
    date: string;
    return_date: string;
    trip_days: number;
    airline: string;
    source: string;
  }>();
  for (const p of calendarResult.documents) {
    const dest = p.destination_iata as string;
    if (calendarPriceMap.has(dest)) continue; // already have cheapest (sorted by price ASC)
    calendarPriceMap.set(dest, {
      price: p.price as number,
      date: (p.date as string) || '',
      return_date: (p.return_date as string) || '',
      trip_days: (p.trip_days as number) ?? 7,
      airline: (p.airline as string) || '',
      source: (p.source as string) || 'travelpayouts',
    });
  }
```

**In the merge section (around line 604-673), prefer calendarPriceMap over priceMap for the live_price:**

Where the code currently does:
```typescript
    live_price: lp?.price ?? null,
```

Change to:
```typescript
    live_price: cp?.price ?? lp?.price ?? null,
```

Where `cp = calendarPriceMap.get(d.iata_code)`.

Also add new fields to the merge:
```typescript
    cheapest_date: cp?.date ?? lp?.departure_date,
    cheapest_return_date: cp?.return_date ?? lp?.return_date,
```

And in `toFrontend()` (around line 681), add:
```typescript
    cheapestDate: d.cheapest_date || undefined,
    cheapestReturnDate: d.cheapest_return_date || undefined,
```

And update the `price_source` to prefer calendar:
```typescript
    price_source: cp ? cp.source : (lp?.source ?? undefined),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/api/feed-calendar.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx jest --no-coverage`
Expected: All tests pass (existing feed tests may need mock adjustments for the new query — add a calendar mock returning empty `{ documents: [] }` to existing feed test setup)

- [ ] **Step 6: Commit**

```bash
git add api/feed.ts __tests__/api/feed-calendar.test.ts
git commit -m "feat: feed reads cheapest prices from price_calendar collection"
```

---

### Task 4: BoardDeal Type + Store Changes

**Files:**
- Modify: `types/deal.ts`
- Modify: `stores/dealStore.ts`

- [ ] **Step 1: Add cheapestDate fields to BoardDeal**

In `types/deal.ts`, add after `returnDate` (line 14):

```typescript
  cheapestDate: string;
  cheapestReturnDate: string;
```

- [ ] **Step 2: Update ApiDestination and apiToBoardDeal**

In `stores/dealStore.ts`, add to `ApiDestination` interface (after `returnDate`):

```typescript
  cheapestDate?: string;
  cheapestReturnDate?: string;
```

In `apiToBoardDeal()`, add to the return object (after `returnDate`):

```typescript
    cheapestDate: d.cheapestDate || d.departureDate || '',
    cheapestReturnDate: d.cheapestReturnDate || d.returnDate || '',
```

- [ ] **Step 3: Update SwipeFeed to pass cheapest dates on book**

In `components/swipe/SwipeFeed.tsx`, in the `handleBook` callback, after `store.setTripContext(...)` and before `router.push(...)`, add:

```typescript
    if (deal.cheapestDate && deal.cheapestReturnDate) {
      store.setDates(deal.cheapestDate, deal.cheapestReturnDate);
    }
```

This pre-selects the cheapest dates in the booking flow so the calendar opens on the right dates.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx jest --no-coverage && npx tsc --noEmit`
Expected: All pass (fix any type errors from the new required fields — add to test stubs/mocks)

- [ ] **Step 5: Commit**

```bash
git add types/deal.ts stores/dealStore.ts components/swipe/SwipeFeed.tsx
git commit -m "feat: pass cheapest calendar dates through to booking flow"
```

---

### Task 5: Calendar Data Source Switch

**Files:**
- Modify: `api/destination.ts` (lines 10-34)

- [ ] **Step 1: Update handleCalendar to read from price_calendar with TP fallback**

Replace the `handleCalendar` function in `api/destination.ts` (lines 10-34):

```typescript
async function handleCalendar(req: VercelRequest, res: VercelResponse) {
  const v = validateRequest(priceCalendarQuerySchema, req.query);
  if (!v.success) return res.status(400).json({ error: v.error });
  const { origin, destination, month } = v.data;

  try {
    // Try price_calendar collection first (cached by cron)
    const datePrefix = month || new Date().toISOString().slice(0, 7); // "2026-04"
    const today = new Date().toISOString().split('T')[0];

    let calendarDocs;
    try {
      calendarDocs = await serverDatabases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.priceCalendar,
        [
          Query.equal('origin', origin),
          Query.equal('destination_iata', destination),
          Query.greaterThanEqual('date', today),
          Query.orderAsc('date'),
          Query.limit(90),
        ],
      );
    } catch {
      calendarDocs = { documents: [] };
    }

    // Filter to requested month
    const monthDocs = calendarDocs.documents.filter(
      (d) => (d.date as string).startsWith(datePrefix),
    );

    if (monthDocs.length > 0) {
      // Use cached calendar data
      const calendar = monthDocs.map((d) => ({
        date: d.date as string,
        price: d.price as number,
        airline: (d.airline as string) || '',
        transferCount: 0,
      }));

      const cheapest = calendar.reduce((min, entry) =>
        entry.price < min.price ? entry : min, calendar[0]);

      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json({
        calendar,
        cheapestDate: cheapest.date,
        cheapestPrice: cheapest.price,
      });
    }

    // Fallback: live Travelpayouts call (existing behavior)
    const calendar = await fetchPriceCalendar(origin, destination, 'USD', month);
    if (calendar.length === 0) {
      return res.status(200).json({ calendar: [], cheapestDate: null, cheapestPrice: null });
    }

    const cheapest = calendar.reduce((min, entry) =>
      entry.price < min.price ? entry : min, calendar[0]);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({
      calendar,
      cheapestDate: cheapest.date,
      cheapestPrice: cheapest.price,
    });
  } catch (err) {
    logApiError('api/destination?action=calendar', err);
    return res.status(500).json({ error: 'Failed to load price calendar' });
  }
}
```

- [ ] **Step 2: Add import for COLLECTIONS and Query if not already present**

Check the imports at the top of `api/destination.ts`. If `serverDatabases`, `DATABASE_ID`, `COLLECTIONS`, `Query` aren't imported, add:

```typescript
import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../services/appwriteServer';
```

- [ ] **Step 3: Run full test suite**

Run: `npx jest --no-coverage`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add api/destination.ts
git commit -m "feat: calendar endpoint reads from price_calendar with TP fallback"
```

---

### Task 6: Seed Initial Data + Verify

- [ ] **Step 1: Trigger initial calendar population**

Run the cron manually for a few origins:

```bash
curl -s -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  "https://sogojet.com/api/prices/refresh-calendar?origin=JFK" | python3 -m json.tool

curl -s -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  "https://sogojet.com/api/prices/refresh-calendar?origin=LAX" | python3 -m json.tool
```

Expected: JSON response with `totalEntries > 0` showing destinations and calendar entries populated.

- [ ] **Step 2: Verify feed uses calendar prices**

```bash
curl -s "https://sogojet.com/api/feed?origin=JFK" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for d in data.get('destinations', [])[:5]:
    print(d.get('city'), '|', 'price=', d.get('flightPrice'), '|', 'source=', d.get('priceSource'), '|', 'cheapestDate=', d.get('cheapestDate', 'none'))
"
```

Expected: Prices come from `travelpayouts` source with cheapestDate populated.

- [ ] **Step 3: Verify booking calendar uses cached data**

```bash
curl -s "https://sogojet.com/api/destination?action=calendar&origin=JFK&destination=BCN" | python3 -m json.tool | head -20
```

Expected: Calendar entries with per-day prices, cheapestDate and cheapestPrice.

- [ ] **Step 4: Run full test suite + lint**

Run: `npx jest --no-coverage && npm run lint`
Expected: All tests pass, no new lint errors

- [ ] **Step 5: Final push**

```bash
git push origin main
```
