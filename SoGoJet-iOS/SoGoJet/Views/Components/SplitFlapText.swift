import SwiftUI

// MARK: - SplitFlapText
//
// Stylistic wrapper over the existing SplitFlapRow. Encodes named roles
// (headline / ticker / price / tag) that compose size + color + stagger +
// alignment + haptic into one choice. Call sites should always reach for
// a style rather than specifying raw cells — this keeps the split-flap
// vocabulary uniform across the app.

enum SplitFlapStyle {
    /// Huge headline — hero blocks, empty states ("END OF LINE").
    case headline
    /// Ticker row — departure board entries, primary table rows.
    case ticker
    /// Price cell — right-aligned, yellow accent.
    case price
    /// Small accent tag — vibe labels, micro metadata.
    case tag

    fileprivate var size: SplitFlapSize {
        switch self {
        case .headline: return .lg
        case .ticker:   return .md
        case .price:    return .sm
        case .tag:      return .sm
        }
    }

    fileprivate var color: Color {
        switch self {
        case .headline: return .sgWhite
        case .ticker:   return .sgWhite
        case .price:    return .sgYellow
        case .tag:      return .sgWhiteDim
        }
    }

    fileprivate var alignment: HorizontalAlignment {
        switch self {
        case .price: return .trailing
        default:     return .leading
        }
    }

    fileprivate var staggerMs: Double {
        switch self {
        case .headline: return 55
        case .ticker:   return 40
        case .price:    return 50
        case .tag:      return 35
        }
    }
}

struct SplitFlapText: View {
    let text: String
    var style: SplitFlapStyle = .ticker
    var maxLength: Int? = nil
    var animate: Bool = true
    var startDelay: Double = 0
    var animationID: Int = 0
    /// When true, fires a flapSettle haptic cascade on animate start.
    var hapticOnSettle: Bool = false

    var body: some View {
        SplitFlapRow(
            text: text,
            maxLength: maxLength ?? defaultMaxLength,
            size: style.size,
            color: style.color,
            alignment: style.alignment,
            animate: animate,
            startDelay: startDelay,
            staggerMs: style.staggerMs,
            animationID: animationID
        )
        .onChange(of: animate) { _, active in
            guard active, hapticOnSettle else { return }
            HapticEngine.flapSettle(
                count: min((maxLength ?? defaultMaxLength), 8),
                staggerMs: style.staggerMs
            )
        }
    }

    private var defaultMaxLength: Int {
        switch style {
        case .headline: return 12
        case .ticker:   return 14
        case .price:    return 7
        case .tag:      return 8
        }
    }
}

#Preview("SplitFlapText") {
    struct Demo: View {
        @State private var animate = false
        var body: some View {
            VStack(alignment: .leading, spacing: Spacing.md) {
                SplitFlapText(text: "DEPARTURE", style: .headline, animate: animate)
                SplitFlapText(text: "TOKYO", style: .ticker, animate: animate, startDelay: 0.2)
                SplitFlapText(text: "$428", style: .price, animate: animate, startDelay: 0.4, hapticOnSettle: true)
                SplitFlapText(text: "BEACH", style: .tag, animate: animate, startDelay: 0.55)
                SGButton("Animate") { animate.toggle() }
            }
            .padding(Spacing.lg)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.sgBg)
        }
    }
    return Demo()
}
