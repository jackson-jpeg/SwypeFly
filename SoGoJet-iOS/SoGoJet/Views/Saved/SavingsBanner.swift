import SwiftUI

// MARK: - Savings Banner
// Stats row showing total savings, trip value, and trip count.
// Only rendered when there are saved deals with savings data.

struct SavingsBanner: View {
    let totalSavings: Double
    let totalValue: Double
    let tripCount: Int

    /// Only show the banner when there are actual savings to display.
    var shouldShow: Bool {
        tripCount > 0 && totalSavings > 0
    }

    var body: some View {
        HStack(spacing: 0) {
            // Total Savings
            statColumn(
                label: "TOTAL SAVINGS",
                value: "$\(Int(totalSavings))",
                valueColor: Color.sgDealAmazing
            )

            divider

            // Trip Value
            statColumn(
                label: "TRIP VALUE",
                value: "$\(Int(totalValue))",
                valueColor: Color.sgWhite
            )

            divider

            // Trips Saved
            statColumn(
                label: "TRIPS",
                value: "\(tripCount)",
                valueColor: Color.sgWhite
            )
        }
        .padding(.vertical, Spacing.md)
        .background(Color.sgCell)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Savings summary: $\(Int(totalSavings)) saved across \(tripCount) trips worth $\(Int(totalValue))")
    }

    // MARK: - Subviews

    private func statColumn(label: String, value: String, valueColor: Color) -> some View {
        VStack(spacing: Spacing.xs) {
            Text(value)
                .font(SGFont.display(size: 22))
                .foregroundStyle(valueColor)

            Text(label)
                .font(SGFont.caption)
                .foregroundStyle(Color.sgMuted)
                .tracking(0.5)
        }
        .frame(maxWidth: .infinity)
    }

    private var divider: some View {
        Rectangle()
            .fill(Color.sgBorder)
            .frame(width: 1, height: 36)
    }
}

// MARK: - Preview

#Preview("Savings Banner") {
    VStack(spacing: Spacing.md) {
        SavingsBanner(totalSavings: 524, totalValue: 1263, tripCount: 3)
        SavingsBanner(totalSavings: 1200, totalValue: 4500, tripCount: 8)
    }
    .padding(Spacing.md)
    .background(Color.sgBg)
}
