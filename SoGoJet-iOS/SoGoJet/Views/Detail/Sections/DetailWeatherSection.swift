import SwiftUI

// MARK: - Weather Section
// Shows avg temp card, best-month chips, seasonality bar, and what-to-wear hint.
// Reveals with cascade animation when scrolled into viewport.

struct DetailWeatherSection: View {
    let deal: Deal
    let settingsStore: SettingsStore

    @State private var appeared = false

    var body: some View {
        let hasWeather = deal.averageTemp != nil || !(deal.bestMonths ?? []).isEmpty
        if hasWeather {
            VStack(alignment: .leading, spacing: 12) {
                sectionHead
                tempAndMonths
                if let temp = deal.averageTemp {
                    Text(Self.whatToWear(temp))
                        .font(SGFont.body(size: 13))
                        .foregroundStyle(Color.sgMuted)
                        .padding(.top, 4)
                }
                monthSeasonalityBar
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 16)
            .onAppear {
                withAnimation(SGCurve.heroEntrance.respectingReduceMotion().delay(0.06)) {
                    appeared = true
                }
            }
        }
    }

    // MARK: Section head uses SplitFlapText ticker style
    private var sectionHead: some View {
        SplitFlapText(
            text: "WEATHER",
            style: .ticker,
            maxLength: 10,
            animate: appeared,
            animationID: appeared ? 1 : 0
        )
        .accessibilityAddTraits(.isHeader)
    }

    private var tempAndMonths: some View {
        HStack(spacing: 16) {
            if let temp = deal.averageTemp {
                VStack(spacing: 6) {
                    Image(systemName: tempIcon(temp))
                        .font(.system(size: 28))
                        .foregroundStyle(tempColor(temp))
                    Text(Deal.formatTemp(temp, metric: settingsStore.usesMetric))
                        .font(.system(size: 28, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color.sgWhite)
                    Text("avg temp")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Color.sgMuted)
                }
                .frame(width: 90, height: 110)
                .background(Color.sgBg)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Color.sgBorder, lineWidth: 1))
            }

            if let months = deal.bestMonths, !months.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 4) {
                        Image(systemName: "calendar").font(.system(size: 12)).foregroundStyle(Color.sgYellow)
                        Text("Best months").font(SGFont.bodyBold(size: 12)).foregroundStyle(Color.sgWhiteDim)
                    }
                    let columns = [GridItem(.adaptive(minimum: 50, maximum: 80), spacing: 4)]
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 4) {
                        ForEach(months, id: \.self) { month in
                            let isCurrent = isCurrentMonth(month)
                            Text(month)
                                .font(.system(size: 11, weight: isCurrent ? .bold : .medium))
                                .foregroundStyle(isCurrent ? Color.sgBg : Color.sgWhiteDim)
                                .padding(.horizontal, 8).padding(.vertical, 4)
                                .background(isCurrent ? Color.sgDealAmazing : Color.sgBg)
                                .clipShape(Capsule())
                                .overlay(Capsule().strokeBorder(isCurrent ? Color.sgDealAmazing : Color.sgBorder, lineWidth: 1))
                        }
                    }
                    if deal.isGoodTimeToVisit {
                        HStack(spacing: 4) {
                            Image(systemName: "checkmark.circle.fill").font(.system(size: 11))
                            Text("Great time to go!").font(.system(size: 11, weight: .semibold))
                        }
                        .foregroundStyle(Color.sgDealAmazing)
                        .padding(.top, 2)
                    }
                }
            }
        }
    }

    private var monthSeasonalityBar: some View {
        let allMonths = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        let labels = ["J","F","M","A","M","J","J","A","S","O","N","D"]
        let bestSet: Set<String> = {
            guard let best = deal.bestMonths else { return [] }
            var set = Set<String>()
            for m in best {
                for full in allMonths {
                    if m.localizedCaseInsensitiveContains(full) || full.localizedCaseInsensitiveContains(m) {
                        set.insert(full)
                    }
                }
            }
            return set
        }()
        let currentMonthIndex = Calendar.current.component(.month, from: Date()) - 1

        return VStack(spacing: 0) {
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(0..<12, id: \.self) { i in
                    let isBest = bestSet.contains(allMonths[i])
                    let isCurrent = i == currentMonthIndex
                    VStack(spacing: 3) {
                        if isCurrent { Circle().fill(Color.sgWhite).frame(width: 4, height: 4) }
                        else { Spacer().frame(height: 4) }
                        RoundedRectangle(cornerRadius: 2)
                            .fill(isBest ? Color.sgYellow : Color.sgBorder)
                            .frame(height: isBest ? 24 : 8)
                        Text(labels[i])
                            .font(.system(size: 8, weight: isBest ? .bold : .regular, design: .monospaced))
                            .foregroundStyle(isBest ? Color.sgYellow : Color.sgMuted)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 40)
        }
        .padding(.top, 8)
    }

    // MARK: - Helpers

    private func tempIcon(_ temp: Double) -> String {
        if temp >= 30 { return "sun.max.fill" }
        if temp >= 20 { return "sun.min.fill" }
        if temp >= 10 { return "cloud.sun.fill" }
        return "snowflake"
    }

    private func tempColor(_ temp: Double) -> Color {
        if temp >= 30 { return Color.sgOrange }
        if temp >= 20 { return Color.sgYellow }
        if temp >= 10 { return Color.sgGreen }
        return Color.sgDealGood
    }

    private func isCurrentMonth(_ month: String) -> Bool {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        let current = formatter.string(from: Date())
        let fullFormatter = DateFormatter()
        fullFormatter.dateFormat = "MMMM"
        let currentFull = fullFormatter.string(from: Date())
        return month.localizedCaseInsensitiveContains(current) ||
               month.localizedCaseInsensitiveContains(currentFull)
    }

    private static func whatToWear(_ tempCelsius: Double) -> String {
        switch tempCelsius {
        case ..<5:     return "Bundle up — heavy winter coat and layers essential"
        case 5..<15:   return "Bring a warm jacket and layers"
        case 15..<25:  return "Light layers — perfect for casual wear"
        case 25..<35:  return "Light, breathable clothing recommended"
        default:       return "Extreme heat — stay hydrated, wear sun protection"
        }
    }
}
