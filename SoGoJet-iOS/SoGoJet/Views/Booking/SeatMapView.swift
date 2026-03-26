import SwiftUI

// MARK: - Seat Map View
// Vintage cabin-selection desk for the booking flow.
// Turns the raw seat map into something closer to a cabin atlas and fare manifest.

struct SeatMapView: View {
    @Environment(BookingStore.self) private var store
    @Environment(SettingsStore.self) private var settingsStore

    private let seatSize: CGFloat = 42
    private let seatSpacing: CGFloat = 6
    private let rowNumberWidth: CGFloat = 34
    private let aisleSpacing: CGFloat = 20

    private var seatMap: SeatMap? {
        store.seatMap
    }

    private var selectedSeat: SeatInfo? {
        guard let selectedSeatId = store.selectedSeatId else { return nil }
        return findSeatById(selectedSeatId)
    }

    private var allSeats: [SeatInfo] {
        seatMap?.rows.flatMap(\.seats) ?? []
    }

    private var availableSeats: [SeatInfo] {
        allSeats.filter(\.available)
    }

    private var extraLegroomSeats: [SeatInfo] {
        availableSeats.filter { $0.type == .extra }
    }

    private var windowSeats: [SeatInfo] {
        availableSeats.filter { $0.type == .window }
    }

    private var aisleSeats: [SeatInfo] {
        availableSeats.filter { $0.type == .aisle }
    }

    private var cheapestSeat: SeatInfo? {
        availableSeats.sorted { lhs, rhs in
            (lhs.price ?? 0) < (rhs.price ?? 0)
        }
        .first
    }

    private var cheapestExtraSeat: SeatInfo? {
        extraLegroomSeats.sorted { lhs, rhs in
            (lhs.price ?? 0) < (rhs.price ?? 0)
        }
        .first
    }

    private var recommendedSeat: SeatInfo? {
        if let selectedSeat {
            return selectedSeat
        }

        return cheapestExtraSeat
            ?? aisleSeats.first
            ?? windowSeats.first
            ?? availableSeats.first
    }

    private var sectionedColumns: [[String]] {
        guard let seatMap else { return [] }
        return columnSections(for: seatMap)
    }

    private var cabinLayoutLabel: String {
        let layout = sectionedColumns
            .map { section in
                section.joined()
            }
            .joined(separator: " / ")

        return layout.isEmpty ? "Assigned at check-in" : layout
    }

    private var selectedSeatLabel: String {
        selectedSeat?.label ?? "OPEN"
    }

    private var selectedSeatFareLabel: String {
        guard let selectedSeat else { return "Assigned later" }
        return seatPriceLabel(for: selectedSeat)
    }

    private var routeLabel: String {
        let origin = store.searchOrigin ?? settingsStore.departureCode
        let destination = store.searchDestination ?? store.deal?.iataCode ?? "DST"
        return "\(origin) - \(destination)"
    }

    private var travelWindowLabel: String {
        let departure = (store.searchDepartureDate ?? store.deal?.bestDepartureDate ?? "---").shortDate
        let returnDate = (store.searchReturnDate ?? store.deal?.bestReturnDate ?? "---").shortDate
        return "\(departure) to \(returnDate)"
    }

    private var cabinMetrics: [VintageTerminalMetric] {
        [
            VintageTerminalMetric(
                title: "Available",
                value: "\(availableSeats.count)",
                footnote: availableSeats.isEmpty ? "No cabin selection available" : "Seats still open right now",
                tone: .amber
            ),
            VintageTerminalMetric(
                title: "Legroom",
                value: "\(extraLegroomSeats.count)",
                footnote: extraLegroomSeats.isEmpty ? "No upgraded seats returned" : "Premium rows with extra space",
                tone: .moss
            ),
            VintageTerminalMetric(
                title: "Layout",
                value: cabinLayoutLabel,
                footnote: "Cabin sections split by aisle",
                tone: .ivory
            ),
            VintageTerminalMetric(
                title: "Exit rows",
                value: exitRowSummary,
                footnote: "Useful for reading legroom posture",
                tone: .ember
            ),
        ]
    }

    private var exitRowSummary: String {
        guard let seatMap, !seatMap.exitRows.isEmpty else { return "None" }
        return seatMap.exitRows
            .prefix(3)
            .map(String.init)
            .joined(separator: ", ")
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                header

                // Prominent skip option for budget travelers
                Button {
                    HapticEngine.light()
                    store.selectedSeatId = nil
                    store.proceedToReview()
                } label: {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "forward.fill")
                            .font(.system(size: 13, weight: .semibold))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Skip seat selection")
                                .font(SGFont.bodyBold(size: 14))
                            Text("Airline assigns your seat at check-in — most budget travelers skip this")
                                .font(SGFont.body(size: 11))
                                .foregroundStyle(Color.sgMuted)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.sgMuted)
                    }
                    .foregroundStyle(Color.sgWhite)
                    .padding(Spacing.md)
                    .background(Color.sgCell, in: RoundedRectangle(cornerRadius: Radius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md)
                            .strokeBorder(Color.sgBorder, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)

                boardingStub
                cabinTelemetry
                cabinLegend

                if let seatMap, !seatMap.rows.isEmpty {
                    seatSelectionDesk
                    cabinAtlas(seatMap)
                    travelerNotes
                } else {
                    noSeatMapDesk
                }

                actionCluster
            }
            .padding(.horizontal, Spacing.md)
            .padding(.top, Spacing.lg)
            .padding(.bottom, Spacing.xl)
        }
    }

    // MARK: - Header

    private var header: some View {
        VintageTerminalHeroLockup(
            eyebrow: "Seat Map",
            title: "Seat Selection",
            subtitle: "Pick a place in the cabin now, or leave it open and let the carrier assign one later.",
            accent: .amber
        )
    }

    private var boardingStub: some View {
        VintageTerminalBoardingSummary(
            originCode: store.searchOrigin ?? settingsStore.departureCode,
            destinationCode: store.searchDestination ?? store.deal?.iataCode ?? "DST",
            fare: selectedSeatLabel,
            detail: selectedSeat == nil
                ? "\(travelWindowLabel)  |  Seat assignment still open"
                : "\(travelWindowLabel)  |  \(selectedSeatFareLabel)",
            tone: .amber
        )
    }

    private var cabinTelemetry: some View {
        VintageTerminalPanel(
            title: "Cabin Overview",
            subtitle: "Here's what's available on this flight.",
            stamp: routeLabel,
            tone: .ivory
        ) {
            VintageTerminalMetricDeck(metrics: cabinMetrics)
        }
    }

    private var cabinLegend: some View {
        VintageTerminalPanel(
            title: "Seat Key",
            subtitle: "",
            stamp: "Guide",
            tone: .amber
        ) {
            LazyVGrid(
                columns: [
                    GridItem(.flexible(), spacing: Spacing.sm),
                    GridItem(.flexible(), spacing: Spacing.sm),
                ],
                spacing: Spacing.sm
            ) {
                SeatLegendBadge(
                    title: "Available",
                    subtitle: "Open standard seat",
                    fill: Color.sgSurface,
                    stroke: Color.sgBorder,
                    indicator: nil
                )

                SeatLegendBadge(
                    title: "Selected",
                    subtitle: "Selected",
                    fill: Color.sgYellow,
                    stroke: Color.sgYellow,
                    indicator: nil
                )

                SeatLegendBadge(
                    title: "Legroom",
                    subtitle: "Extra space row",
                    fill: Color.sgSurface,
                    stroke: Color.sgGreen,
                    indicator: nil
                )

                SeatLegendBadge(
                    title: "Best value",
                    subtitle: "Cheapest premium option",
                    fill: Color.sgSurface,
                    stroke: Color.sgOrange,
                    indicator: Color.sgOrange
                )
            }
        }
    }

    // MARK: - Selection Desk

    private var seatSelectionDesk: some View {
        VintageTravelTicket(tone: selectedSeat == nil ? .ivory : .amber) {
            HStack(alignment: .top, spacing: Spacing.md) {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    VintageTerminalSectionLabel(
                        text: selectedSeat == nil ? "Seat Selection" : "Seat Selected",
                        tone: selectedSeat == nil ? .ivory : .amber
                    )
                    SplitFlapRow(
                        text: selectedSeatLabel,
                        maxLength: 6,
                        size: .lg,
                        color: selectedSeat == nil ? Color.sgWhiteDim : Color.sgWhite,
                        alignment: .leading,
                        animate: true,
                        staggerMs: 24
                    )
                }

                Spacer(minLength: 0)

                if let seat = selectedSeat ?? recommendedSeat {
                    VintageTerminalPassportStamp(
                        title: selectedSeat == nil ? "Suggestion" : "Fare",
                        subtitle: selectedSeat == nil ? seat.label : seatPriceLabel(for: seat),
                        tone: selectedSeat == nil ? .ivory : .moss
                    )
                }
            }
        } content: {
            VStack(alignment: .leading, spacing: Spacing.md) {
                if let selectedSeat {
                    seatFocusRow(
                        title: "\(selectedSeat.label) is included in your booking",
                        detail: seatNarrative(for: selectedSeat),
                        tone: .amber
                    )
                } else if let recommendedSeat {
                    seatFocusRow(
                        title: "Recommended seat: \(recommendedSeat.label)",
                        detail: seatNarrative(for: recommendedSeat),
                        tone: .moss
                    )
                } else {
                    seatFocusRow(
                        title: "The carrier did not return a bookable seat map",
                        detail: "You can continue without choosing a seat. The airline may assign one later during check-in.",
                        tone: .ivory
                    )
                }

                HStack(spacing: Spacing.sm) {
                    if let recommendedSeat, selectedSeat?.id != recommendedSeat.id {
                        VintageTerminalSecondaryButton(
                            title: "Choose \(recommendedSeat.label)",
                            subtitle: seatPriceLabel(for: recommendedSeat),
                            icon: "sparkles",
                            tone: .moss,
                            fillsWidth: true
                        ) {
                            store.selectSeat(recommendedSeat.id)
                        }
                    }

                    if selectedSeat != nil {
                        VintageTerminalSecondaryButton(
                            title: "Clear Seat",
                            subtitle: "Leave assignment open",
                            icon: "xmark.circle",
                            tone: .ivory,
                            fillsWidth: true
                        ) {
                            store.selectedSeatId = nil
                            HapticEngine.selection()
                        }
                    }
                }
            }
        } footer: {
            HStack {
                VintageTerminalCaptionBlock(
                    title: "Cabin",
                    value: cabinLayoutLabel,
                    tone: .ivory
                )

                Spacer()

                VintageTerminalCaptionBlock(
                    title: "Status",
                    value: selectedSeat == nil ? "Optional" : "Ready",
                    tone: selectedSeat == nil ? .ember : .amber,
                    alignment: .trailing
                )
            }
        }
    }

    // MARK: - Cabin Atlas

    private func cabinAtlas(_ seatMap: SeatMap) -> some View {
        VintageTerminalPanel(
            title: "Seat Map",
            subtitle: "Choose your preferred seat.",
            stamp: cabinLayoutLabel,
            tone: .amber
        ) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                if !seatMap.exitRows.isEmpty {
                    cabinExitRowStrip(seatMap.exitRows)
                }

                if sectionedColumns.isEmpty {
                    seatFallbackList(seatMap)
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        VStack(alignment: .leading, spacing: seatSpacing) {
                            cabinColumnHeader

                            ForEach(seatMap.rows, id: \.rowNumber) { row in
                                cabinRow(row, seatMap: seatMap)
                            }
                        }
                        .padding(Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: Radius.md)
                                .fill(Color.sgBg.opacity(0.35))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.md)
                                .strokeBorder(Color.sgBorder.opacity(0.65), lineWidth: 1)
                        )
                    }
                }
            }
        }
    }

    private var cabinColumnHeader: some View {
        HStack(spacing: seatSpacing) {
            Text("")
                .frame(width: rowNumberWidth)

            ForEach(Array(sectionedColumns.enumerated()), id: \.offset) { index, section in
                HStack(spacing: seatSpacing) {
                    ForEach(section, id: \.self) { column in
                        Text(column)
                            .font(SGFont.bodyBold(size: 11))
                            .foregroundStyle(Color.sgMuted)
                            .frame(width: seatSize, height: 22)
                    }
                }

                if index < sectionedColumns.count - 1 {
                    Text("")
                        .frame(width: aisleSpacing)
                }
            }
        }
    }

    private func cabinRow(_ row: SeatRow, seatMap: SeatMap) -> some View {
        HStack(spacing: seatSpacing) {
            rowMarker(row.rowNumber, isExit: seatMap.exitRows.contains(row.rowNumber))

            ForEach(Array(sectionedColumns.enumerated()), id: \.offset) { index, section in
                HStack(spacing: seatSpacing) {
                    ForEach(section, id: \.self) { column in
                        if let seat = findSeat(row: row, column: column) {
                            cabinSeatButton(seat)
                        } else {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color.sgSurface.opacity(0.18))
                                .frame(width: seatSize, height: seatSize)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .strokeBorder(Color.sgBorder.opacity(0.25), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                                )
                        }
                    }
                }

                if index < sectionedColumns.count - 1 {
                    aisleMarker
                }
            }
        }
    }

    private func rowMarker(_ rowNumber: Int, isExit: Bool) -> some View {
        VStack(spacing: 2) {
            Text("\(rowNumber)")
                .font(SGFont.bodyBold(size: 12))
                .foregroundStyle(isExit ? Color.sgYellow : Color.sgWhiteDim)
            if isExit {
                Text("EXIT")
                    .font(SGFont.bodyBold(size: 7))
                    .foregroundStyle(Color.sgOrange)
                    .tracking(1.1)
            }
        }
        .frame(width: rowNumberWidth, height: seatSize)
        .background(Color.sgSurface.opacity(0.55), in: RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(isExit ? Color.sgOrange.opacity(0.4) : Color.sgBorder.opacity(0.6), lineWidth: 1)
        )
    }

    private var aisleMarker: some View {
        VStack(spacing: 4) {
            Rectangle()
                .fill(Color.sgBorder.opacity(0.5))
                .frame(width: aisleSpacing, height: 1)
            Image(systemName: "figure.walk")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(Color.sgMuted)
            Rectangle()
                .fill(Color.sgBorder.opacity(0.5))
                .frame(width: aisleSpacing, height: 1)
        }
        .frame(width: aisleSpacing, height: seatSize)
    }

    private func cabinSeatButton(_ seat: SeatInfo) -> some View {
        let isSelected = store.selectedSeatId == seat.id
        let isExtraLegroom = seat.type == .extra
        let isBestValue = isExtraLegroom && seat.available && isCheapestExtra(seat)
        let tone: VintageTerminalTone = {
            if isSelected { return .amber }
            if isBestValue { return .ember }
            if isExtraLegroom { return .moss }
            return .ivory
        }()

        return Button {
            guard seat.available else { return }
            store.selectSeat(seat.id)
        } label: {
            CabinSeatCell(
                seat: seat,
                isSelected: isSelected,
                isExtraLegroom: isExtraLegroom,
                isBestValue: isBestValue,
                tone: tone,
                size: seatSize
            )
        }
        .buttonStyle(.plain)
        .disabled(!seat.available)
        .accessibilityLabel("\(seat.label), \(seatNarrative(for: seat))")
    }

    private func seatFallbackList(_ seatMap: SeatMap) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VintageTerminalDividerLabel(text: "Available Seats", tone: .ivory)

            ForEach(seatMap.rows, id: \.rowNumber) { row in
                VintageTerminalManifestCard(
                    title: "Row \(row.rowNumber)",
                    subtitle: "Seats shown in list view.",
                    tone: .ivory
                ) {
                    ForEach(Array(row.seats.enumerated()), id: \.element.id) { index, seat in
                        seatListButton(seat)

                        if index < row.seats.count - 1 {
                            Rectangle()
                                .fill(Color.sgBorder.opacity(0.45))
                                .frame(height: 1)
                        }
                    }
                }
            }
        }
    }

    private func seatListButton(_ seat: SeatInfo) -> some View {
        let isSelected = store.selectedSeatId == seat.id
        let isExtraLegroom = seat.type == .extra
        let tone: VintageTerminalTone = isSelected ? .amber : (isExtraLegroom ? .moss : .ivory)

        return Button {
            guard seat.available else { return }
            store.selectSeat(seat.id)
        } label: {
            HStack(alignment: .center, spacing: Spacing.md) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(seat.label)
                        .font(SGFont.bodyBold(size: 15))
                        .foregroundStyle(isSelected ? Color.sgYellow : Color.sgWhite)
                    Text(seatNarrative(for: seat))
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                }

                Spacer()

                Text(seatPriceLabel(for: seat))
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(tone.text)
            }
            .padding(Spacing.sm + 2)
            .background(tone.softFill, in: RoundedRectangle(cornerRadius: Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .strokeBorder(tone.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(!seat.available)
    }

    private func cabinExitRowStrip(_ exitRows: [Int]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            VintageTerminalDividerLabel(text: "Exit Row Marker", tone: .ember)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.sm) {
                    ForEach(exitRows, id: \.self) { row in
                        VintageTerminalPassportStamp(
                            title: "Row",
                            subtitle: "\(row)",
                            tone: .ember
                        )
                    }
                }
            }
        }
    }

    // MARK: - Notes and Empty States

    private var travelerNotes: some View {
        VintageTerminalPanel(
            title: "Seat Info",
            subtitle: "",
            stamp: "Ready",
            tone: .moss
        ) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                VintageTerminalChecklistItem(
                    title: "Seat selection is optional",
                    detail: "If nothing feels right, continue without choosing a seat and let the airline assign one later.",
                    tone: .ivory
                )

                VintageTerminalChecklistItem(
                    title: "Extra legroom rows often cost more",
                    detail: "We mark the cheapest premium seat so you can see when the upgrade is actually reasonable.",
                    tone: .amber
                )

                VintageTerminalChecklistItem(
                    title: "The live order only holds one seat at a time",
                    detail: "Switching seats here simply replaces the current choice attached to this traveler.",
                    tone: .moss
                )
            }
        }
    }

    private var noSeatMapDesk: some View {
        VintageTerminalPanel(
            title: "Seat Selection Unavailable",
            subtitle: "This fare did not return a purchasable seat map, but the route can still be issued.",
            stamp: "Fallback",
            tone: .ivory
        ) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                VintageTerminalInfoRow(
                    icon: "airplane.circle",
                    title: "Seat will be assigned later",
                    value: "You can keep moving and let the carrier assign seating during check-in or after booking.",
                    detail: "The rest of the booking flow still works normally.",
                    tone: .ivory
                )

                VintageTerminalMetricDeck(metrics: [
                    .init(title: "Route", value: routeLabel, footnote: travelWindowLabel, tone: .amber),
                    .init(title: "Status", value: "Continue", footnote: "Seat map missing but booking stays open", tone: .moss),
                    .init(title: "Traveler", value: "\(store.passengerCount)", footnote: "Lead traveler on this order", tone: .ivory),
                    .init(title: "Seats", value: "Seat map unavailable", footnote: "Seat selection not available for this flight", tone: .ember),
                ])
            }
        }
    }

    // MARK: - Actions

    private var actionCluster: some View {
        VintageTerminalActionCluster {
            VintageTerminalActionButton(
                title: primaryActionTitle,
                subtitle: primaryActionSubtitle,
                icon: "airplane.departure",
                tone: .amber,
                fillsWidth: true
            ) {
                handlePrimaryAction()
            }
        } secondary: {
            HStack(spacing: Spacing.sm) {
                VintageTerminalSecondaryButton(
                    title: "Skip Seat",
                    subtitle: "Skip seat selection",
                    icon: "forward.fill",
                    tone: .ivory,
                    fillsWidth: true
                ) {
                    store.selectedSeatId = nil
                    store.proceedToReview()
                }

                if let recommendedSeat, selectedSeat?.id != recommendedSeat.id {
                    VintageTerminalSecondaryButton(
                        title: "Best Value",
                        subtitle: recommendedSeat.label,
                        icon: "sparkles",
                        tone: .moss,
                        fillsWidth: true
                    ) {
                        store.selectSeat(recommendedSeat.id)
                    }
                }
            }

            VintageTerminalSecondaryButton(
                title: "Back",
                subtitle: "Edit passenger details",
                icon: "chevron.left",
                tone: .neutral,
                fillsWidth: true
            ) {
                store.goBack()
            }
        }
    }

    private var primaryActionTitle: String {
        if let selectedSeat {
            return "Continue with \(selectedSeat.label)"
        }

        if let recommendedSeat {
            return "Choose \(recommendedSeat.label) + Continue"
        }

        return "Continue Without Seat"
    }

    private var primaryActionSubtitle: String {
        if let selectedSeat {
            return seatPriceLabel(for: selectedSeat)
        }

        if let recommendedSeat {
            return seatNarrative(for: recommendedSeat)
        }

        return "Seat will be assigned later"
    }

    private func handlePrimaryAction() {
        if let selectedSeat {
            store.selectSeat(selectedSeat.id)
            store.proceedToReview()
            return
        }

        if let recommendedSeat {
            store.selectSeat(recommendedSeat.id)
        }
        store.proceedToReview()
    }

    // MARK: - Helpers

    private func seatFocusRow(title: String, detail: String, tone: VintageTerminalTone) -> some View {
        VintageTerminalInfoRow(
            icon: "airplane.circle.fill",
            title: title,
            value: detail,
            detail: "Seat availability may change. Select yours before it's taken.",
            tone: tone
        )
    }

    private func findSeat(row: SeatRow, column: String) -> SeatInfo? {
        row.seats.first { $0.column.caseInsensitiveCompare(column) == .orderedSame }
    }

    private func findSeatById(_ id: String) -> SeatInfo? {
        allSeats.first { $0.id == id }
    }

    private func isCheapestExtra(_ seat: SeatInfo) -> Bool {
        guard let minPrice = extraLegroomSeats.compactMap(\.price).min() else {
            return false
        }
        return seat.price == minPrice
    }

    private func columnSections(for seatMap: SeatMap) -> [[String]] {
        let aisleBreaks = Set(seatMap.aisleAfterColumns.map { $0.uppercased() })
        let columns = seatMap.columns
            .map { $0.uppercased() }
            .sorted()

        guard !columns.isEmpty else { return [] }

        var sections: [[String]] = []
        var currentSection: [String] = []

        for column in columns {
            currentSection.append(column)
            if aisleBreaks.contains(column) {
                sections.append(currentSection)
                currentSection = []
            }
        }

        if !currentSection.isEmpty {
            sections.append(currentSection)
        }

        return sections.isEmpty ? [columns] : sections
    }

    private func seatPriceLabel(for seat: SeatInfo) -> String {
        guard seat.available else { return "Unavailable" }
        guard let price = seat.price else { return "Included" }
        return "$\(Int(price.rounded()))"
    }

    private func seatNarrative(for seat: SeatInfo) -> String {
        guard seat.available else { return "Unavailable seat" }

        let pieces = [
            seatTypeLabel(for: seat),
            seat.price.map { "$\(Int($0.rounded())) add-on" } ?? "No added seat fee",
            isCheapestExtra(seat) ? "Best premium value" : nil,
        ]

        return pieces.compactMap { $0 }.joined(separator: "  |  ")
    }

    private func seatTypeLabel(for seat: SeatInfo) -> String {
        switch seat.type {
        case .window:
            return "Window"
        case .middle:
            return "Middle"
        case .aisle:
            return "Aisle"
        case .extra:
            return "Extra legroom"
        }
    }
}

// MARK: - Local Components

private struct SeatLegendBadge: View {
    let title: String
    let subtitle: String
    let fill: Color
    let stroke: Color
    let indicator: Color?

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.sm) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(fill)
                    .frame(width: 28, height: 28)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(stroke, lineWidth: 1.5)
                    )

                if let indicator {
                    Circle()
                        .fill(indicator)
                        .frame(width: 6, height: 6)
                        .offset(y: -8)
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgWhite)
                Text(subtitle)
                    .font(SGFont.body(size: 11))
                    .foregroundStyle(Color.sgMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
        }
        .padding(Spacing.sm)
        .background(Color.sgSurface.opacity(0.45), in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(Color.sgBorder.opacity(0.55), lineWidth: 1)
        )
    }
}

private struct CabinSeatCell: View {
    let seat: SeatInfo
    let isSelected: Bool
    let isExtraLegroom: Bool
    let isBestValue: Bool
    let tone: VintageTerminalTone
    let size: CGFloat

    private var fillColor: Color {
        if isSelected { return Color.sgYellow }
        if !seat.available { return Color.sgFaint.opacity(0.22) }
        return Color.sgSurface
    }

    private var borderColor: Color {
        if isSelected { return Color.sgYellow }
        if isBestValue { return Color.sgOrange }
        if isExtraLegroom { return Color.sgGreen }
        if !seat.available { return Color.sgFaint }
        return tone.border
    }

    private var labelColor: Color {
        if isSelected { return Color.sgBg }
        if !seat.available { return Color.sgFaint }
        return Color.sgWhite
    }

    var body: some View {
        ZStack(alignment: .top) {
            RoundedRectangle(cornerRadius: 12)
                .fill(fillColor)
                .frame(width: size, height: size)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(borderColor, lineWidth: isSelected || isExtraLegroom || isBestValue ? 2 : 1)
                )

            if isBestValue && !isSelected {
                Circle()
                    .fill(Color.sgOrange)
                    .frame(width: 6, height: 6)
                    .offset(y: -8)
            }

            VStack(spacing: 1) {
                Text(seat.label)
                    .font(SGFont.bodyBold(size: 10))
                    .foregroundStyle(labelColor)

                if seat.available {
                    Text(seat.price.map { "$\(Int($0.rounded()))" } ?? "INC")
                        .font(SGFont.bodyBold(size: 6))
                        .foregroundStyle(isSelected ? Color.sgBg.opacity(0.8) : Color.sgMuted)
                        .tracking(0.4)
                }
            }
        }
        .opacity(seat.available ? 1 : 0.6)
    }
}

#Preview("Seat Map") {
    let store = BookingStore()
    SeatMapView()
        .environment(store)
        .environment(SettingsStore())
}
