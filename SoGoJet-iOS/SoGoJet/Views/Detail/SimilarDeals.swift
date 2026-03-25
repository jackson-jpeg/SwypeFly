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
                VintageTerminalCollectionHeader(
                    title: "Related Routes",
                    subtitle: "More destinations carrying a similar mood to the route you are reading now.",
                    tone: .amber
                )
                .padding(.horizontal, Spacing.md)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.md) {
                        ForEach(similarDeals) { deal in
                            Button {
                                onTap(deal)
                            } label: {
                                card(for: deal)
                            }
                            .buttonStyle(.plain)
                            .frame(width: 280)
                        }
                    }
                    .padding(.horizontal, Spacing.md)
                }
            }
        }
    }

    private func card(for deal: Deal) -> some View {
        VintageTravelTicket(tone: .amber) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    VintageTerminalSectionLabel(text: deal.country, tone: .amber)
                    Text(deal.destination)
                        .font(SGFont.display(size: 28))
                        .foregroundStyle(Color.sgWhite)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }

                Spacer(minLength: 0)

                Text(deal.priceFormatted)
                    .font(SGFont.display(size: 28))
                    .foregroundStyle(Color.sgYellow)
            }
        } content: {
            VStack(alignment: .leading, spacing: Spacing.md) {
                CachedAsyncImage(url: deal.imageUrl) {
                    Color.sgSurface
                }
                .frame(height: 148)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md)
                        .strokeBorder(Color.sgBorder, lineWidth: 1)
                )

                Text(deal.tagline.isEmpty ? "Another board-worthy route with a related travel mood." : deal.tagline)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgWhiteDim)
                    .fixedSize(horizontal: false, vertical: true)

                if !deal.safeVibeTags.isEmpty {
                    VintageTerminalTagCloud(tags: Array(deal.safeVibeTags.prefix(3)), tone: .amber)
                }
            }
        } footer: {
            HStack(alignment: .top) {
                VintageTerminalCaptionBlock(title: "IATA", value: deal.iataCode, tone: .amber)
                Spacer()
                VintageTerminalCaptionBlock(title: "Duration", value: deal.safeFlightDuration, tone: .ivory, alignment: .trailing)
            }
        }
    }
}

#Preview {
    SimilarDeals(
        deals: [.preview, .previewNonstop],
        currentDealId: Deal.preview.id
    )
    .background(Color.sgBg)
}
