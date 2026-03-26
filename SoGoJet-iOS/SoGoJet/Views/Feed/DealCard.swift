import SwiftUI

// MARK: - Deal Card
// Full-bleed destination photo with minimal overlay.
// City, country, price badge, flight teaser — that's it.

struct DealCard: View {
    let deal: Deal
    let isSaved: Bool
    let isFirst: Bool
    var isTopPick: Bool = false
    var livePriceOverride: Double? = nil // Live price from booking search, replaces estimate
    var animate: Bool = true
    var animationTrigger: Int = 0 // Changes when this card becomes current, replays flip
    var onSave: () -> Void = {}
    var onShare: () -> Void = {}
    var onBook: () -> Void = {}
    var onTap: () -> Void = {}
    var onVibeFilter: (String) -> Void = { _ in }

    @Environment(SettingsStore.self) private var settingsStore

    @State private var heartBounce: Bool = false
    @State private var showSwipeHint: Bool = false
    @State private var swipeHintOffset: CGFloat = 0

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Full-bleed photo — CachedAsyncImage handles frame + clip internally
                CachedAsyncImage(url: deal.imageUrl) {
                    fallbackBackground
                }

                // Bottom gradient for text legibility
                VStack {
                    Spacer()
                    LinearGradient(
                        colors: [.clear, Color(hex: 0x0A0A0A, alpha: 0.85)],
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

                        VStack(alignment: .trailing, spacing: 4) {
                            if !deal.country.isEmpty {
                                Text(deal.country.uppercased())
                                    .font(SGFont.bodySmall)
                                    .foregroundStyle(Color.sgWhite.opacity(0.9))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(Color.black.opacity(0.45))
                                    .clipShape(Capsule())
                            }

                            // "Best time" badge when current month is ideal
                            if deal.isGoodTimeToVisit {
                                HStack(spacing: 3) {
                                    Image(systemName: "sun.max.fill")
                                        .font(.system(size: 9))
                                    Text("Best time to visit")
                                        .font(.system(size: 10, weight: .semibold))
                                }
                                .foregroundStyle(Color.sgBg)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color.sgDealAmazing)
                                .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.top, geo.safeAreaInsets.top + 56)
                    .padding(.horizontal, 16)

                    // Top Pick badge — centered below the top row
                    if isTopPick {
                        topPickBadge
                            .padding(.top, 6)
                    }

                    Spacer()

                    // Bottom: city + vibes + flight teaser + price
                    VStack(alignment: .leading, spacing: 6) {
                        SplitFlapRow(
                            text: deal.city.uppercased(),
                            maxLength: 12,
                            size: .md,
                            color: Color.sgWhite,
                            alignment: .leading,
                            animate: animate,
                            startDelay: 0.1,
                            staggerMs: 50,
                            animationID: animationTrigger
                        )

                        // Tappable vibe tags
                        if !deal.safeVibeTags.isEmpty {
                            HStack(spacing: 6) {
                                ForEach(deal.safeVibeTags.prefix(3), id: \.self) { tag in
                                    Button {
                                        HapticEngine.light()
                                        onVibeFilter(tag)
                                    } label: {
                                        Text(tag.lowercased())
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundStyle(Color.sgYellow)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 3)
                                            .background(Color.sgYellow.opacity(0.15))
                                            .clipShape(Capsule())
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }

                        HStack {
                            flightTeaser
                            Spacer()
                            priceBadge
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 120)
                }

                // Swipe hint — only on the first card, auto-dismisses
                if isFirst && showSwipeHint {
                    swipeHintView
                        .transition(.opacity)
                }
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge) // Cap scaling — overlay text must fit on photo
        .contentShape(Rectangle())
        .onTapGesture { onTap() }
        .contextMenu {
            Button {
                onSave()
            } label: {
                Label(isSaved ? "Unsave" : "Save", systemImage: isSaved ? "heart.slash" : "heart")
            }

            Button {
                onShare()
            } label: {
                Label("Share", systemImage: "square.and.arrow.up")
            }

            Button {
                onBook()
            } label: {
                Label("Search Flights", systemImage: "airplane.departure")
            }

            if let url = deal.mapsURL {
                Link(destination: url) {
                    Label("Open in Maps", systemImage: "map")
                }
            }
        } preview: {
            VStack(alignment: .leading, spacing: 8) {
                if let urlStr = deal.imageUrl, let url = URL(string: urlStr) {
                    AsyncImage(url: url) { image in
                        image.resizable().aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Rectangle().fill(Color.sgSurface)
                    }
                    .frame(width: 300, height: 180)
                    .clipped()
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(deal.city)
                        .font(.headline)
                    Text("\(deal.country) \(deal.hasPrice ? "-- \(deal.isEstimatedPrice ? "seen at " : "")\(deal.priceFormatted)" : "")")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
            }
            .frame(width: 300)
            .background(Color(.systemBackground))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(dealCardAccessibilityLabel)
        .accessibilityAddTraits(.isButton)
        .onAppear {
            guard isFirst else { return }
            // Delay appearance so the card loads first
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                withAnimation(.easeOut(duration: 0.5)) {
                    showSwipeHint = true
                }
                startSwipeHintBounce()
            }
            // Auto-dismiss after a few seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 4.5) {
                withAnimation(.easeIn(duration: 0.4)) {
                    showSwipeHint = false
                }
            }
        }
    }

    // MARK: - Swipe Hint

    private var swipeHintView: some View {
        VStack(spacing: 4) {
            Spacer()

            VStack(spacing: 2) {
                Image(systemName: "chevron.compact.up")
                    .font(.system(size: 22, weight: .medium))
                Image(systemName: "chevron.compact.up")
                    .font(.system(size: 22, weight: .medium))
                    .opacity(0.5)
            }
            .foregroundStyle(Color.sgWhite.opacity(0.7))
            .offset(y: swipeHintOffset)

            Text("Swipe up")
                .font(SGFont.bodyBold(size: 12))
                .foregroundStyle(Color.sgWhite.opacity(0.6))
                .offset(y: swipeHintOffset)

            Spacer()
                .frame(height: 90)
        }
        .allowsHitTesting(false)
    }

    private func startSwipeHintBounce() {
        withAnimation(
            .easeInOut(duration: 0.8)
            .repeatCount(4, autoreverses: true)
        ) {
            swipeHintOffset = -10
        }
    }

    // MARK: - Fallback

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
        Button {
            heartBounce = true
            onSave()
            // Reset bounce after the animation completes
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                heartBounce = false
            }
        } label: {
            Image(systemName: isSaved ? "heart.fill" : "heart")
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(isSaved ? Color.sgYellow : Color.sgWhite)
                .frame(width: 44, height: 44)
                .background(Color.black.opacity(0.3))
                .clipShape(Circle())
                .scaleEffect(heartBounce ? 1.3 : 1.0)
                .animation(.spring(response: 0.3, dampingFraction: 0.5), value: heartBounce)
        }
        .accessibilityLabel(isSaved ? "Remove from saved" : "Save")
    }

    private var topPickBadge: some View {
        HStack(spacing: 4) {
            Image(systemName: "crown.fill")
                .font(.system(size: 9, weight: .semibold))
            Text("TOP PICK")
                .font(.system(size: 10, weight: .bold, design: .monospaced))
        }
        .foregroundStyle(Color.sgYellow)
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(Color.black.opacity(0.55))
        .clipShape(Capsule())
    }

    /// The price to display — uses live override if available, otherwise deal's price.
    private var effectivePrice: String {
        if let live = livePriceOverride, live > 0 {
            return "$\(Int(live))"
        }
        return deal.priceFormatted
    }

    /// Whether the displayed price is confirmed (live override) or an estimate.
    private var priceIsConfirmed: Bool {
        livePriceOverride != nil
    }

    private var priceBadge: some View {
        VStack(alignment: .trailing, spacing: 2) {
            // "seen at" label for estimated prices, "live" for confirmed prices
            if priceIsConfirmed {
                Text("live")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Color.sgDealAmazing)
            } else if deal.isEstimatedPrice {
                HStack(spacing: 3) {
                    Text("seen at")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Color.sgWhite.opacity(0.7))
                    PriceInfoButton()
                }
            }

            HStack(spacing: 4) {
                // Price trend arrow
                if deal.priceTrend != .stable {
                    Image(systemName: deal.priceTrend.icon)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(deal.priceTrend == .down ? Color.sgDealAmazing : Color.sgRed)
                }

                SplitFlapRow(
                    text: effectivePrice,
                    maxLength: 6,
                    size: .sm,
                    color: deal.isEstimatedPrice && !priceIsConfirmed ? Color.sgWhite.opacity(0.85) : Color.sgWhite,
                    alignment: .trailing,
                    animate: animate,
                    startDelay: 0.3,
                    staggerMs: 60,
                    animationID: animationTrigger
                )
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(deal.tierColor)
            .clipShape(Capsule())
            .overlay(
                // Dashed border for estimated prices, solid for live
                Capsule()
                    .strokeBorder(
                        deal.isEstimatedPrice && !priceIsConfirmed
                            ? Color.sgWhite.opacity(0.3)
                            : Color.clear,
                        style: StrokeStyle(lineWidth: 1, dash: [4, 3])
                    )
            )

            // Freshness timestamp for estimated prices
            if deal.isEstimatedPrice, !priceIsConfirmed, let freshness = deal.priceFreshnessLabel {
                Text(freshness)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(deal.priceFreshness == .old ? Color.sgRed.opacity(0.8) : Color.sgWhite.opacity(0.5))
            }
        }
    }

    @ViewBuilder
    private var flightTeaser: some View {
        let parts = buildFlightTeaser()
        if !parts.isEmpty {
            Text(parts)
                .font(SGFont.bodySmall)
                .foregroundStyle(Color.sgWhite.opacity(0.85))
                .lineLimit(1)
        }
    }

    private var dealCardAccessibilityLabel: String {
        var parts: [String] = [deal.city, deal.country, deal.priceFormatted]
        if deal.airlineName != "—" {
            parts.append(deal.airlineName)
        }
        if let duration = deal.flightDuration, !duration.isEmpty {
            parts.append(duration)
        }
        let stops = deal.stopsLabel
        if !stops.isEmpty {
            parts.append(stops)
        }
        return parts.joined(separator: ", ")
    }

    /// Look up the departure airport's coordinates from AirportPicker's static list.
    private var departureAirport: AirportPicker.Airport? {
        AirportPicker.airports.first { $0.code == settingsStore.departureCode }
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

        // When we have no flight duration, show approximate distance instead
        if deal.flightDuration == nil || deal.flightDuration?.isEmpty == true {
            if let airport = departureAirport,
               let km = deal.distanceKm(fromLat: airport.latitude, lon: airport.longitude) {
                if deal.isDomesticUS {
                    let mi = Int((km * 0.621371).rounded())
                    parts.append("~\(mi.formatted()) mi")
                } else {
                    let rounded = Int(km.rounded())
                    parts.append("~\(rounded.formatted()) km")
                }
            }
        }

        // Compass direction — always show when we can calculate it
        if let airport = departureAirport,
           let compass = deal.compassDirection(fromLat: airport.latitude, lon: airport.longitude) {
            parts.append(compass)
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
    .environment(SettingsStore())
}
