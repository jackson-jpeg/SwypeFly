# Price Calendar System

**Date:** 2026-03-19
**Status:** Approved

## Problem

Feed cards show stale/promotional prices from mixed sources (estimates, Travelpayouts, Amadeus). When users book, live Duffel prices are 2-6x higher. This destroys trust.

## Solution

Two-tier pricing: Travelpayouts price calendar (free, broad, daily granularity) powers discovery. Duffel live search (accurate, real-time) powers booking. Users see real prices on cards and real prices on the calendar — no surprises.

## New Appwrite Collection: `price_calendar`

One document per origin-destination-date combination.

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `origin` | string | `JFK` | Departure airport |
| `destination_iata` | string | `ICN` | Arrival airport |
| `date` | string | `2026-04-02` | Departure date |
| `price` | number | `440` | Round-trip price USD |
| `return_date` | string | `2026-04-09` | Estimated return (departure_date + 7 days) |
| `trip_days` | number | `7` | Default 7 days (TP doesn't return return_date) |
| `airline` | string | `KE` | IATA airline code |
| `source` | string | `travelpayouts` | Price source |
| `fetched_at` | string | ISO timestamp | When this price was fetched |

**Indexes needed:**
- `origin` + `destination_iata` (composite) — for calendar lookups
- `origin` + `price` (composite, ascending) — for feed cheapest-per-destination
- `fetched_at` (ascending) — for staleness queries

**Composite key for upserts:** Match on `origin` + `destination_iata` + `date`. If doc exists, update. Else create.

## New Cron: `api/prices/refresh-calendar.ts`

**Schedule:** `0 */2 * * *` (every 2 hours)
**Max duration:** 300s (Pro plan)

### Algorithm

Each run processes **2 origins** (round-robin by staleness):

1. **Bulk discovery:** Call `fetchAllCheapPrices(origin)` — returns cheapest price to ALL destinations in one request. This is free and instant.

2. **Calendar fill:** For each destination that returned a price (typically 40-60):
   - Call `fetchPriceCalendar(origin, destination)` — returns daily prices for next 30 days
   - TP returns `{ departure_at, price, airline, transfers }` — no return date. Compute `return_date` as `departure_date + 7 days` and `trip_days = 7`.
   - Upsert each day's entry into `price_calendar`
   - Rate limit: batch 5 concurrent, **1200ms delay between batches** (TP rate limit is 60 req/min = 1 req/sec; 5 concurrent × 1.2s = safe margin)

3. **Staleness tracking:** After processing an origin, update a `fetched_at` on its calendar entries so the next run picks the stalest origins.

### Rate Budget

- 2 origins × 1 bulk call = 2 Travelpayouts requests
- 2 origins × ~50 destinations × 1 calendar call = ~100 requests
- At 5 concurrent with 1.2s delay: 100 requests / 5 × 1.2s = ~24 seconds networking + response time
- Total execution: ~60-90 seconds, well within 300s limit
- All 10 default origins refreshed every ~10 hours
- Each origin gets ~30 days of daily prices per refresh

### Origin Selection

Same `pickNextOrigins()` pattern as existing refresh.ts but reading staleness from `price_calendar` instead of `cached_prices`. Uses `DEFAULT_ORIGINS` + active user origins.

## No New API Endpoint Needed

The existing `GET /api/destination?action=calendar&origin=JFK&destination=ICN&month=2026-04` already serves calendar data to `DatePickerSheet`. The `handleCalendar()` function in `api/destination.ts` just needs its data source changed from live Travelpayouts to the `price_calendar` collection. Same endpoint, same response shape, faster response.

A `priceCalendarQuerySchema` already exists in `utils/validation.ts` — no new schema needed.

## Feed Changes: `api/feed.ts`

### New price source for cards

Replace the current `cached_prices` read with a `price_calendar` read:

1. Query `price_calendar` for this origin, where `date >= today`, sorted by price ascending, limit 500
2. Build a Map<destination_iata, { price, date, returnDate, airline, source }>  — keep only the cheapest per destination (first occurrence since sorted by price)
3. Merge into feed response as before, but now `flightPrice` = cheapest calendar price and new fields `cheapestDate` + `cheapestReturnDate` are included

### What stays

- `cached_prices` collection and its cron still run — needed for Duffel `offer_json` in the booking flow
- Hotel prices, images, scoring, personalization — unchanged
- The `live_price` field in ScoredDest gets populated from `price_calendar` instead of `cached_prices`

### New response fields

The `toFrontend()` function adds:
- `cheapestDate: string | undefined` — the departure date that has the cheapest price
- `cheapestReturnDate: string | undefined` — the return date for that cheapest price

## BoardDeal Type Changes

### `types/deal.ts`

Add:
```typescript
  cheapestDate: string;       // YYYY-MM-DD, the date with the cheapest price
  cheapestReturnDate: string; // YYYY-MM-DD
```

### `stores/dealStore.ts`

In `ApiDestination`, add `cheapestDate?: string` and `cheapestReturnDate?: string`.

In `apiToBoardDeal()`, pass through:
```typescript
  cheapestDate: d.cheapestDate || d.departureDate || '',
  cheapestReturnDate: d.cheapestReturnDate || d.returnDate || '',
```

## Booking Calendar UI Changes

**The calendar UI already exists.** `DatePickerSheet.tsx` already fetches prices from `/api/destination?action=calendar`, renders price dots with green/orange color coding, and shows the cheapest date. No new UI components needed.

### Data source change: `api/destination.ts` `handleCalendar()`

The existing `handleCalendar` calls Travelpayouts live on every calendar page view. Change it to read from the `price_calendar` Appwrite collection instead:

1. Query `price_calendar` where `origin` = param AND `destination_iata` = param AND `date` starts with `month` param (e.g., "2026-04")
2. Return the same response shape (`{ calendar: [...], cheapestDate, cheapestPrice }`) so `DatePickerSheet` works unchanged
3. Fallback: if no `price_calendar` data for this route, fall back to live Travelpayouts call (existing behavior)

This makes the calendar instant (DB read instead of API call) and consistent with the feed card price.

## SwipeFeed / SwipeCard Changes

### Book button pre-selection

In `components/swipe/SwipeFeed.tsx`, `handleBook` should pass the cheapest dates into the booking flow store:

```typescript
store.setDates(deal.cheapestDate, deal.cheapestReturnDate);
```

This ensures the calendar screen opens with the cheapest dates pre-selected, and the user immediately sees the price they expect.

## vercel.json

Add the new cron:
```json
{
  "path": "/api/prices/refresh-calendar",
  "schedule": "0 */2 * * *"
}
```

## Migration / Rollout

1. Create `price_calendar` collection in Appwrite with indexes
2. Deploy `refresh-calendar.ts` cron — starts populating data
3. Deploy calendar API endpoint
4. Once calendar has data (~24 hours of cron runs), switch feed to read from it
5. Deploy calendar UI in booking dates screen
6. Monitor: compare calendar prices vs Duffel live prices to measure gap

## Out of Scope

- Duffel-based calendar (too slow/expensive for bulk)
- Price alerts ("notify me when price drops")
- Multi-city or one-way pricing
- Hotel price calendar (separate feature)
- Removing `cached_prices` collection (still needed for Duffel offers)
