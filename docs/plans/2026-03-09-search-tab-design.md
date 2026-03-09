# Search Tab + Travelpayouts→Duffel Handoff Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Search tab that shows cached flight deals in a browsable 2-column grid with full filtering, where tapping a deal expands inline and hands off to the Duffel-powered booking flow.

**Architecture:** Search tab reads from `cached_prices` (populated by Travelpayouts/Duffel cron). No live API calls from Search — Duffel only fires when user enters booking flow. Data handoff via `bookingStore`.

**Tech Stack:** React + TypeScript, Zustand, TanStack Query, existing design tokens

---

## Product Context

Two modes of discovery:
- **Explore (swipe feed):** "Surprise me" — algorithm-curated deals, TikTok-style swiping, user doesn't pick dates or destinations
- **Search (new):** "I have intent" — browsable grid of deals with filtering/sorting, user finds specific routes

Both feed into the same Duffel-powered booking flow.

## Navigation

4 tabs in BottomNav:

| # | Tab | Icon | Route |
|---|-----|------|-------|
| 1 | Explore | compass | `/` |
| 2 | Search | magnifying glass | `/search` |
| 3 | Saved | heart | `/wishlist` |
| 4 | Settings | gear | `/settings` |

## Search Screen Layout

### Top: Filter Bar

- **Destination text input** — autocomplete from cached destinations, filters grid live
- **Region dropdown** — all, domestic, caribbean, latam, europe, asia, africa-me, oceania
- **Price range slider** — min/max derived from cached prices for user's origin
- **Sort toggle** — Cheapest (default), Trending, Nearest

### Main: 2-Column Deal Grid

Small cards showing:
- Destination photo (top half)
- City name, country (bottom half)
- Price badge
- Airline
- Travel dates (departure → return)

Data source: `cached_prices` joined with `destinations` metadata for user's origin from `UIStore.departureCode`.

Infinite scroll or cursor-based pagination (same pattern as feed).

### Empty State

"Set your home airport in Settings to see deals" — shown when no departure code is configured.

## Card Interaction

### Collapsed (default)

Compact grid card: image, city, country, price, airline, dates.

### Expanded (on tap)

Card expands inline, pushing grid items down. Shows:
- Airline name (resolved from IATA code)
- Departure date → return date
- Trip duration (e.g., "7 days")
- Number of stops (if available from cached data)
- Price (prominent)
- **"Book This Deal" button**

Tapping outside or another card collapses the expanded card.

### Book This Deal Action

1. `bookingStore.setBookingDestination(dest.id, dest.flightPrice)`
2. `bookingStore.setCachedOffer(dest.offerJson)` (if Duffel offer is cached)
3. Navigate to `/booking/flights` (FlightSelectionScreen)
4. FlightSelectionScreen pre-fills: origin, destination, departure date, return date
5. If cached offer is valid + not expired → shows "Best Deal" card
6. Otherwise → fires fresh Duffel search for those dates
7. Continues existing booking flow

## Data Flow

```
Cron (daily 6AM UTC)
  ├─ Duffel searchFlights() → cached_prices (primary)
  └─ Travelpayouts fetchCheapPrices() → cached_prices (fallback)

User opens Search tab
  → API query: cached_prices WHERE origin = user's airport
  → Join with destinations for metadata (city, country, image, vibes)
  → Apply filters (region, price range, text search)
  → Apply sort (cheapest, trending, nearest)
  → Return paginated results

User taps deal card → inline expand
User taps "Book This Deal"
  → bookingStore receives route + dates + cached offer
  → Navigate to /booking/flights
  → Duffel live search with pre-filled params
  → Existing booking pipeline takes over
```

## API

### New endpoint: `GET /api/search-deals`

**Params:**
- `origin` (string, IATA) — user's departure airport
- `search` (string, optional) — destination text filter
- `region` (enum, optional) — region filter
- `minPrice` / `maxPrice` (number, optional) — price range
- `sort` (enum: cheapest, trending, nearest) — sort order
- `cursor` (number, optional) — pagination offset

**Returns:** Array of deal objects:
```typescript
{
  destinationId: string,
  city: string,
  country: string,
  iataCode: string,
  imageUrl: string,
  vibeTags: string[],
  price: number,
  currency: string,
  airline: string,
  departureDate: string,
  returnDate: string,
  tripDurationDays: number,
  priceDirection: 'up' | 'down' | 'stable',
  previousPrice: number | null,
  priceSource: 'duffel' | 'travelpayouts',
  offerJson: string | null,
  offerExpiresAt: string | null,
}
```

No scoring or personalization. Straight filtered + sorted cache query.

## Scope Exclusions

- No date picker (dates come from cached deals)
- No passenger count selector (default 1 adult, adjustable in booking flow)
- No map view
- No compare prices feature
- No saved searches
