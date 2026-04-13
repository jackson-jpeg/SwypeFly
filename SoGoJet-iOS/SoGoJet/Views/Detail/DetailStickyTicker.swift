import SwiftUI

// MARK: - Sticky Ticker Header
//
// As the user scrolls, the full hero title collapses and this ticker appears
// pinned to the top of the viewport showing city IATA code + price.
// Driven by scroll offset communicated via a PreferenceKey.

// MARK: - Scroll offset tracking

struct DetailScrollOffsetKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

// MARK: - Sticky Ticker

struct DetailStickyTicker: View {
    let deal: Deal
    /// 0 = hero fully visible, 1 = fully collapsed
    let collapseProgress: CGFloat

    private var visible: Bool { collapseProgress > 0.25 }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            SplitFlapText(
                text: deal.iataCode.uppercased(),
                style: .ticker,
                maxLength: 4,
                animate: visible,
                animationID: visible ? 1 : 0
            )
            .frame(width: 60)

            Text(deal.city.uppercased())
                .sgFont(.section)
                .foregroundStyle(Color.sgWhite)
                .lineLimit(1)

            Spacer()

            SplitFlapText(
                text: deal.priceFormatted,
                style: .price,
                maxLength: 7,
                animate: visible,
                animationID: visible ? 1 : 0
            )
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .background(
            Color.sgSurfaceElevated.opacity(0.96)
                .background(.ultraThinMaterial)
        )
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.sgHairline)
                .frame(height: 1)
        }
        .opacity(Double(min(max(collapseProgress - 0.15, 0) / 0.35, 1.0)))
        .offset(y: visible ? 0 : -8)
        .animation(
            visible
                ? SGCurve.heroEntrance.respectingReduceMotion()
                : SGSpring.snappy.respectingReduceMotion(),
            value: visible
        )
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

// MARK: - ScrollOffset reader modifier

extension View {
    /// Reads the minY of the view in the named coordinate space and reports via preference.
    func readScrollOffset(in space: String) -> some View {
        background(
            GeometryReader { geo in
                Color.clear.preference(
                    key: DetailScrollOffsetKey.self,
                    value: geo.frame(in: .named(space)).minY
                )
            }
        )
    }
}
