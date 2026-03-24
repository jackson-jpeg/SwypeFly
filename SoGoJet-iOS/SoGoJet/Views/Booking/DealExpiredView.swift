import SwiftUI

// MARK: - Deal Expired View
// Shown when the live Duffel price exceeds the feed price by more than 50%.

struct DealExpiredView: View {
    let feedPrice: Double
    let livePrice: Double
    var onSetAlert: () -> Void = {}
    var onBackToDeals: () -> Void = {}

    private var increasePercent: Int {
        guard feedPrice > 0 else { return 0 }
        return Int(((livePrice - feedPrice) / feedPrice) * 100)
    }

    var body: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()

            // Timer icon
            Image(systemName: "timer")
                .font(.system(size: 64))
                .foregroundStyle(Color.sgRed)

            // Title
            Text("Deal Expired")
                .font(SGFont.display(size: 40))
                .foregroundStyle(Color.sgWhite)

            // Explanation
            VStack(spacing: Spacing.sm) {
                Text("The price went from $\(Int(feedPrice)) to $\(Int(livePrice))")
                    .font(SGFont.bodyDefault)
                    .foregroundStyle(Color.sgWhiteDim)

                Text("That's a \(increasePercent)% increase. Flight deals move fast — this one's no longer available at the original price.")
                    .font(SGFont.bodySmall)
                    .foregroundStyle(Color.sgMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, Spacing.lg)

            Spacer()

            // Set Price Alert
            Button {
                onSetAlert()
                HapticEngine.success()
            } label: {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "bell.fill")
                        .font(.system(size: 14))
                    Text("Set Price Alert")
                        .font(SGFont.bodyBold(size: 16))
                }
                .foregroundStyle(Color.sgBg)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(Color.sgGreen)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            }
            .padding(.horizontal, Spacing.md)

            // Back to deals link
            Button {
                onBackToDeals()
            } label: {
                Text("Back to deals")
                    .font(SGFont.bodyDefault)
                    .foregroundStyle(Color.sgMuted)
                    .underline()
            }
            .padding(.bottom, Spacing.xl)
        }
    }
}

// MARK: - Preview

#Preview("Deal Expired") {
    ZStack {
        Color.sgBg.ignoresSafeArea()
        DealExpiredView(
            feedPrice: 487,
            livePrice: 890,
            onSetAlert: { print("Set alert") },
            onBackToDeals: { print("Back") }
        )
    }
}
