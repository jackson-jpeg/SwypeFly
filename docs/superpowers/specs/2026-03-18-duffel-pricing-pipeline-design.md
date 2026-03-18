# Duffel-Only Pricing Pipeline — Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Blocks:** Booking flow restoration (separate spec)

---

## Overview

Replace the Travelpayouts-primary pricing pipeline with Duffel-only pricing. Users see real bookable prices — no bait-and-switch. Two tiers: background cron pre-fills feed prices every 6 hours, live Duffel search on tap guarantees the price shown is bookable.

**Revenue model:** Pass-through pricing. User pays the exact Duffel price. SoGoJet earns Duffel's built-in airline commission (1-3% per booking). No markup or service fee in V1.

---

## 1. Background Cron (Every 6 Hours)

**File:** `api/prices/refresh.ts` (modify existing)

### Changes

- **Remove Travelpayouts bulk phase entirely.** No more `fetchAllCheapPrices()` or `fetchCheapPrices()` calls.
- **Duffel-only searches.** Keep the existing Duffel search logic (concurrent batches, round-robin origins, compact offer JSON caching).
- **Increase batch size.** Vercel Pro gives 300s timeout (vs 60s Hobby). Increase from 20 to 40 destinations per run. At 5 concurrent × ~3s per search = ~24s per batch of 5 → 8 batches = ~25s search time + DB overhead ≈ ~60s total. Well within 300s.
- **Keep round-robin origin rotation.** Picks the origin with stalest prices. With 5-10 origins and 40 dests/run, full coverage in ~4-5 cron cycles (~24-30 hours).
- **Keep price direction tracking** (up/down/stable vs previous price).
- **Keep compact offer JSON caching** in `cached_prices.offer_json`.

### Cron Schedule

Change from `0 6 * * *` (once daily) to `0 */6 * * *` (every 6 hours) in `vercel.json`.

### What's Removed

- `fetchAllCheapPrices()` call (TP bulk)
- `fetchCheapPrices()` fallback (TP single route)
- `tp_found_at` field usage (keep in schema for now, just stop writing to it)
- Travelpayouts as a price source in the cron

---

## 2. Live Search on Tap

**File:** `api/search.ts` (new endpoint)

### Endpoint

`GET /api/search?origin=JFK&destination=LIM`

### Behavior

1. Check `cached_prices` for a Duffel result < 30 min old for this origin+destination pair.
2. If fresh cache exists → return it immediately.
3. If no cache or stale → call Duffel `searchFlights()` live.
   - Search params: origin, destination, ~2 weeks out (next Wednesday), 5-7 day trip, 1 passenger, economy.
   - Return the cheapest offer.
4. Cache the result in `cached_prices` (upsert) with `source='duffel'`.
5. Return the full offer details to the client.

### Response Shape

```json
{
  "price": 310,
  "currency": "USD",
  "airline": "Avianca",
  "airlineCode": "AV",
  "flightDuration": "7h 10m",
  "departureDate": "2026-04-02",
  "returnDate": "2026-04-09",
  "tripDays": 7,
  "offerJson": { "id": "...", "total_amount": "310.00", ... },
  "offerExpiresAt": "2026-04-08T...",
  "cached": false
}
```

### Error Handling

- Duffel search fails → return `{ error: "No flights found", fallback: true }`. Client shows "No flights available for these dates" instead of a price.
- Duffel rate limited → return 429 with retry-after header.

### Validation

Zod schema in `utils/validation.ts`:
```typescript
searchQuerySchema = z.object({
  origin: z.string().length(3),
  destination: z.string().length(3),
});
```

---

## 3. Feed Card Changes

### Swipe Feed (`components/swipe/SwipeCard.tsx`)

- **Has cached Duffel price (≤24h):** Show "From $293" in the price tag. Book button text → "View Deal".
- **No cached price:** Hide the price tag. Show "Check price" in place of the price. Book button text → "View Deal".
- **Tapping the card** still navigates to detail page (no change to navigation, but detail page now does the live search).

### Board View (`components/board/DepartureRow.tsx`)

- **Has cached Duffel price:** Show the price as before ($293 in the price column).
- **No cached price:** Show "—" in the price column, status column shows "CHECK".

### dealStore Changes (`stores/dealStore.ts`)

- `apiToBoardDeal()` transform: if `flightPrice` is null/0 and `priceSource` is not 'duffel', set `priceFormatted` to "Check" and `status` to a new display-only state.
- Feed API already returns `priceSource` field — use it to distinguish Duffel vs estimate.

---

## 4. Detail Page Changes

**File:** `app/destination/[id].tsx` (modify existing)

### On Mount

1. Show destination info (photo, vibes, description) immediately from the feed data passed via navigation params.
2. Call `GET /api/search?origin={departureCode}&destination={iataCode}` for live Duffel price.
3. While loading: show skeleton price card (pulsing animation).
4. On success: show real price + "Book This Flight — $310" CTA.
5. On failure: show "No flights available" message with a "Try different dates" note.

### CTA Behavior

- "Book This Flight — $310" → navigates to booking flow (sub-project 2). Until booking flow is restored, this button is **disabled with "Coming soon"** text.
- Keep the existing "Save" heart button.
- Remove the Aviasales affiliate link as the primary CTA. (Can keep as a secondary "Compare prices" link if desired.)

---

## 5. API Pipeline Changes

### `api/feed.ts`

- `toFrontend()` still returns `flightPrice`, `priceSource`, `departureDate`, etc.
- No code changes needed — the data in `cached_prices` will just be Duffel-only after the cron change.
- Destinations without any cached price naturally return `flightPrice: null, priceSource: 'estimate'`.

### `services/travelpayouts.ts`

- **No changes.** Keep the file — it's used by `api/prices/refresh-hotels.ts` and the budget discovery endpoint. Just stop calling it from the main price cron.

---

## 6. Environment & Config Changes

### `vercel.json`

Cron schedule change:
```json
{ "path": "/api/prices/refresh", "schedule": "0 */6 * * *" }
```

### Vercel Pro Settings

- Function timeout: 300s (set in `vercel.json` or project settings)
- Cron: every 6 hours (4 runs/day)

---

## Explicitly Out of Scope

- Booking flow (separate spec, blocked on this)
- Multi-passenger search
- Flexible date search
- Hotel pricing changes
- Removing `services/travelpayouts.ts` (still used elsewhere)
- Service fee / markup (V2)
- Push notifications for price drops

---

## Dependencies

- `@duffel/api` — already installed
- `DUFFEL_API_KEY` — already set on Vercel production
- Vercel Pro — user confirmed they have it
- Appwrite — must be active (was just unpaused)

## New Files

1. `api/search.ts` — live Duffel search endpoint

## Modified Files

1. `api/prices/refresh.ts` — remove TP, increase batch size, change cron
2. `stores/dealStore.ts` — handle "Check price" state
3. `components/swipe/SwipeCard.tsx` — "From $X" / "Check price" display
4. `components/board/DepartureRow.tsx` — handle missing price
5. `app/destination/[id].tsx` — live search on mount, skeleton loading
6. `utils/validation.ts` — add search query schema
7. `vercel.json` — cron schedule update
