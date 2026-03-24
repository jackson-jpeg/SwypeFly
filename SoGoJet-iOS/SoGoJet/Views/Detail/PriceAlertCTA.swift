import SwiftUI

// MARK: - PriceAlertCTA
// Card prompting the user to set up price tracking for a destination.

struct PriceAlertCTA: View {
    let destinationName: String
    let price: Double?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack(spacing: Spacing.sm) {
                Image(systemName: "bell.badge.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(Color.sgGreen)
                Text("Track this price")
                    .font(SGFont.sectionHead)
                    .foregroundStyle(Color.sgWhite)
            }

            if let price {
                Text("Get notified when flights to \(destinationName) drop below $\(Int(price)).")
                    .font(SGFont.bodySmall)
                    .foregroundStyle(Color.sgWhiteDim)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text("Get notified when we find a great deal to \(destinationName).")
                    .font(SGFont.bodySmall)
                    .foregroundStyle(Color.sgWhiteDim)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button {
                HapticEngine.medium()
                // TODO: Hook up price alert subscription
            } label: {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "bell.fill")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Alert")
                        .font(SGFont.bodyBold(size: 14))
                }
                .foregroundStyle(Color.sgBg)
                .padding(.horizontal, Spacing.lg)
                .padding(.vertical, Spacing.sm + 2)
                .background(Color.sgGreen)
                .clipShape(Capsule())
            }
        }
        .padding(Spacing.md)
        .background(Color.sgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(Color.sgGreen.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Preview

#Preview {
    PriceAlertCTA(destinationName: "Bali", price: 450)
        .padding()
        .background(Color.sgBg)
}
