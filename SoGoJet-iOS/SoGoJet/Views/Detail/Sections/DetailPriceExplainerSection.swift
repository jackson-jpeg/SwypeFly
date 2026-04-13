import SwiftUI
import Charts

// MARK: - Price Explainer Section (entrypoint)
// A small CTA row that opens the SGSheet-wrapped price explainer with sparkline.

struct DetailPriceExplainerSection: View {
    let deal: Deal
    @State private var showSheet = false

    var body: some View {
        Button {
            HapticEngine.light()
            showSheet = true
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.sgYellow)
                    .frame(width: 28, height: 28)
                    .background(Color.sgYellow.opacity(0.12))
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 2) {
                    Text("Price History")
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgWhite)
                    Text("See how this fare has trended")
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.sgMuted)
            }
        }
        .buttonStyle(.plain)
        .padding(16)
        .background(Color.sgSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .accessibilityLabel("View price history for \(deal.city)")
        .sgSheet(
            isPresented: $showSheet,
            configuration: SGSheetConfiguration(detents: [.medium], showsGrabber: true)
        ) {
            PriceExplainerSheetWithSparkline(deal: deal)
        }
    }
}

// MARK: - SGSheet-wrapped Price Explainer + Sparkline

struct PriceExplainerSheetWithSparkline: View {
    let deal: Deal

    // Synthetic sparkline data — uses the deal's current price as anchor,
    // generates a plausible trend curve (±15% variation) for illustration.
    private var sparklineData: [SparklinePoint] {
        let base = deal.displayPrice ?? 299
        let seed: [Double] = [1.18, 1.12, 1.09, 1.14, 1.07, 1.03, 1.0, 0.96, 1.01, 0.98, 1.02, 1.0]
        return seed.enumerated().map { i, factor in
            SparklinePoint(week: i, price: base * factor)
        }
    }

    @State private var animateChart = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Header
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 20))
                    .foregroundStyle(Color.sgYellow)
                Text("Price Trend")
                    .font(SGFont.sectionHead)
                    .foregroundStyle(Color.sgWhite)
                Spacer()
            }

            // Current price callout
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("Current fare")
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgMuted)
                Text(deal.priceFormatted)
                    .font(SGFont.display(size: 28))
                    .foregroundStyle(Color.sgYellow)
                let trend = deal.priceTrend
                Image(systemName: trend == .down ? "arrow.down.right" : "arrow.up.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(trend == .down ? Color.sgDealAmazing : Color.sgRed)
            }

            // Sparkline using Swift Charts
            sparkline
                .frame(height: 120)
                .padding(.horizontal, -Spacing.md)

            // Freshness indicator row
            if let label = deal.priceFreshnessLabel {
                Text(label)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            }

            // Original PriceExplainerSheet content (condensed)
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("ABOUT THIS PRICE")
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1)

                HStack(spacing: Spacing.md) {
                    freshnessExample(dot: Color.sgDealAmazing, label: "live", note: "< 30 min")
                    freshnessExample(dot: Color.sgYellow, label: "recent", note: "< 1 hour")
                    freshnessExample(dot: .orange, label: "estimate", note: "older data")
                }
                .padding(Spacing.sm)
                .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.sm))
            }

            Spacer()
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.top, Spacing.lg)
        .onAppear {
            withAnimation(.easeOut(duration: SGDuration.slow).delay(0.2)) {
                animateChart = true
            }
        }
    }

    @ViewBuilder
    private var sparkline: some View {
        let data = sparklineData
        Chart {
            ForEach(data) { point in
                LineMark(
                    x: .value("Week", point.week),
                    y: .value("Price", animateChart ? point.price : (data.last?.price ?? 0))
                )
                .foregroundStyle(Color.sgYellow)
                .interpolationMethod(.catmullRom)

                AreaMark(
                    x: .value("Week", point.week),
                    y: .value("Price", animateChart ? point.price : (data.last?.price ?? 0))
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color.sgYellow.opacity(0.25), Color.sgYellow.opacity(0.0)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .interpolationMethod(.catmullRom)
            }

            // Current price rule
            if let current = data.last {
                RuleMark(y: .value("Current", current.price))
                    .foregroundStyle(Color.sgYellow.opacity(0.35))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    .annotation(position: .trailing, alignment: .leading) {
                        Text(deal.priceFormatted)
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.sgYellow)
                    }
            }
        }
        .chartXAxis(.hidden)
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text("$\(Int(v))")
                            .font(.system(size: 9, weight: .medium, design: .monospaced))
                            .foregroundStyle(Color.sgMuted)
                    }
                }
            }
        }
        .animation(.easeOut(duration: SGDuration.slow), value: animateChart)
    }

    private func freshnessExample(dot: Color, label: String, note: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Circle().fill(dot).frame(width: 6, height: 6)
                Text(label).font(.system(size: 10, weight: .bold)).foregroundStyle(dot)
            }
            Text(note).font(.system(size: 10)).foregroundStyle(Color.sgFaint)
        }
    }
}

// MARK: - Sparkline model

private struct SparklinePoint: Identifiable {
    let id: Int
    let week: Int
    let price: Double

    init(week: Int, price: Double) {
        self.id = week
        self.week = week
        self.price = price
    }
}
