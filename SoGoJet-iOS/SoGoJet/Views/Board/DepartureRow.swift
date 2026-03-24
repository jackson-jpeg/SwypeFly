import SwiftUI

// MARK: - Departure Row
// A single row in the departure board showing time, destination, flight code, price, and status.
// Each column is a SplitFlapRow with appropriate sizing, color, and alignment.

struct DepartureRow: View {
    let deal: Deal
    var isActive: Bool = false
    var animate: Bool = false
    var onAnimationComplete: (() -> Void)?

    // MARK: Computed

    /// Departure time truncated to 5 chars (e.g. "14:30").
    private var timeText: String {
        String(deal.departureTime.prefix(5))
    }

    /// Destination name uppercased, truncated to 12 chars.
    private var destinationText: String {
        deal.destination.uppercased()
    }

    /// Flight code truncated to 6 chars (e.g. "AA 123").
    private var flightCodeText: String {
        String(deal.flightCode.prefix(6))
    }

    /// Price as a short string (e.g. "$249"), or "—" if nil.
    private var priceText: String {
        if let price = deal.price {
            return "$\(Int(price))"
        }
        return "---"
    }

    /// Price column color: green if price exists, faint if nil.
    private var priceColor: Color {
        deal.price != nil ? Color.sgGreen : Color.sgFaint
    }

    /// Status text showing savings percent or deal status.
    private var statusText: String {
        if let pct = deal.savingsPercent, pct > 0 {
            return "-\(Int(pct))%"
        }
        return deal.status.rawValue
    }

    /// Status color derived from deal tier.
    private var statusColor: Color {
        (deal.dealTier ?? .fair).color
    }

    // MARK: Body

    var body: some View {
        HStack(spacing: Spacing.sm) {
            // Time column — 5 chars, right-aligned, yellow, sm
            SplitFlapRow(
                text: timeText,
                maxLength: 5,
                size: .sm,
                color: Color.sgYellow,
                alignment: .trailing,
                animate: animate,
                startDelay: 0,
                staggerMs: 40
            )

            // Destination column — 12 chars, left-aligned, yellow, md
            SplitFlapRow(
                text: destinationText,
                maxLength: 12,
                size: .md,
                color: Color.sgYellow,
                alignment: .leading,
                animate: animate,
                startDelay: 0.05,
                staggerMs: 40
            )

            // Flight code column — 6 chars, left-aligned, whiteDim, sm
            SplitFlapRow(
                text: flightCodeText,
                maxLength: 6,
                size: .sm,
                color: Color.sgWhiteDim,
                alignment: .leading,
                animate: animate,
                startDelay: 0.10,
                staggerMs: 40
            )

            // Price column — 5 chars, right-aligned, green/faint, md
            SplitFlapRow(
                text: priceText,
                maxLength: 5,
                size: .md,
                color: priceColor,
                alignment: .trailing,
                animate: animate,
                startDelay: 0.15,
                staggerMs: 40
            )

            // Status column — 5 chars, right-aligned, tier color
            SplitFlapRow(
                text: statusText,
                maxLength: 5,
                size: .sm,
                color: statusColor,
                alignment: .trailing,
                animate: animate,
                startDelay: 0.20,
                staggerMs: 40,
                onComplete: onAnimationComplete
            )
        }
        .padding(.vertical, Spacing.xs)
        .padding(.horizontal, Spacing.sm)
        .overlay(alignment: .leading) {
            // Active row indicator: yellow left border
            RoundedRectangle(cornerRadius: 1.5)
                .fill(isActive ? Color.sgYellow : Color.clear)
                .frame(width: 3)
        }
        .opacity(isActive ? 1.0 : 0.45)
        .animation(.easeInOut(duration: 0.25), value: isActive)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(deal.departureTime), \(deal.destination), flight \(deal.flightCode), \(priceText)")
        .accessibilityAddTraits(isActive ? [.isSelected, .isButton] : .isButton)
    }
}

// MARK: - Preview

#Preview("Departure Row") {
    let sampleDeal = Deal(
        id: "1",
        departureTime: "14:30",
        destination: "Bali",
        destinationFull: "Bali, Indonesia",
        country: "Indonesia",
        iataCode: "DPS",
        flightCode: "AA 123",
        price: 249,
        priceFormatted: "$249",
        status: .deal,
        priceSource: "travelpayouts",
        airline: "American Airlines",
        departureDate: "2026-04-15",
        returnDate: "2026-04-22",
        cheapestDate: "2026-04-15",
        cheapestReturnDate: "2026-04-22",
        tripDays: 7,
        flightDuration: "18h 30m",
        vibeTags: ["Beach", "Culture"],
        imageUrl: "",
        blurHash: nil,
        tagline: "Tropical paradise awaits",
        description: "Discover Bali",
        affiliateUrl: "",
        itinerary: nil,
        restaurants: nil,
        dealScore: 0.85,
        dealTier: .great,
        qualityScore: 0.9,
        pricePercentile: 0.15,
        isNonstop: false,
        totalStops: 1,
        maxLayoverMinutes: 120,
        usualPrice: 450,
        savingsAmount: 201,
        savingsPercent: 45,
        priceHistory: nil,
        nearbyOrigin: nil,
        nearbyOriginLabel: nil
    )

    return VStack(spacing: 2) {
        DepartureRow(
            deal: sampleDeal,
            isActive: true,
            animate: true
        )
        DepartureRow(
            deal: sampleDeal,
            isActive: false,
            animate: true
        )
    }
    .padding(Spacing.md)
    .background(Color.sgBg)
}
