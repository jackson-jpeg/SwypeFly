# iOS Visual Overhaul — Design Spec

**Date:** 2026-03-24
**Goal:** Transform the SoGoJet iOS app from a cluttered data dump into a polished, minimal travel app with two signature modes: full-bleed photo swiper and split-flap departure board.

## Design Philosophy

**One retro element, everything else modern.**

The split-flap board is the signature. It's mechanical, minimal, beautiful — the kind of thing you'd see in a well-designed European train station. Everything around it is crisp and modern: dark backgrounds, clean sans-serif type, generous whitespace, sharp edges.

**Kill list:** No leather textures. No sepia tones. No faux-aged paper. No stamp effects. No "vintage" decorative borders. No skeuomorphic anything except the flipboard itself.

**Keep list:** Split-flap character animation. Dark terminal-inspired backgrounds (pure, clean blacks and near-blacks). Monospace or condensed type for data. The mechanical rhythm of the board.

---

## 1. Feed Card — Full-Bleed Photo Swiper

### Current problems
- Card is a data dump: Fare Stub, 4 info boxes, Travel Notes, Open Dossier, NOW BOARDING bar
- "HOME" as departure instead of actual airport
- "TRAVELPAYOUTS" exposed as carrier source
- "Stop profile pending" shown as raw state text
- Too many competing visual elements

### New design

**Full-screen card with destination photo filling edge to edge.**

Layout (bottom-up on the photo):
```
┌─────────────────────────────────┐
│                                 │
│        [full-bleed photo]       │
│                                 │
│  ♡ (save)              Country  │
│                                 │
│                                 │
│                                 │
│                                 │
│  ░░░░░ gradient ░░░░░░░░░░░░░░  │
│  CITY NAME              $305   │
│  Spirit · 3h 30m direct         │
└─────────────────────────────────┘
```

**Elements:**
- **Photo:** Full bleed, edge to edge, fills the entire card
- **Bottom gradient:** 40% height dark gradient (black, 0.0 → 0.7 opacity) so text reads on any photo
- **City name:** Bottom-left, large bold type (Bebas Neue, ~34pt)
- **Country:** Top-right, small muted label (Inter, 13pt, 60% opacity white)
- **Price badge:** Bottom-right, pill shape with deal tier background color, white text (Inter SemiBold, 20pt)
- **Flight teaser:** Below city name, single line, small muted text (Inter, 13pt, 70% opacity). Format: "{Airline Name} · {duration} {stops}". Example: "Spirit · 3h 30m direct"
- **Save button:** Heart icon, top-left, semi-transparent background circle
- **No other elements on the card**

**Interactions:**
- Swipe left/right → next/previous card
- Tap anywhere → navigate to detail view
- Tap heart → save/unsave with haptic

**Data rules:**
- Airline: Map IATA code to name (NK → Spirit). If no code, hide the teaser line entirely
- Duration: Show if available, hide "Stop profile pending" — never show placeholder text
- Stops: "direct" / "1 stop" / "2 stops". If unknown, omit
- Price: `displayPrice` computed property (live price or fallback)
- If no photo available: solid dark gradient with city name centered (no broken image state)

### What to remove from DealCard.swift
- Entire "Fare Stub" section
- All 4 info grid boxes (Fare, Duration, Timing, Carrier)
- "Travel Notes" section
- "Open Dossier" row
- "NOW BOARDING" bottom bar
- "Route live" / "Hotels from $X" badges
- VintageTerminalBackdrop behind the card
- Split-flap city name animation (keep this ONLY in departure board view)

### What stays
- Hero image loading with blur-up
- Price badge (simplified)
- Save button (relocated to top-left)
- Swipe gesture handling
- Haptic feedback

---

## 2. Departure Board — Full-Screen Split-Flap List

### Current problems
- Rows don't fill the screen properly
- Tapping a city doesn't navigate to the detail page
- Layout has awkward gaps and clipping

### New design

**Full-screen departure board with rows filling available space.**

```
┌─────────────────────────────────┐
│  ── DEPARTURES ──        JFK ▾  │
│─────────────────────────────────│
│  C A N C Ú N         $305  NK  │
│  Mexico · 3h 30m direct        │
│─────────────────────────────────│
│  B A L I              $487  GA  │
│  Indonesia · 18h 1 stop        │
│─────────────────────────────────│
│  L I S B O N          $412  TP  │
│  Portugal · 7h direct          │
│─────────────────────────────────│
│  T O K Y O            $623  NH  │
│  Japan · 14h direct            │
│─────────────────────────────────│
│                                 │
│  [rows fill remaining space]    │
│                                 │
└─────────────────────────────────┘
```

**Row layout:**
- **City name** in split-flap characters (left-aligned, the signature animation)
- **Price** right-aligned, bold
- **Airline code** far right, muted
- **Subtitle line:** Country · duration · stops (small, muted, below the city)
- **Separator:** Thin horizontal line between rows (dark gray, not gold)

**Header:**
- "DEPARTURES" in split-flap style (small, centered)
- Departure airport code (from SettingsStore) with dropdown indicator, right-aligned
- Minimal — no VintageTerminalBackdrop texture behind it

**Interactions:**
- Tap any row → navigate to detail page (via Router)
- Pull to refresh → reload feed
- Scroll naturally (no paging)

**Sizing fix:**
- Rows should have a fixed minimum height (~80pt) and fill available space
- Use LazyVStack with proper frame modifiers
- No expandable row state — tap goes straight to detail

### What to remove from DepartureBoardView.swift
- Row expansion/collapse behavior (if present)
- Any VintageTerminalBackdrop usage behind content
- Gold/yellow accent colors on separators
- Overcomplicated chrome headers

### What stays
- SplitFlapChar + SplitFlapRow animation engine (this IS the feature)
- Split-flap character flip animation
- Dark background

---

## 3. Detail View — Clean Destination Page

### Current problems
- "Arrival Dossier" / "Desk Fare" / "Fare Memory" — confusing jargon
- Fare Memory shows 6 identical $305 bars (broken/useless)
- Flight info table is cramped
- "Stop profile unavailable" shown as text
- Layout feels like a data sheet, not a travel page

### New design

**Scrollable detail page with hero image, clean sections, sticky bottom bar.**

```
┌─────────────────────────────────┐
│  ← (back)                       │
│                                 │
│        [hero image 40%]         │
│                                 │
│  CITY NAME              $305   │
│  Country                        │
│─────────────────────────────────│
│                                 │
│  Spirit · 3h 30m · Direct       │
│  Mar 28 – Apr 4 · 7 days       │
│                                 │
│─────────────────────────────────│
│  TRAVEL GUIDE                   │
│                                 │
│  "Beach paradise with ancient   │
│   Mayan ruins..."               │
│                                 │
│  ☀ Best months: Dec – Apr       │
│  🌡 Avg temp: 28°C              │
│                                 │
│─────────────────────────────────│
│  SIMILAR DESTINATIONS           │
│  [horizontal scroll cards]      │
│                                 │
│─────────────────────────────────│
│                                 │
│  [sticky bottom bar]            │
│  ♡  ⤴  │  Search Flights ➜     │
└─────────────────────────────────┘
```

**Sections:**

1. **Hero image** — Full width, 40% of screen height, same photo as card. Replace the existing `VintageTerminalPoster` component with a simple `CachedAsyncImage` + bottom gradient overlay. City name + price overlaid at bottom (same gradient treatment as card).

2. **Flight info** — Clean horizontal layout:
   - Airline name (not code) · duration · stops
   - Date range · trip length
   - If any field is missing, omit it (never show "pending" or "unavailable")

3. **Travel Guide** (renamed from "Travel Desk Notes"):
   - AI-generated description (the existing `snippet` / travel notes)
   - Best months, average weather — only if data exists
   - Clean card style, no "Desk" branding

4. **Similar Destinations** — Horizontal scroll of compact cards:
   - Photo thumbnail + city + price
   - Tap → navigate to that destination's detail

5. **Sticky bottom bar:**
   - Save button (heart)
   - Share button
   - "Search Flights" primary CTA button (gold/accent)

### What to remove from DestinationDetailView.swift
- "ARRIVAL DOSSIER" header terminology
- "DESK FARE" badge
- "Fare Memory" section entirely
- "Travel Desk Notes" label (rename to "Travel Guide")
- "Stop profile pending/unavailable" text
- Price alert CTA (defer to settings)
- Flight info table grid (replace with inline text)

### What stays
- Hero image
- Save functionality
- Share button
- "Search Flights" CTA → booking flow
- Similar deals carousel (simplified)
- AI content display (description, months, weather)

---

## 4. Global Fixes

### Terminology cleanup

| Current | New |
|---------|-----|
| Fare Stub | *(removed)* |
| Desk Fare | *(removed, price shows directly)* |
| Open Dossier | *(removed, tap card instead)* |
| Arrival Dossier | *(removed, city name as header)* |
| Live Board Fare | *(removed)* |
| Fare Memory | *(removed entirely)* |
| Travel Desk Notes | Travel Guide |
| Stop profile pending | *(hidden when no data)* |
| Stop profile unavailable | *(hidden when no data)* |
| TRAVELPAYOUTS | *(hidden, show airline name)* |
| HOME | *(actual airport code from SettingsStore)* |
| Now Boarding | *(removed from card)* |

### Airline name mapping

Port the IATA → airline name mapping from the web app (`utils/airlines.ts`) to a Swift dictionary in a new `Extensions/Airlines.swift` file (no `Utils/` directory exists in the project). Cover the ~90 codes already in the web app.

### Color system update

**Direction:** Shift from warm gold-tinted tones to cooler, neutral tones — except for the split-flap characters which keep their warm gold. Update `Theme/Colors.swift` with these literal values:

| Token | Current hex | New hex | Notes |
|-------|------------|---------|-------|
| `sgBg` | `0x0A0806` (warm) | `0x0A0A0A` (neutral) | No texture, clean black |
| Card background | Dark with gold accents | Transparent | Photo fills the card |
| Separator | Gold/yellow lines | `0x1A1A1A` | Subtle neutral gray |
| `sgYellow` (accent) | Keep as-is | Keep as-is | Use sparingly — only primary CTAs and price badges |
| `sgWhite` (text primary) | `0xFFF8F0` (warm) | `0xF5F5F5` (neutral) | Crisp off-white |
| `sgMuted` (text secondary) | `0x8B7D6B` (warm brown) | `0x888888` (neutral gray) | Clean secondary text |
| Split-flap chars | Keep existing gold-on-dark | Keep as-is | This is the ONE retro element |

### VintageTerminalKit changes
- **Keep:** Split-flap character/row components
- **Remove:** VintageTerminalBackdrop (the text-matrix background texture)
- **Remove:** Decorative chrome borders, "ticket stub" styling
- **Remove:** Any leather/paper/stamp textures if present

### Gesture fix
- The "System gesture gate timed out" errors likely originate from the **DepartureBoardView's custom DragGesture** (not the feed's ScrollView paging)
- The board view uses a custom DragGesture that may conflict with iOS edge swipe gestures
- Fix: Use `.simultaneousGesture()` or adjust the gesture's `minimumDistance` to avoid conflicting with system navigation gestures
- The feed view uses `.scrollTargetBehavior(.paging)` which is system-native and should not cause conflicts

### Loading & empty states
- **Feed card with no photo:** Solid dark gradient (`sgBg`) with city name centered in large type — no broken image placeholder
- **Feed loading:** Shimmer skeleton cards (match existing board shimmer pattern)
- **Detail view loading:** Hero area shows solid dark background while image loads, content sections show skeleton lines
- **Empty similar deals:** Hide the section entirely, don't show an empty carousel

### Fare Memory / price history
- **Remove from UI entirely** for now — the data (all identical prices) provides no value
- Price history is a future feature when the data pipeline produces meaningful variation
- No TODO comments in code — just remove it cleanly

---

## 5. What's NOT Changing

- **Booking flow** — TripView, PassengerForm, SeatMapView, ReviewView, BoardingPassView stay as-is
- **Settings** — SettingsView and AirportPicker stay as-is
- **Onboarding** — OnboardingView stays as-is
- **Saved view** — SavedView and SavedCard stay as-is (minor: should use new card style)
- **Stores** — FeedStore, BookingStore, SavedStore, SettingsStore logic untouched
- **APIClient** — No changes
- **Toast system** — Stays as-is
- **Haptic engine** — Stays as-is

---

## 6. Files to Modify

| File | Change |
|------|--------|
| `Views/Feed/DealCard.swift` | **Rewrite** — strip to full-bleed photo + minimal overlay |
| `Views/Feed/FeedView.swift` | **Moderate** — remove VintageTerminalBackdrop, simplify chrome |
| `Views/Board/DepartureBoardView.swift` | **Moderate** — fix row sizing, add tap-to-detail, clean header |
| `Views/Board/DepartureRow.swift` | **Moderate** — add country subtitle, fix layout, add tap handler |
| `Views/Detail/DestinationDetailView.swift` | **Rewrite** — new layout, remove jargon, clean sections |
| `Views/Detail/SimilarDeals.swift` | **Minor** — simplify card style |
| `Views/Detail/PriceAlertCTA.swift` | **Remove** from detail view |
| `Views/Components/VintageTerminalKit.swift` | **Trim** — keep split-flap, remove backdrop/chrome |
| `Views/Components/SplitFlapChar.swift` | **Keep** — no changes |
| `Views/Components/SplitFlapRow.swift` | **Keep** — no changes |
| `Views/Components/FilterSheet.swift` | **Minor** — update colors to new palette |
| `Views/Components/ToastView.swift` | **Minor** — update colors |
| `Stores/Router.swift` | **Minor** — ensure detail navigation from board rows works |
| `Models/Deal.swift` | **Minor** — modify existing `airlineName` computed property to use Airlines lookup |
| `Theme/Colors.swift` | **Moderate** — update hex values per color system update table |
| `Views/Saved/SavedCard.swift` | **Minor** — update to match new card style (photo-forward, minimal overlay) |
| **NEW** `Extensions/Airlines.swift` | **Create** — IATA code → airline name dictionary |

---

## 7. Success Criteria

- [ ] Feed card shows full-bleed photo with minimal overlay (city, country, price, flight teaser)
- [ ] No "Fare Stub", info boxes, or "NOW BOARDING" on the card
- [ ] Departure board rows fill the screen, tap navigates to detail
- [ ] Detail view has hero image, clean flight info, travel guide, similar deals, sticky bottom bar
- [ ] No jargon: no "Dossier", "Desk Fare", "Fare Memory", "TRAVELPAYOUTS", "HOME"
- [ ] Airline codes map to names (NK → Spirit)
- [ ] Missing data hidden gracefully (no "pending" or "unavailable" text)
- [ ] No VintageTerminalBackdrop texture anywhere
- [ ] Split-flap animation preserved in departure board view
- [ ] System gesture timeouts resolved
- [ ] App builds clean with 0 errors
