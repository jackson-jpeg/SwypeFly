import SwiftUI

// MARK: - Compare View
// Phase 4: vertical split-flap board comparing 2 trips side-by-side.
// Swipe left/right pages between pairs when >2 deals available.
// Wrap in SGCard(elevation: .hero).

struct CompareView: View {
    let dealA: Deal
    let dealB: Deal
    @Environment(\.dismiss) private var dismiss
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(SavedStore.self) private var savedStore

    // Paging: all saved deals so user can swipe to next pair
    @State private var pairIndex: Int = 0
    @State private var dragOffset: CGFloat = 0
    @State private var animateRows: Bool = false

    // Build all consecutive pairs from saved deals
    private var allDeals: [Deal] { savedStore.savedDeals }
    private var pairs: [(Deal, Deal)] {
        guard allDeals.count >= 2 else { return [(dealA, dealB)] }
        var result: [(Deal, Deal)] = []
        for i in stride(from: 0, to: allDeals.count - 1, by: 2) {
            result.append((allDeals[i], allDeals[i + 1]))
        }
        // If odd count, add a pair with the last deal repeated from the previous
        if allDeals.count % 2 == 1, let last = allDeals.last, allDeals.count >= 2 {
            result.append((allDeals[allDeals.count - 2], last))
        }
        return result.isEmpty ? [(dealA, dealB)] : result
    }

    private var currentA: Deal { pairs[pairIndex].0 }
    private var currentB: Deal { pairs[pairIndex].1 }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.sgBg.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: Spacing.md) {
                        // Paging indicator (only if multiple pairs)
                        if pairs.count > 1 {
                            pagingIndicator
                        }

                        // Main board card
                        SGCard(elevation: .hero) {
                            VStack(spacing: 0) {
                                // Destination headers
                                boardHeaderRow

                                // Metric rows — split-flap style
                                VStack(spacing: 2) {
                                    boardRow(
                                        metric: "PRICE",
                                        leftText: currentA.hasPrice ? currentA.priceFormatted : "--",
                                        rightText: currentB.hasPrice ? currentB.priceFormatted : "--",
                                        leftWins: compareWins(currentA.displayPrice, currentB.displayPrice, lowerIsBetter: true),
                                        rightWins: compareWins(currentB.displayPrice, currentA.displayPrice, lowerIsBetter: true),
                                        rowIndex: 0
                                    )
                                    boardRow(
                                        metric: "FLIGHT",
                                        leftText: currentA.safeFlightDuration,
                                        rightText: currentB.safeFlightDuration,
                                        leftWins: compareWins(parseMins(currentA.flightDuration), parseMins(currentB.flightDuration), lowerIsBetter: true),
                                        rightWins: compareWins(parseMins(currentB.flightDuration), parseMins(currentA.flightDuration), lowerIsBetter: true),
                                        rowIndex: 1
                                    )
                                    boardRow(
                                        metric: "STOPS",
                                        leftText: currentA.stopsLabel.isEmpty ? "--" : currentA.stopsLabel,
                                        rightText: currentB.stopsLabel.isEmpty ? "--" : currentB.stopsLabel,
                                        leftWins: compareWins(effectiveStops(currentA), effectiveStops(currentB), lowerIsBetter: true),
                                        rightWins: compareWins(effectiveStops(currentB), effectiveStops(currentA), lowerIsBetter: true),
                                        rowIndex: 2
                                    )
                                    boardRow(
                                        metric: "NIGHTS",
                                        leftText: currentA.tripDurationDays.map { "\($0)d" } ?? "--",
                                        rightText: currentB.tripDurationDays.map { "\($0)d" } ?? "--",
                                        leftWins: compareWins(currentA.tripDurationDays, currentB.tripDurationDays, lowerIsBetter: false),
                                        rightWins: compareWins(currentB.tripDurationDays, currentA.tripDurationDays, lowerIsBetter: false),
                                        rowIndex: 3
                                    )
                                    boardRow(
                                        metric: "SAVINGS",
                                        leftText: currentA.savingsLabel ?? "--",
                                        rightText: currentB.savingsLabel ?? "--",
                                        leftWins: false,
                                        rightWins: false,
                                        rowIndex: 4
                                    )
                                    boardRow(
                                        metric: "AIRLINE",
                                        leftText: currentA.airlineName,
                                        rightText: currentB.airlineName,
                                        leftWins: false,
                                        rightWins: false,
                                        rowIndex: 5
                                    )
                                    boardRow(
                                        metric: "TEMP",
                                        leftText: currentA.averageTemp.map { Deal.formatTemp($0, metric: settingsStore.usesMetric) } ?? "--",
                                        rightText: currentB.averageTemp.map { Deal.formatTemp($0, metric: settingsStore.usesMetric) } ?? "--",
                                        leftWins: false,
                                        rightWins: false,
                                        rowIndex: 6
                                    )
                                }
                            }
                        }
                        .padding(.horizontal, Spacing.md)

                        // Swipe hint
                        if pairs.count > 1 {
                            Text("Swipe left or right to compare other pairs")
                                .sgFont(.caption)
                                .foregroundStyle(Color.sgFaint)
                        }
                    }
                    .padding(.vertical, Spacing.md)
                    .padding(.bottom, Spacing.xl)
                }
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            guard pairs.count > 1 else { return }
                            dragOffset = value.translation.width
                        }
                        .onEnded { value in
                            guard pairs.count > 1 else { return }
                            let threshold: CGFloat = 60
                            if value.translation.width < -threshold && pairIndex < pairs.count - 1 {
                                HapticEngine.selection()
                                withAnimation(SGSpring.snappy) {
                                    pairIndex += 1
                                }
                                resetRowAnimation()
                            } else if value.translation.width > threshold && pairIndex > 0 {
                                HapticEngine.selection()
                                withAnimation(SGSpring.snappy) {
                                    pairIndex -= 1
                                }
                                resetRowAnimation()
                            }
                            withAnimation(SGSpring.snappy) {
                                dragOffset = 0
                            }
                        }
                )
                .offset(x: dragOffset * 0.15)
            }
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
            .onAppear {
                // Find initial pair index matching dealA
                if let idx = pairs.firstIndex(where: { $0.0.id == dealA.id || $0.1.id == dealA.id }) {
                    pairIndex = idx
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    animateRows = true
                    HapticEngine.flapSettle(count: 7, staggerMs: 40)
                }
            }
        }
    }

    // MARK: - Paging Indicator

    private var pagingIndicator: some View {
        HStack(spacing: 6) {
            ForEach(0..<pairs.count, id: \.self) { i in
                Capsule()
                    .fill(i == pairIndex ? Color.sgYellow : Color.sgFaint)
                    .frame(width: i == pairIndex ? 18 : 6, height: 6)
                    .animation(SGSpring.snappy, value: pairIndex)
            }
        }
        .padding(.top, Spacing.xs)
    }

    // MARK: - Board Header Row

    private var boardHeaderRow: some View {
        HStack(spacing: 0) {
            destinationHeader(currentA)

            // Center divider with board label
            VStack(spacing: 4) {
                Text("VS")
                    .sgFont(.micro)
                    .foregroundStyle(Color.sgYellow)
                    .tracking(2)
                Rectangle()
                    .fill(Color.sgHairline)
                    .frame(width: 1)
                    .frame(maxHeight: .infinity)
            }
            .frame(width: 44)

            destinationHeader(currentB)
        }
        .frame(height: 130)
        .animation(SGSpring.snappy, value: pairIndex)
    }

    private func destinationHeader(_ deal: Deal) -> some View {
        VStack(spacing: Spacing.xs) {
            CachedAsyncImage(url: deal.imageUrl) {
                RoundedRectangle(cornerRadius: Radius.sm)
                    .fill(Color.sgSurface)
                    .overlay {
                        Text(deal.city.prefix(3).uppercased())
                            .sgFont(.cardTitle)
                            .foregroundStyle(Color.sgMuted.opacity(0.4))
                    }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 80)
            .clipShape(RoundedRectangle(cornerRadius: Radius.sm))

            Text(deal.city.uppercased())
                .sgFont(.micro)
                .foregroundStyle(Color.sgWhite)
                .lineLimit(1)

            Text(deal.country.uppercased())
                .font(SGFont.body(size: 10))
                .foregroundStyle(Color.sgMuted)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(deal.city), \(deal.country)")
    }

    // MARK: - Board Row (split-flap style)

    private func boardRow(
        metric: String,
        leftText: String,
        rightText: String,
        leftWins: Bool,
        rightWins: Bool,
        rowIndex: Int
    ) -> some View {
        let delay = SGSpring.cascadeDelay(index: rowIndex, staggerMs: 45)

        return HStack(spacing: 0) {
            // Left flap cell
            flapCell(
                text: leftText,
                wins: leftWins,
                alignment: .trailing,
                rowIndex: rowIndex,
                delay: delay
            )

            // Center metric label
            Text(metric)
                .font(SGFont.body(size: 9))
                .foregroundStyle(Color.sgMuted)
                .tracking(0.8)
                .frame(width: 52)
                .multilineTextAlignment(.center)
                .padding(.vertical, 11)
                .background(Color.sgSurfaceElevated)

            // Right flap cell
            flapCell(
                text: rightText,
                wins: rightWins,
                alignment: .leading,
                rowIndex: rowIndex,
                delay: delay
            )
        }
        .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(metric): \(leftText) versus \(rightText)")
    }

    private func flapCell(
        text: String,
        wins: Bool,
        alignment: HorizontalAlignment,
        rowIndex: Int,
        delay: Double
    ) -> some View {
        SplitFlapText(
            text: text,
            style: .ticker,
            maxLength: 10,
            animate: animateRows,
            startDelay: delay
        )
        .frame(maxWidth: .infinity, alignment: alignment == .trailing ? .trailing : .leading)
        .padding(.vertical, 9)
        .padding(.horizontal, Spacing.sm)
        .background(wins ? Color.sgDealAmazing.opacity(0.10) : Color.sgSurface.opacity(0.5))
        .overlay(alignment: alignment == .trailing ? .leading : .trailing) {
            if wins {
                Rectangle()
                    .fill(Color.sgDealAmazing)
                    .frame(width: 2)
            }
        }
    }

    // MARK: - Helpers

    private func resetRowAnimation() {
        animateRows = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            animateRows = true
            HapticEngine.flapSettle(count: 7, staggerMs: 40)
        }
    }

    private func compareWins<T: Comparable>(_ a: T?, _ b: T?, lowerIsBetter: Bool) -> Bool {
        guard let a, let b, a != b else { return false }
        return lowerIsBetter ? a < b : a > b
    }

    private func parseMins(_ duration: String?) -> Int? {
        guard let duration else { return nil }
        var total = 0
        var found = false
        if let h = duration.range(of: #"(\d+)\s*h"#, options: .regularExpression) {
            if let v = Int(duration[h].filter(\.isNumber)) { total += v * 60; found = true }
        }
        if let m = duration.range(of: #"(\d+)\s*m"#, options: .regularExpression) {
            if let v = Int(duration[m].filter(\.isNumber)) { total += v; found = true }
        }
        return found ? total : nil
    }

    private func effectiveStops(_ deal: Deal) -> Int? {
        deal.isNonstop == true ? 0 : deal.totalStops
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

                    HStack(spacing: Spacing.sm) {
                        selectionSlot(label: "First", deal: selectedA)
                        selectionSlot(label: "Second", deal: selectedB)
                    }
                    .padding(.horizontal, Spacing.md)

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
        .accessibilityLabel("\(deal.city), \(deal.country), \(deal.priceFormatted)")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityHint(isSelected ? String(localized: "compare.deselect") : String(localized: "compare.select"))
    }

    private func handleSelection(_ deal: Deal) {
        if selectedA?.id == deal.id { selectedA = nil; return }
        if selectedB?.id == deal.id { selectedB = nil; return }
        if selectedA == nil { selectedA = deal }
        else if selectedB == nil { selectedB = deal }
        else { selectedB = deal }
    }
}

// MARK: - Previews

#Preview("Compare View") {
    CompareView(dealA: .preview, dealB: .previewNonstop)
        .environment(SettingsStore())
        .environment(SavedStore())
}

#Preview("Compare Picker") {
    ComparePickerView(
        deals: [.preview, .previewNonstop],
        selectedA: .constant(.preview),
        selectedB: .constant(.previewNonstop),
        onCompare: {}
    )
}
