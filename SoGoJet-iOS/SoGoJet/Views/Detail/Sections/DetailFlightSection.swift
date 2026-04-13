import SwiftUI

// MARK: - Flight Info Section
// Direct port of flightInfoSection + helpers from the original monolith.

struct DetailFlightSection: View {
    let deal: Deal
    let settingsStore: SettingsStore
    let savedStore: SavedStore
    let toastManager: ToastManager

    @State private var appeared = false

    private var isSaved: Bool { savedStore.isSaved(id: deal.id) }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            let flightLine = buildFlightLine()
            if !flightLine.isEmpty {
                Text(flightLine)
                    .font(SGFont.body(size: 15))
                    .foregroundStyle(Color.sgWhite)
            }
            let dateLine = buildDateLine()
            if !dateLine.isEmpty {
                Text(dateLine)
                    .font(SGFont.body(size: 15))
                    .foregroundStyle(Color.sgMuted)
            }
            if let tzDiff = deal.timeZoneDifference {
                HStack(spacing: 4) {
                    Image(systemName: "clock").font(.system(size: 12))
                    Text(tzDiff).font(.system(size: 13, weight: .medium))
                }
                .foregroundStyle(Color.sgMuted)
                .padding(.top, 2)
            }
            if let freshnessLabel = deal.priceFreshnessLabel, let freshness = deal.priceFreshness {
                HStack(spacing: 4) {
                    Circle()
                        .fill(freshnessColor(freshness))
                        .frame(width: 6, height: 6)
                    Text(freshnessLabel)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(freshnessColor(freshness))
                }
                .padding(.top, 2)
            }
            if deal.isEstimatedPrice {
                HStack(spacing: 4) {
                    Image(systemName: "info.circle").font(.system(size: 11))
                    Text("Price shown is an estimate. Live prices are confirmed when you search flights.")
                        .font(.system(size: 11))
                }
                .foregroundStyle(Color.sgMuted.opacity(0.7))
                .padding(.top, 2)
            }
            visaIndicator
            priceWatchButton
            PriceAlertCTA(
                destinationName: deal.city,
                iataCode: deal.iataCode,
                price: deal.displayPrice
            )
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Flight info: \(buildFlightLine()). \(buildDateLine())")
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 12)
        .onAppear {
            withAnimation(SGCurve.heroEntrance.respectingReduceMotion().delay(0.08)) {
                appeared = true
            }
        }
    }

    // MARK: - Helpers

    private func buildFlightLine() -> String {
        var parts: [String] = []
        if deal.airlineName != "\u{2014}" { parts.append(deal.airlineName) }
        if let d = deal.flightDuration, !d.isEmpty { parts.append(d) }
        let s = deal.stopsLabel
        if !s.isEmpty { parts.append(s) }
        return parts.joined(separator: " \u{00B7} ")
    }

    private func buildDateLine() -> String {
        var parts: [String] = []
        if let dep = deal.bestDepartureDate, let ret = deal.bestReturnDate {
            parts.append("\(dep.shortDate) \u{2013} \(ret.shortDate)")
        } else if let dep = deal.bestDepartureDate {
            parts.append(dep.shortDate)
        }
        if deal.tripDays > 0 { parts.append("\(deal.tripDays) days") }
        return parts.joined(separator: " \u{00B7} ")
    }

    private func freshnessColor(_ freshness: Deal.PriceFreshness) -> Color {
        switch freshness {
        case .fresh: return Color.sgDealAmazing
        case .stale: return Color.sgYellow
        case .old:   return Color.sgRed
        }
    }

    @ViewBuilder
    private var visaIndicator: some View {
        let status = VisaRequirement.status(for: deal.country)
        if status != .unknown {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: status.icon)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(status.color)
                    Text(status.label)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(status.color)
                }
                Text("Check travel.state.gov for current requirements")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.sgMuted.opacity(0.6))
            }
            .padding(.top, 4)
        }
    }

    @ViewBuilder
    private var priceWatchButton: some View {
        if deal.hasPrice {
            Button {
                HapticEngine.medium()
                savedStore.toggle(deal: deal)
                toastManager.show(
                    message: isSaved
                        ? "Price alert removed for \(deal.city)"
                        : "Price alert set for \(deal.city)",
                    type: isSaved ? .info : .success
                )
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: isSaved ? "eye.fill" : "bell.badge")
                        .font(.system(size: 12, weight: .semibold))
                    Text(isSaved ? "Watching" : "Watch Price")
                        .font(SGFont.bodyBold(size: 13))
                }
                .foregroundStyle(isSaved ? Color.sgGreen : Color.sgYellow)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background((isSaved ? Color.sgGreen : Color.sgYellow).opacity(0.12))
                .clipShape(Capsule())
                .overlay(
                    Capsule().strokeBorder((isSaved ? Color.sgGreen : Color.sgYellow).opacity(0.3), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
            .accessibilityLabel(isSaved ? "Stop watching price for \(deal.city)" : "Watch price for \(deal.city)")
        }
    }
}
