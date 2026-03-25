import SwiftUI

// MARK: - Price Sparkline
// Mini inline chart showing historical price trend with current price dot.

struct PriceSparkline: View {
    let prices: [Double]
    let currentPrice: Double
    var width: CGFloat = 64
    var height: CGFloat = 22

    var body: some View {
        if prices.count < 3 {
            EmptyView()
        } else {
            Canvas { context, size in
                let count = prices.count
                let minP = prices.min() ?? 0
                let maxP = prices.max() ?? 1
                let range = max(maxP - minP, 1) // avoid /0
                let median = prices.sorted()[count / 2]

                // Normalise Y: 0 = top, 1 = bottom (inverted for lower=better)
                func yPos(_ value: Double) -> CGFloat {
                    let norm = (value - minP) / range
                    let padded = Spacing.xs // vertical padding
                    return padded + CGFloat(norm) * (size.height - padded * 2)
                }

                func xPos(_ index: Int) -> CGFloat {
                    CGFloat(index) / CGFloat(count - 1) * size.width
                }

                // --- Dashed median reference line ---
                let medianY = yPos(median)
                var medianPath = Path()
                medianPath.move(to: CGPoint(x: 0, y: medianY))
                medianPath.addLine(to: CGPoint(x: size.width, y: medianY))

                context.stroke(
                    medianPath,
                    with: .color(Color.sgMuted.opacity(0.4)),
                    style: StrokeStyle(lineWidth: 1, dash: [3, 3])
                )

                // --- Polyline of historical prices ---
                var linePath = Path()
                for i in 0..<count {
                    let pt = CGPoint(x: xPos(i), y: yPos(prices[i]))
                    if i == 0 {
                        linePath.move(to: pt)
                    } else {
                        linePath.addLine(to: pt)
                    }
                }

                let lineColor: Color = {
                    if currentPrice < median * 0.95 {
                        return Color.sgGreen
                    } else if currentPrice > median * 1.05 {
                        return Color.sgRed
                    } else {
                        return Color.sgYellow
                    }
                }()

                context.stroke(
                    linePath,
                    with: .color(lineColor),
                    lineWidth: 1.5
                )

                // --- Current price dot (rightmost) ---
                let dotCenter = CGPoint(x: xPos(count - 1), y: yPos(prices.last ?? currentPrice))
                let dotRadius: CGFloat = 3
                let dotRect = CGRect(
                    x: dotCenter.x - dotRadius,
                    y: dotCenter.y - dotRadius,
                    width: dotRadius * 2,
                    height: dotRadius * 2
                )
                context.fill(Circle().path(in: dotRect), with: .color(lineColor))
            }
            .frame(width: width, height: height)
            .accessibilityElement()
            .accessibilityLabel(accessibilitySummary)
        }
    }

    // MARK: - Accessibility

    private var accessibilitySummary: String {
        guard prices.count >= 3 else { return "" }
        let median = prices.sorted()[prices.count / 2]
        let trend: String
        if currentPrice < median * 0.95 {
            trend = "below average"
        } else if currentPrice > median * 1.05 {
            trend = "above average"
        } else {
            trend = "near average"
        }
        return "Price trend: currently \(trend)"
    }
}

// MARK: - Preview

#Preview("Price Sparklines") {
    VStack(spacing: Spacing.lg) {
        Text("Below Median (Green)")
            .font(SGFont.caption)
            .foregroundStyle(Color.sgMuted)
        PriceSparkline(
            prices: [420, 380, 350, 390, 310, 340, 290],
            currentPrice: 290
        )

        Text("At Median (Yellow)")
            .font(SGFont.caption)
            .foregroundStyle(Color.sgMuted)
        PriceSparkline(
            prices: [300, 320, 310, 305, 315, 308, 312],
            currentPrice: 312
        )

        Text("Above Median (Red)")
            .font(SGFont.caption)
            .foregroundStyle(Color.sgMuted)
        PriceSparkline(
            prices: [200, 220, 250, 280, 310, 350, 400],
            currentPrice: 400
        )

        Text("Too Few Points (Empty)")
            .font(SGFont.caption)
            .foregroundStyle(Color.sgMuted)
        PriceSparkline(
            prices: [100, 200],
            currentPrice: 200
        )
    }
    .padding(Spacing.lg)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.sgBg)
}
