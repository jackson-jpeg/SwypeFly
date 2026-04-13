import SwiftUI

// MARK: - Detail Hero
//
// Full-bleed image hero for the destination detail view.
// Receives a matchedGeometryEffect namespace (id "dest-<deal.id>") from either
// FeedView/DealCard or DepartureBoardView so the hero continues the source
// card's position. On settle a slow Ken Burns zoom fires via SGDuration.epic.
//
// Reduce Motion: skips Ken Burns, hero transition collapses to a fast fade.

struct DetailHero: View {
    let deal: Deal
    var namespace: Namespace.ID? = nil
    var onDismiss: () -> Void = {}

    @State private var kenBurnsScale: CGFloat = 1.0
    @State private var appeared = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // Hero image — full bleed
            GeometryReader { geo in
                let scrollY = geo.frame(in: .named("detailScroll")).minY
                let isPullingDown = scrollY > 0

                CachedAsyncImage(url: deal.imageUrl) {
                    Rectangle().fill(Color.sgSurface)
                }
                .frame(
                    width: geo.size.width,
                    height: isPullingDown ? 320 + scrollY : 320
                )
                .offset(y: isPullingDown ? -scrollY : -scrollY * 0.35)
                // Ken Burns slow zoom on settle — respect Reduce Motion
                .scaleEffect(reduceMotion ? 1.0 : kenBurnsScale, anchor: .center)
                .clipped()
            }
            .frame(height: 320)
            .applyHeroEffect(id: "dest-\(deal.id)", namespace: namespace)

            // Gradient scrim
            LinearGradient(
                colors: [.clear, Color(hex: 0x0A0A0A, alpha: 0.85)],
                startPoint: .center,
                endPoint: .bottom
            )
            .allowsHitTesting(false)

            // City + price overlay
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(deal.city.uppercased())
                        .font(SGFont.display(size: 36))
                        .foregroundStyle(Color.sgWhite)
                        .minimumScaleFactor(0.7)
                        .lineLimit(2)
                    if !deal.country.isEmpty {
                        Text(deal.country)
                            .font(SGFont.body(size: 15))
                            .foregroundStyle(Color.sgWhite.opacity(0.7))
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    HStack(spacing: 3) {
                        Text("from")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Color.sgWhite.opacity(0.7))
                        PriceInfoButton()
                    }
                    Text(deal.priceFormatted)
                        .font(SGFont.bodyBold(size: 24))
                        .foregroundStyle(Color.sgWhite)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(deal.tierColor)
                        .clipShape(Capsule())
                    if let localPrice = deal.displayPrice.flatMap({ CurrencyHelper.convertFromUSD(amount: $0) }) {
                        Text(localPrice)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color.sgWhite.opacity(0.6))
                    }
                }
            }
            .padding(16)
        }
        .frame(height: 320)
        .clipped()
        .overlay(alignment: .topTrailing) {
            // X dismiss button
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.sgWhite)
                    .frame(width: 32, height: 32)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
            }
            .accessibilityLabel(String(localized: "common.close"))
            .padding(.top, 12)
            .padding(.trailing, 16)
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(deal.city), \(deal.country), \(deal.priceFormatted)")
        .accessibilityAddTraits(.isHeader)
        .onAppear {
            guard !reduceMotion else { return }
            // Ken Burns: slow scale from 1.0 → 1.06 over epic duration
            withAnimation(
                .timingCurve(0.16, 1.0, 0.3, 1.0, duration: SGDuration.epic * 2)
                .delay(0.15)
            ) {
                kenBurnsScale = 1.06
            }
        }
    }
}

// MARK: - View Gallery CTA (shown below hero when ≥ 2 images)

struct DetailHeroGalleryCTA: View {
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 6) {
                Image(systemName: "photo.stack")
                    .font(.system(size: 12, weight: .semibold))
                Text("View Photos")
                    .font(SGFont.bodyBold(size: 13))
            }
            .foregroundStyle(Color.sgYellow)
            .padding(.horizontal, 14)
            .padding(.vertical, 7)
            .background(Color.sgYellow.opacity(0.12))
            .clipShape(Capsule())
            .overlay(
                Capsule().strokeBorder(Color.sgYellow.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("View all photos")
    }
}

// MARK: - Hero matchedGeometryEffect helper

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
