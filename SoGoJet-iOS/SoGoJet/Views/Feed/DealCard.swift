import SwiftUI

// MARK: - Deal Card
// Full-screen card displayed in the vertical paging feed.
// Overlays destination info, price, deal badge, and actions on a full-bleed background image.

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
            ZStack(alignment: .bottom) {
                // MARK: Background Image
                backgroundImage(size: geo.size)

                // MARK: Gradient Overlay
                LinearGradient(
                    colors: [
                        Color.clear,
                        Color.sgBg.opacity(0.3),
                        Color.sgBg.opacity(0.85),
                    ],
                    startPoint: .init(x: 0.5, y: 0.3),
                    endPoint: .bottom
                )

                // MARK: Top Overlay (badges + price)
                VStack {
                    topOverlay
                    Spacer()
                }

                // MARK: Bottom Content
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    destinationHeader
                    tripWindow
                    taglineView
                    flightInfoChips
                    vibeTagPills
                    actionButtons
                }
                .padding(.horizontal, Spacing.md)
                .padding(.bottom, Spacing.xl + Spacing.lg) // room for tab bar
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .contentShape(Rectangle())
        .onTapGesture { onTap() }
        .contextMenu {
            Button { onShare() } label: {
                Label("Share", systemImage: "square.and.arrow.up")
            }
            Button { onSave() } label: {
                Label(isSaved ? "Unsave" : "Save", systemImage: isSaved ? "heart.slash" : "heart")
            }
            Button { onBook() } label: {
                Label("Search Flights", systemImage: "airplane.departure")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(deal.destination), \(deal.country). \(deal.priceFormatted) round trip.")
    }

    // MARK: - Background

    @ViewBuilder
    private func backgroundImage(size: CGSize) -> some View {
        CachedAsyncImage(url: deal.imageUrl) {
            Color.sgSurface
        }
        .frame(width: size.width, height: size.height)
        .clipped()
    }

    // MARK: - Top Overlay

    private var topOverlay: some View {
        HStack(alignment: .top) {
            // Deal badge (top-left)
            if let tier = deal.dealTier {
                DealBadge(
                    dealTier: tier,
                    savingsPercent: deal.savingsPercent.map { Int($0) }
                )
            }

            Spacer()

            // Price tag (top-right)
            priceTag
        }
        .padding(.horizontal, Spacing.md)
        .padding(.top, 70)
        .overlay(alignment: .top) {
            // "DEAL OF THE DAY" badge (top-center)
            if isFirst && deal.dealTier == .amazing {
                dealOfTheDayBadge
                    .padding(.top, 70)
            }
        }
    }

    // MARK: - Deal of the Day Badge

    private var dealOfTheDayBadge: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: "star.fill")
                .font(.system(size: 10))
            Text("DEAL OF THE DAY")
                .font(SGFont.bodyBold(size: 10))
                .tracking(1.2)
        }
        .foregroundStyle(Color.sgBg)
        .padding(.horizontal, Spacing.sm + Spacing.xs)
        .padding(.vertical, Spacing.xs)
        .background(
            Capsule()
                .fill(
                    LinearGradient(
                        colors: [Color.sgOrange, Color.sgYellow],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
        )
    }

    // MARK: - Price Tag

    private var priceTag: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text("from")
                .font(SGFont.caption)
                .foregroundStyle(Color.sgMuted)

            SplitFlapRow(
                text: deal.priceFormatted,
                maxLength: 7,
                size: .md,
                color: Color.sgYellow,
                alignment: .trailing,
                animate: animate,
                startDelay: 0.2,
                staggerMs: 50
            )

            Text("round trip")
                .font(SGFont.caption)
                .foregroundStyle(Color.sgMuted)

            // Savings row
            if let usual = deal.usualPrice, let savings = deal.savingsAmount, savings > 0 {
                HStack(spacing: Spacing.xs) {
                    Text("$\(Int(usual))")
                        .font(SGFont.body(size: 12))
                        .strikethrough()
                        .foregroundStyle(Color.sgMuted)
                    Text("Save $\(Int(savings))")
                        .font(SGFont.bodyBold(size: 11))
                        .foregroundStyle(Color.sgGreen)
                }
            }

            // Sparkline
            if let history = deal.priceHistory, let price = deal.price {
                PriceSparkline(prices: history, currentPrice: price)
            }
        }
    }

    // MARK: - Destination Header

    private var destinationHeader: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            SplitFlapRow(
                text: deal.destination.uppercased(),
                maxLength: 14,
                size: .lg,
                color: Color.sgWhite,
                animate: animate,
                staggerMs: 35
            )

            HStack(spacing: Spacing.sm) {
                Text(deal.country)
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgWhiteDim)

                if let nearbyLabel = deal.nearbyOriginLabel {
                    Text("·")
                        .foregroundStyle(Color.sgFaint)
                    Text("from \(nearbyLabel)")
                        .font(SGFont.body(size: 13))
                        .foregroundStyle(Color.sgMuted)
                }
            }
        }
    }

    // MARK: - Trip Window

    private var tripWindow: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: "calendar")
                .font(.system(size: 12))
                .foregroundStyle(Color.sgMuted)

            Text(deal.departureDate)
                .font(SGFont.body(size: 13))
                .foregroundStyle(Color.sgWhiteDim)

            Text("·")
                .foregroundStyle(Color.sgFaint)

            Text("\(deal.tripDays) days")
                .font(SGFont.body(size: 13))
                .foregroundStyle(Color.sgMuted)
        }
    }

    // MARK: - Tagline

    private var taglineView: some View {
        Text(deal.tagline)
            .font(SGFont.tagline)
            .foregroundStyle(Color.sgWhiteDim)
            .lineLimit(2)
            .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Flight Info Chips

    private var flightInfoChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.sm) {
                // Airline
                flightChip(text: deal.airline, icon: "airplane")

                // Flight code (split flap)
                flightCodeChip

                // Duration
                flightChip(text: deal.flightDuration, icon: "clock")

                // Nonstop / stops
                if deal.isNonstop == true {
                    nonstopBadge
                } else if let stops = deal.totalStops, stops > 0 {
                    flightChip(text: deal.stopsLabel, icon: "arrow.triangle.branch")
                }
            }
        }
    }

    private func flightChip(text: String, icon: String) -> some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 10))
            Text(text)
                .font(SGFont.body(size: 12))
        }
        .foregroundStyle(Color.sgWhiteDim)
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.xs)
        .background(Color.sgSurface.opacity(0.7))
        .clipShape(Capsule())
    }

    private var flightCodeChip: some View {
        SplitFlapRow(
            text: deal.flightCode,
            maxLength: 7,
            size: .sm,
            color: Color.sgMuted,
            animate: animate,
            startDelay: 0.4,
            staggerMs: 40
        )
    }

    private var nonstopBadge: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 10))
            Text("Nonstop")
                .font(SGFont.bodyBold(size: 11))
        }
        .foregroundStyle(Color.sgGreen)
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.xs)
        .background(Color.sgGreen.opacity(0.15))
        .clipShape(Capsule())
    }

    // MARK: - Vibe Tag Pills

    private var vibeTagPills: some View {
        HStack(spacing: Spacing.sm) {
            ForEach(Array(deal.vibeTags.prefix(3)), id: \.self) { vibe in
                Text(vibe)
                    .font(SGFont.bodyBold(size: 11))
                    .foregroundStyle(Color.sgYellow)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.xs)
                    .background(
                        Capsule()
                            .strokeBorder(Color.sgYellow.opacity(0.3), lineWidth: 1)
                    )
            }
        }
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: Spacing.sm) {
            // Save (heart)
            Button {
                onSave()
            } label: {
                Image(systemName: isSaved ? "heart.fill" : "heart")
                    .font(.system(size: 20))
                    .foregroundStyle(isSaved ? Color.sgRed : Color.sgWhite)
                    .frame(width: 48, height: 48)
                    .background(Color.sgSurface.opacity(0.7))
                    .clipShape(Circle())
            }
            .accessibilityLabel(isSaved ? "Unsave deal" : "Save deal")

            // Share
            Button {
                onShare()
            } label: {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 18))
                    .foregroundStyle(Color.sgWhite)
                    .frame(width: 48, height: 48)
                    .background(Color.sgSurface.opacity(0.7))
                    .clipShape(Circle())
            }
            .accessibilityLabel("Share deal")

            Spacer()

            // Search Flights (primary CTA)
            Button {
                onBook()
            } label: {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "airplane.departure")
                        .font(.system(size: 14, weight: .semibold))
                    Text("Search Flights")
                        .font(SGFont.bodyBold(size: 15))
                }
                .foregroundStyle(Color.sgBg)
                .padding(.horizontal, Spacing.lg)
                .padding(.vertical, Spacing.sm + Spacing.xs)
                .background(Color.sgYellow)
                .clipShape(Capsule())
            }
            .accessibilityLabel("Search flights to \(deal.destination)")
        }
        .padding(.top, Spacing.xs)
    }
}

// MARK: - Preview

#Preview("Deal Card") {
    DealCard(
        deal: .preview,
        isSaved: false,
        isFirst: true,
        animate: true,
        onSave: { print("Save") },
        onShare: { print("Share") },
        onBook: { print("Book") },
        onTap: { print("Tap") }
    )
    .ignoresSafeArea()
}

// MARK: - Preview Data

extension Deal {
    static let preview = Deal(
        id: "1",
        departureTime: "06:30",
        destination: "Bali",
        destinationFull: "Bali, Indonesia",
        country: "Indonesia",
        iataCode: "DPS",
        flightCode: "GA 875",
        price: 487,
        priceFormatted: "$487",
        status: .deal,
        priceSource: "travelpayouts",
        airline: "Garuda Indonesia",
        departureDate: "2026-04-15",
        returnDate: "2026-04-22",
        cheapestDate: "2026-04-15",
        cheapestReturnDate: "2026-04-22",
        tripDays: 7,
        flightDuration: "18h 30m",
        vibeTags: ["Beach", "Culture", "Nightlife"],
        imageUrl: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800",
        blurHash: nil,
        tagline: "Temple sunsets and rice terrace mornings",
        description: "Discover the magic of Bali",
        affiliateUrl: "https://aviasales.com",
        itinerary: nil,
        restaurants: nil,
        dealScore: 0.92,
        dealTier: .amazing,
        qualityScore: 0.88,
        pricePercentile: 0.12,
        isNonstop: false,
        totalStops: 1,
        maxLayoverMinutes: 120,
        usualPrice: 850,
        savingsAmount: 363,
        savingsPercent: 42,
        priceHistory: [720, 680, 750, 620, 580, 540, 487],
        nearbyOrigin: nil,
        nearbyOriginLabel: nil
    )

    static let previewNonstop = Deal(
        id: "2",
        departureTime: "08:00",
        destination: "London",
        destinationFull: "London, United Kingdom",
        country: "United Kingdom",
        iataCode: "LHR",
        flightCode: "BA 178",
        price: 389,
        priceFormatted: "$389",
        status: .hot,
        priceSource: "travelpayouts",
        airline: "British Airways",
        departureDate: "2026-05-01",
        returnDate: "2026-05-08",
        cheapestDate: "2026-05-01",
        cheapestReturnDate: "2026-05-08",
        tripDays: 7,
        flightDuration: "7h 10m",
        vibeTags: ["Culture", "Food", "History"],
        imageUrl: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800",
        blurHash: nil,
        tagline: "Where history meets the future",
        description: "Explore London's timeless charm",
        affiliateUrl: "https://aviasales.com",
        itinerary: nil,
        restaurants: nil,
        dealScore: 0.85,
        dealTier: .great,
        qualityScore: 0.9,
        pricePercentile: 0.2,
        isNonstop: true,
        totalStops: 0,
        maxLayoverMinutes: nil,
        usualPrice: 550,
        savingsAmount: 161,
        savingsPercent: 29,
        priceHistory: [520, 490, 510, 470, 430, 400, 389],
        nearbyOrigin: nil,
        nearbyOriginLabel: nil
    )
}
