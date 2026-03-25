import SwiftUI

// MARK: - Deal Expired View
// Shown when the live price has increased significantly from the feed price.

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

            // Icon
            Image(systemName: "tag.slash.fill")
                .font(.system(size: 56))
                .foregroundStyle(Color.sgRed.opacity(0.85))

            // Title
            Text("Price Changed")
                .font(SGFont.display(size: 36))
                .foregroundStyle(Color.sgWhite)

            // Explanation
            VStack(spacing: Spacing.sm) {
                Text("This flight jumped from $\(Int(feedPrice)) to $\(Int(livePrice))")
                    .font(SGFont.bodyDefault)
                    .foregroundStyle(Color.sgWhiteDim)

                Text("That's \(increasePercent)% more. Flight prices change constantly — we'll let you know if it drops back down.")
                    .font(SGFont.bodySmall)
                    .foregroundStyle(Color.sgMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, Spacing.lg)

            Spacer()

            // Notify me when it drops
            Button {
                onSetAlert()
                HapticEngine.success()
            } label: {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "bell.fill")
                        .font(.system(size: 14))
                    Text("Notify Me When It Drops")
                        .font(SGFont.bodyBold(size: 16))
                }
                .foregroundStyle(Color.sgBg)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(Color.sgGreen)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            }
            .padding(.horizontal, Spacing.md)

            // Search again
            Button {
                onBackToDeals()
            } label: {
                Text("Search other flights")
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
