import SwiftUI

// MARK: - QuickFactsStrip
// Horizontal scroll of pill-shaped facts about a deal.

struct QuickFactsStrip: View {
    let deal: Deal

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.sm) {
                // Nonstop
                if deal.isNonstop == true {
                    factPill(
                        icon: "bolt.fill",
                        text: "Nonstop",
                        iconColor: Color.sgGreen,
                        bgColor: Color.sgGreen.opacity(0.15)
                    )
                }

                // Trip nights
                if deal.tripDays > 0 {
                    factPill(
                        icon: "moon.fill",
                        text: "\(deal.tripDays) nights"
                    )
                }

                // Flight duration
                if !deal.flightDuration.isEmpty {
                    factPill(
                        icon: "clock.fill",
                        text: deal.flightDuration
                    )
                }

                // Stops
                if let stops = deal.totalStops, stops > 0 {
                    factPill(
                        icon: "point.topleft.down.to.point.bottomright.curvepath",
                        text: stops == 1 ? "1 stop" : "\(stops) stops"
                    )
                }

                // Deal quality
                if let tier = deal.dealTier, tier != .fair {
                    factPill(
                        icon: "arrow.down.right",
                        text: tier.label,
                        iconColor: tier.color,
                        textColor: tier.color
                    )
                }
            }
            .padding(.horizontal, Spacing.md)
        }
    }

    // MARK: - Pill Builder

    @ViewBuilder
    private func factPill(
        icon: String,
        text: String,
        iconColor: Color = Color.sgMuted,
        textColor: Color = Color.sgWhiteDim,
        bgColor: Color = Color.sgSurface
    ) -> some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(iconColor)
            Text(text)
                .font(SGFont.bodySmall)
                .foregroundStyle(textColor)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .background(bgColor)
        .clipShape(Capsule())
    }
}

// MARK: - Preview

#Preview {
    QuickFactsStrip(deal: .preview)
        .background(Color.sgBg)
}
