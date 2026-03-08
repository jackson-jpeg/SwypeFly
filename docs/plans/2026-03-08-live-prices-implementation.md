# Live Duffel Prices + Feed Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace estimated prices with live Duffel offers in the feed so the price on the card IS the bookable deal.

**Architecture:** Rewrite the price refresh cron to search Duffel for 8 destinations per invocation (10s hobby timeout), caching full offer details. Feed cards show real dates/airline. Booking flow pre-populates with cached offer. Expand to 150+ destinations with 5 images each. Improve feed scoring to prioritize fresh deals.

**Tech Stack:** Duffel JS SDK (`@duffel/api`), Appwrite (node-appwrite), Vercel Serverless Functions, Vite + React (app-v2)

---

## Task 1: Add Appwrite attributes for cached Duffel offers

We need new fields on `cached_prices` to store full Duffel offer data alongside the existing price fields.

**Files:**
- Create: `scripts/setup-duffel-price-attrs.ts`

**Step 1: Write the migration script**

```typescript
// scripts/setup-duffel-price-attrs.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Client, Databases } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '';
const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '';
const apiKey = process.env.APPWRITE_API_KEY ?? '';

if (!endpoint || !projectId || !apiKey) {
  console.error('Missing APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const db = new Databases(client);
const DB = 'sogojet';

async function safe(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`✓ ${label}`);
  } catch (err: any) {
    if (err?.code === 409 || err?.message?.includes('already exists')) {
      console.log(`⊘ ${label} (already exists)`);
    } else {
      console.error(`✗ ${label}:`, err?.message || err);
    }
  }
}

async function main() {
  // Store serialized Duffel offer JSON for tap-through
  await safe('cached_prices.offer_json', () =>
    db.createStringAttribute(DB, 'cached_prices', 'offer_json', 10000, false),
  );
  // Offer expiry time from Duffel
  await safe('cached_prices.offer_expires_at', () =>
    db.createStringAttribute(DB, 'cached_prices', 'offer_expires_at', 30, false),
  );
  // Flight number for display on feed cards
  await safe('cached_prices.flight_number', () =>
    db.createStringAttribute(DB, 'cached_prices', 'flight_number', 20, false),
  );

  console.log('\nDone. Attributes may take a few seconds to provision.');
}

main().catch(console.error);
```

**Step 2: Run the migration**

Run: `npx tsx scripts/setup-duffel-price-attrs.ts`
Expected: All attributes created (or already exist).

**Step 3: Commit**

```bash
git add scripts/setup-duffel-price-attrs.ts
git commit -m "chore: add Appwrite attrs for Duffel offer caching"
```

---

## Task 2: Rewrite price refresh cron to use Duffel

Replace the Travelpayouts-based price cron with Duffel-powered searches. Process 8 destinations per invocation within the 10s Vercel hobby timeout.

**Files:**
- Modify: `api/prices/refresh.ts` (full rewrite of `refreshOrigin` and batch logic)
- Read: `services/duffel.ts` (use `searchFlights`)

**Step 1: Write the test**

Create `__tests__/api/prices-refresh-duffel.test.ts` that:
- Mocks Duffel `searchFlights` to return a fake offer
- Mocks Appwrite `listDocuments` / `updateDocument` / `createDocument`
- Verifies the cron calls Duffel for each destination in the batch
- Verifies it stores `offer_json`, `offer_expires_at`, `source: 'duffel'`
- Verifies it processes only 8 destinations per batch
- Verifies round-robin origin selection still works

Key mock setup:
```typescript
jest.mock('../../services/duffel', () => ({
  searchFlights: jest.fn().mockResolvedValue({
    offers: [{
      id: 'off_test123',
      total_amount: '327.10',
      total_currency: 'USD',
      base_amount: '265.10',
      tax_amount: '62.00',
      expires_at: '2026-03-08T15:00:00Z',
      slices: [{
        segments: [{
          operating_carrier: { name: 'Test Air', iata_code: 'TA' },
          operating_carrier_flight_number: '1234',
          departing_at: '2026-06-13T08:00:00',
          arriving_at: '2026-06-13T18:00:00',
          origin: { iata_code: 'JFK' },
          destination: { iata_code: 'CDG' },
        }],
      }, {
        segments: [{
          operating_carrier: { name: 'Test Air', iata_code: 'TA' },
          operating_carrier_flight_number: '1235',
          departing_at: '2026-06-20T10:00:00',
          arriving_at: '2026-06-20T20:00:00',
          origin: { iata_code: 'CDG' },
          destination: { iata_code: 'JFK' },
        }],
      }],
      passengers: [{ id: 'pas_001', type: 'adult' }],
      owner: { name: 'Test Air', iata_code: 'TA' },
    }],
  }),
}));
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern prices-refresh-duffel`
Expected: FAIL (module not found or assertion failures)

**Step 3: Rewrite `api/prices/refresh.ts`**

Key changes to the existing file:

1. **Replace Travelpayouts/Amadeus imports** with Duffel:
```typescript
import { searchFlights } from '../../services/duffel';
```

2. **Add batch size constant:**
```typescript
const BATCH_SIZE = 8; // fits in 10s Vercel hobby timeout (~1.2s per Duffel search)
```

3. **Replace `refreshOrigin`** with `refreshBatch` that:
   - Takes a list of IATA codes (batch of 8)
   - For each destination, calls `searchFlights({ origin, destination: iata, departureDate: flexDate, returnDate: flexReturn, passengers: [{ type: 'adult' }] })`
   - Uses flexible dates: search 2-4 weeks out, pick cheapest
   - Extracts from cheapest offer: price, airline, flight number, dates, full offer JSON
   - Upserts into `cached_prices` with `source: 'duffel'`, `offer_json`, `offer_expires_at`
   - Wraps each search in try/catch (one failure shouldn't kill the batch)

4. **Date strategy for discovery:**
   - Departure: 14 days from now (weekday for cheaper fares)
   - Return: departure + 7 days
   - This gives realistic round-trip pricing

5. **Keep existing price history tracking** (previous_price, price_direction)

6. **Keep Travelpayouts as fallback** for when Duffel fails or is rate-limited:
```typescript
// If Duffel fails for a destination, try Travelpayouts as fallback
if (!duffelResult) {
  const tpResult = await fetchCheapPrices(origin, iata);
  if (tpResult) { /* upsert with source: 'travelpayouts' */ }
}
```

7. **Handler changes:**
   - Pick next batch of 8 destinations that are stalest (not origins — destinations)
   - Track which destinations were last refreshed
   - Single origin per invocation (round-robin across origins across invocations)

Full `refreshBatch` implementation:

```typescript
async function refreshBatch(
  origin: string,
  batch: string[],
  currentPriceMap: Map<string, { price: number; docId: string }>,
): Promise<{ fetched: number; sources: Record<string, number> }> {
  const sources: Record<string, number> = { duffel: 0, travelpayouts: 0 };

  // Search dates: 2 weeks out, 7-night trip
  const depDate = new Date(Date.now() + 14 * 86400000);
  // Shift to next Wednesday (cheapest flights tend to be mid-week)
  const dayOfWeek = depDate.getDay();
  const daysToWed = (3 - dayOfWeek + 7) % 7 || 7;
  depDate.setDate(depDate.getDate() + daysToWed);
  const retDate = new Date(depDate.getTime() + 7 * 86400000);

  const departureDate = depDate.toISOString().slice(0, 10);
  const returnDate = retDate.toISOString().slice(0, 10);

  for (const iata of batch) {
    try {
      const result = await searchFlights({
        origin,
        destination: iata,
        departureDate,
        returnDate,
        passengers: [{ type: 'adult' }],
        cabinClass: 'economy',
      });

      const offers = result.offers ?? [];
      if (offers.length === 0) continue;

      // Sort by price, take cheapest
      const sorted = [...offers].sort(
        (a, b) => parseFloat(String(a.total_amount)) - parseFloat(String(b.total_amount)),
      );
      const best = sorted[0];
      const price = Math.round(parseFloat(String(best.total_amount)));
      const outSlice = best.slices?.[0];
      const firstSeg = outSlice?.segments?.[0];
      const airline = firstSeg?.operating_carrier?.name ?? best.owner?.name ?? '';
      const flightNumber = firstSeg?.operating_carrier_flight_number ?? '';
      const depDateActual = firstSeg?.departing_at?.split('T')[0] ?? departureDate;
      const retSlice = best.slices?.[1];
      const retSeg = retSlice?.segments?.[0];
      const retDateActual = retSeg?.departing_at?.split('T')[0] ?? returnDate;

      // Price history tracking
      const existing = currentPriceMap.get(iata);
      let priceDirection: 'up' | 'down' | 'stable' = 'stable';
      const prevPrice = existing?.price;
      if (prevPrice != null && prevPrice > 0) {
        const pctChange = (price - prevPrice) / prevPrice;
        if (pctChange > 0.05) priceDirection = 'up';
        else if (pctChange < -0.05) priceDirection = 'down';
      }

      const tripDays = Math.round(
        (new Date(retDateActual).getTime() - new Date(depDateActual).getTime()) / 86400000,
      );

      // Serialize minimal offer data for tap-through (strip heavy fields)
      const offerJson = JSON.stringify({
        id: best.id,
        total_amount: best.total_amount,
        total_currency: best.total_currency,
        expires_at: best.expires_at,
        slices: best.slices?.map((s: any) => ({
          origin: s.origin?.iata_code ?? s.segments?.[0]?.origin?.iata_code,
          destination: s.destination?.iata_code ?? s.segments?.[0]?.destination?.iata_code,
          segments: s.segments?.map((seg: any) => ({
            airline: seg.operating_carrier?.name,
            airline_code: seg.operating_carrier?.iata_code,
            flight_number: seg.operating_carrier_flight_number,
            departing_at: seg.departing_at,
            arriving_at: seg.arriving_at,
            aircraft: seg.aircraft?.name,
            origin: seg.origin?.iata_code,
            destination: seg.destination?.iata_code,
          })),
        })),
        passengers: best.passengers?.map((p: any) => ({ id: p.id, type: p.type })),
      });

      const data: Record<string, unknown> = {
        origin,
        destination_iata: iata,
        price,
        currency: 'USD',
        airline,
        flight_number: flightNumber,
        source: 'duffel',
        fetched_at: new Date().toISOString(),
        departure_date: depDateActual,
        return_date: retDateActual,
        trip_duration_days: tripDays,
        previous_price: prevPrice ?? 0,
        price_direction: priceDirection,
        offer_json: offerJson,
        offer_expires_at: best.expires_at ?? '',
      };

      if (existing) {
        await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.cachedPrices, existing.docId, data);
      } else {
        await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.cachedPrices, ID.unique(), data);
      }
      sources.duffel++;
    } catch (err) {
      console.warn(`[refresh] Duffel search failed for ${origin}->${iata}:`, err);
      // Fallback: try Travelpayouts for this route
      try {
        const tp = await fetchCheapPrices(origin, iata);
        if (tp) {
          const existing = currentPriceMap.get(iata);
          const data: Record<string, unknown> = {
            origin,
            destination_iata: iata,
            price: tp.price,
            currency: 'USD',
            airline: tp.airline,
            source: 'travelpayouts',
            fetched_at: new Date().toISOString(),
            departure_date: tp.departureAt?.split('T')[0] ?? '',
            return_date: tp.returnAt?.split('T')[0] ?? '',
            previous_price: existing?.price ?? 0,
            price_direction: 'stable',
          };
          if (existing) {
            await serverDatabases.updateDocument(DATABASE_ID, COLLECTIONS.cachedPrices, existing.docId, data);
          } else {
            await serverDatabases.createDocument(DATABASE_ID, COLLECTIONS.cachedPrices, ID.unique(), data);
          }
          sources.travelpayouts++;
        }
      } catch { /* silent — both sources failed for this route */ }
    }
  }

  return { fetched: sources.duffel + sources.travelpayouts, sources };
}
```

Handler rewrite — destination-based batching:
```typescript
// In handler():
const allIatas = destResult.documents.map((d) => d.iata_code as string);

// Pick origin (round-robin across origins)
const origins = originParam ? [originParam] : await pickNextOrigins(1);
const origin = origins[0];

// Find stalest destinations for this origin
const currentResult = await serverDatabases.listDocuments(DATABASE_ID, COLLECTIONS.cachedPrices, [
  Query.equal('origin', origin),
  Query.orderAsc('fetched_at'),
  Query.limit(500),
]);

const refreshedSet = new Set(currentResult.documents.map((d) => d.destination_iata as string));
const currentPriceMap = new Map<string, { price: number; docId: string }>();
for (const cp of currentResult.documents) {
  currentPriceMap.set(cp.destination_iata as string, {
    price: cp.price as number,
    docId: cp.$id,
  });
}

// Never-refreshed first, then stalest
const neverRefreshed = allIatas.filter((i) => !refreshedSet.has(i));
const staleFirst = currentResult.documents.map((d) => d.destination_iata as string);
const ordered = [...neverRefreshed, ...staleFirst.filter((i) => !neverRefreshed.includes(i))];
const batch = ordered.slice(0, BATCH_SIZE);

const result = await refreshBatch(origin, batch, currentPriceMap);
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern prices-refresh-duffel`
Expected: PASS

**Step 5: Run full test suite**

Run: `npm test`
Expected: All existing tests still pass

**Step 6: Commit**

```bash
git add api/prices/refresh.ts __tests__/api/prices-refresh-duffel.test.ts
git commit -m "feat: rewrite price cron to use Duffel for live feed prices"
```

---

## Task 3: Update cron schedule to every 30 minutes

**Files:**
- Modify: `vercel.json` (line 41)

**Step 1: Update the schedule**

Change the prices/refresh cron from daily to every 30 minutes:

```json
{
  "path": "/api/prices/refresh",
  "schedule": "*/30 * * * *"
}
```

Keep the other crons unchanged.

**Step 2: Commit**

```bash
git add vercel.json
git commit -m "chore: run price refresh every 30min for live Duffel prices"
```

---

## Task 4: Update feed to return Duffel offer metadata

The feed already returns `departureDate`, `returnDate`, `airline` from cached prices. But we need to also pass through `offer_json` and `offer_expires_at` so the booking flow can pre-populate.

**Files:**
- Modify: `api/feed.ts` (lines 349-358, toFrontend lines 373-410)
- Modify: `types/destination.ts`
- Modify: `app-v2/src/api/types.ts`

**Step 1: Add `offerJson` and `offerExpiresAt` to both Destination types**

In `types/destination.ts`, add after line 53 (`previousPrice`):
```typescript
  offerJson?: string;
  offerExpiresAt?: string;
```

In `app-v2/src/api/types.ts`, add after line 50 (`previousPrice`):
```typescript
  offerJson?: string;
  offerExpiresAt?: string;
```

**Step 2: Update feed price merging**

In `api/feed.ts`, in the price merge section (around line 349-358), ensure `offer_json` and `offer_expires_at` are included in the `lp` (live price) object that's read from `cached_prices`.

The `priceMap` is built from cached_prices documents. Check how it's constructed and ensure `offer_json` and `offer_expires_at` fields are passed through.

**Step 3: Update `toFrontend()` in `api/feed.ts`**

After line 408 (`previousPrice`), add:
```typescript
    offerJson: d.offer_json || undefined,
    offerExpiresAt: d.offer_expires_at || undefined,
```

**Step 4: Run tests**

Run: `npm test`
Expected: All pass (feed tests should still work since new fields are optional)

**Step 5: Commit**

```bash
git add types/destination.ts app-v2/src/api/types.ts api/feed.ts
git commit -m "feat: pass Duffel offer metadata through feed response"
```

---

## Task 5: Update feed card to show flight details

Show dates and airline on the feed card price pill.

**Files:**
- Modify: `app-v2/src/screens/FeedScreen.tsx` (lines 163-208, the price pill)

**Step 1: Enhance the price pill**

Replace the simple "From / $XXX / LIVE PRICE" pill with:
```
$327 · Jun 13–20 · Icelandair
LIVE PRICE
```

When dates/airline are available (priceSource !== 'estimate'), show them. Otherwise keep the current "From $XXX EST." format.

```tsx
{/* Price pill */}
<div style={{
  position: 'absolute', bottom: 88, left: 20,
  display: 'flex', flexDirection: 'column', gap: 4,
  paddingBlock: 10, paddingInline: 18, borderRadius: 16,
  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  backgroundColor: '#2C1F1AE6', border: '1px solid #FFFFFF1A',
}}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{
      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
      fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
      lineHeight: '26px', color: colors.sunriseButter,
    }}>
      ${destination.flightPrice}
    </span>
    {destination.departureDate && destination.returnDate && (
      <span style={{
        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
        fontSize: 11, lineHeight: '14px', color: '#FFFFFFAA',
      }}>
        {new Date(destination.departureDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        {' – '}
        {new Date(destination.returnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </span>
    )}
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    {destination.airline && (
      <span style={{
        fontFamily: `"${fonts.body}", system-ui, sans-serif`,
        fontSize: 10, lineHeight: '12px', color: '#FFFFFF80',
      }}>
        {destination.airline}
      </span>
    )}
    <span style={{
      fontFamily: `"${fonts.body}", system-ui, sans-serif`,
      fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', lineHeight: '12px',
      color: destination.priceSource === 'estimate' ? '#FFFFFF60' : colors.confirmGreen,
    }}>
      {destination.priceSource !== 'estimate' ? 'LIVE' : 'EST.'}
    </span>
  </div>
</div>
```

**Step 2: Verify visually**

Run: `cd app-v2 && npm run dev`
Check: Feed cards show price + dates + airline when live data exists.

**Step 3: Commit**

```bash
git add app-v2/src/screens/FeedScreen.tsx
git commit -m "feat: show flight dates and airline on feed cards"
```

---

## Task 6: Pre-populate booking with cached offer

When user taps a destination and enters booking, pass the cached offer so FlightSelectionScreen shows it immediately.

**Files:**
- Modify: `app-v2/src/stores/bookingStore.ts` — add `cachedOffer` field
- Modify: `app-v2/src/screens/DestinationDetailScreen.tsx` — pass cached offer to store
- Modify: `app-v2/src/screens/FlightSelectionScreen.tsx` — show cached offer as "Best Deal"

**Step 1: Add `cachedOfferJson` to bookingStore**

In bookingStore, add a field to store the cached offer from the feed:
```typescript
cachedOfferJson: string | null;
setCachedOffer: (json: string | null) => void;
```

**Step 2: Pass cached offer from DestinationDetailScreen**

In `handleBooking()`, after `setBookingDestination()`:
```typescript
const handleBooking = () => {
  if (!session?.userId) {
    navigate('/login', { state: { returnTo: `/destination/${stubDest.id}` } });
    return;
  }
  setBookingDestination(stubDest.id, stubDest.flightPrice);
  // Pass cached Duffel offer if available
  useBookingStore.getState().setCachedOffer(stubDest.offerJson ?? null);
  navigate('/booking/flights');
};
```

**Step 3: Show cached offer in FlightSelectionScreen**

At the top of the offers list, if `cachedOfferJson` is present and not expired, parse and display it as a highlighted "Best Deal" card before the live search results load.

This gives instant feedback — user sees the exact deal from the feed while the live search runs in background.

**Step 4: Run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: All pass

**Step 5: Commit**

```bash
git add app-v2/src/stores/bookingStore.ts app-v2/src/screens/DestinationDetailScreen.tsx app-v2/src/screens/FlightSelectionScreen.tsx
git commit -m "feat: pre-populate booking with cached Duffel offer from feed"
```

---

## Task 7: Expand destinations from 50 to 150+

**Files:**
- Create: `data/destinations-v2.ts` — 100+ new destinations
- Create: `scripts/seed-destinations-v2.ts` — upsert new destinations into Appwrite

**Step 1: Create expanded destination data**

Add ~100 new destinations covering underrepresented regions. Each needs:
- `id`, `iataCode`, `city`, `country`, `tagline`, `description`
- `vibeTags` (2-4 tags), `bestMonths`, `averageTemp`
- `flightPrice` (seed estimate), `hotelPricePerNight`
- `flightDuration` (from JFK), `latitude`, `longitude`

**Regions to fill:**
- **Southeast Asia** (10): Ho Chi Minh, Hanoi, Phnom Penh, Kuala Lumpur, Manila, Chiang Mai, Lombok, Siem Reap, Luang Prabang, Yangon
- **South America** (10): Buenos Aires, Santiago, Cartagena, Cusco, Medellin, Quito, Montevideo, La Paz, Salvador, Florianópolis
- **Europe depth** (15): Prague, Budapest, Dubrovnik, Edinburgh, Marrakech (close enough), Vienna, Berlin, Amsterdam, Copenhagen, Stockholm, Oslo, Helsinki, Tallinn, Riga, Vilnius
- **Middle East/Africa** (10): Dubai, Doha, Muscat, Cape Town, Nairobi, Zanzibar, Cairo, Johannesburg, Addis Ababa, Casablanca
- **Caribbean/Central Am** (10): Havana, San Juan, Cancun, Cartagena, Panama City, Guatemala City, Belize City, Nassau, Aruba, Curaçao
- **North America depth** (10): Montreal, Vancouver, Banff, Honolulu, Anchorage, Nashville, Charleston, Savannah, Sedona, Aspen
- **Asia depth** (10): Seoul, Taipei, Hong Kong, Osaka, Kyoto, Phuket, Da Nang, Kathmandu, Sri Lanka (Colombo), Bhutan (Paro)
- **Oceania** (5): Sydney, Melbourne, Auckland, Queenstown, Fiji (Nadi)

Pattern per entry:
```typescript
{
  id: 'v2-51',
  iataCode: 'PRG',
  city: 'Prague',
  country: 'Czech Republic',
  tagline: 'Fairy-tale spires and craft beer at every corner.',
  description: 'Prague offers centuries of architecture...',
  vibeTags: ['culture', 'historic', 'nightlife', 'budget'],
  bestMonths: ['Apr', 'May', 'Sep', 'Oct'],
  averageTemp: 12,
  flightPrice: 420,
  hotelPricePerNight: 65,
  flightDuration: '9h 30m',
  currency: 'USD',
  latitude: 50.0755,
  longitude: 14.4378,
}
```

**Step 2: Create seed script**

Pattern follows existing `scripts/seed-destinations.ts`:
- Reads destinations-v2.ts
- For each: check if iata_code exists in Appwrite, skip if so
- Create document with `is_active: true`
- Handle 409 (already exists) gracefully

**Step 3: Run the seed**

Run: `npx tsx scripts/seed-destinations-v2.ts`
Expected: 80-100 new destinations created

**Step 4: Commit**

```bash
git add data/destinations-v2.ts scripts/seed-destinations-v2.ts
git commit -m "feat: expand destination catalog to 150+ cities"
```

---

## Task 8: Update images cron for multiple images per destination

The image cron already fetches 5 images per destination (`IMAGES_PER_DEST = 5` on line 11 of `api/images/refresh.ts`). But the feed only uses the primary image. We need the feed and detail pages to use multiple images.

**Files:**
- Modify: `api/feed.ts` — return all image URLs (not just primary)
- Modify: `app-v2/src/screens/FeedScreen.tsx` — optional: cycle through images or show gallery dots

**Step 1: Check how images are joined in feed.ts**

Read the image-joining logic in `api/feed.ts`. Currently it likely only takes the primary image. Update to return all image URLs as `imageUrls` array.

Look for where `destination_images` is queried and `image_url` / `image_urls` is set. Update the merge logic to collect all images for each destination (grouped by `destination_id`, sorted by `is_primary` desc).

**Step 2: Update toFrontend**

Ensure `imageUrls` includes all 5 image URLs (primary first), and `imageUrl` remains the primary for backward compat.

**Step 3: Trigger a full image refresh**

Run: `curl -H "Authorization: Bearer $CRON_SECRET" "https://sogojet.com/api/images/refresh?force=true"`

This will re-fetch 5 images per destination for all 150+ destinations.

**Step 4: Commit**

```bash
git add api/feed.ts
git commit -m "feat: return multiple images per destination in feed"
```

---

## Task 9: Upgrade feed scoring algorithm

Add freshness-aware scoring so destinations with fresh Duffel prices rank higher.

**Files:**
- Modify: `utils/scoreFeed.ts`

**Step 1: Add freshness and deal quality factors**

Update the scoring formula:

```typescript
// Current weights:
// priceScore * 0.35 - regionPenalty * 0.30 - vibePenalty * 0.10 + preferenceBoost * 0.25

// New weights:
// priceScore * 0.25
// - regionPenalty * 0.25
// - vibePenalty * 0.10
// + preferenceBoost * 0.20
// + freshnessBoost * 0.15  (NEW: boost destinations with recent Duffel prices)
// + dealBoost * 0.05       (NEW: boost price drops)
```

Freshness calculation:
```typescript
function getFreshnessBoost(dest: Destination): number {
  if (!dest.priceFetchedAt) return 0; // no live price = no boost
  const ageMs = Date.now() - new Date(dest.priceFetchedAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours < 1) return 1.0;   // <1hr: full boost
  if (ageHours < 4) return 0.7;   // <4hr: good
  if (ageHours < 12) return 0.4;  // <12hr: ok
  if (ageHours < 24) return 0.2;  // <24hr: stale-ish
  return 0;                        // >24hr: no boost
}

function getDealBoost(dest: Destination): number {
  if (dest.priceDirection === 'down') return 1.0;  // price dropped
  if (dest.priceDirection === 'stable') return 0.3;
  return 0; // price went up
}
```

**Step 2: Update existing tests**

In `__tests__/scoreFeed.test.ts`, update assertions to account for new weights. Add test:
- Destination with fresh Duffel price ranks higher than one with stale estimate
- Destination with price drop ranks higher than price increase

**Step 3: Run tests**

Run: `npm test -- --testPathPattern scoreFeed`
Expected: PASS

**Step 4: Commit**

```bash
git add utils/scoreFeed.ts __tests__/scoreFeed.test.ts
git commit -m "feat: add freshness and deal quality to feed scoring"
```

---

## Task 10: End-to-end verification and deploy

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run Appwrite migrations**

```bash
npx tsx scripts/setup-duffel-price-attrs.ts
npx tsx scripts/seed-destinations-v2.ts
```

**Step 4: Push and deploy**

```bash
git push origin main
```

Wait for Vercel to deploy.

**Step 5: Trigger initial price refresh**

```bash
# Trigger price refresh for JFK
curl -H "Authorization: Bearer $CRON_SECRET" "https://sogojet.com/api/prices/refresh?origin=JFK"
```

Wait ~10s, then check feed:
```bash
curl "https://sogojet.com/api/feed?origin=JFK" | jq '.destinations[0] | {city, flightPrice, priceSource, departureDate, airline}'
```

Expected: Real Duffel prices with dates and airline names.

**Step 6: Trigger image refresh for new destinations**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://sogojet.com/api/images/refresh?force=true"
```

**Step 7: Visual verification**

Open https://sogojet.com and verify:
- Feed cards show live prices with dates and airline
- Tapping a destination shows the same price
- Booking flow pre-populates with the cached offer
- New destinations appear in feed

**Step 8: Final commit (if any fixes needed)**

```bash
git add -A && git commit -m "fix: e2e verification fixes" && git push origin main
```

---

## Execution Order Summary

| Task | Description | Depends on |
|------|-------------|------------|
| 1 | Appwrite attrs for offer caching | — |
| 2 | Rewrite price cron to Duffel | Task 1 |
| 3 | Update cron schedule (30 min) | Task 2 |
| 4 | Feed returns offer metadata | Task 2 |
| 5 | Feed card shows dates/airline | Task 4 |
| 6 | Booking pre-populates cached offer | Task 4, 5 |
| 7 | Expand destinations to 150+ | — (parallel with 1-6) |
| 8 | Multiple images in feed | — (parallel) |
| 9 | Upgrade feed scoring | Task 4 |
| 10 | E2E verification + deploy | All |

**Parallelizable:** Tasks 7 and 8 can run in parallel with tasks 1-6.
