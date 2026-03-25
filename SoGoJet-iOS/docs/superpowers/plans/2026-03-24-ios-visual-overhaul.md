# iOS Visual Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the SoGoJet iOS app down to a clean, modern dark UI with full-bleed photo cards and a properly functioning split-flap departure board — removing all vintage skeuomorphism except the flipboard itself.

**Architecture:** Three view rewrites (DealCard, DestinationDetailView, DepartureBoardView) plus a color palette update and airline name mapping. No store/model/API changes. The split-flap animation engine (SplitFlapChar, SplitFlapRow) stays untouched.

**Tech Stack:** SwiftUI, iOS 17+, @Observable, zero external dependencies

**Spec:** `docs/superpowers/specs/2026-03-24-ios-visual-overhaul-design.md`

---

### Task 1: Create Airlines.swift — IATA code → airline name lookup

**Files:**
- Create: `SoGoJet/Extensions/Airlines.swift`
- Modify: `SoGoJet/Models/Deal.swift:159-162`

- [ ] **Step 1: Create Airlines.swift**

```swift
// SoGoJet/Extensions/Airlines.swift
import Foundation

enum Airlines {
    static let names: [String: String] = [
        "2B": "Albawings", "4O": "Interjet", "5J": "Cebu Pacific",
        "6E": "IndiGo", "7C": "Jeju Air", "8M": "Myanmar Airways",
        "9W": "Jet Airways", "AA": "American", "AC": "Air Canada",
        "AF": "Air France", "AI": "Air India", "AM": "Aeromexico",
        "AR": "Aerolineas Argentinas", "AS": "Alaska", "AT": "Royal Air Maroc",
        "AV": "Avianca", "AY": "Finnair", "AZ": "ITA Airways",
        "B6": "JetBlue", "BA": "British Airways", "BR": "EVA Air",
        "CA": "Air China", "CI": "China Airlines", "CM": "Copa Airlines",
        "CO": "Copa Airlines", "CX": "Cathay Pacific", "CZ": "China Southern",
        "DE": "Condor", "DL": "Delta", "DY": "Norwegian",
        "EI": "Aer Lingus", "EK": "Emirates", "ET": "Ethiopian",
        "EV": "ExpressJet", "EW": "Eurowings", "EY": "Etihad",
        "F8": "Flair", "F9": "Frontier", "FI": "Icelandair",
        "FJ": "Fiji Airways", "FR": "Ryanair", "G4": "Allegiant",
        "GA": "Garuda Indonesia", "GF": "Gulf Air", "HA": "Hawaiian",
        "HU": "Hainan Airlines", "IB": "Iberia", "JL": "Japan Airlines",
        "JQ": "Jetstar", "KE": "Korean Air", "KL": "KLM",
        "KQ": "Kenya Airways", "LA": "LATAM", "LH": "Lufthansa",
        "LO": "LOT Polish", "LU": "LAN Express", "LX": "Swiss",
        "MH": "Malaysia Airlines", "MS": "EgyptAir", "MU": "China Eastern",
        "NH": "ANA", "NK": "Spirit", "NZ": "Air New Zealand",
        "OK": "Czech Airlines", "OS": "Austrian", "OZ": "Asiana",
        "PC": "Pegasus", "PG": "Bangkok Airways", "PR": "Philippine Airlines",
        "PS": "UIA", "QF": "Qantas", "QR": "Qatar Airways",
        "RO": "TAROM", "SA": "South African", "SK": "SAS",
        "SN": "Brussels Airlines", "SQ": "Singapore Airlines", "SU": "Aeroflot",
        "SV": "Saudia", "TG": "Thai Airways", "TK": "Turkish Airlines",
        "TN": "Air Tahiti Nui", "TP": "TAP Portugal", "TU": "Tunisair",
        "UA": "United", "UL": "SriLankan", "UX": "Air Europa",
        "VA": "Virgin Australia", "VB": "VivaAerobus", "VN": "Vietnam Airlines",
        "VS": "Virgin Atlantic", "VY": "Vueling", "W6": "Wizz Air",
        "WN": "Southwest", "WS": "WestJet", "XP": "Xtra Airways",
        "Y4": "Volaris",
    ]

    static func name(for code: String?) -> String? {
        guard let code, !code.isEmpty else { return nil }
        return names[code.uppercased()]
    }
}
```

- [ ] **Step 2: Update Deal.airlineName to use the lookup**

In `SoGoJet/Models/Deal.swift`, replace lines 159-162:

```swift
// OLD (lines 159-162):
/// Airline display name (IATA code or "—")
var airlineName: String {
    airline ?? "—"
}

// NEW:
/// Airline display name — resolved from IATA code, falls back to raw code, then "—"
var airlineName: String {
    if let code = airline {
        return Airlines.name(for: code) ?? code
    }
    return "—"
}
```

- [ ] **Step 3: Add the file to the Xcode project**

Run: `open SoGoJet-iOS/SoGoJet.xcodeproj` — verify the file appears in the project navigator under Extensions group. If using file-system based targets, it should be auto-included.

- [ ] **Step 4: Build and verify**

Run: `cd /Users/jackson/SwypeFly/SoGoJet-iOS && xcodebuild -scheme SoGoJet -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -5`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 5: Commit**

```bash
git add SoGoJet/Extensions/Airlines.swift SoGoJet/Models/Deal.swift
git commit -m "feat(ios): add airline name mapping — IATA codes resolve to display names"
```

---

### Task 2: Update color palette — warm to neutral

**Files:**
- Modify: `SoGoJet/Theme/Colors.swift`

- [ ] **Step 1: Update Colors.swift**

Replace these specific color definitions in `SoGoJet/Theme/Colors.swift`:

```swift
// Line 9: sgBg — warm near-black → neutral near-black
static let sgBg         = Color(hex: 0x0A0A0A)

// Line 10: sgSurface — warm dark → neutral dark
static let sgSurface    = Color(hex: 0x141414)

// Line 11: sgCell — warm → neutral
static let sgCell       = Color(hex: 0x1A1A1A)

// Line 12: sgBorder — warm → neutral
static let sgBorder     = Color(hex: 0x2A2A2A)

// Line 20: sgWhite — warm off-white → crisp off-white
static let sgWhite      = Color(hex: 0xF5F5F5)

// Line 21: sgWhiteDim — warm → neutral
static let sgWhiteDim   = Color(hex: 0xCCCCCC)

// Line 22: sgMuted — warm brown → neutral gray
static let sgMuted      = Color(hex: 0x888888)

// Line 23: sgFaint — warm brown → neutral dark gray
static let sgFaint      = Color(hex: 0x555555)
```

**DO NOT change:** sgYellow, sgGreen, sgOrange (accent colors stay warm — they're the split-flap palette).
**DO NOT change:** Deal tier colors (sgDealAmazing, sgDealGreat, sgDealGood, sgRed).

Also update the card gradient to use the new background hex:

```swift
// Lines 33-40: Update gradient base to match new sgBg
static let cardGradient = LinearGradient(
    colors: [
        Color.clear,
        Color(hex: 0x0A0A0A).opacity(0.85)
    ],
    startPoint: .top,
    endPoint: .bottom
)
```

- [ ] **Step 2: Build and verify**

Run: `cd /Users/jackson/SwypeFly/SoGoJet-iOS && xcodebuild -scheme SoGoJet -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -5`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add SoGoJet/Theme/Colors.swift
git commit -m "feat(ios): shift color palette from warm to neutral — keep split-flap gold"
```

---

### Task 3: Rewrite DealCard.swift — full-bleed photo with minimal overlay

**Files:**
- Rewrite: `SoGoJet/Views/Feed/DealCard.swift`

This is the biggest change. The current 466-line card with Fare Stub, info boxes, Travel Notes, etc. becomes a ~120-line full-bleed photo card.

- [ ] **Step 1: Rewrite DealCard.swift**

Replace the entire file content. Keep the same struct signature (DealCard with deal, isSaved, isFirst, animate, callbacks) so FeedView.swift doesn't need changes to its call site.

```swift
import SwiftUI

// MARK: - Deal Card
// Full-bleed destination photo with minimal overlay.
// City, country, price badge, flight teaser — that's it.

struct DealCard: View {
    let deal: Deal
    let isSaved: Bool
    let isFirst: Bool
    var animate: Bool = true
    var onSave: () -> Void = {}
    var onShare: () -> Void = {}
    var onBook: () -> Void = {}
    var onTap: () -> Void = {}

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Full-bleed photo
                heroImage(size: geo.size)

                // Bottom gradient for text legibility
                VStack {
                    Spacer()
                    LinearGradient(
                        colors: [.clear, Color(hex: 0x0A0A0A, alpha: 0.75)],
                        startPoint: .init(x: 0.5, y: 0),
                        endPoint: .init(x: 0.5, y: 1)
                    )
                    .frame(height: geo.size.height * 0.45)
                }

                // Content overlay
                VStack {
                    // Top row: save button + country
                    HStack {
                        saveButton
                        Spacer()
                        if !deal.country.isEmpty {
                            Text(deal.country.uppercased())
                                .font(SGFont.bodySmall)
                                .foregroundStyle(Color.sgWhite.opacity(0.6))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 4)
                        }
                    }
                    .padding(.top, 8)
                    .padding(.horizontal, 16)

                    Spacer()

                    // Bottom: city name, flight teaser, price badge
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(deal.city.uppercased())
                                .font(SGFont.display(size: 34))
                                .foregroundStyle(Color.sgWhite)
                                .lineLimit(1)

                            flightTeaser
                        }

                        Spacer()

                        priceBadge
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 20)
                }
            }
            }
        .contentShape(Rectangle())
        .onTapGesture { onTap() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(deal.city), \(deal.country ?? ""), \(deal.priceFormatted)")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Hero Image

    @ViewBuilder
    private func heroImage(size: CGSize) -> some View {
        // CachedAsyncImage takes a String? and a placeholder closure.
        // It internally applies .resizable().aspectRatio(contentMode: .fill).
        CachedAsyncImage(url: deal.imageUrl) {
            fallbackBackground
        }
        .frame(width: size.width, height: size.height)
        .clipped()
    }

    private var fallbackBackground: some View {
        Rectangle()
            .fill(Color.sgSurface)
            .overlay {
                Text(deal.city.uppercased())
                    .font(SGFont.display(size: 48))
                    .foregroundStyle(Color.sgMuted.opacity(0.3))
            }
    }

    // MARK: - Components

    private var saveButton: some View {
        Button(action: onSave) {
            Image(systemName: isSaved ? "heart.fill" : "heart")
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(isSaved ? Color.sgYellow : Color.sgWhite)
                .frame(width: 44, height: 44)
                .background(Color.black.opacity(0.3))
                .clipShape(Circle())
        }
        .accessibilityLabel(isSaved ? "Remove from saved" : "Save")
    }

    private var priceBadge: some View {
        Text(deal.priceFormatted)
            .font(SGFont.bodyBold(size: 20))
            .foregroundStyle(Color.sgWhite)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(deal.tierColor)
            .clipShape(Capsule())
    }

    @ViewBuilder
    private var flightTeaser: some View {
        let parts = buildFlightTeaser()
        if !parts.isEmpty {
            Text(parts)
                .font(SGFont.bodySmall)
                .foregroundStyle(Color.sgWhite.opacity(0.7))
                .lineLimit(1)
        }
    }

    private func buildFlightTeaser() -> String {
        var parts: [String] = []
        if deal.airlineName != "—" {
            parts.append(deal.airlineName)
        }
        if let duration = deal.flightDuration, !duration.isEmpty {
            parts.append(duration)
        }
        let stops = deal.stopsLabel
        if !stops.isEmpty {
            parts.append(stops.lowercased())
        }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Preview

#Preview("Deal Card") {
    DealCard(
        deal: .preview,
        isSaved: false,
        isFirst: true
    )
    .frame(height: 700)
}
```

- [ ] **Step 2: Check that CachedAsyncImage exists**

The card uses `CachedAsyncImage`. Verify this view exists in the project:

Run: `grep -r "struct CachedAsyncImage" SoGoJet/`

If it doesn't exist, check if the app uses `AsyncImage` directly or a custom wrapper from ImageCache.swift. Adapt the hero image section to use whatever image loading pattern exists in the codebase.

- [ ] **Step 3: Build and verify**

Run: `cd /Users/jackson/SwypeFly/SoGoJet-iOS && xcodebuild -scheme SoGoJet -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -20`
Expected: `** BUILD SUCCEEDED **`

Fix any compilation errors (likely: CachedAsyncImage import path, missing Spacing constants, SGFont availability).

- [ ] **Step 4: Commit**

```bash
git add SoGoJet/Views/Feed/DealCard.swift
git commit -m "feat(ios): rewrite DealCard — full-bleed photo with minimal overlay"
```

---

### Task 4: Simplify FeedView.swift — remove vintage chrome

**Files:**
- Modify: `SoGoJet/Views/Feed/FeedView.swift`

The feed container wraps cards. Key changes:
1. Remove `VintageTerminalBackdrop()` usage (line ~40-41)
2. Remove the "NOW BOARDING" bottom ticker
3. Simplify the header to just departure airport + search + filter buttons
4. Use plain `Color.sgBg` as background

- [ ] **Step 1: Remove VintageTerminalBackdrop**

In FeedView.swift, find the background and replace:

```swift
// OLD (around line 40):
VintageTerminalBackdrop()

// NEW:
Color.sgBg.ignoresSafeArea()
```

- [ ] **Step 2: Remove "NOW BOARDING" bottom ticker**

Find the bottom ticker section (search for "NOW BOARDING" or "nowBoardingBar") and remove it entirely. The current deal info doesn't need a redundant bar — the card itself shows it.

- [ ] **Step 3: Remove "Controls — Show top chrome again" button**

Find the controls button and remove it. The header should stay visible or auto-show on tap (existing behavior) without a dedicated button.

- [ ] **Step 4: Simplify header**

Keep only:
- Departure airport code button (left)
- Search button (right)
- Filter button (right)

Remove any VintageTerminal-prefixed header components (VintageTerminalTopBar, stamps, telemetry displays).

- [ ] **Step 5: Build and verify**

Run: `cd /Users/jackson/SwypeFly/SoGoJet-iOS && xcodebuild -scheme SoGoJet -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -20`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 6: Commit**

```bash
git add SoGoJet/Views/Feed/FeedView.swift
git commit -m "feat(ios): strip FeedView chrome — clean dark background, minimal header"
```

---

### Task 5: Fix DepartureBoardView — row sizing, tap-to-detail, clean header

**Files:**
- Modify: `SoGoJet/Views/Board/DepartureBoardView.swift`
- Modify: `SoGoJet/Views/Board/DepartureRow.swift`

- [ ] **Step 1: Make ALL rows tappable for detail navigation**

In `DepartureBoardView.swift`, find `handleRowTap` (line ~626):

```swift
// OLD:
private func handleRowTap(index: Int, deal: Deal) {
    if index == 0 {
        HapticEngine.medium()
        router.showDeal(deal)
    } else {
        HapticEngine.light()
        boardIndex += index
    }
}

// NEW — all rows navigate to detail:
private func handleRowTap(index: Int, deal: Deal) {
    HapticEngine.medium()
    router.showDeal(deal)
}
```

- [ ] **Step 2: Add country subtitle to DepartureRow**

In `SoGoJet/Views/Board/DepartureRow.swift`, add a `country` field to `DepartureBoardSlot` and display it.

Update `DepartureBoardSlot`:
```swift
struct DepartureBoardSlot: Identifiable, Equatable {
    let id: Int
    let deal: Deal?
    let code: String
    let destination: String
    let price: String
    let airlineName: String
    let country: String        // ADD THIS

    // ... update blank() and fromDeal():
    static func blank(slot: Int) -> DepartureBoardSlot {
        DepartureBoardSlot(
            id: slot, deal: nil, code: "   ",
            destination: "        ", price: "    ",
            airlineName: "", country: ""
        )
    }

    static func fromDeal(_ deal: Deal, slot: Int) -> DepartureBoardSlot {
        DepartureBoardSlot(
            id: slot, deal: deal,
            code: deal.iataCode.uppercased(),
            destination: deal.city.uppercased(),
            price: deal.priceFormatted,
            airlineName: deal.airlineName,
            country: deal.country ?? ""
        )
    }
}
```

Update `DepartureRow` body — add a subtitle line below the split-flap row:

```swift
var body: some View {
    VStack(alignment: .leading, spacing: 2) {
        // Existing split-flap HStack
        HStack(spacing: Spacing.sm) {
            // ... existing 3 SplitFlapRow cells (unchanged)
        }

        // NEW: Country subtitle line
        if !slot.isBlank, let deal = slot.deal {
            HStack(spacing: 4) {
                Text(slot.country)
                if let dur = deal.flightDuration, !dur.isEmpty {
                    Text("·")
                    Text(dur)
                }
                let stops = deal.stopsLabel
                if !stops.isEmpty {
                    Text("·")
                    Text(stops.lowercased())
                }
            }
            .font(SGFont.caption)
            .foregroundStyle(Color.sgMuted)
            .padding(.leading, 64 + Spacing.sm) // align with destination column
        }
    }
    .padding(.vertical, Spacing.xs)
    .padding(.horizontal, Spacing.sm)
    // ... rest of modifiers unchanged
}
```

- [ ] **Step 3: Fix row sizing — ensure rows fill available space**

In `DepartureBoardView.swift`, find the board panel where rows are laid out. Ensure each row has a minimum height:

```swift
// On each DepartureRow in the board, add:
.frame(minHeight: 72)
```

- [ ] **Step 4: Fix gesture conflict**

In `DepartureBoardView.swift`, find `swipeGesture` (line ~601). Add `minimumDistance` to prevent conflict with system edge gestures:

```swift
private var swipeGesture: some Gesture {
    DragGesture(minimumDistance: 30)  // ADD minimumDistance
        .onChanged { value in
            // ... unchanged
        }
        .onEnded { value in
            // ... unchanged
        }
}
```

- [ ] **Step 5: Clean header — remove vintage chrome**

In the board header section, simplify to:
- "DEPARTURES" text (can use SplitFlapRow for the title)
- Airport code button (right-aligned)
- Search + filter buttons

Remove any VintageTerminal-prefixed header wrappers.

- [ ] **Step 6: Update separator colors**

Replace any gold/yellow separator lines with neutral dark gray:

```swift
// Replace any separator using sgYellow or sgBorder with:
Rectangle()
    .fill(Color(hex: 0x1A1A1A))
    .frame(height: 1)
```

- [ ] **Step 7: Build and verify**

Run: `cd /Users/jackson/SwypeFly/SoGoJet-iOS && xcodebuild -scheme SoGoJet -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -20`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 8: Commit**

```bash
git add SoGoJet/Views/Board/DepartureBoardView.swift SoGoJet/Views/Board/DepartureRow.swift
git commit -m "feat(ios): fix departure board — all rows tap to detail, country subtitles, gesture fix"
```

---

### Task 6: Rewrite DestinationDetailView.swift — clean destination page

**Files:**
- Rewrite: `SoGoJet/Views/Detail/DestinationDetailView.swift`

The current 503-line detail view with "Arrival Dossier", "Fare Memory", "Travel Desk Notes" becomes a clean scrollable page.

- [ ] **Step 1: Rewrite DestinationDetailView.swift**

Keep the same struct signature (DestinationDetailView with deal, allDeals, environment stores).

```swift
import SwiftUI
import UIKit

struct DestinationDetailView: View {
    let deal: Deal
    let allDeals: [Deal]

    @Environment(SavedStore.self) private var savedStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(Router.self) private var router

    @State private var shareItem: DetailShareItem?

    private var isSaved: Bool {
        savedStore.isSaved(deal.id)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    heroSection
                    flightInfoSection
                    travelGuideSection
                    similarDealsSection
                }
                .padding(.bottom, 100) // space for sticky bar
            }
            .background(Color.sgBg)

            stickyBottomBar
        }
        .sheet(item: $shareItem) { item in
            ShareSheet(url: item.url)
        }
    }

    // MARK: - Hero Section

    private var heroSection: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottomLeading) {
                // Photo — CachedAsyncImage takes String?, applies resizable+fill internally
                CachedAsyncImage(url: deal.imageUrl) {
                    Rectangle().fill(Color.sgSurface)
                }
                .frame(width: geo.size.width, height: geo.size.height)
                .clipped()

                // Gradient
                LinearGradient(
                    colors: [.clear, Color(hex: 0x0A0A0A, alpha: 0.8)],
                    startPoint: .center,
                    endPoint: .bottom
                )

                // City + price overlay
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(deal.city.uppercased())
                            .font(SGFont.display(size: 36))
                            .foregroundStyle(Color.sgWhite)
                        if !deal.country.isEmpty {
                            Text(deal.country)
                                .font(SGFont.body(size: 15))
                                .foregroundStyle(Color.sgWhite.opacity(0.7))
                        }
                    }
                    Spacer()
                    Text(deal.priceFormatted)
                        .font(SGFont.bodyBold(size: 24))
                        .foregroundStyle(Color.sgWhite)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(deal.tierColor)
                        .clipShape(Capsule())
                }
                .padding(16)
            }
        }
        .frame(height: UIScreen.main.bounds.height * 0.4)
    }

    // MARK: - Flight Info

    @ViewBuilder
    private var flightInfoSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Line 1: Airline · duration · stops
            let flightParts = buildFlightLine()
            if !flightParts.isEmpty {
                Text(flightParts)
                    .font(SGFont.body(size: 15))
                    .foregroundStyle(Color.sgWhite)
            }

            // Line 2: Date range · trip length
            let dateParts = buildDateLine()
            if !dateParts.isEmpty {
                Text(dateParts)
                    .font(SGFont.body(size: 15))
                    .foregroundStyle(Color.sgMuted)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func buildFlightLine() -> String {
        var parts: [String] = []
        if deal.airlineName != "—" { parts.append(deal.airlineName) }
        if let d = deal.flightDuration, !d.isEmpty { parts.append(d) }
        let s = deal.stopsLabel
        if !s.isEmpty { parts.append(s) }
        return parts.joined(separator: " · ")
    }

    private func buildDateLine() -> String {
        var parts: [String] = []
        if let dep = deal.bestDepartureDate, let ret = deal.bestReturnDate {
            parts.append("\(dep) – \(ret)")
        } else if let dep = deal.bestDepartureDate {
            parts.append(dep)
        }
        if deal.tripDays > 0 {
            parts.append("\(deal.tripDays) days")
        }
        return parts.joined(separator: " · ")
    }

    // MARK: - Travel Guide

    @ViewBuilder
    private var travelGuideSection: some View {
        // deal.description is non-optional String, bestMonths is [String]?, averageTemp is Double?
        let hasGuideContent = !deal.description.isEmpty || deal.bestMonths != nil || deal.averageTemp != nil

        if hasGuideContent {
            VStack(alignment: .leading, spacing: 12) {
                Text("TRAVEL GUIDE")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.5)

                if !deal.description.isEmpty {
                    Text(deal.description)
                        .font(SGFont.body(size: 15))
                        .foregroundStyle(Color.sgWhiteDim)
                        .lineSpacing(4)
                }

                if let months = deal.bestMonths, !months.isEmpty {
                    Label {
                        Text("Best months: \(months.joined(separator: ", "))")
                            .font(SGFont.body(size: 14))
                            .foregroundStyle(Color.sgWhiteDim)
                    } icon: {
                        Image(systemName: "sun.max")
                            .foregroundStyle(Color.sgYellow)
                    }
                }

                if let temp = deal.averageTemp {
                    Label {
                        Text("Avg temp: \(Int(temp))°")
                            .font(SGFont.body(size: 14))
                            .foregroundStyle(Color.sgWhiteDim)
                    } icon: {
                        Image(systemName: "thermometer.medium")
                            .foregroundStyle(Color.sgOrange)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.sgSurface)
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    // MARK: - Similar Deals

    @ViewBuilder
    private var similarDealsSection: some View {
        let similar = allDeals.filter { $0.id != deal.id }.prefix(8)

        if !similar.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("SIMILAR DESTINATIONS")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.5)
                    .padding(.horizontal, 16)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(Array(similar), id: \.id) { otherDeal in
                            SimilarDealCard(deal: otherDeal) {
                                router.showDeal(otherDeal)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.top, 16)
        }
    }

    // MARK: - Sticky Bottom Bar

    private var stickyBottomBar: some View {
        HStack(spacing: 12) {
            Button(action: { savedStore.toggle(deal) }) {
                Image(systemName: isSaved ? "heart.fill" : "heart")
                    .font(.system(size: 20))
                    .foregroundStyle(isSaved ? Color.sgYellow : Color.sgWhite)
                    .frame(width: 48, height: 48)
                    .background(Color.sgSurface)
                    .clipShape(Circle())
            }

            Button(action: {
                if let url = deal.shareURL {
                    shareItem = DetailShareItem(url: url)
                }
            }) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 18))
                    .foregroundStyle(Color.sgWhite)
                    .frame(width: 48, height: 48)
                    .background(Color.sgSurface)
                    .clipShape(Circle())
            }

            Button(action: { router.startBooking(deal) }) {
                HStack(spacing: 6) {
                    Image(systemName: "airplane.departure")
                    Text("Search Flights")
                        .font(SGFont.bodyBold(size: 16))
                }
                .foregroundStyle(Color.sgBg)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Color.sgYellow)
                .clipShape(Capsule())
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            Color.sgBg.opacity(0.95)
                .background(.ultraThinMaterial)
        )
    }
}

// MARK: - Similar Deal Card

private struct SimilarDealCard: View {
    let deal: Deal
    let onTap: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Thumbnail — CachedAsyncImage takes String?
            CachedAsyncImage(url: deal.imageUrl) {
                RoundedRectangle(cornerRadius: 8).fill(Color.sgSurface)
            }
            .frame(width: 140, height: 100)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            Text(deal.city)
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgWhite)
                .lineLimit(1)

            Text(deal.priceFormatted)
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(Color.sgYellow)
        }
        .frame(width: 140)
        .contentShape(Rectangle())
        .onTapGesture { onTap() }
    }
}

// MARK: - Share Helper

private struct DetailShareItem: Identifiable, Sendable {
    let id = UUID()
    let url: URL
}

private struct ShareSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
```

- [ ] **Step 2: Verify Deal model properties used in the view**

Confirmed properties on Deal model:
- `deal.description: String` (non-optional) — AI description text
- `deal.bestMonths: [String]?` — array of month names
- `deal.averageTemp: Double?` — average temperature
- `deal.imageUrl: String?` — image URL string
- `deal.country: String` (non-optional) — country name
- `deal.tagline: String` (non-optional) — one-line tagline

Run: `grep -n "description\|bestMonths\|averageTemp\|imageUrl\|country" SoGoJet/Models/Deal.swift`

- [ ] **Step 3: Build and verify**

Run: `cd /Users/jackson/SwypeFly/SoGoJet-iOS && xcodebuild -scheme SoGoJet -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -20`
Expected: `** BUILD SUCCEEDED **`

Fix compilation errors — likely issues: CachedAsyncImage usage, DetailShareItem already defined elsewhere, missing properties.

- [ ] **Step 4: Commit**

```bash
git add SoGoJet/Views/Detail/DestinationDetailView.swift
git commit -m "feat(ios): rewrite detail view — hero photo, travel guide, similar deals, sticky bar"
```

---

### Task 7: Trim VintageTerminalKit.swift — keep split-flap, remove chrome

**Files:**
- Modify: `SoGoJet/Views/Components/VintageTerminalKit.swift`

This file is 14,000+ lines. We're NOT rewriting it. We're removing the components that are no longer referenced after Tasks 3-6.

- [ ] **Step 1: Identify which VintageTerminal components are still used**

After the card and detail rewrites, search for remaining references:

Run: `grep -rn "VintageTerminal\|VintageTravelTicket" SoGoJet/Views/ SoGoJet/App/ --include="*.swift" | grep -v "VintageTerminalKit.swift"`

This tells us which components are still referenced. Keep those, mark the rest for removal.

- [ ] **Step 1.5: Replace VintageTerminalBackdrop in SearchView and BookingFlowView**

`SearchView.swift` and `BookingFlowView.swift` also use `VintageTerminalBackdrop`. Replace with `Color.sgBg.ignoresSafeArea()` in both files. (Booking flow is "not changing" per spec, but its background must update so we can remove the backdrop component.)

Run: `grep -rn "VintageTerminalBackdrop" SoGoJet/Views/ --include="*.swift"` to find exact lines.

- [ ] **Step 2: Remove unreferenced decorative components**

After Step 1.5, re-run the grep from Step 1. Remove all VintageTerminal components that have ZERO remaining references: VintageTerminalBackdrop, VintageTerminalGridOverlay, VintageTerminalVerticalGlow, VintageTerminalNoiseOverlay, VintageTerminalPassportStamp, VintageTerminalOrbitDecoration, VintageTravelTicket, and any others.

**Do NOT remove:** Any component still referenced by views we're keeping (booking flow, settings, onboarding, toast). The booking flow uses many VintageTerminal components beyond just the backdrop — those stay.

- [ ] **Step 3: Build and verify**

Run: `cd /Users/jackson/SwypeFly/SoGoJet-iOS && xcodebuild -scheme SoGoJet -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -20`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 4: Commit**

```bash
git add SoGoJet/Views/Components/VintageTerminalKit.swift
git commit -m "feat(ios): trim VintageTerminalKit — remove unused backdrop and chrome components"
```

---

### Task 8: Final integration pass — build, run, push

**Files:**
- Various minor fixups across all modified files

- [ ] **Step 1: Full build**

Run: `cd /Users/jackson/SwypeFly/SoGoJet-iOS && xcodebuild -scheme SoGoJet -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -30`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 2: Run in simulator and verify visually**

Run: `open SoGoJet.xcodeproj` and Cmd+R to run in simulator.

Verify:
- [ ] Feed shows full-bleed photo cards (not data dump)
- [ ] Cards show: city, country, price badge, flight teaser only
- [ ] No "Fare Stub", info boxes, "NOW BOARDING" visible
- [ ] Departure board rows fill screen, show country subtitle
- [ ] Tapping any board row opens detail view
- [ ] Detail view has hero photo, flight info, travel guide, similar deals
- [ ] Detail "Search Flights" button opens booking flow
- [ ] No "Dossier", "Desk Fare", "Fare Memory", "TRAVELPAYOUTS" text anywhere
- [ ] Airline codes show names (NK → Spirit)
- [ ] No "Stop profile pending" or "unavailable" text
- [ ] Split-flap animation works on departure board
- [ ] No system gesture timeout errors in console
- [ ] Saved tab still works
- [ ] Settings tab still works

- [ ] **Step 3: Fix any visual issues found during manual testing**

Address anything that looks off — spacing, alignment, color, missing data handling.

- [ ] **Step 4: Final commit and push**

```bash
git add -A
git commit -m "feat(ios): visual overhaul complete — full-bleed cards, clean detail, fixed board"
git push origin main
```

---

## Task Summary

| Task | Files | Effort | Dependencies |
|------|-------|--------|--------------|
| 1. Airlines.swift | 2 files (1 new, 1 modify) | Small | None |
| 2. Color palette | 1 file | Small | None |
| 3. DealCard rewrite | 1 file | Large | Task 1 (airline names) |
| 4. FeedView cleanup | 1 file | Medium | Task 3 (card interface) |
| 5. DepartureBoard fix | 2 files | Medium | Task 1 (airline names) |
| 6. Detail view rewrite | 1 file | Large | Task 1 (airline names) |
| 7. VintageTerminalKit trim | 1 file | Medium | Tasks 3, 4, 5, 6 (know what's unused) |
| 8. Integration pass | All | Medium | All above |

**Parallelizable:** Tasks 1 + 2 can run in parallel. Tasks 3, 5, 6 can run in parallel (after 1). Task 7 must run after 3-6. Task 8 is last.
