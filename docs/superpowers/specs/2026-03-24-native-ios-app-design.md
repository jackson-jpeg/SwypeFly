# SoGoJet Native iOS App — Design Spec

## Overview

Native SwiftUI iOS app for SoGoJet. Full port of the Expo React Native app into pure Swift with zero external dependencies. Connects to the existing Vercel serverless API backend.

**Target:** iOS 17+ | **Architecture:** Pure SwiftUI + @Observable + SwiftData | **Dependencies:** None (Apple frameworks only)

## Decisions

- **Full port** — all 15 screens from the Expo app
- **Zero dependencies** — custom image cache, custom split-flap animation, no Kingfisher/Lottie
- **Same backend** — all existing `/api/*` Vercel endpoints stay as-is
- **Accessibility first** — VoiceOver labels on every interactive element, Dynamic Type, reduce motion support

## Navigation Architecture

Router coordinator pattern. Each tab owns a NavigationStack with typed NavigationPath. A central `Router` @Observable manages deep links, cross-tab navigation, and modal presentation.

```swift
@Observable final class Router {
    var feedPath = NavigationPath()
    var savedPath = NavigationPath()
    var selectedTab: Tab = .feed
    var presentedSheet: Sheet?
    var presentedFullScreen: FullScreenDestination?

    enum Tab: Int { case feed, saved, settings }
    enum Sheet { case filters, airportPicker }
    enum FullScreenDestination {
        case destination(Deal)
        case booking(Deal, BookingStep)
        case onboarding
    }
}
```

**Why:** Testable (plain @Observable), deep-linkable (URL → Router state), no navigation spaghetti.

## State Management

All stores are `@Observable` classes, injected into the view hierarchy via `.environment()`. No singletons except ImageCache and APIClient (both actors).

```swift
// SoGoJetApp.swift — creates and injects all stores
@main struct SoGoJetApp: App {
    @State private var feedStore = FeedStore()
    @State private var savedStore = SavedStore()
    @State private var settings = SettingsStore()
    @State private var router = Router()
    @State private var bookingStore = BookingStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(feedStore)
                .environment(savedStore)
                .environment(settings)
                .environment(router)
                .environment(bookingStore)
                .modelContainer(for: SavedDeal.self)
        }
    }
}
```

### Store responsibilities:
- **FeedStore** — deals array, pagination (page cursor), loading state, filters, fetchDeals()/fetchMore()
- **SavedStore** — SwiftData @Model array, toggle save/unsave, totalSavings computed property
- **SettingsStore** — @AppStorage: departureCode, preferredView, notificationsEnabled, hasOnboarded
- **BookingStore** — state machine (idle → searching → selecting → passengers → seats → review → confirmed), passenger/seat/offer data
- **Router** — tab selection, NavigationPath per tab, modal/sheet state, deep link parsing

## Networking — APIClient

Actor-based for thread safety. Type-safe Endpoint enum for compile-time route safety.

```swift
actor APIClient {
    static let shared = APIClient()
    private let baseURL = URL(string: "https://sogojet.com/api")!
    private let decoder: JSONDecoder  // .convertFromSnakeCase + .iso8601

    enum Endpoint {
        case feed(origin: String, page: Int, filters: FeedFilters?)
        case destination(id: String)
        case topDeals(limit: Int)
        case bookingSearch(origin: String, destination: String, outDate: String, returnDate: String)
        case bookingOrder(offerId: String, passengers: [PassengerData])
        case seatMap(offerId: String)
        case swipe(dealId: String, action: String)
        case alertCreate(destinationId: String, targetPrice: Int)
        case subscribe(email: String)

        var path: String { /* route mapping */ }
        var method: String { /* GET or POST */ }
        var body: Data? { /* JSON encoding for POST */ }
    }

    func fetch<T: Decodable>(_ endpoint: Endpoint) async throws -> T
}
```

## Image Cache

Two-layer custom cache, no dependencies.

- **Memory:** NSCache, 50 UIImage objects max, auto-evicted on memory pressure
- **Disk:** FileManager Caches directory, SHA256 filenames, 7-day TTL, 200MB cap
- **API:** `CachedAsyncImage(url:)` view — drop-in AsyncImage replacement with loading/error states

## Animation System

Three tiers, all spring-based:

| Tier | Use | Config |
|------|-----|--------|
| Micro | Button press, toggle | `.spring(response: 0.3, dampingFraction: 0.6)` |
| Medium | Card transitions, sheet | `.spring(response: 0.5, dampingFraction: 0.8)` |
| Signature | Split-flap character flip | `rotation3DEffect` + stagger delay per char |

**Rule:** Every state change is animated. Reduce Motion users get `.easeInOut(duration: 0.2)` instead of springs. `@Environment(\.accessibilityReduceMotion)` checked in every animated view.

## Split-Flap Engine

The signature component. Each character is a `SplitFlapChar` view that:
1. Shows current character on a dark cell background
2. On change: top half flips down (rotation3DEffect around X axis) revealing new char
3. Stagger delay between characters in a row (30-50ms)
4. Shadow on the flipping half for depth
5. Mechanical "thunk" haptic on each character landing

`SplitFlapRow` composes N characters, manages stagger timing, and calls onComplete.

## Project Structure

```
SoGoJet-iOS/
├── SoGoJet/
│   ├── App/
│   │   ├── SoGoJetApp.swift
│   │   └── ContentView.swift
│   ├── Models/
│   │   ├── Deal.swift
│   │   ├── BookingModels.swift
│   │   └── DealTier.swift
│   ├── Services/
│   │   ├── APIClient.swift
│   │   ├── ImageCache.swift
│   │   └── HapticEngine.swift
│   ├── Stores/
│   │   ├── FeedStore.swift
│   │   ├── SavedStore.swift
│   │   ├── SettingsStore.swift
│   │   ├── BookingStore.swift
│   │   └── Router.swift
│   ├── Views/
│   │   ├── Feed/ (FeedView, DealCard, DealBadge, PriceSparkline)
│   │   ├── Board/ (DepartureBoardView, SplitFlapText, DepartureRow)
│   │   ├── Detail/ (DestinationDetailView, QuickFacts, SimilarDeals, PriceAlertCTA)
│   │   ├── Saved/ (SavedView, SavedCard, SavingsBanner)
│   │   ├── Booking/ (TripView, PassengerForm, SeatMapView, ReviewView, BoardingPassView, DealExpiredView)
│   │   ├── Settings/ (SettingsView, AirportPicker)
│   │   ├── Onboarding/ (OnboardingView)
│   │   └── Components/ (SplitFlapChar, SplitFlapRow, CachedAsyncImage, ToastView, FilterSheet)
│   ├── Theme/
│   │   ├── Colors.swift
│   │   ├── Fonts.swift
│   │   └── Spacing.swift
│   ├── Extensions/
│   │   ├── View+Accessibility.swift
│   │   └── Date+Formatting.swift
│   └── Resources/
│       ├── Assets.xcassets
│       └── Fonts/ (BebasNeue, Inter, PlayfairDisplay .ttf)
└── SoGoJet.xcodeproj
```

## Screens (15 total)

| Screen | Type | Key Features |
|--------|------|-------------|
| Feed (Swipe) | Tab 1 | Full-screen paging, deal badges, sparklines, context menu, immersion mode |
| Departure Board | Tab 1 Alt | Split-flap rows, 3D flip, swipe-up advance, deal tier colors |
| Saved | Tab 2 | 2-col grid, savings banner, sort chips, SwiftData persistence |
| Settings | Tab 3 | Airport picker, view toggle, notifications, legal links |
| Destination Detail | Modal | Hero image, quick facts, similar deals, price alert CTA |
| Filter Sheet | Sheet | Price range, vibes, regions — .presentationDetents |
| Your Trip | Booking 1 | Hero card, alternatives, price discrepancy tiers |
| Passengers | Booking 2 | Native Form, validation, title/name/DOB/gender/email |
| Seat Map | Booking 3 | Scrollable plane, recommended seat, legroom highlight |
| Review & Pay | Booking 4 | Line items, Apple Pay, price increase modal |
| Boarding Pass | Booking 5 | Perforated card, route, barcode, share button |
| Onboarding | Flow | Split-flap teaser, value props, airport picker |
| Deal Expired | Flow | Timer icon, explanation, set alert CTA |
| Privacy Policy | Legal | ScrollView with styled text |
| Terms of Service | Legal | ScrollView with styled text |

## API Surface

All calls to `https://sogojet.com/api/`:
- `GET /feed?origin=TPA&page=0` — paginated deals
- `GET /destination?id=<id>` — single destination detail
- `POST /swipe` — record swipe action
- `GET /top-deals?limit=10` — public top deals
- `POST /booking?action=search` — Duffel flight search
- `POST /booking?action=order` — create booking order
- `GET /booking?action=offer&offerId=<id>` — seat map
- `POST /alerts?action=create` — create price alert
- `POST /subscribe` — newsletter signup

Auth: Bearer token from Clerk JWT in Authorization header. Guest mode works without auth for feed browsing.

## Implementation Phases

1. **Foundation** — Xcode project, theme (colors/fonts/spacing), Deal model, APIClient actor, ImageCache, HapticEngine
2. **Split-Flap Engine** — SplitFlapChar (3D rotation), SplitFlapRow (stagger), used by every screen
3. **Feed + Swipe** — FeedView (TabView paging), DealCard, DealBadge, PriceSparkline (Canvas), context menu, immersion mode
4. **Board View** — DepartureBoardView, DepartureRow, detail strip, swipe-up gesture
5. **Saved + Settings** — SavedView (LazyVGrid), SavingsBanner, SettingsView, AirportPicker, SwiftData
6. **Destination Detail** — Hero, QuickFacts, SimilarDeals, PriceAlertCTA, restaurants, itinerary
7. **Booking Flow** — TripView, PassengerForm, SeatMapView, ReviewView, BoardingPassView, DealExpiredView
8. **Onboarding + Polish** — OnboardingView, ToastView, accessibility pass, reduce motion, Dynamic Type

## Testing

- **Unit:** Deal model decoding, APIClient mock, FeedStore pagination, BookingStore state machine, DealTier classification
- **Previews:** Every view has #Preview with mock data — visual regression via Xcode canvas
- **Accessibility:** Xcode Accessibility Inspector audit on every screen, VoiceOver walkthrough of booking flow
