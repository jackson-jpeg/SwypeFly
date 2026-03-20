# "Your Trip" Screen — Replace Select Dates + Flight Selection

**Date:** 2026-03-20
**Status:** Approved

## Problem

The booking flow has two useless screens: a date picker calendar (ugly, slow, forces the user to pick dates when the app already knows the cheapest ones) and a flight selection screen (shows live Duffel prices that are higher than the feed price). The user already decided they want to go — just show them the best trip and let them book it.

## Solution

Replace the date picker and flight selection screens with a single "Your Trip" screen that shows the best deal as a complete trip card, with an expandable section for alternative dates.

**New flow:** Feed card → **Your Trip** → Passengers → Payment
**Old flow:** Feed card → Select Dates → Select Flight → Passengers → Payment

Two screens eliminated.

## Screen Layout

### Top: Destination Header

```
← SAN JUAN
  Puerto Rico · 3h 15m from JFK
```

Back arrow + destination name (Bebas Neue, yellow) + country + typical flight duration. One compact line.

### Middle: Hero Trip Card

The best deal from `price_calendar`, displayed as a complete bookable trip.

```
┌─────────────────────────────────────────────┐
│ ✦ BEST PRICE WE FOUND              $229    │
├─────────────────────────────────────────────┤
│                                             │
│ DEPART              →           RETURN      │
│ Mon, Apr 7                   Mon, Apr 14    │
│                                             │
│ ┌─────┐ ┌──────────┐ ┌──────┐              │
│ │7 nts│ │Round trip │ │Direct│              │
│ └─────┘ └──────────┘ └──────┘              │
│                                             │
│ FRONTIER · F9 376              Economy      │
│ 09:40 ────────────────────────── 13:00      │
│ JFK         3h 20m · Direct        SJU      │
│                                             │
│ 15:30 ────────────────────────── 19:00      │
│ SJU         3h 30m · Direct        JFK      │
│                                             │
└─────────────────────────────────────────────┘
```

**Data source:** `price_calendar` collection — cheapest entry for this origin-destination pair with a future date. The airline and departure date come from the Travelpayouts data stored in the calendar entry. Flight times are not available from TP — show airline + "Direct"/"1 stop" based on `transferCount` but NOT specific times.

**Important:** Since we don't have exact flight times from Travelpayouts (only airline + stops), the hero card shows:
- Airline name + flight number (if available, else just airline)
- "Direct" or "1 stop" (from `transferCount`)
- NOT specific departure/arrival times — those come from the live Duffel search later

### Below Hero: "Other dates" Expandable

Collapsed by default — shows a single tappable row:

```
Other dates from $267 →
```

When tapped, expands to show 3-4 alternative trips as compact rows:

```
┌─────────────────────────────────────────────┐
│ Apr 15 → Apr 22   7 nights   IB     $267   │
├─────────────────────────────────────────────┤
│ Apr 22 → Apr 29   7 nights   B6     $289   │
├─────────────────────────────────────────────┤
│ May 5 → May 12    7 nights   AA     $312   │
├─────────────────────────────────────────────┤
│ May 12 → May 19   7 nights   DL     $445   │
└─────────────────────────────────────────────┘
```

Each row shows: date range, trip duration, airline code, price. Tapping a row replaces the hero card with that trip's details.

**Data source:** `price_calendar` entries for this origin-destination, sorted by price ascending, deduplicated so alternatives are at least 3 days apart (don't show Apr 7 and Apr 8 as separate options).

### Bottom: CTA Button

```
┌─────────────────────────────────────────────┐
│         Book this trip · $229          →    │
└─────────────────────────────────────────────┘
```

Full-width yellow button. Tapping goes to passenger form.

**Note:** This does NOT skip the live Duffel search. When the user taps "Book this trip", the app calls the Duffel search API for the selected dates in the background, then navigates to passengers. If the Duffel price is significantly different (>50% higher), show a price update notice before continuing. If the Duffel search fails, show an error with "Try different dates" option.

### Hidden: Full Calendar Link

```
See full price calendar →
```

Small muted link at the very bottom. Opens the existing `DatePickerSheet` as a modal for power users who want specific dates. This keeps the calendar available without making it the primary UX.

## Visual Style

Follows the app's existing vintage air-travel aesthetic:
- **Hero card background:** `colors.surface` (#0F0D0A) with `colors.border` (#2A2218) border
- **"Best price" header:** Green tint (`rgba(123,175,142,0.15)`) background
- **Price:** Large, bold, `colors.green` (#7BAF8E)
- **Date labels:** `fonts.display` (Bebas Neue) or `fonts.bodyBold` (Inter 600)
- **Chips:** Outlined with `colors.border`, text in `colors.yellow`
- **Alternative rows:** `colors.surface` background, muted text, price in white
- **CTA button:** `colors.yellow` (#F7E8A0) background, `colors.bg` text

## New Files

| File | Purpose |
|------|---------|
| `app/booking/[id]/trip.tsx` | New "Your Trip" screen |
| `components/booking/TripHeroCard.tsx` | Hero trip card component |
| `components/booking/AlternativeTrips.tsx` | Expandable alternatives list |

## Modified Files

| File | Change |
|------|--------|
| `components/swipe/SwipeFeed.tsx` | Navigate to `/booking/{id}/trip` instead of `/booking/{id}/dates` |
| `components/swipe/SwipeCard.tsx` | Same — if onBook navigates anywhere |
| `app/booking/[id]/dates.tsx` | Keep as-is — accessed via "See price calendar" link from trip screen |
| `app/destination/[id].tsx` | Navigate to trip screen instead of dates |

## Data Flow

```
User taps "Search Flights" on feed card
  → Navigate to /booking/{id}/trip
  → Read deal from dealStore (has cheapestDate, cheapestReturnDate, price, airline)
  → Fetch alternatives from /api/destination?action=calendar (reads from price_calendar)
  → Display hero card with best trip + expandable alternatives
  → User taps "Book this trip"
  → Call POST /api/booking?action=search with selected dates
  → Navigate to /booking/{id}/passengers with offerId
  → If Duffel price >50% higher than calendar price, show price update notice
```

## Price Update Notice

When the live Duffel price comes back significantly higher than the calendar price:

```
┌─────────────────────────────────────────────┐
│ ⓘ Prices updated                           │
│                                             │
│ The best available price for your dates     │
│ is now $385 (was $229 when we checked).     │
│                                             │
│ [Continue at $385]    [Try different dates]  │
└─────────────────────────────────────────────┘
```

This is honest — the user knows the price changed and can decide to continue or look at alternatives.

## Edge Cases

- **No calendar data for this destination:** Fall back to existing dates screen (`/booking/{id}/dates`)
- **All calendar dates in the past:** Show "No upcoming deals found" with option to search custom dates
- **Duffel search fails:** Show error with retry + "Try different dates" options
- **Duffel search times out:** Show "Still searching..." with option to continue with estimated price (calendar price) — actual Duffel offer will be fetched before payment

## Out of Scope

- Trip duration selector (3/5/7/10 nights) — all calendar prices are 7-night trips for now
- Flight time preferences — user gets the cheapest regardless of departure time
- Multi-city trips
- Removing the existing dates/flight-selection screens (keep them as fallbacks)
