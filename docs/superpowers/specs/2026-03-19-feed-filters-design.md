# Feed Filter Bottom Sheet

**Date:** 2026-03-19
**Status:** Approved

## Overview

Add a filter bottom sheet to the swipe feed, triggered by a filter icon in the header. Users select from four filter categories (Price, Region, Vibe, Duration) using tappable pills styled with the app's vintage air-travel aesthetic. The backend already supports all filter parameters. One small backend addition: a `countOnly` param for the live count preview in the sheet.

## Trigger

A filter icon button added to the existing feed header (`app/(tabs)/index.tsx`). The header currently uses `flexDirection: 'row'` with `justifyContent: 'space-between'` and two children (logo, airport badge). Change to three children: logo (left), filter button (center), airport badge (right). The `space-between` layout naturally positions the filter icon in the center. Uses a retro compass/radar icon style consistent with the app's visual language.

- **Default state:** Icon only, muted color (`colors.muted`)
- **Active filters:** Terracotta badge (`colors.orange`) with count overlay (e.g., "3")
- **Tap:** Opens the filter bottom sheet

## Bottom Sheet

### Layout

```
┌─────────────────────────────────────┐
│            ── handle ──             │
│                                     │
│  PRICE                  Clear all ↗ │
│  ┌──────┐ ┌───────┐ ┌──────┐ ┌───┐│
│  │<$300 │ │$300-500│ │$500-1K│ │1K+││
│  └──────┘ └───────┘ └──────┘ └───┘│
│                                     │
│  REGION                             │
│  ┌────────┐ ┌─────────┐ ┌────────┐│
│  │Domestic│ │Caribbean│ │Lat. Am.││
│  └────────┘ └─────────┘ └────────┘│
│  ┌──────┐ ┌────┐ ┌─────────┐ ┌───┐│
│  │Europe│ │Asia│ │Africa/ME│ │OC ││
│  └──────┘ └────┘ └─────────┘ └───┘│
│                                     │
│  VIBE                               │
│  ┌─────┐ ┌────┐ ┌──────┐ ┌───────┐│
│  │Beach│ │City│ │Nature│ │Culture││
│  └─────┘ └────┘ └──────┘ └───────┘│
│  ┌─────────┐ ┌────────┐ ┌──────┐  │
│  │Adventure│ │Romantic│ │Foodie│  │
│  └─────────┘ └────────┘ └──────┘  │
│  ┌──────┐ ┌───────┐               │
│  │Luxury│ │Historic│               │
│  └──────┘ └───────┘               │
│                                     │
│  DURATION                           │
│  ┌───────┐ ┌────┐ ┌────────┐      │
│  │Weekend│ │Week│ │Extended│      │
│  └───────┘ └────┘ └────────┘      │
│                                     │
│  ┌─────────────────────────────────┐│
│  │      Show 24 destinations       ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### Interaction Rules

| Category | Selection | Behavior |
|----------|-----------|----------|
| Price | Single-select | Tap to select, tap again to deselect. Only one active at a time. |
| Region | Multi-select | Tap to toggle. Multiple can be active. |
| Vibe | Multi-select | Tap to toggle. Multiple can be active. |
| Duration | Single-select | Tap to select, tap again to deselect. Only one active at a time. |

- **"Show X destinations"** button: Closes sheet, applies filters. The count updates live as filters change (debounced 300ms).
- **"Clear all"** link: Resets all filters, count updates to total unfiltered count. If user then dismisses the sheet, the feed refetches with no filters (showing everything).
- **Drag down** to dismiss: Keeps current selections applied.
- **Backdrop tap**: Same as drag down — dismisses, keeps selections.

## Visual Style

### Vintage Air-Travel Aesthetic

**Unselected pills:**
- Background: transparent
- Border: 1px `colors.border` (`#2A2218`)
- Text: `colors.muted` (`#C9A99A`)
- Font: `fonts.body` (Inter 400), 13px
- Border radius: 6px (slightly rounded — luggage tag feel, not fully pill)
- Padding: 10px horizontal, 6px vertical

**Selected pills:**
- Background: `colors.orange` (`#D4734A`) — terracotta
- Border: 1px `colors.orange`
- Text: `#FFF8F0` (warm cream)
- Font: `fonts.bodyBold` (Inter 600), 13px

**Section labels:**
- Font: `fonts.display` (Bebas Neue), 13px
- Color: `colors.yellow` (`#F7E8A0`)
- Letter spacing: 2px
- Text transform: uppercase (inherent with Bebas Neue)

**Sheet:**
- Background: `colors.sheetBg` (`#12100D`)
- Handle: `colors.sheetHandle` (`#2A2218`), 36px wide, 4px tall, centered
- Top border radius: 16px
- Max height: 70% of screen

**Show button:**
- Background: `colors.orange`
- Text: warm cream, `fonts.bodyBold`, 15px
- Border radius: 8px
- Full width with 16px horizontal margin
- Height: 48px

**Clear all:**
- Text: `colors.muted`, `fonts.body`, 13px
- Positioned top-right of sheet, inline with first section label

## State Management

### New file: `stores/filterStore.ts`

```typescript
interface FilterState {
  // Filter values
  priceRange: 'under300' | '300to500' | '500to1k' | 'over1k' | null;
  regions: string[];      // e.g., ['domestic', 'europe']
  vibes: string[];        // Values must match actual vibe_tags in Appwrite destinations collection
                          // Known tags: beach, tropical, city, nightlife, mountain, nature,
                          // adventure, winter, culture, historic, foodie, romantic, luxury
  duration: 'weekend' | 'week' | 'extended' | null;

  // Sheet visibility
  isOpen: boolean;

  // Actions
  setPriceRange: (range: FilterState['priceRange']) => void;
  toggleRegion: (region: string) => void;
  toggleVibe: (vibe: string) => void;
  setDuration: (duration: FilterState['duration']) => void;
  clearAll: () => void;
  open: () => void;
  close: () => void;

  // Derived
  activeCount: () => number;
  toQueryParams: () => Record<string, string>;
}
```

**Not persisted** — filters reset on app restart. This is intentional; fresh discovery each session.

### Price range → API params mapping

| UI Label | `minPrice` | `maxPrice` |
|----------|-----------|-----------|
| Under $300 | — | 300 |
| $300–500 | 300 | 500 |
| $500–1K | 500 | 1000 |
| $1K+ | 1000 | — |

### `toQueryParams()` output

Converts filter state to the query params the `/api/feed` endpoint already accepts:

```typescript
{
  vibeFilter: 'beach,city',      // comma-separated
  regionFilter: 'domestic,europe', // comma-separated
  minPrice: '300',
  maxPrice: '500',
  durationFilter: 'weekend',
}
```

Only includes keys with active selections. Empty/null values are omitted.

### Vibe pill labels → `vibeFilter` values

The backend matches `vibeFilter` values against raw `vibe_tags` stored in Appwrite (case-insensitive). Pill labels map directly to tag values:

| Pill Label | `vibeFilter` value |
|------------|-------------------|
| Beach | `beach` |
| City | `city` |
| Nature | `nature` |
| Culture | `culture` |
| Adventure | `adventure` |
| Romantic | `romantic` |
| Foodie | `foodie` |
| Luxury | `luxury` |
| Historic | `historic` |

Note: "Budget" was removed as a vibe pill — it's not a `vibe_tag` in the DB. Price filtering handles budget travelers.

## Data Flow

```
User taps pill
  → filterStore updates
  → "Show X" count refetches (debounced 300ms, lightweight count query)
  → User taps "Show X destinations"
  → sheet closes
  → dealStore.fetchDeals() called with filterStore.toQueryParams()
  → React Query key includes filter params → automatic refetch
  → feed re-renders with filtered results
```

### Count preview

The "Show X destinations" button needs a count. Two options:

**Chosen approach:** Call `GET /api/feed?...&countOnly=true` with current filters. The feed endpoint already filters — add a `countOnly` param that returns `{ count: N }` instead of full results. Debounced at 300ms to avoid spamming on rapid filter changes.

**Backend change needed:** Add `countOnly` query param to `feedQuerySchema` and short-circuit the response to return just the count after filtering. This is minimal — ~5 lines in `api/feed.ts`.

## New Files

| File | Purpose |
|------|---------|
| `stores/filterStore.ts` | Zustand store for filter state |
| `components/swipe/FilterSheet.tsx` | Bottom sheet with filter pills |
| `components/swipe/FilterPill.tsx` | Individual pill component |
| `components/swipe/FilterButton.tsx` | Header icon button with badge |

## Modified Files

| File | Change |
|------|--------|
| `app/(tabs)/index.tsx` | Add `FilterButton` to header, pass filters to `fetchDeals` |
| `stores/dealStore.ts` | Change `fetchDeals(origin)` → `fetchDeals(origin, filters?: Record<string, string>)`. Merge filter params into URLSearchParams. Also fix existing bug: current code sends `vibes` param but API expects `vibeFilter`. Remove old `activeFilters`/`setFilters`/`clearFilters` from dealStore — filterStore replaces them. Same change for `fetchMore()`. |
| `api/feed.ts` | Add `countOnly` param support (~5 lines) |
| `utils/validation.ts` | Add `countOnly: z.literal('true').optional()` to feedQuerySchema |

## Animations

- **Sheet open/close:** Slide up from bottom with spring animation (React Native Reanimated or `Animated` API). Duration ~300ms.
- **Pill selection:** Quick scale pulse (1.0 → 0.95 → 1.0, 150ms) on tap for tactile feedback.
- **Badge appear:** Fade + scale in when count goes from 0 to 1.

## Edge Cases

- **No results:** "Show 0 destinations" button is disabled (dimmed). Tapping shows nothing — user must adjust filters.
- **Sheet overflow:** ScrollView inside sheet if content exceeds 70% screen height (unlikely on most devices, but safe).
- **Web vs native:** Use `Platform.OS === 'web'` for the sheet implementation — web uses a modal/overlay with CSS transitions, native uses React Native bottom sheet pattern.
- **Filter + departure city:** Filters combine with the existing departure code. Changing departure city in settings clears filters (fresh context).

## Accessibility

- Filter pills: `accessibilityRole="button"`, `accessibilityState={{ selected: isActive }}`, `accessibilityLabel` (e.g., "Beach vibe filter, selected")
- Filter button in header: `accessibilityLabel="Open filters"`, `accessibilityHint` with active count (e.g., "3 filters active")
- Sheet: on web, trap focus within the sheet while open; Escape key dismisses
- "Show X destinations" button: `accessibilityRole="button"`, disabled state announced

## Out of Scope

- Filter persistence across sessions
- Sort order controls (already exists as `sortPreset` in API, can add later)
- Search functionality (separate feature)
- Saved filter presets
