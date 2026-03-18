# Duffel-Only Pricing Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Travelpayouts-based pricing with Duffel-only pricing — background cron every 6h for feed pre-fill, live Duffel search on tap for guaranteed bookable prices.

**Architecture:** Three changes: (1) strip TP from the price cron and increase batch/timeout for Vercel Pro, (2) new `api/search.ts` endpoint for live Duffel search with caching + rate limiting, (3) update client to show "From $X" or "Tap to check price" and fetch live price on detail page.

**Tech Stack:** Duffel API (`@duffel/api`), Vercel Serverless Functions (Pro, 300s timeout), Appwrite (cached_prices), Zustand, React Native/Expo

**Spec:** `docs/superpowers/specs/2026-03-18-duffel-pricing-pipeline-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `api/prices/refresh.ts` | Modify | Remove TP calls, increase batch to 30, maxDuration=300, add chunk delay |
| `api/search.ts` | Create | Live Duffel search endpoint with cache check + rate limiting |
| `api/feed.ts` | Modify | Filter cached_prices to source='duffel' only |
| `utils/validation.ts` | Modify | Add searchQuerySchema |
| `utils/duration.ts` | Create | ISO 8601 duration parser (P1DT8H20M → "1d 8h 20m") |
| `stores/dealStore.ts` | Modify | Handle null prices, "From $X" prefix, "Check" display |
| `types/deal.ts` | Modify | `price: number` → `price: number \| null` |
| `components/swipe/SwipeCard.tsx` | Modify | Conditional price tag, "View Deal" CTA |
| `components/board/DepartureRow.tsx` | Modify | Handle "Check" in price column |
| `app/destination/[id].tsx` | Modify | Live search on mount, skeleton loading, real price CTA |
| `vercel.json` | Modify | Cron schedule 0 */6 * * * |
| `__tests__/search.test.ts` | Create | Tests for search endpoint + duration parser |

---

### Task 1: Duration Parser Utility

**Files:**
- Create: `utils/duration.ts`
- Create: `__tests__/duration.test.ts`

ISO 8601 duration parser for Duffel flight durations. This is a standalone utility needed by both the search endpoint and the cron.

- [ ] **Step 1: Write tests**

Create `__tests__/duration.test.ts`:

```typescript
import { parseDuration } from '../utils/duration';

describe('parseDuration', () => {
  it('parses hours and minutes', () => {
    expect(parseDuration('PT7H10M')).toBe('7h 10m');
  });

  it('parses days, hours, minutes', () => {
    expect(parseDuration('P1DT8H20M')).toBe('1d 8h 20m');
  });

  it('parses hours only', () => {
    expect(parseDuration('PT14H')).toBe('14h 0m');
  });

  it('parses minutes only', () => {
    expect(parseDuration('PT45M')).toBe('0h 45m');
  });

  it('returns empty string for invalid input', () => {
    expect(parseDuration('')).toBe('');
    expect(parseDuration('invalid')).toBe('');
  });

  it('handles null/undefined', () => {
    expect(parseDuration(null as any)).toBe('');
    expect(parseDuration(undefined as any)).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/duration.test.ts -v`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

Create `utils/duration.ts`:

```typescript
/**
 * Parse ISO 8601 duration (e.g., PT7H10M, P1DT8H20M) into human-readable string.
 * Returns "" for invalid input.
 */
export function parseDuration(iso: string | null | undefined): string {
  if (!iso) return '';
  const match = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return '';

  const days = match[1] ? parseInt(match[1], 10) : 0;
  const hours = match[2] ? parseInt(match[2], 10) : 0;
  const minutes = match[3] ? parseInt(match[3], 10) : 0;

  if (days === 0 && hours === 0 && minutes === 0) return '';

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hours}h ${minutes}m`);
  return parts.join(' ');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/duration.test.ts -v`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add utils/duration.ts __tests__/duration.test.ts
git commit -m "feat: add ISO 8601 duration parser for Duffel flight times"
```

---

### Task 2: Search Query Validation Schema

**Files:**
- Modify: `utils/validation.ts`

Add Zod schema for the new search endpoint.

- [ ] **Step 1: Add searchQuerySchema**

Add to `utils/validation.ts` (near the other query schemas):

```typescript
export const searchQuerySchema = z.object({
  origin: z.string().regex(/^[A-Z]{3}$/),
  destination: z.string().regex(/^[A-Z]{3}$/),
});
```

- [ ] **Step 2: Run existing validation tests**

Run: `npx jest __tests__/validation.test.ts -v`
Expected: All existing tests PASS (no regressions)

- [ ] **Step 3: Commit**

```bash
git add utils/validation.ts
git commit -m "feat: add searchQuerySchema for live Duffel search endpoint"
```

---

### Task 3: Live Search Endpoint (`api/search.ts`)

**Files:**
- Create: `api/search.ts`
- Create: `__tests__/api/search.test.ts`

The core new endpoint — live Duffel search with cache + rate limiting.

- [ ] **Step 1: Write tests**

Create `__tests__/api/search.test.ts`:

```typescript
jest.mock('../utils/apiLogger', () => ({ logApiError: jest.fn() }));
jest.mock('../services/appwriteServer', () => {
  const Query = {
    equal: jest.fn((...args: any[]) => `equal(${args.join(',')})`),
    greaterThan: jest.fn((...args: any[]) => `greaterThan(${args.join(',')})`),
    orderDesc: jest.fn((...args: any[]) => `orderDesc(${args.join(',')})`),
    limit: jest.fn((...args: any[]) => `limit(${args.join(',')})`),
  };
  return {
    serverDatabases: {
      listDocuments: jest.fn(),
      createDocument: jest.fn(),
      updateDocument: jest.fn(),
    },
    DATABASE_ID: 'sogojet',
    COLLECTIONS: { cachedPrices: 'cached_prices' },
    Query,
  };
});
jest.mock('../services/duffel', () => ({
  searchFlights: jest.fn(),
}));
jest.mock('../utils/rateLimit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 })),
  getClientIp: jest.fn(() => '1.2.3.4'),
}));

import handler from '../api/search';
import { searchFlights } from '../services/duffel';
import { serverDatabases } from '../services/appwriteServer';
import { checkRateLimit } from '../utils/rateLimit';

function makeReq(query = {}, headers = {}) {
  return { method: 'GET', query, headers } as any;
}
function makeRes() {
  const res: any = { statusCode: 200, headers: {} };
  res.status = jest.fn((code: number) => { res.statusCode = code; return res; });
  res.json = jest.fn((data: any) => { res.body = data; return res; });
  res.setHeader = jest.fn((k: string, v: string) => { res.headers[k] = v; return res; });
  return res;
}

describe('GET /api/search', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 for missing params', async () => {
    const res = makeRes();
    await handler(makeReq({}), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for lowercase IATA codes', async () => {
    const res = makeRes();
    await handler(makeReq({ origin: 'jfk', destination: 'lim' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    (checkRateLimit as jest.Mock).mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 30000 });
    const res = makeRes();
    await handler(makeReq({ origin: 'JFK', destination: 'LIM' }), res);
    expect(res.statusCode).toBe(429);
  });

  it('returns cached result if fresh', async () => {
    const cached = {
      documents: [{
        price: 310,
        source: 'duffel',
        fetched_at: new Date().toISOString(),
        offer_expires_at: new Date(Date.now() + 20 * 60000).toISOString(),
        destination_iata: 'LIM',
        airline: 'AV',
        departure_date: '2026-04-02',
        return_date: '2026-04-09',
        trip_duration_days: 7,
        offer_json: '{"id":"offer_123"}',
      }],
    };
    (serverDatabases.listDocuments as jest.Mock).mockResolvedValueOnce(cached);
    const res = makeRes();
    await handler(makeReq({ origin: 'JFK', destination: 'LIM' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.price).toBe(310);
    expect(res.body.cached).toBe(true);
    expect(searchFlights).not.toHaveBeenCalled();
  });

  it('calls Duffel when no cache', async () => {
    (serverDatabases.listDocuments as jest.Mock).mockResolvedValueOnce({ documents: [] });
    (searchFlights as jest.Mock).mockResolvedValueOnce({
      offers: [{
        total_amount: '293.00',
        total_currency: 'USD',
        expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
        slices: [{
          segments: [{
            operating_carrier: { name: 'Avianca', iata_code: 'AV' },
            operating_carrier_flight_number: '941',
            departing_at: '2026-04-02T08:00:00',
            arriving_at: '2026-04-02T15:10:00',
            origin: { iata_code: 'JFK' },
            destination: { iata_code: 'LIM' },
          }],
        }],
      }],
    });
    // Mock the upsert (listDocuments for existing, then createDocument)
    (serverDatabases.listDocuments as jest.Mock).mockResolvedValueOnce({ documents: [] });
    (serverDatabases.createDocument as jest.Mock).mockResolvedValueOnce({});

    const res = makeRes();
    await handler(makeReq({ origin: 'JFK', destination: 'LIM' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.price).toBe(293);
    expect(res.body.cached).toBe(false);
    expect(searchFlights).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/api/search.test.ts -v`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the search endpoint**

Create `api/search.ts`. This is the full implementation — live Duffel search with cache, rate limiting, duration parsing, and offer caching.

The endpoint should:
1. Validate input with `searchQuerySchema`
2. Rate limit with `checkRateLimit` (10 req/min per IP)
3. Check `cached_prices` for fresh Duffel result (fetched < 30 min AND offer not expired)
4. If cache miss → call `searchFlights()` → find cheapest offer → cache in `cached_prices`
5. Return structured response with price, airline, dates, duration, offerJson, cached flag, searchedAt

Key imports and patterns to follow:
- `import type { VercelRequest, VercelResponse } from '@vercel/node'`
- `import { serverDatabases, DATABASE_ID, COLLECTIONS, Query } from '../services/appwriteServer'`
- `import { searchFlights } from '../services/duffel'`
- `import { checkRateLimit, getClientIp } from '../utils/rateLimit'`
- `import { searchQuerySchema, validateRequest } from '../utils/validation'`
- `import { parseDuration } from '../utils/duration'`
- `import { logApiError } from '../utils/apiLogger'`
- `import { cors } from './_cors.js'`
- Use `compactOfferJson()` (copy from `api/prices/refresh.ts` or import — it's not exported, so copy the function)
- Date strategy: `getSearchDates()` — same logic as cron (2 weeks out, next Wednesday, 7-day trip)
- For upsert: query existing doc by origin+destination, update if exists, create if not

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/api/search.test.ts -v`
Expected: All 5 tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm run test`
Expected: All tests pass (existing 165 + new duration 6 + new search 5 = 176)

- [ ] **Step 6: Commit**

```bash
git add api/search.ts __tests__/api/search.test.ts
git commit -m "feat: add live Duffel search endpoint with cache + rate limiting"
```

---

### Task 4: Strip Travelpayouts from Price Cron

**Files:**
- Modify: `api/prices/refresh.ts`
- Modify: `vercel.json`

Remove TP calls from the cron, increase batch size, update timeout and schedule.

- [ ] **Step 1: Update `api/prices/refresh.ts`**

Changes:
1. Remove `import { fetchCheapPrices, fetchAllCheapPrices } from '../../services/travelpayouts';`
2. Change `export const maxDuration = 60;` → `export const maxDuration = 300;`
3. Change `const BATCH_SIZE = 20;` → `const BATCH_SIZE = 30;`
4. In `refreshOneDest()`: Remove the entire "Fallback: Travelpayouts" block (lines ~219-234 in the current file). When Duffel fails, just return `{ source: null }`.
5. Remove the Travelpayouts bulk pre-seed phase from the main handler (the `fetchAllCheapPrices()` call).
6. Add a 5-second delay between chunks to respect Duffel's 60 req/min limit:
   ```typescript
   // After each chunk's Promise.all completes, add:
   if (chunkIndex < chunks.length - 1) {
     await new Promise(resolve => setTimeout(resolve, 5000));
   }
   ```

- [ ] **Step 2: Update `vercel.json` cron schedule**

Change:
```json
{ "path": "/api/prices/refresh", "schedule": "0 6 * * *" }
```
To:
```json
{ "path": "/api/prices/refresh", "schedule": "0 */6 * * *" }
```

- [ ] **Step 3: Run existing price refresh tests**

Run: `npx jest __tests__/api/prices-refresh.test.ts -v`
Expected: Some tests may fail if they mock TP calls. Update mocks: remove TP mocks, update expected source counts.

- [ ] **Step 4: Fix failing tests**

Update `__tests__/api/prices-refresh.test.ts`:
- Remove any tests that specifically test TP fallback behavior
- Update mock expectations that count sources (should only have 'duffel' now)
- Keep tests for Duffel search, price direction tracking, round-robin, batch logic

- [ ] **Step 5: Run full test suite**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add api/prices/refresh.ts vercel.json
git commit -m "feat: strip Travelpayouts from price cron, increase batch to 30, 6h schedule"
```

---

### Task 5: Filter Feed to Duffel-Only Prices

**Files:**
- Modify: `api/feed.ts`

When joining `cached_prices`, only use Duffel-sourced rows.

- [ ] **Step 1: Update the cached_prices query in `getDestinationsWithPrices()`**

In `api/feed.ts`, find where `cached_prices` are queried (the `listDocuments` call for cached prices). Add a filter:

```typescript
Query.equal('source', 'duffel')
```

to the query array. This ensures old Travelpayouts rows are ignored.

- [ ] **Step 2: Run feed tests**

Run: `npx jest __tests__/api/feed.test.ts -v`
Expected: Tests pass. If any test mocks include `source: 'travelpayouts'`, those destinations will now show `flightPrice: null` in the response. Update mocks to use `source: 'duffel'`.

- [ ] **Step 3: Commit**

```bash
git add api/feed.ts
git commit -m "feat: filter feed cached_prices to Duffel-only source"
```

---

### Task 6: Update Types and dealStore for Nullable Prices

**Files:**
- Modify: `types/deal.ts`
- Modify: `stores/dealStore.ts`

Handle destinations without Duffel prices — show "Check" instead of "$0".

- [ ] **Step 1: Update BoardDeal type**

In `types/deal.ts`, change:
```typescript
price: number;
```
To:
```typescript
price: number | null;
```

- [ ] **Step 2: Update apiToBoardDeal in dealStore**

In `stores/dealStore.ts`, update the transform:

```typescript
function apiToBoardDeal(d: ApiDestination, origin: string): BoardDeal {
  const hasPrice = d.flightPrice != null && d.flightPrice > 0 && d.priceSource === 'duffel';
  const price = hasPrice ? Math.round(d.flightPrice) : null;
  const priceFormatted = hasPrice ? `From $${price}` : 'Check';

  // ... rest stays the same, but use the new price/priceFormatted
```

Also update the `ApiDestination` interface to include `priceSource?: string`.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: May surface errors in components that assume `price` is always a number. Note them for Task 7.

- [ ] **Step 4: Commit**

```bash
git add types/deal.ts stores/dealStore.ts
git commit -m "feat: handle nullable prices in BoardDeal for 'Check price' display"
```

---

### Task 7: Update Feed Card UI

**Files:**
- Modify: `components/swipe/SwipeCard.tsx`
- Modify: `components/board/DepartureRow.tsx`

Show "From $X" or "Tap to check price" based on whether we have a cached Duffel price.

- [ ] **Step 1: Update SwipeCard**

In `components/swipe/SwipeCard.tsx`:

- Wrap the `priceTag` View in a conditional: only render when `deal.price != null`
- When `deal.price === null`: show a "Tap to check price" text where the price tag was (use same positioning, `Inter_600SemiBold` 14px, `colors.yellow`)
- Change "Book {deal.priceFormatted}" button text to "View Deal" for all cases
- The "from" prefix is already baked into `priceFormatted` by the dealStore transform ("From $293")

- [ ] **Step 2: Update DepartureRow**

In `components/board/DepartureRow.tsx`:

When `deal.price === null`:
- Price column: pass `text="—"` to `SplitFlapRow` (1 char, right-aligned in 5-char column)
- Status column: keep the normal status value — don't change it

When `deal.price != null`:
- Price column shows the formatted price as before (but now includes "From" prefix... actually the board should NOT show "From" — just the number). Update: in `dealStore`, create a separate `boardPriceFormatted` field or just use `$${price}` for board and `From $${price}` for swipe card.

Simplest approach: keep `priceFormatted` as `$${price}` (no "From" prefix). Add the "From" prefix in SwipeCard's render, not in the data. Board gets clean `$293`, swipe card renders "From $293".

- [ ] **Step 3: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: No errors in our changed files

- [ ] **Step 4: Commit**

```bash
git add components/swipe/SwipeCard.tsx components/board/DepartureRow.tsx
git commit -m "feat: conditional price display — 'From $X' in swipe, 'Check' when no price"
```

---

### Task 8: Detail Page Live Search

**Files:**
- Modify: `app/destination/[id].tsx`

Call the live Duffel search on mount and show the real bookable price.

- [ ] **Step 1: Update detail page**

In `app/destination/[id].tsx`:

1. Add state: `const [livePrice, setLivePrice] = useState<LiveSearchResult | null>(null)` and `const [priceLoading, setPriceLoading] = useState(true)`
2. Read departure code from `useSettingsStore((s) => s.departureCode)`
3. Read deal from `useDealStore` to get `iataCode`
4. On mount (`useEffect`): call `fetch(\`${API_BASE}/api/search?origin=${departureCode}&destination=${deal.iataCode}\`)`
5. While loading: show skeleton price area (pulsing View with same dimensions as the price card)
6. On success: show real price, airline, dates. CTA: "Book This Flight — $310" (disabled with "Coming soon" tooltip until booking flow is restored)
7. On error: show "No flights available for these dates"
8. On success, also update the deal's price in the store: `useDealStore.getState().updateDealPrice(deal.id, livePrice.price)` — add this action to dealStore

Add `API_BASE` constant (same as dealStore uses):
```typescript
const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';
```

- [ ] **Step 2: Add `updateDealPrice` action to dealStore**

In `stores/dealStore.ts`, add:
```typescript
updateDealPrice: (dealId: string, price: number) => {
  const deals = get().deals.map((d) =>
    d.id === dealId ? { ...d, price, priceFormatted: `$${price}` } : d,
  );
  set({ deals });
},
```

- [ ] **Step 3: Commit**

```bash
git add app/destination/\\[id\\].tsx stores/dealStore.ts
git commit -m "feat: live Duffel search on detail page mount, update feed price on return"
```

---

### Task 9: Final Verification + Deploy

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No new errors

- [ ] **Step 4: Deploy to Vercel**

```bash
git push origin main
vercel --prod --yes
```

- [ ] **Step 5: Verify live**

1. Open https://www.sogojet.com
2. Feed should show "From $X" prices (Duffel-sourced) or "Tap to check price" (no cache yet)
3. Tap a destination → detail page shows skeleton → then live Duffel price
4. Switch to Board view — same behavior
5. Check the cron schedule in Vercel dashboard (should show every 6 hours)

- [ ] **Step 6: Trigger a manual cron run**

```bash
curl -H "Authorization: Bearer CRON_SECRET" https://www.sogojet.com/api/prices/refresh
```

Verify it runs Duffel-only (no TP calls in logs).
