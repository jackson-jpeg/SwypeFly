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

    /// Departure time (derived from departureDate or airline code).
    private var timeText: String {
        // Use IATA code as compact identifier
        deal.iataCode
    }

    /// Destination name uppercased.
    private var destinationText: String {
        deal.city.uppercased()
    }

    /// Flight code from airline code.
    private var flightCodeText: String {
        deal.airlineName
    }

    /// Price as a short string.
    private var priceText: String {
        deal.priceFormatted
    }

    /// Price column color.
    private var priceColor: Color {
        deal.displayPrice != nil ? Color.sgGreen : Color.sgFaint
    }

    /// Status text showing savings percent or tier.
    private var statusText: String {
        if let pct = deal.savingsPercent, pct > 0 {
            return "-\(Int(pct))%"
        }
        return deal.dealTier?.label.prefix(5).uppercased().trimmingCharacters(in: .whitespaces) ?? "DEAL"
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
        .accessibilityLabel("\(deal.city), \(deal.airlineName), \(priceText)")
        .accessibilityAddTraits(isActive ? [.isSelected, .isButton] : .isButton)
    }
}

// MARK: - Preview

#Preview("Departure Row") {
    VStack(spacing: 2) {
        DepartureRow(
            deal: Deal.preview,
            isActive: true,
            animate: true
        )
        DepartureRow(
            deal: Deal.preview,
            isActive: false,
            animate: true
        )
    }
    .padding(Spacing.md)
    .background(Color.sgBg)
}
