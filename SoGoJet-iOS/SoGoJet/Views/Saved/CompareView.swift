import SwiftUI

// MARK: - Compare View
// Side-by-side destination comparison sheet.
// Highlights the "better" value for each metric in green.

struct CompareView: View {
    let dealA: Deal
    let dealB: Deal
    @Environment(\.dismiss) private var dismiss
    @Environment(SettingsStore.self) private var settingsStore

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    // Photo + name headers
                    headerRow

                    Divider()
                        .background(Color.sgBorder)
                        .padding(.vertical, Spacing.sm)

                    // Metric rows
                    VStack(spacing: 2) {
                        priceRow
                        flightDurationRow
                        stopsRow
                        tripDurationRow
                        bestMonthsRow
                        averageTempRow
                        vibeTagsRow
                        airlineRow
                    }
                }
                .padding(.horizontal, Spacing.md)
                .padding(.bottom, Spacing.xl)
            }
            .background(Color.sgBg)
            .navigationTitle("Compare")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(SGFont.bodyBold(size: 15))
                        .foregroundStyle(Color.sgYellow)
                }
            }
            .toolbarBackground(Color.sgSurface, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
    }

    // MARK: - Header Row

    private var headerRow: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            destinationHeader(dealA)
            destinationHeader(dealB)
        }
        .padding(.top, Spacing.md)
    }

    private func destinationHeader(_ deal: Deal) -> some View {
        VStack(spacing: Spacing.sm) {
            CachedAsyncImage(url: deal.imageUrl) {
                RoundedRectangle(cornerRadius: Radius.sm)
                    .fill(Color.sgSurface)
                    .overlay {
                        Text(deal.city.prefix(3).uppercased())
                            .font(SGFont.display(size: 20))
                            .foregroundStyle(Color.sgMuted.opacity(0.4))
                    }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 120)
            .clipShape(RoundedRectangle(cornerRadius: Radius.sm))

            VStack(spacing: 2) {
                Text(deal.city.uppercased())
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgWhite)
                    .lineLimit(1)

                Text(deal.country.uppercased())
                    .font(SGFont.body(size: 11))
                    .foregroundStyle(Color.sgMuted)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Metric Rows

    private var priceRow: some View {
        let priceA = dealA.displayPrice
        let priceB = dealB.displayPrice
        let winA = compareOptional(priceA, priceB, lowerIsBetter: true)
        let winB = compareOptional(priceB, priceA, lowerIsBetter: true)

        return metricRow(
            label: "Price",
            leftValue: dealA.hasPrice ? dealA.priceFormatted : "--",
            rightValue: dealB.hasPrice ? dealB.priceFormatted : "--",
            leftWins: winA,
            rightWins: winB
        )
    }

    private var flightDurationRow: some View {
        let minsA = parseDurationMinutes(dealA.flightDuration)
        let minsB = parseDurationMinutes(dealB.flightDuration)
        let winA = compareOptional(minsA, minsB, lowerIsBetter: true)
        let winB = compareOptional(minsB, minsA, lowerIsBetter: true)

        return metricRow(
            label: "Flight",
            leftValue: dealA.safeFlightDuration,
            rightValue: dealB.safeFlightDuration,
            leftWins: winA,
            rightWins: winB
        )
    }

    private var stopsRow: some View {
        let stopsA = effectiveStops(dealA)
        let stopsB = effectiveStops(dealB)
        let winA = compareOptional(stopsA, stopsB, lowerIsBetter: true)
        let winB = compareOptional(stopsB, stopsA, lowerIsBetter: true)

        return metricRow(
            label: "Stops",
            leftValue: dealA.stopsLabel.isEmpty ? "--" : dealA.stopsLabel,
            rightValue: dealB.stopsLabel.isEmpty ? "--" : dealB.stopsLabel,
            leftWins: winA,
            rightWins: winB
        )
    }

    private var tripDurationRow: some View {
        let daysA = dealA.tripDurationDays
        let daysB = dealB.tripDurationDays
        // Longer trip is "better" (more vacation)
        let winA = compareOptional(daysA, daysB, lowerIsBetter: false)
        let winB = compareOptional(daysB, daysA, lowerIsBetter: false)

        return metricRow(
            label: "Trip length",
            leftValue: daysA.map { "\($0) days" } ?? "--",
            rightValue: daysB.map { "\($0) days" } ?? "--",
            leftWins: winA,
            rightWins: winB
        )
    }

    private var bestMonthsRow: some View {
        let leftMonths = dealA.bestMonths?.prefix(3).joined(separator: ", ") ?? "--"
        let rightMonths = dealB.bestMonths?.prefix(3).joined(separator: ", ") ?? "--"
        // No winner for best months — just informational
        return metricRow(
            label: "Best months",
            leftValue: leftMonths,
            rightValue: rightMonths,
            leftWins: false,
            rightWins: false
        )
    }

    private var averageTempRow: some View {
        // No clear "better" for temperature — just informational
        return metricRow(
            label: "Avg temp",
            leftValue: dealA.averageTemp.map { Deal.formatTemp($0, metric: settingsStore.usesMetric) } ?? "--",
            rightValue: dealB.averageTemp.map { Deal.formatTemp($0, metric: settingsStore.usesMetric) } ?? "--",
            leftWins: false,
            rightWins: false
        )
    }

    private var vibeTagsRow: some View {
        let leftVibes = dealA.safeVibeTags.prefix(3).joined(separator: ", ")
        let rightVibes = dealB.safeVibeTags.prefix(3).joined(separator: ", ")

        return metricRow(
            label: "Vibes",
            leftValue: leftVibes.isEmpty ? "--" : leftVibes,
            rightValue: rightVibes.isEmpty ? "--" : rightVibes,
            leftWins: false,
            rightWins: false
        )
    }

    private var airlineRow: some View {
        return metricRow(
            label: "Airline",
            leftValue: dealA.airlineName,
            rightValue: dealB.airlineName,
            leftWins: false,
            rightWins: false
        )
    }

    // MARK: - Generic Metric Row

    private func metricRow(
        label: String,
        leftValue: String,
        rightValue: String,
        leftWins: Bool,
        rightWins: Bool
    ) -> some View {
        HStack(spacing: 0) {
            // Left value
            Text(leftValue)
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(leftWins ? Color.sgDealAmazing : Color.sgWhite)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.vertical, 10)
                .padding(.horizontal, Spacing.sm)
                .background(leftWins ? Color.sgDealAmazing.opacity(0.08) : Color.clear)

            // Center label
            Text(label.uppercased())
                .font(SGFont.body(size: 10))
                .foregroundStyle(Color.sgMuted)
                .tracking(0.5)
                .frame(width: 80)
                .multilineTextAlignment(.center)
                .padding(.vertical, 10)

            // Right value
            Text(rightValue)
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(rightWins ? Color.sgDealAmazing : Color.sgWhite)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 10)
                .padding(.horizontal, Spacing.sm)
                .background(rightWins ? Color.sgDealAmazing.opacity(0.08) : Color.clear)
        }
        .background(Color.sgSurface.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
    }

    // MARK: - Helpers

    /// Compare two optional numeric values. Returns true if `a` wins.
    private func compareOptional<T: Comparable>(_ a: T?, _ b: T?, lowerIsBetter: Bool) -> Bool {
        guard let a = a, let b = b else { return false }
        if a == b { return false }
        return lowerIsBetter ? a < b : a > b
    }

    /// Parse flight duration string like "9h 30m" or "7h 10m" to minutes.
    private func parseDurationMinutes(_ duration: String?) -> Int? {
        guard let duration = duration else { return nil }
        var totalMinutes = 0
        var found = false

        // Match hours
        if let hRange = duration.range(of: #"(\d+)\s*h"#, options: .regularExpression) {
            let numStr = duration[hRange].filter(\.isNumber)
            if let h = Int(numStr) {
                totalMinutes += h * 60
                found = true
            }
        }
        // Match minutes
        if let mRange = duration.range(of: #"(\d+)\s*m"#, options: .regularExpression) {
            let numStr = duration[mRange].filter(\.isNumber)
            if let m = Int(numStr) {
                totalMinutes += m
                found = true
            }
        }
        return found ? totalMinutes : nil
    }

    /// Effective stops count for comparison. Nonstop = 0.
    private func effectiveStops(_ deal: Deal) -> Int? {
        if deal.isNonstop == true { return 0 }
        return deal.totalStops
    }
}

// MARK: - Destination Picker Sheet

struct ComparePickerView: View {
    let deals: [Deal]
    @Binding var selectedA: Deal?
    @Binding var selectedB: Deal?
    let onCompare: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    Text("Pick two destinations to compare side by side.")
                        .font(SGFont.body(size: 14))
                        .foregroundStyle(Color.sgMuted)
                        .padding(.horizontal, Spacing.md)
                        .padding(.top, Spacing.sm)

                    // Selection slots
                    HStack(spacing: Spacing.sm) {
                        selectionSlot(label: "First", deal: selectedA)
                        selectionSlot(label: "Second", deal: selectedB)
                    }
                    .padding(.horizontal, Spacing.md)

                    // Deal list
                    LazyVStack(spacing: 2) {
                        ForEach(deals) { deal in
                            pickerRow(deal)
                        }
                    }
                }
                .padding(.bottom, Spacing.xl)
            }
            .background(Color.sgBg)
            .navigationTitle("Select Destinations")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .font(SGFont.body(size: 15))
                        .foregroundStyle(Color.sgMuted)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Compare") {
                        dismiss()
                        onCompare()
                    }
                    .font(SGFont.bodyBold(size: 15))
                    .foregroundStyle(canCompare ? Color.sgYellow : Color.sgFaint)
                    .disabled(!canCompare)
                }
            }
            .toolbarBackground(Color.sgSurface, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
    }

    private var canCompare: Bool {
        selectedA != nil && selectedB != nil && selectedA?.id != selectedB?.id
    }

    private func selectionSlot(label: String, deal: Deal?) -> some View {
        VStack(spacing: 4) {
            if let deal = deal {
                CachedAsyncImage(url: deal.imageUrl) {
                    RoundedRectangle(cornerRadius: Radius.sm)
                        .fill(Color.sgSurface)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 60)
                .clipShape(RoundedRectangle(cornerRadius: Radius.sm))

                Text(deal.city)
                    .font(SGFont.bodyBold(size: 12))
                    .foregroundStyle(Color.sgWhite)
                    .lineLimit(1)
            } else {
                RoundedRectangle(cornerRadius: Radius.sm)
                    .strokeBorder(Color.sgBorder, style: StrokeStyle(lineWidth: 1, dash: [4]))
                    .frame(maxWidth: .infinity)
                    .frame(height: 60)
                    .overlay {
                        Text(label)
                            .font(SGFont.body(size: 12))
                            .foregroundStyle(Color.sgFaint)
                    }

                Text("Tap below")
                    .font(SGFont.body(size: 11))
                    .foregroundStyle(Color.sgFaint)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func pickerRow(_ deal: Deal) -> some View {
        let isSelectedA = selectedA?.id == deal.id
        let isSelectedB = selectedB?.id == deal.id
        let isSelected = isSelectedA || isSelectedB

        return Button {
            HapticEngine.selection()
            handleSelection(deal)
        } label: {
            HStack(spacing: Spacing.sm) {
                CachedAsyncImage(url: deal.imageUrl) {
                    RoundedRectangle(cornerRadius: Radius.sm)
                        .fill(Color.sgSurface)
                }
                .frame(width: 48, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: Radius.sm))

                VStack(alignment: .leading, spacing: 2) {
                    Text(deal.city)
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgWhite)
                    Text(deal.country)
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                }

                Spacer()

                if deal.hasPrice {
                    VStack(alignment: .trailing, spacing: 1) {
                        if deal.isEstimatedPrice {
                            Text("from")
                                .font(.system(size: 8, weight: .medium))
                                .foregroundStyle(Color.sgMuted)
                        }
                        Text(deal.priceFormatted)
                            .font(.system(size: 13, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.sgWhite)
                    }
                }

                // Selection indicator
                ZStack {
                    Circle()
                        .strokeBorder(isSelected ? Color.sgYellow : Color.sgBorder, lineWidth: 1.5)
                        .frame(width: 22, height: 22)

                    if isSelected {
                        Circle()
                            .fill(Color.sgYellow)
                            .frame(width: 14, height: 14)
                    }
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm + 2)
            .background(isSelected ? Color.sgYellow.opacity(0.06) : Color.clear)
        }
    }

    private func handleSelection(_ deal: Deal) {
        // If already selected, deselect
        if selectedA?.id == deal.id {
            selectedA = nil
            return
        }
        if selectedB?.id == deal.id {
            selectedB = nil
            return
        }
        // Fill first empty slot
        if selectedA == nil {
            selectedA = deal
        } else if selectedB == nil {
            selectedB = deal
        } else {
            // Both full — replace the second
            selectedB = deal
        }
    }
}

// MARK: - Previews

#Preview("Compare View") {
    CompareView(dealA: .preview, dealB: .previewNonstop)
}

#Preview("Compare Picker") {
    ComparePickerView(
        deals: [.preview, .previewNonstop],
        selectedA: .constant(.preview),
        selectedB: .constant(.previewNonstop),
        onCompare: {}
    )
}
