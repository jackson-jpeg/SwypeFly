import SwiftUI

// MARK: - Compare Strip
//
// Horizontal rail of the user's other saved trips at the bottom of the detail
// view. Each item is a tiny SGCard(elevation: .flush) showing city + price.
// Tapping navigates to that trip's detail via router.showDeal — the hero
// transition is handled by DestinationDetailView's namespace at the call site.
// Glides with SGSpring.silky on scroll.

struct DetailCompareStrip: View {
    let currentDealId: String
    let savedDeals: [Deal]
    let router: Router
    var namespace: Namespace.ID? = nil

    @State private var appeared = false

    private var otherSaved: [Deal] {
        savedDeals.filter { $0.id != currentDealId }
    }

    var body: some View {
        if !otherSaved.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("YOUR SAVED TRIPS")
                    .sgFont(.micro)
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.4)
                    .padding(.horizontal, Spacing.md)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.sm) {
                        ForEach(Array(otherSaved.enumerated()), id: \.element.id) { index, deal in
                            compareCard(deal, index: index)
                        }
                    }
                    .padding(.horizontal, Spacing.md)
                }
            }
            .padding(.top, Spacing.md)
            .padding(.bottom, Spacing.sm)
            .background(Color.sgSurfaceElevated)
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(Color.sgHairline)
                    .frame(height: 1)
            }
            .opacity(appeared ? 1 : 0)
            .onAppear {
                withAnimation(SGSpring.silky.respectingReduceMotion().delay(0.05)) {
                    appeared = true
                }
            }
        }
    }

    private func compareCard(_ deal: Deal, index: Int) -> some View {
        Button {
            HapticEngine.selection()
            router.showDeal(deal)
        } label: {
            SGCard(elevation: .flush, padding: Spacing.sm) {
                VStack(alignment: .leading, spacing: 4) {
                    // Thumbnail
                    CachedAsyncImage(url: deal.imageUrl) {
                        RoundedRectangle(cornerRadius: 6).fill(Color.sgSurface)
                    }
                    .frame(width: 80, height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .applyHeroEffect(id: "dest-\(deal.id)", namespace: namespace)

                    Text(deal.city)
                        .sgFont(.micro)
                        .foregroundStyle(Color.sgWhite)
                        .lineLimit(1)
                    Text(deal.priceFormatted)
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color.sgYellow)
                }
                .frame(width: 96)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(deal.city) \(deal.priceFormatted)")
        .accessibilityHint("View this saved deal")
        .accessibilityAddTraits(.isButton)
        // Cascade entrance
        .opacity(appeared ? 1 : 0)
        .offset(x: appeared ? 0 : 20)
        .animation(
            SGSpring.silky
                .respectingReduceMotion()
                .delay(SGSpring.cascadeDelay(index: index, staggerMs: 40)),
            value: appeared
        )
    }
}

// MARK: - matchedGeometryEffect helper

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
