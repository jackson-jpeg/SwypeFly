import SwiftUI

// MARK: - Deal Badge
// Small pill badge showing deal quality tier with savings percentage.

struct DealBadge: View {
    let dealTier: DealTier
    let savingsPercent: Int?

    var body: some View {
        // Only show for meaningful tiers
        if dealTier != .fair {
            HStack(spacing: Spacing.xs) {
                Image(systemName: dealTier.iconName)
                    .font(.system(size: 9, weight: .bold))

                Text(badgeText)
                    .font(SGFont.bodyBold(size: 11))
                    .tracking(0.8)
            }
            .textCase(.uppercase)
            .foregroundStyle(dealTier.color)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.xs)
            .background(
                Capsule()
                    .fill(dealTier.color.opacity(0.2))
                    .overlay(
                        Capsule()
                            .strokeBorder(dealTier.color.opacity(0.6), lineWidth: 1)
                    )
            )
        }
    }

    private var badgeText: String {
        if let pct = savingsPercent, pct > 0 {
            return "\(pct)% BELOW AVG"
        }
        switch dealTier {
        case .amazing: return "INCREDIBLE DEAL"
        case .great:   return "GREAT DEAL"
        case .good:    return "GOOD PRICE"
        case .fair:    return ""
        }
    }
}

// MARK: - Preview

#Preview("Deal Badges") {
    VStack(spacing: Spacing.md) {
        DealBadge(dealTier: .amazing, savingsPercent: 42)
        DealBadge(dealTier: .great, savingsPercent: 28)
        DealBadge(dealTier: .good, savingsPercent: nil)
        DealBadge(dealTier: .amazing, savingsPercent: nil)
        DealBadge(dealTier: .fair, savingsPercent: 10) // should not render
    }
    .padding(Spacing.lg)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.sgBg)
}
