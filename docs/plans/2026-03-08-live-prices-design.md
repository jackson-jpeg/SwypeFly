# Live Duffel Prices + Feed Upgrade Design

**Date:** 2026-03-08
**Status:** Approved

## Problem

Feed cards show cached/estimated prices from Travelpayouts or seed data. When users tap "Book", Duffel returns a completely different live price. This breaks trust — the price on the card should BE the deal.

Additionally: one image per destination, only 50 destinations, no real personalization.

## Solution Overview

Replace Travelpayouts with Duffel as the primary feed price source. Cache full offer details (price, dates, airline) so feed cards show real bookable flights. Expand to 150+ destinations with 5 images each. Improve feed scoring to prioritize fresh deals.

## Architecture

### Price Refresh Pipeline

```
Cron (every 30 min)
  → Pick next batch of ~8 destinations (rotate through all)
  → For each: Duffel offerRequests.create(origin, dest, flexible dates)
  → Cache cheapest offer: price, dates, airline, flight number, offer JSON
  → Store in cached_prices with source='duffel', fetched_at=now
  → Track batch cursor in a simple rotation (batch_index in cached state)
```

**Batch sizing for Vercel Hobby (10s timeout):**
- Each Duffel search takes ~1-1.5s
- 8 destinations × 1.2s avg = ~10s (safe margin)
- 50 destinations ÷ 8 = 7 batches × 30 min = 3.5 hour full rotation
- When upgrading to Vercel Pro (60s): batch size → 50, full refresh every 30 min

**Origin strategy:**
- Default origins: JFK, LAX, ORD, ATL (covers most US demand)
- Rotate through origins across cron invocations
- Each origin gets full destination rotation before moving to next
- Priority: most-used departure codes first

### Feed Response Changes

Current feed response per destination:
```json
{ "flightPrice": 327, "priceSource": "estimate" }
```

New feed response:
```json
{
  "flightPrice": 327,
  "priceSource": "duffel",
  "departureDate": "2026-06-13",
  "returnDate": "2026-06-20",
  "airline": "Icelandair",
  "flightNumber": "FI 614",
  "priceFetchedAt": "2026-03-08T14:30:00Z",
  "offerExpiresAt": "2026-03-08T15:00:00Z"
}
```

### Booking Flow Integration

When user taps a destination and enters booking:
1. Pass cached offer metadata (dates, price) to FlightSelectionScreen
2. Show cached offer as "Best Deal" card at top (if <30 min old)
3. Run live Duffel re-search in background for more date options
4. Live results appear below as "Other flights available"
5. If cached offer expired, live search is the only source (slight delay)

### Multiple Images

Current: 1 Unsplash image per destination.

Change:
- Fetch 5 images per destination from Unsplash
- Store as JSON array in `destination_images` collection
- Feed card shows hero image (index 0)
- Detail page shows image gallery (all 5)
- Cron: `api/images/refresh.ts` updated to request 5 per query

### Destination Expansion (50 → 150+)

New seed data covering:
- **North America**: More US cities, Mexico, Caribbean, Canada
- **Europe**: Eastern Europe, Scandinavia, smaller gems
- **Asia**: Southeast Asia, Japan, Korea, India
- **South America**: Brazil, Argentina, Colombia, Peru, Chile
- **Middle East/Africa**: Morocco, Egypt, UAE, South Africa, Kenya

Each destination requires: city, country, IATA code, lat/lng, vibe tags, description, best months.

### Feed Algorithm Upgrade

Current: generic weighted score (price + rating + diversity).

New scoring factors:
- **Price freshness**: Boost destinations with Duffel offers <4 hours old
- **Deal quality**: Lower price relative to historical average = bigger boost
- **Vibe match**: User's saved/swiped vibes weighted against destination vibes
- **Staleness penalty**: Destinations with no fresh price get pushed down (not hidden)
- **Diversity**: Same region/vibe penalty (keep current logic)
- **Exploration bonus**: Small random factor for discovery

## Database Changes

### cached_prices collection (modified)

Add fields:
- `offer_json` (string, 10000) — full Duffel offer response for tap-through
- `airline` (string, 100)
- `flight_number` (string, 20)
- `departure_date` (string, 20)
- `return_date` (string, 20)
- `offer_expires_at` (string, 30)
- `batch_index` (integer) — tracks rotation cursor

### destination_images collection (modified)

Change from single image to array:
- `images_json` (string, 5000) — JSON array of up to 5 image URLs + photographer credits

## Vercel Hobby Constraints

| Constraint | Limit | Our usage |
|------------|-------|-----------|
| Function timeout | 10s | 8 Duffel calls × ~1.2s = ~10s |
| Cron frequency | 1/min minimum | Every 30 min |
| Duffel rate limit | 60 req/min | 8 per invocation (well under) |
| Monthly function invocations | 100k | ~1,440 cron + user traffic (fine) |

## Files Modified

| File | Change |
|------|--------|
| `api/prices/refresh.ts` | Rewrite: Duffel batch search, rotation logic |
| `api/feed.ts` | Return offer metadata (dates, airline, freshness) |
| `api/destination.ts` | Include cached offer in detail response |
| `api/booking.ts` | Accept cached offer context for pre-population |
| `api/images/refresh.ts` | Fetch 5 images per destination |
| `app-v2/src/api/types.ts` | Add offer fields to Destination type |
| `app-v2/src/components/FeedCard.tsx` (or equivalent) | Show dates + airline on card |
| `app-v2/src/screens/FlightSelectionScreen.tsx` | Pre-populate with cached offer |
| `app-v2/src/screens/DestinationDetailScreen.tsx` | Pass cached offer to booking |
| `scripts/setup-cached-price-attrs.ts` | NEW: add Duffel offer fields to cached_prices |
| `scripts/seed-destinations-v2.ts` | NEW: seed 150+ destinations |
| `data/destinations-v2.ts` | NEW: expanded destination data |
| `vercel.json` | Update cron schedule to every 30 min |
| `types/destination.ts` | Add offer metadata fields |
| `utils/scoreFeed.ts` | Enhanced scoring with freshness + deal quality |
