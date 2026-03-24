# SoGoJet Native iOS App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native SwiftUI iOS app that's a full port of the SoGoJet Expo React Native app, connecting to the existing Vercel API backend.

**Architecture:** Pure SwiftUI with @Observable stores, actor-based APIClient, custom image cache, custom split-flap 3D animation engine. NavigationStack + Router coordinator for navigation. SwiftData for offline persistence.

**Tech Stack:** Swift 5.9+, SwiftUI, SwiftData, iOS 17+, URLSession, NSCache, FileManager, Canvas, GeometryEffect. Zero external dependencies.

**Spec:** `docs/superpowers/specs/2026-03-24-native-ios-app-design.md`

**Existing API base URL:** `https://sogojet.com/api`

**Existing TS type reference:** `types/deal.ts` (BoardDeal interface — the Deal Swift model must match this 1:1)

---

## File Map

### New files to create (in `SoGoJet-iOS/SoGoJet/`):

**App:**
- `App/SoGoJetApp.swift` — @main, WindowGroup, environment injection, modelContainer
- `App/ContentView.swift` — Onboarding gate check, TabView with 3 tabs

**Models:**
- `Models/Deal.swift` — Codable struct matching BoardDeal TS type (44 fields)
- `Models/DealTier.swift` — enum amazing/great/good/fair with color/label helpers
- `Models/FeedResponse.swift` — API response wrapper with page cursor
- `Models/BookingModels.swift` — TripOption, Passenger, SeatMap, SeatInfo, BookingOrder

**Services:**
- `Services/APIClient.swift` — actor, Endpoint enum, generic fetch<T>, auth token
- `Services/ImageCache.swift` — actor, NSCache + FileManager, CachedAsyncImage view
- `Services/HapticEngine.swift` — static methods: light(), medium(), success(), heavy()

**Stores:**
- `Stores/FeedStore.swift` — @Observable, deals array, page, filters, fetch/fetchMore
- `Stores/SavedStore.swift` — @Observable, SwiftData @Model SavedDeal, toggle/clear
- `Stores/SettingsStore.swift` — @Observable, @AppStorage backed properties
- `Stores/BookingStore.swift` — @Observable, state machine enum, passenger/seat/offer data
- `Stores/Router.swift` — @Observable, Tab enum, NavigationPath per tab, sheet/fullscreen state

**Theme:**
- `Theme/Colors.swift` — Color extension with bg, surface, cell, border, yellow, green, orange, white, muted, faint, dealAmazing/Great/Good
- `Theme/Fonts.swift` — Font extension for display (BebasNeue), body/bodyBold (Inter), accent (PlayfairDisplay)
- `Theme/Spacing.swift` — CGFloat constants xs(4)/sm(8)/md(16)/lg(24)/xl(40)

**Views/Components:**
- `Views/Components/SplitFlapChar.swift` — Single character with 3D flip animation
- `Views/Components/SplitFlapRow.swift` — Row of N SplitFlapChars with stagger
- `Views/Components/CachedAsyncImage.swift` — Image view using ImageCache
- `Views/Components/ToastView.swift` — Animated toast overlay
- `Views/Components/FilterSheet.swift` — Bottom sheet with price/vibe/region filters

**Views/Feed:**
- `Views/Feed/FeedView.swift` — Vertical paging TabView, immersion mode header
- `Views/Feed/DealCard.swift` — Full-screen card with image, badges, price, actions
- `Views/Feed/DealBadge.swift` — Tier badge component (amazing/great/good)
- `Views/Feed/PriceSparkline.swift` — Canvas-drawn price trend mini chart

**Views/Board:**
- `Views/Board/DepartureBoardView.swift` — 5 visible rows, swipe-up advance, detail strip
- `Views/Board/DepartureRow.swift` — Single board row with SplitFlapRow columns

**Views/Detail:**
- `Views/Detail/DestinationDetailView.swift` — Full detail page with hero, sections
- `Views/Detail/QuickFactsStrip.swift` — Horizontal pill row
- `Views/Detail/SimilarDeals.swift` — 2-col grid of related deals
- `Views/Detail/PriceAlertCTA.swift` — Card with alert button

**Views/Saved:**
- `Views/Saved/SavedView.swift` — LazyVGrid, savings banner, sort chips
- `Views/Saved/SavedCard.swift` — Grid card with image, price, book chip
- `Views/Saved/SavingsBanner.swift` — Stats row (total savings, trip value, count)

**Views/Booking:**
- `Views/Booking/TripView.swift` — Your Trip hero + alternatives
- `Views/Booking/PassengerForm.swift` — Native Form with validation
- `Views/Booking/SeatMapView.swift` — Scrollable seat grid, recommended badge
- `Views/Booking/ReviewView.swift` — Line items, total, pay button
- `Views/Booking/BoardingPassView.swift` — Confirmation card with perforated edge
- `Views/Booking/DealExpiredView.swift` — Expired deal screen with alert CTA

**Views/Settings:**
- `Views/Settings/SettingsView.swift` — List with sections
- `Views/Settings/AirportPicker.swift` — Search + results list

**Views/Onboarding:**
- `Views/Onboarding/OnboardingView.swift` — Split-flap teaser, value props, airport picker

**Extensions:**
- `Extensions/View+Accessibility.swift` — .dealAccessibility() modifier
- `Extensions/Date+Formatting.swift` — shortDate, boardTime formatters

**Resources:**
- `Resources/Assets.xcassets` — AppIcon, AccentColor
- `Resources/Fonts/` — BebasNeue-Regular.ttf, Inter-Regular.ttf, Inter-SemiBold.ttf, PlayfairDisplay-Italic.ttf

---

## Phase 1: Foundation

### Task 1.1: Create Xcode Project Structure

**Files:**
- Create: `SoGoJet-iOS/` directory with Swift package structure

- [ ] **Step 1: Create project directory tree**

```bash
mkdir -p SoGoJet-iOS/SoGoJet/{App,Models,Services,Stores,Views/{Feed,Board,Detail,Saved,Booking,Settings,Onboarding,Components},Theme,Extensions,Resources/Fonts}
```

- [ ] **Step 2: Create Package.swift for the project**

Create `SoGoJet-iOS/Package.swift` — Swift executable package targeting iOS 17. No dependencies.

- [ ] **Step 3: Create SoGoJetApp.swift**

Create `SoGoJet-iOS/SoGoJet/App/SoGoJetApp.swift` — @main entry point with @State stores and .environment() injection. Include modelContainer for SavedDeal.

- [ ] **Step 4: Create ContentView.swift**

Create `SoGoJet-iOS/SoGoJet/App/ContentView.swift` — checks `settings.hasOnboarded`, shows OnboardingView or TabView. TabView has 3 tabs: Feed (airplane), Saved (heart), Settings (gear). Tab bar styled with dark surface background, yellow active tint.

- [ ] **Step 5: Commit**

```bash
git add SoGoJet-iOS/
git commit -m "feat(ios): Phase 1.1 — Xcode project structure + app entry"
```

### Task 1.2: Theme System

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Theme/Colors.swift`
- Create: `SoGoJet-iOS/SoGoJet/Theme/Fonts.swift`
- Create: `SoGoJet-iOS/SoGoJet/Theme/Spacing.swift`

- [ ] **Step 1: Create Colors.swift**

Extension on Color matching `theme/tokens.ts` exactly:
```swift
extension Color {
    static let sgBg = Color(red: 10/255, green: 8/255, blue: 6/255)           // #0A0806
    static let sgSurface = Color(red: 21/255, green: 18/255, blue: 16/255)    // #151210
    static let sgCell = Color(red: 26/255, green: 21/255, blue: 16/255)       // #1A1510
    static let sgBorder = Color(red: 42/255, green: 35/255, blue: 26/255)     // #2A231A
    static let sgYellow = Color(red: 247/255, green: 232/255, blue: 160/255)  // #F7E8A0
    static let sgGreen = Color(red: 168/255, green: 196/255, blue: 184/255)   // #A8C4B8
    static let sgOrange = Color(red: 232/255, green: 168/255, blue: 73/255)   // #E8A849
    static let sgWhite = Color(red: 255/255, green: 248/255, blue: 240/255)   // #FFF8F0
    static let sgWhiteDim = Color(red: 212/255, green: 200/255, blue: 184/255) // #D4C8B8
    static let sgMuted = Color(red: 139/255, green: 125/255, blue: 107/255)   // #8B7D6B
    static let sgFaint = Color(red: 90/255, green: 79/255, blue: 66/255)      // #5A4F42
    static let sgDealAmazing = Color(red: 74/255, green: 222/255, blue: 128/255)  // #4ADE80
    static let sgDealGreat = Color(red: 251/255, green: 191/255, blue: 36/255)    // #FBBF24
    static let sgDealGood = Color(red: 96/255, green: 165/255, blue: 250/255)     // #60A5FA
    static let sgRed = Color(red: 232/255, green: 93/255, blue: 74/255)           // #E85D4A
}
```

- [ ] **Step 2: Create Fonts.swift**

Register custom fonts via Info.plist UIAppFonts array. Create Font extension:
```swift
extension Font {
    static func sgDisplay(_ size: CGFloat) -> Font { .custom("BebasNeue-Regular", size: size) }
    static func sgBody(_ size: CGFloat) -> Font { .custom("Inter-Regular", size: size) }
    static func sgBodyBold(_ size: CGFloat) -> Font { .custom("Inter-SemiBold", size: size) }
    static func sgAccent(_ size: CGFloat) -> Font { .custom("PlayfairDisplay-Italic", size: size) }
}
```

Note: Font TTF files need to be bundled. Copy from `node_modules/@expo-google-fonts/` or download from Google Fonts.

- [ ] **Step 3: Create Spacing.swift**

```swift
enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 40
}
```

- [ ] **Step 4: Commit**

```bash
git add SoGoJet-iOS/SoGoJet/Theme/
git commit -m "feat(ios): Phase 1.2 — theme system (colors, fonts, spacing)"
```

### Task 1.3: Data Models

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Models/Deal.swift`
- Create: `SoGoJet-iOS/SoGoJet/Models/DealTier.swift`
- Create: `SoGoJet-iOS/SoGoJet/Models/FeedResponse.swift`
- Create: `SoGoJet-iOS/SoGoJet/Models/BookingModels.swift`

- [ ] **Step 1: Create Deal.swift**

Map every field from `types/deal.ts` BoardDeal interface. Use CodingKeys for exact JSON field names. Reference the TS type file directly — every field must match.

Key fields: id, destination, country, iataCode, price (optional Double), dealTier (optional DealTier), dealScore (optional Int), savingsPercent (optional Int), usualPrice (optional Int), priceHistory (optional [Double]), imageUrl, vibeTags ([String]), isNonstop (optional Bool), totalStops (optional Int).

- [ ] **Step 2: Create DealTier.swift**

```swift
enum DealTier: String, Codable {
    case amazing, great, good, fair

    var color: Color {
        switch self {
        case .amazing: .sgDealAmazing
        case .great: .sgDealGreat
        case .good: .sgDealGood
        case .fair: .sgMuted
        }
    }

    var label: String {
        switch self {
        case .amazing: "INCREDIBLE DEAL"
        case .great: "GREAT DEAL"
        case .good: "GOOD PRICE"
        case .fair: ""
        }
    }
}
```

- [ ] **Step 3: Create FeedResponse.swift**

```swift
struct FeedResponse: Codable {
    let destinations: [Deal]
    let page: Int
    let hasMore: Bool
    let totalCount: Int?
}
```

Check the actual API response shape from `api/feed.ts` — the response might use different field names.

- [ ] **Step 4: Create BookingModels.swift**

Structs for: TripOption (from booking search), PassengerData (form input), SeatMap, SeatInfo, SeatRow, BookingOrder (confirmation). Reference `api/booking.ts` for exact response shapes.

- [ ] **Step 5: Commit**

```bash
git add SoGoJet-iOS/SoGoJet/Models/
git commit -m "feat(ios): Phase 1.3 — data models (Deal, DealTier, Booking)"
```

### Task 1.4: APIClient + ImageCache + HapticEngine

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Services/APIClient.swift`
- Create: `SoGoJet-iOS/SoGoJet/Services/ImageCache.swift`
- Create: `SoGoJet-iOS/SoGoJet/Services/HapticEngine.swift`

- [ ] **Step 1: Create APIClient.swift**

Actor with:
- `static let shared` singleton
- `baseURL = URL(string: "https://sogojet.com/api")!`
- JSONDecoder with `.convertFromSnakeCase` key strategy
- `Endpoint` enum with all 9 API routes (feed, destination, topDeals, bookingSearch, bookingOrder, seatMap, swipe, alertCreate, subscribe)
- Each endpoint case defines `path: String`, `method: String`, `queryItems: [URLQueryItem]?`, `body: Encodable?`
- Generic `func fetch<T: Decodable>(_ endpoint: Endpoint) async throws -> T`
- Auth token stored as optional String, set after login

- [ ] **Step 2: Create ImageCache.swift**

Actor with:
- NSCache<NSString, UIImage> (memory, 50 count limit)
- FileManager-based disk cache in Caches directory
- `func image(for url: URL) async -> UIImage?` — checks memory → disk → network
- `func prefetch(_ urls: [URL])` — background download without blocking
- SHA256 hash for disk filenames
- `CachedAsyncImage` SwiftUI view that uses the cache

- [ ] **Step 3: Create HapticEngine.swift**

```swift
enum HapticEngine {
    static func light() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
    static func medium() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
    static func heavy() {
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add SoGoJet-iOS/SoGoJet/Services/
git commit -m "feat(ios): Phase 1.4 — APIClient actor, ImageCache, HapticEngine"
```

### Task 1.5: Stores + Router

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Stores/FeedStore.swift`
- Create: `SoGoJet-iOS/SoGoJet/Stores/SavedStore.swift`
- Create: `SoGoJet-iOS/SoGoJet/Stores/SettingsStore.swift`
- Create: `SoGoJet-iOS/SoGoJet/Stores/BookingStore.swift`
- Create: `SoGoJet-iOS/SoGoJet/Stores/Router.swift`

- [ ] **Step 1: Create FeedStore.swift**

@Observable class with: deals: [Deal], page: Int, isLoading: Bool, error: String?, filters (origin, vibes, priceRange, region). Methods: fetchDeals(origin:) async, fetchMore() async. Uses APIClient.shared.

- [ ] **Step 2: Create SavedStore.swift**

@Observable class with SwiftData @Model SavedDeal. Methods: toggle(deal:), clear(), isSaved(id:) -> Bool. Computed: totalSavings, totalValue, count.

- [ ] **Step 3: Create SettingsStore.swift**

@Observable class with @AppStorage properties: departureCode (default "TPA"), departureCity (default "Tampa"), preferredView (swipe/board), notificationsEnabled, priceAlertsEnabled, hasOnboarded.

- [ ] **Step 4: Create BookingStore.swift**

@Observable class with state machine:
```swift
enum BookingStep { case idle, searching, tripSelection, passengers, seats, review, paying, confirmed }
```
Properties: step, selectedOffer, passengers: [PassengerData], selectedSeats, bookingRef, deal. Methods: reset(), startSearch(deal:), selectOffer(_:), etc.

- [ ] **Step 5: Create Router.swift**

@Observable class with: selectedTab: Tab, feedPath: NavigationPath, savedPath: NavigationPath, presentedSheet: Sheet?, presentedFullScreen: FullScreenDestination?. Methods: openDeal(_:), startBooking(_:), deepLink(_:).

- [ ] **Step 6: Commit**

```bash
git add SoGoJet-iOS/SoGoJet/Stores/
git commit -m "feat(ios): Phase 1.5 — stores (Feed, Saved, Settings, Booking, Router)"
```

### Task 1.6: Extensions + Utilities

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Extensions/View+Accessibility.swift`
- Create: `SoGoJet-iOS/SoGoJet/Extensions/Date+Formatting.swift`

- [ ] **Step 1: Create accessibility extension**

```swift
extension View {
    func dealAccessibility(label: String, hint: String = "") -> some View {
        self.accessibilityLabel(label)
            .accessibilityHint(hint)
            .accessibilityAddTraits(.isButton)
    }
}
```

- [ ] **Step 2: Create date formatting extension**

```swift
extension String {
    var shortDate: String {
        // Parse "2026-04-15" → "Apr 15"
    }
    var boardTime: String {
        // Parse departure time → "14:25" format
    }
}
```

- [ ] **Step 3: Commit Phase 1 complete**

```bash
git add SoGoJet-iOS/
git commit -m "feat(ios): Phase 1 complete — foundation (theme, models, services, stores)"
git push origin main
```

---

## Phase 2: Split-Flap Engine

### Task 2.1: SplitFlapChar

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Views/Components/SplitFlapChar.swift`

- [ ] **Step 1: Build single character flip animation**

A view that displays one character on a dark cell background. When the character changes:
1. Top half rotates down around X-axis (0° → -90°) revealing the new character behind
2. Bottom half of new character flips up (-90° → 0°)
3. Shadow appears on the flipping half for depth
4. Duration ~150ms per character

Use `rotation3DEffect`, `clipped()` for top/bottom halves, `@State` for animation phase. The cell background is `Color.sgCell` with subtle border.

- [ ] **Step 2: Add #Preview with cycling characters**

Preview that cycles A-Z every 500ms to demonstrate the flip.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(ios): Phase 2.1 — SplitFlapChar with 3D rotation animation"
```

### Task 2.2: SplitFlapRow

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Views/Components/SplitFlapRow.swift`

- [ ] **Step 1: Build row of N SplitFlapChars**

Properties: text: String, maxLength: Int, size: Size (sm/md/lg), color: Color, align: Alignment, animate: Bool, startDelay: Double, staggerMs: Double, onComplete: (() -> Void)?

Logic: pad text to maxLength, render each SplitFlapChar with staggered delay = startDelay + (index * staggerMs). When last char completes animation, call onComplete.

- [ ] **Step 2: Add size variants**

sm: 14pt font, 22x28 cell. md: 20pt font, 28x36 cell. lg: 28pt font, 36x46 cell.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(ios): Phase 2.2 — SplitFlapRow with staggered animation"
git push origin main
```

---

## Phase 3: Feed + Swipe

### Task 3.1: DealCard

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Views/Feed/DealCard.swift`
- Create: `SoGoJet-iOS/SoGoJet/Views/Feed/DealBadge.swift`
- Create: `SoGoJet-iOS/SoGoJet/Views/Feed/PriceSparkline.swift`

- [ ] **Step 1: Build DealCard — full-screen card**

Full screen (GeometryReader for size). Layers: CachedAsyncImage background → gradient overlay → deal badge (top-left) → price tag (top-right) with SplitFlapRow → bottom content (destination SplitFlapRow, country, tagline, trip window, flight info chips, vibe tags, action buttons: Save, Share, Search Flights). Match the Expo SwipeCard.tsx layout exactly.

- [ ] **Step 2: Build DealBadge**

Small component: tier color background at 20% opacity, border at 60%, text showing "X% BELOW AVG" or tier label.

- [ ] **Step 3: Build PriceSparkline**

Swift Canvas view. Draw polyline of priceHistory array, dot for current price, dashed median line. Color-coded: green if below median, yellow at median, red above. 64x22 points.

- [ ] **Step 4: Add .contextMenu to DealCard**

Native iOS context menu with: Share, Save, Search Flights, View on Aviasales (if affiliateUrl exists). Each action triggers haptic + function.

- [ ] **Step 5: Add Deal of the Day badge**

If card is first in feed AND dealTier == .amazing, show golden "DEAL OF THE DAY" pill at top center.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(ios): Phase 3.1 — DealCard, DealBadge, PriceSparkline, context menu"
```

### Task 3.2: FeedView

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Views/Feed/FeedView.swift`

- [ ] **Step 1: Build vertical paging feed**

Use TabView with .tabViewStyle(.page(indexDisplayMode: .never)) and vertical axis, OR ScrollView with .scrollTargetBehavior(.paging). Each page is a DealCard. On appear: fetch deals. On reaching last 2 cards: fetchMore(). Show deal counter subtitle under logo: "243 deals · avg 34% off".

- [ ] **Step 2: Add immersion mode**

After user scrolls past 2 cards, fade header to 0 opacity (withAnimation .spring). Tap anywhere on header area restores it. Track visible index via ScrollViewReader or onChange.

- [ ] **Step 3: Add filter button + filter sheet**

FilterButton in header triggers .sheet presenting FilterSheet. FilterSheet has price chips, vibe chips, region chips. On dismiss, re-fetch with filters.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ios): Phase 3.2 — FeedView with paging, immersion, filters"
git push origin main
```

---

## Phase 4: Board View

### Task 4.1: DepartureRow + DepartureBoardView

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Views/Board/DepartureRow.swift`
- Create: `SoGoJet-iOS/SoGoJet/Views/Board/DepartureBoardView.swift`

- [ ] **Step 1: Build DepartureRow**

Row with 5 SplitFlapRow columns: time, destination, flight code, price, status (deal tier savings). Active row has yellow left border, inactive rows at 0.45 opacity.

- [ ] **Step 2: Build DepartureBoardView**

Show 5 visible rows from deals array. Swipe-up gesture (DragGesture) advances to next. Tap row 0 → navigate to detail. Tap other rows → make active. Detail strip below board shows active deal's dates, duration, nonstop badge, vibe tags. BOOK IT button at bottom.

- [ ] **Step 3: Add segmented control in FeedView**

Toggle between Swipe and Board view in the feed header. Use SwiftUI Picker with .segmented style or custom SegmentedControl.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ios): Phase 4 — DepartureBoard with split-flap rows"
git push origin main
```

---

## Phase 5: Saved + Settings

### Task 5.1: SavedView + SavedCard

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Views/Saved/SavedView.swift`
- Create: `SoGoJet-iOS/SoGoJet/Views/Saved/SavedCard.swift`
- Create: `SoGoJet-iOS/SoGoJet/Views/Saved/SavingsBanner.swift`

- [ ] **Step 1: Build SavedCard**

Grid card with CachedAsyncImage, gradient overlay, price SplitFlapRow, destination name, country, "Book →" chip. Heart remove button top-right.

- [ ] **Step 2: Build SavingsBanner**

Row showing: total savings (green), total trip value, trip count. Only visible when savedDeals.count > 0 and totalSavings > 0.

- [ ] **Step 3: Build SavedView**

Header with title + sort chips (Recent, Price ↑, Price ↓). SavingsBanner. LazyVGrid with 2 columns of SavedCards. Empty state: airplane emoji, "No saved flights yet", hint text. Tab badge showing saved count.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ios): Phase 5.1 — SavedView with grid, savings banner, sort"
```

### Task 5.2: SettingsView + AirportPicker

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Views/Settings/SettingsView.swift`
- Create: `SoGoJet-iOS/SoGoJet/Views/Settings/AirportPicker.swift`

- [ ] **Step 1: Build AirportPicker**

TextField with airport search, results list showing IATA code + city name. Uses airports data (hardcode top 60 US airports matching data/airports.ts).

- [ ] **Step 2: Build SettingsView**

Native List with sections: DEPARTURE (airport picker), DISPLAY (view toggle), NOTIFICATIONS (push + price alerts toggles), DATA (clear saved), ABOUT (privacy, terms, contact, version). Match the Expo settings screen layout.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(ios): Phase 5.2 — Settings + AirportPicker"
git push origin main
```

---

## Phase 6: Destination Detail

### Task 6.1: DestinationDetailView

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Views/Detail/DestinationDetailView.swift`
- Create: `SoGoJet-iOS/SoGoJet/Views/Detail/QuickFactsStrip.swift`
- Create: `SoGoJet-iOS/SoGoJet/Views/Detail/SimilarDeals.swift`
- Create: `SoGoJet-iOS/SoGoJet/Views/Detail/PriceAlertCTA.swift`

- [ ] **Step 1: Build DestinationDetailView**

ScrollView with: hero image (360pt), back button overlay, SplitFlapRow destination name, country, tagline. Deal tier badge row. Price card with SplitFlapRow price + usual price strikethrough + savings. Quick facts strip. Trip details grid (depart, return, duration, flight). Description section. Vibe tags. Itinerary (if available). Restaurants (if available). Price alert CTA. Similar destinations. Bottom bar: save button + share button + "Search Flights" primary CTA.

- [ ] **Step 2: Build QuickFactsStrip**

Horizontal ScrollView of pill-shaped facts: Nonstop (green), trip duration, flight time, stops, deal quality.

- [ ] **Step 3: Build SimilarDeals**

2-column LazyVGrid of deals with matching vibes. Each card: image, city, country, price. Tap navigates to that deal's detail.

- [ ] **Step 4: Build PriceAlertCTA**

Card with "Track this price" title, description with destination + price, "Alert" button with bell icon.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ios): Phase 6 — Destination detail with all sections"
git push origin main
```

---

## Phase 7: Booking Flow

### Task 7.1: TripView + DealExpiredView

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Views/Booking/TripView.swift`
- Create: `SoGoJet-iOS/SoGoJet/Views/Booking/DealExpiredView.swift`

- [ ] **Step 1: Build TripView**

"Your Trip" screen. Hero card showing destination, price, dates, airline. Expandable alternatives section. "Continue to Booking" button triggers Duffel search. Loading state during search. Price discrepancy handling: if deal_expired → show DealExpiredView. If moderate_increase → show alert dialog.

- [ ] **Step 2: Build DealExpiredView**

Timer icon, "Deal Expired" title, explanation text, "Set Price Alert" green button, "Back to deals" link.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(ios): Phase 7.1 — TripView + DealExpiredView"
```

### Task 7.2: PassengerForm

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Views/Booking/PassengerForm.swift`

- [ ] **Step 1: Build passenger form**

Native SwiftUI Form with: Title picker (Mr/Mrs/Ms/Miss/Dr), given name, family name ("As on passport" hint), date of birth (DatePicker), gender (segmented), email, phone. Real-time validation. Continue button disabled until all valid. SplitFlapRow "PASSENGER" header.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(ios): Phase 7.2 — PassengerForm with validation"
```

### Task 7.3: SeatMapView

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Views/Booking/SeatMapView.swift`

- [ ] **Step 1: Build seat map**

ScrollView with seat grid. Each seat is a small square: available (dark), selected (yellow), occupied (faint, disabled), extra legroom (green border), recommended (gold border + dot). Legend row at top. Skip button. Continue stores selected seat in BookingStore.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(ios): Phase 7.3 — SeatMapView with recommended seat"
```

### Task 7.4: ReviewView + BoardingPassView

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Views/Booking/ReviewView.swift`
- Create: `SoGoJet-iOS/SoGoJet/Views/Booking/BoardingPassView.swift`

- [ ] **Step 1: Build ReviewView**

Line items: base fare, seat (if selected), taxes. Total amount. Pay button (initially just triggers API call, Apple Pay integration later). On success → set BookingStore to .confirmed, show BoardingPassView.

- [ ] **Step 2: Build BoardingPassView**

Boarding pass card: header strip (SOGOJET | BOARDING PASS), route section (origin IATA → airplane → dest IATA), perforated divider (use DottedLine + circle notches via clipShape), details grid (passenger, airline, dates), booking ref in display font, barcode strip (decorative rectangles), "Share Trip" + "Back to Deals" buttons.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(ios): Phase 7.4 — ReviewView + BoardingPassView"
git push origin main
```

---

## Phase 8: Onboarding + Polish

### Task 8.1: OnboardingView

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Views/Onboarding/OnboardingView.swift`

- [ ] **Step 1: Build onboarding**

Airplane emoji, "SOGOJET" in display font (yellow), tagline in accent font. Split-flap teaser cycling destinations (Barcelona $287, Tokyo $412, etc.) every 2.5s. Value prop row (3 items). "Where are you flying from?" heading. Airport picker (same as settings). "Let's Go" button → sets hasOnboarded, navigates to tabs.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(ios): Phase 8.1 — OnboardingView with split-flap teaser"
```

### Task 8.2: ToastView

**Files:**
- Create: `SoGoJet-iOS/SoGoJet/Views/Components/ToastView.swift`

- [ ] **Step 1: Build toast system**

ToastManager @Observable singleton with show(message:type:). ToastView overlays content, slides in from top with spring animation, auto-dismisses after 2.5s. Success (green icon), error (red), info (yellow). Wire into save/share/clear actions.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(ios): Phase 8.2 — ToastView notification system"
```

### Task 8.3: Accessibility Pass

- [ ] **Step 1: Add .accessibilityLabel to every interactive element**

Sweep all Views. Every Pressable/Button/tappable element must have .accessibilityLabel. Images need .accessibilityLabel(deal.destination). Decorative elements get .accessibilityHidden(true).

- [ ] **Step 2: Add Dynamic Type support**

Replace fixed font sizes with .font(.sgBody(16)) which should respect Dynamic Type. Use @ScaledMetric for spacing where needed.

- [ ] **Step 3: Add reduce motion support**

Check `@Environment(\.accessibilityReduceMotion)` in SplitFlapChar and any spring animation. Replace with .easeInOut(duration: 0.2) when enabled.

- [ ] **Step 4: Final commit**

```bash
git commit -m "feat(ios): Phase 8.3 — accessibility pass (VoiceOver, Dynamic Type, reduce motion)"
git push origin main
```

---

## Verification

After all phases:
1. Build succeeds: `xcodebuild -scheme SoGoJet -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build`
2. All screens render in Xcode Previews
3. API calls work: feed loads, destination detail works, booking flow progresses
4. Split-flap animation plays smoothly at 60fps
5. VoiceOver reads every interactive element
6. Accessibility Inspector shows no issues
