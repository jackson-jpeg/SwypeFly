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

    @State private var heartBounce: Bool = false
    @State private var showSwipeHint: Bool = false
    @State private var swipeHintOffset: CGFloat = 0

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Full-bleed photo — contentMode .fill can offset the image
                // so we must pin it inside a fixed-size container and clip.
                Color.clear
                    .overlay {
                        CachedAsyncImage(url: deal.imageUrl) {
                            fallbackBackground
                        }
                    }
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()

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
                        if !deal.country.isEmpty {
                            Text(deal.country.uppercased())
                                .font(SGFont.bodySmall)
                                .foregroundStyle(Color.sgWhite.opacity(0.9))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(Color.black.opacity(0.45))
                                .clipShape(Capsule())
                        }
                    }
                    .padding(.top, geo.safeAreaInsets.top + 56)
                    .padding(.horizontal, 16)

                    Spacer()

                    // Bottom: city name, flight teaser, price badge
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 4) {
                            SplitFlapRow(
                                text: deal.city.uppercased(),
                                maxLength: 12,
                                size: .md,
                                color: Color.sgWhite,
                                alignment: .leading,
                                animate: animate,
                                startDelay: 0.1,
                                staggerMs: 50
                            )

                            flightTeaser
                        }

                        Spacer()

                        priceBadge
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 120) // Clear tab bar (49pt) + home indicator (34pt) + breathing room
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

    private var priceBadge: some View {
        SplitFlapRow(
            text: deal.priceFormatted,
            maxLength: 6,
            size: .sm,
            color: Color.sgWhite,
            alignment: .trailing,
            animate: animate,
            startDelay: 0.3,
            staggerMs: 60
        )
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(deal.tierColor)
        .clipShape(Capsule())
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
