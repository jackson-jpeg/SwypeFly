import SwiftUI

// MARK: - SGCard
//
// Unified card container used across feed, saved, detail sections, and
// settings groups. Depth shadow + hairline border give the app its
// carved-paper feel; optional shimmer activates the runway treatment
// during loading or hero states.

enum SGCardElevation {
    /// Flat — sits inside another surface (settings rows).
    case flush
    /// Standard card — feed, saved grid.
    case lifted
    /// Emphasized — hero blocks, booking boarding pass.
    case hero

    fileprivate var shadow: SGShadow {
        switch self {
        case .flush: return SGShadow(color: .clear, radius: 0, x: 0, y: 0)
        case .lifted: return .card
        case .hero: return .hero
        }
    }

    fileprivate var fill: Color {
        switch self {
        case .flush: return .sgCell
        case .lifted: return .sgSurfaceElevated
        case .hero: return .sgSurfaceHigh
        }
    }
}

struct SGCard<Content: View>: View {
    var elevation: SGCardElevation = .lifted
    var cornerRadius: CGFloat = Radius.lg
    var padding: CGFloat = Spacing.md
    var shimmer: Bool = false
    var showsPaperTexture: Bool = true
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                ZStack {
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(elevation.fill)
                    if showsPaperTexture {
                        PaperTexture(intensity: 0.03)
                            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                    }
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(Color.sgHairline, lineWidth: 0.5)
            )
            .runwayShimmer(active: shimmer)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .sgShadow(elevation.shadow)
    }
}

#Preview("SGCard") {
    ScrollView {
        VStack(spacing: Spacing.md) {
            SGCard(elevation: .lifted) {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("TOKYO")
                        .sgFont(.cardTitle)
                        .foregroundStyle(Color.sgWhite)
                    Text("from $420")
                        .sgFont(.body)
                        .foregroundStyle(Color.sgWhiteDim)
                }
            }
            SGCard(elevation: .hero, shimmer: true) {
                Text("THE DEPARTURE")
                    .sgFont(.hero)
                    .foregroundStyle(Color.sgYellow)
            }
            SGCard(elevation: .flush) {
                Text("Flush row")
                    .sgFont(.body)
                    .foregroundStyle(Color.sgWhiteDim)
            }
        }
        .padding()
    }
    .background(Color.sgBg)
}
