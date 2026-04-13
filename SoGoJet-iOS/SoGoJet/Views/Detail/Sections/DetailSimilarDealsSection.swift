import SwiftUI

// MARK: - Similar Deals Section
// Horizontal scrolling rail of other destinations. Tapping a card navigates
// to that deal's detail via the router (hero transition wired at call site).

struct DetailSimilarDealsSection: View {
    let deal: Deal
    let allDeals: [Deal]
    var namespace: Namespace.ID? = nil
    let router: Router

    @State private var appeared = false

    private var similar: [Deal] {
        Array(allDeals.filter { $0.id != deal.id }.prefix(8))
    }

    var body: some View {
        if !similar.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                SplitFlapText(
                    text: "SIMILAR",
                    style: .ticker,
                    maxLength: 10,
                    animate: appeared,
                    animationID: appeared ? 1 : 0
                )
                .padding(.horizontal, 16)
                .accessibilityAddTraits(.isHeader)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(Array(similar.enumerated()), id: \.element.id) { index, otherDeal in
                            similarCard(otherDeal, index: index)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.top, 16)
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 16)
            .onAppear {
                withAnimation(SGCurve.heroEntrance.respectingReduceMotion().delay(0.12)) {
                    appeared = true
                }
            }
        }
    }

    private func similarCard(_ otherDeal: Deal, index: Int) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            CachedAsyncImage(url: otherDeal.imageUrl) {
                RoundedRectangle(cornerRadius: 8).fill(Color.sgSurface)
            }
            .frame(width: 140, height: 100)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .applyHeroEffect(id: "dest-\(otherDeal.id)", namespace: namespace)

            Text(otherDeal.city)
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgWhite)
                .lineLimit(1)
            Text(otherDeal.priceFormatted)
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(Color.sgYellow)
        }
        .frame(width: 140)
        .contentShape(Rectangle())
        .onTapGesture {
            HapticEngine.light()
            router.showDeal(otherDeal)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(otherDeal.city), \(otherDeal.priceFormatted)")
        .accessibilityHint("View deal details")
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Nearby Destinations Section

struct DetailNearbySection: View {
    let deal: Deal
    let allDeals: [Deal]
    let settingsStore: SettingsStore
    var namespace: Namespace.ID? = nil
    let router: Router

    @State private var appeared = false

    private var nearbyDeals: [(deal: Deal, distanceKm: Int)] {
        guard deal.latitude != nil, deal.longitude != nil else { return [] }
        return allDeals
            .compactMap { other -> (Deal, Int)? in
                guard other.id != deal.id,
                      let km = Deal.distanceKm(from: deal, to: other),
                      km <= 1500, km > 0 else { return nil }
                return (other, Int(km))
            }
            .sorted { $0.1 < $1.1 }
            .prefix(5)
            .map { (deal: $0.0, distanceKm: $0.1) }
    }

    var body: some View {
        let nearby = nearbyDeals
        if !nearby.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                SplitFlapText(
                    text: "NEARBY",
                    style: .ticker,
                    maxLength: 10,
                    animate: appeared,
                    animationID: appeared ? 1 : 0
                )
                .padding(.horizontal, 16)
                .accessibilityAddTraits(.isHeader)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(nearby, id: \.deal.id) { item in
                            nearbyCard(item.deal, distanceKm: item.distanceKm)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.top, 16)
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 16)
            .onAppear {
                withAnimation(SGCurve.heroEntrance.respectingReduceMotion().delay(0.14)) {
                    appeared = true
                }
            }
        }
    }

    private func nearbyCard(_ otherDeal: Deal, distanceKm: Int) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack(alignment: .topTrailing) {
                CachedAsyncImage(url: otherDeal.imageUrl) {
                    RoundedRectangle(cornerRadius: 8).fill(Color.sgSurface)
                }
                .frame(width: 140, height: 100)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .applyHeroEffect(id: "dest-\(otherDeal.id)", namespace: namespace)

                Text(Deal.formatDistance(Double(distanceKm), metric: settingsStore.usesMetric))
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Color.sgWhite.opacity(0.85))
                    .clipShape(Capsule())
                    .padding(6)
            }
            Text(otherDeal.city)
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgWhite)
                .lineLimit(1)
            Text(otherDeal.priceFormatted)
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(Color.sgYellow)
        }
        .frame(width: 140)
        .contentShape(Rectangle())
        .onTapGesture {
            HapticEngine.light()
            router.showDeal(otherDeal)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(otherDeal.city), \(distanceKm) km away, \(otherDeal.priceFormatted)")
        .accessibilityHint("View deal details")
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - matchedGeometryEffect helper for similar/nearby cards

private extension View {
    @ViewBuilder
    func applyHeroEffect(id: String, namespace: Namespace.ID?) -> some View {
        if let ns = namespace {
            self.matchedGeometryEffect(id: id, in: ns)
        } else {
            self
        }
    }
}
