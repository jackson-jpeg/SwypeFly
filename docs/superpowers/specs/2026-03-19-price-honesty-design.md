# Kill the Bait-and-Switch: Price Honesty

**Date:** 2026-03-19
**Status:** Approved

## Problem

Feed cards show unreliable prices ($65 Miami, $440 Seoul) from stale/promotional sources. When users tap "Book $440", the live Duffel search returns $1,946 — a 4-5x gap. This is a bait-and-switch that destroys trust.

## Changes

### 1. Add `priceSource` to BoardDeal

**File:** `types/deal.ts`
Add `priceSource: string;` to the `BoardDeal` interface.

**File:** `stores/dealStore.ts`
In `apiToBoardDeal()`, pass through `d.priceSource || 'unknown'`.

### 2. Book button: drop the price

**File:** `components/swipe/SwipeCard.tsx`

Change line 183 from:
```
Book ${deal.priceFormatted}
```
To:
```
Search Flights
```

The card still shows the price in the top-right split-flap display — that's the discovery hook. But the action button no longer promises a specific price.

### 3. Hide price for estimate sources

**File:** `components/swipe/SwipeCard.tsx`

When `deal.priceSource === 'estimate'`, the top-right price tag should show "Check prices" instead of a dollar amount. These are not real prices.

### 4. Future-date guard on calendar pre-selection

**File:** `app/booking/[id]/dates.tsx`

Lines 62-63 already pass `deal?.departureDate` as `initialDepartureDate`. Add a guard: only pre-select if the date is in the future (today or later). If dates are in the past, pass `null`.

When cached dates ARE pre-selected, show hint text: "Dates matched to best price found"

### 5. Status badge: no false confidence for weak sources

**File:** `stores/dealStore.ts`

Change `getStatus()` function: if `priceSource` is `'estimate'` or `'amadeus'`, always return `'NEW'` — don't label these as `'DEAL'` or `'HOT'` since those prices are unreliable.

## Files Changed

| File | Change |
|------|--------|
| `types/deal.ts` | Add `priceSource: string` to BoardDeal |
| `stores/dealStore.ts` | Pass priceSource through, update getStatus() |
| `components/swipe/SwipeCard.tsx` | Button text → "Search Flights", hide price for estimates |
| `app/booking/[id]/dates.tsx` | Future-date guard, hint text |

## What stays the same

- Feed scoring/ordering
- Price refresh cron (every 6 hours)
- Booking flow (live Duffel search)
- The "wow" moment — card still shows "$440 to Seoul" for real prices
