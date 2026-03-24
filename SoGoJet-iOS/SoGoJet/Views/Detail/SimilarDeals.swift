import SwiftUI

// MARK: - SimilarDeals
// 2-column grid of deals with matching vibes.

struct SimilarDeals: View {
    let deals: [Deal]
    let currentDealId: String
    var onTap: (Deal) -> Void = { _ in }

    private let columns = [
        GridItem(.flexible(), spacing: Spacing.sm),
        GridItem(.flexible(), spacing: Spacing.sm),
    ]

    /// Deals that share at least one vibe tag with the current deal, excluding itself.
    private var similarDeals: [Deal] {
        guard let current = deals.first(where: { $0.id == currentDealId }) else {
            return []
        }
        let currentVibes = Set(current.safeVibeTags)
        return deals
            .filter { $0.id != currentDealId && !Set($0.safeVibeTags).isDisjoint(with: currentVibes) }
            .prefix(4)
            .map { $0 }
    }

    var body: some View {
        if !similarDeals.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.md) {
                Text("Similar Deals")
                    .font(SGFont.sectionHead)
                    .foregroundStyle(Color.sgWhite)
                    .padding(.horizontal, Spacing.md)

                LazyVGrid(columns: columns, spacing: Spacing.sm) {
                    ForEach(similarDeals) { deal in
                        similarCard(deal)
                            .onTapGesture { onTap(deal) }
                    }
                }
                .padding(.horizontal, Spacing.md)
            }
        }
    }

    // MARK: - Card

    @ViewBuilder
    private func similarCard(_ deal: Deal) -> some View {
        ZStack(alignment: .bottomLeading) {
            CachedAsyncImage(url: deal.imageUrl) {
                Color.sgSurface
            }
            .frame(height: 120)
            .clipped()

            // Gradient overlay
            LinearGradient(
                colors: [.clear, Color.sgBg.opacity(0.85)],
                startPoint: .top,
                endPoint: .bottom
            )

            VStack(alignment: .leading, spacing: 2) {
                Text(deal.destination)
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgWhite)
                    .lineLimit(1)
                Text(deal.country)
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgMuted)
                    .lineLimit(1)
                if let price = deal.displayPrice {
                    Text("$\(Int(price))")
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgYellow)
                }
            }
            .padding(Spacing.sm)
        }
        .frame(height: 120)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
    }
}

// MARK: - Preview

#Preview {
    SimilarDeals(
        deals: [.preview],
        currentDealId: "other"
    )
    .background(Color.sgBg)
}
