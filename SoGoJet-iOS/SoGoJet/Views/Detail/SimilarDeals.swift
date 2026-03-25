import SwiftUI

struct SimilarDeals: View {
    let deals: [Deal]
    let currentDealId: String
    var onTap: (Deal) -> Void = { _ in }

    private var similarDeals: [Deal] {
        guard let current = deals.first(where: { $0.id == currentDealId }) else {
            return []
        }
        let currentVibes = Set(current.safeVibeTags)
        var seen = Set<String>()

        return deals
            .filter { $0.id != currentDealId && !Set($0.safeVibeTags).isDisjoint(with: currentVibes) }
            .filter { deal in
                seen.insert(deal.id).inserted
            }
            .prefix(4)
            .map { $0 }
    }

    var body: some View {
        if !similarDeals.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.md) {
                // Clean section header
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("Similar Destinations")
                        .font(SGFont.sectionHead)
                        .foregroundStyle(Color.sgWhite)
                    Text("More places with a similar vibe")
                        .font(SGFont.bodySmall)
                        .foregroundStyle(Color.sgMuted)
                }
                .padding(.horizontal, Spacing.md)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.md) {
                        ForEach(similarDeals) { deal in
                            Button {
                                onTap(deal)
                            } label: {
                                card(for: deal)
                            }
                            .buttonStyle(SimilarDealButtonStyle())
                            .frame(width: 220)
                        }
                    }
                    .padding(.horizontal, Spacing.md)
                }
            }
        }
    }

    private func card(for deal: Deal) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Photo with price overlay
            ZStack(alignment: .bottomLeading) {
                CachedAsyncImage(url: deal.imageUrl) {
                    Color.sgSurface
                }
                .frame(height: 140)
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: Radius.md, topTrailingRadius: Radius.md))

                // Price badge
                Text(deal.priceFormatted)
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, Spacing.sm + 2)
                    .padding(.vertical, Spacing.xs)
                    .background(Color.sgYellow, in: Capsule())
                    .padding(Spacing.sm)
            }

            // Info area
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(deal.destination)
                    .font(SGFont.bodyBold(size: 16))
                    .foregroundStyle(Color.sgWhite)
                    .lineLimit(1)

                Text(deal.country)
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgMuted)

                if !deal.safeVibeTags.isEmpty {
                    HStack(spacing: Spacing.xs) {
                        ForEach(deal.safeVibeTags.prefix(2), id: \.self) { tag in
                            Text(tag.capitalized)
                                .font(SGFont.body(size: 11))
                                .foregroundStyle(Color.sgWhiteDim)
                                .padding(.horizontal, Spacing.sm)
                                .padding(.vertical, 3)
                                .background(Color.sgBorder.opacity(0.5), in: Capsule())
                        }
                    }
                    .padding(.top, 2)
                }
            }
            .padding(Spacing.sm + 2)
        }
        .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }
}

// MARK: - Similar Deal Button Style

private struct SimilarDealButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

#Preview {
    SimilarDeals(
        deals: [.preview, .previewNonstop],
        currentDealId: Deal.preview.id
    )
    .background(Color.sgBg)
}
