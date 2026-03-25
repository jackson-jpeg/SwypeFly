import SwiftUI

// MARK: - Departure Board View
// Airport-style departure board showing 5 deal rows at a time with swipe-up navigation.
// Tapping the active (top) row opens deal detail; tapping other rows makes them active.

struct DepartureBoardView: View {
    @Environment(FeedStore.self) private var feedStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(Router.self) private var router

    @State private var boardIndex: Int = 0
    @State private var dragOffset: CGFloat = 0
    @State private var animationCycle: Int = 0
    @State private var renderedSlots: [DepartureBoardSlot] = []
    @State private var boardTransitionTask: Task<Void, Never>?
    @State private var isBoardTransitioning = false

    private let visibleCount = 5

    // MARK: Derived

    private var targetVisibleDeals: [Deal] {
        guard !feedStore.deals.isEmpty else { return [] }
        let start = min(boardIndex, feedStore.deals.count)
        let end = min(start + visibleCount, feedStore.deals.count)
        guard start < end else { return [] }
        return Array(feedStore.deals[start..<end])
    }

    private var visibleDeals: [Deal] {
        renderedSlots.compactMap(\.deal)
    }

    private var activeDeal: Deal? {
        renderedSlots.first?.deal
    }

    private var canAdvance: Bool {
        boardIndex + 1 < feedStore.deals.count
    }

    // MARK: Body

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            if feedStore.isLoading && feedStore.allDeals.isEmpty {
                loadingState
            } else if feedStore.deals.isEmpty {
                emptyState
            } else {
                VStack(spacing: 0) {
                    boardPanel
                    if let deal = activeDeal {
                        detailStrip(for: deal)
                    }
                    actionButtons
                }
            }
        }
        .task {
            if feedStore.allDeals.isEmpty {
                await feedStore.fetchDeals(origin: settingsStore.departureCode)
            }
            syncBoardWindow(animated: false)
        }
        .onChange(of: settingsStore.departureCode) { _, newCode in
            boardIndex = 0
            Task {
                await feedStore.fetchDeals(origin: newCode)
            }
        }
        .onChange(of: boardIndex) { _, _ in
            syncBoardWindow(animated: true)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            topBar
        }
        .onChange(of: feedStore.deals.map(\.id)) { _, deals in
            guard !deals.isEmpty else {
                boardIndex = 0
                syncBoardWindow(animated: false)
                return
            }

            if boardIndex >= deals.count {
                boardIndex = 0
                return
            }
            syncBoardWindow(animated: true)
        }
        .onDisappear {
            boardTransitionTask?.cancel()
        }
    }

    // MARK: - Board Section

    private var boardPanel: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(alignment: .center) {
                Text(terminalStampTitle)
                    .font(SGFont.bodyBold(size: 11))
                    .foregroundStyle(Color.sgWhiteDim)

                Spacer()

                Text(terminalStampSubtitle)
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgMuted)
            }

            boardLegend
            boardSection
            Spacer(minLength: 0)
        }
        .padding(Spacing.md)
        .frame(maxHeight: .infinity)
        .background(boardPanelBackground)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .shadow(color: Color.black.opacity(0.32), radius: 18, y: 10)
        .padding(.horizontal, Spacing.md)
        .padding(.top, Spacing.md)
    }

    private var boardLegend: some View {
        HStack(spacing: Spacing.sm) {
            Text("CODE")
                .frame(width: 64, alignment: .leading)

            Text("DESTINATION")
                .frame(maxWidth: .infinity, alignment: .leading)

            Text("FARE")
                .frame(width: 82, alignment: .trailing)
        }
        .font(SGFont.bodyBold(size: 10))
        .foregroundStyle(Color.sgMuted)
        .tracking(1.4)
        .padding(.horizontal, Spacing.sm)
        .padding(.bottom, 2)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.sgBorder.opacity(0.7))
                .frame(height: 1)
        }
    }

    private var boardPanelBackground: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radius.lg)
                .fill(
                    LinearGradient(
                        colors: [
                            Color.sgSurface,
                            Color.sgCell,
                            Color.sgBg,
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            RoundedRectangle(cornerRadius: Radius.lg)
                .fill(
                    LinearGradient(
                        colors: [
                            Color.sgYellow.opacity(0.07),
                            Color.clear,
                            Color.sgOrange.opacity(0.05),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        }
    }

    private var terminalStampTitle: String {
        "\(visibleDeals.count) LIVE ROWS"
    }

    private var terminalStampSubtitle: String {
        canAdvance ? "Swipe for next departure" : "End of current board"
    }

    private var topBar: some View {
        HStack(spacing: Spacing.sm) {
            SplitFlapRow(
                text: "DEPARTURES",
                maxLength: 10,
                size: .sm,
                color: Color.sgYellow,
                animate: true,
                staggerMs: 30
            )

            Spacer()

            Button {
                HapticEngine.selection()
                router.showDeparturePicker()
            } label: {
                Text(settingsStore.departureCode)
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgYellow)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.xs)
                    .background(
                        Capsule()
                            .strokeBorder(Color.sgYellow.opacity(0.3), lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Departure airport \(settingsStore.departureCode)")
            .accessibilityHint("Open airport picker")

            Button {
                router.showSearch()
            } label: {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.sgWhite)
                    .frame(width: 36, height: 36)
                    .background(Color.sgCell, in: Circle())
                    .overlay(
                        Circle()
                            .strokeBorder(Color.sgBorder, lineWidth: 1)
                    )
            }
            .accessibilityLabel("Search destinations")

            Button {
                router.showFilters()
            } label: {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: "slider.horizontal.3")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.sgWhite)
                        .frame(width: 36, height: 36)
                        .background(Color.sgCell, in: Circle())
                        .overlay(
                            Circle()
                                .strokeBorder(Color.sgBorder, lineWidth: 1)
                        )

                    if feedStore.activeFilterCount > 0 {
                        Text("\(feedStore.activeFilterCount)")
                            .font(SGFont.bodyBold(size: 10))
                            .foregroundStyle(Color.sgBg)
                            .frame(minWidth: 16, minHeight: 16)
                            .background(Color.sgYellow, in: Circle())
                            .offset(x: 4, y: -4)
                    }
                }
            }
            .accessibilityLabel(feedStore.activeFilterCount > 0 ? "Filters, \(feedStore.activeFilterCount) active" : "Open filters")
        }
        .padding(.horizontal, Spacing.md)
        .padding(.top, Spacing.xs)
        .padding(.bottom, Spacing.sm)
        .background(
            LinearGradient(
                colors: [Color.sgBg.opacity(0.95), Color.sgBg.opacity(0.7), Color.clear],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }

    private var boardSection: some View {
        VStack(spacing: 2) {
            ForEach(Array(renderedSlots.enumerated()), id: \.element.id) { index, slot in
                DepartureRow(
                    slot: slot,
                    isActive: index == 0 && !slot.isBlank,
                    animate: true,
                    animationID: animationCycle
                )
                .frame(minHeight: 80, maxHeight: .infinity)
                .contentShape(Rectangle())
                .onTapGesture {
                    guard let deal = slot.deal, !isBoardTransitioning else { return }
                    handleRowTap(index: index, deal: deal)
                }
                .accessibilityLabel(slot.accessibilityText)
                .accessibilityHint(
                    slot.isBlank
                        ? "No flight in this row"
                        : "Tap to view deal details"
                )
                .accessibilityAddTraits(slot.isBlank ? [] : .isButton)
            }
        }
        .padding(.horizontal, Spacing.sm)
        .offset(y: dragOffset)
        .gesture(swipeGesture)
        .accessibilityHint("Swipe up to advance to the next flight")
        .onAppear {
            syncBoardWindow(animated: false)
        }
    }

    // MARK: - Detail Strip

    private func detailStrip(for deal: Deal) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.sm) {
                pill(text: deal.safeDepartureDate.shortDate, icon: "calendar")

                pill(text: deal.airlineName, icon: "airplane")

                pill(text: deal.tripDays == 0 ? "—d" : "\(deal.tripDays)d", icon: "clock")

                if deal.isNonstop == true {
                    pill(text: "Nonstop", icon: "arrow.right", color: Color.sgGreen)
                } else if !deal.stopsLabel.isEmpty {
                    pill(text: deal.stopsLabel, icon: "arrow.triangle.branch", color: Color.sgWhiteDim)
                }

                if let tier = deal.dealTier {
                    pill(text: tier.label, icon: tier.iconName, color: tier.color)
                }

                ForEach(deal.safeVibeTags.prefix(2), id: \.self) { tag in
                    pill(text: tag, icon: nil)
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm)
        }
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: Spacing.md) {
            // NEXT FLIGHT — outline button
            Button {
                advanceBoard()
            } label: {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "chevron.up")
                    Text("NEXT FLIGHT")
                }
                .font(SGFont.bodyBold(size: 15))
                .foregroundStyle(Color.sgYellow)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md)
                        .strokeBorder(Color.sgYellow, lineWidth: 1.5)
                )
            }
            .disabled(!canAdvance || isBoardTransitioning)
            .opacity((canAdvance && !isBoardTransitioning) ? 1.0 : 0.4)
            .accessibilityLabel("Next flight")
            .accessibilityHint("Advance to the next deal on the board")

            // BOOK IT — green fill button
            Button {
                if let deal = activeDeal {
                    HapticEngine.medium()
                    router.startBooking(deal)
                }
            } label: {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "airplane.departure")
                    Text("SEARCH FLIGHTS")
                }
                .font(SGFont.bodyBold(size: 15))
                .foregroundStyle(Color.sgBg)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
            }
            .disabled(activeDeal == nil || isBoardTransitioning)
            .accessibilityLabel("Book this flight")
            .accessibilityHint(activeDeal.map { "Book a flight to \($0.destination)" } ?? "No deal selected")
        }
        .padding(.horizontal, Spacing.md)
        .padding(.bottom, Spacing.lg)
    }

    // MARK: - Loading State

    private var loadingState: some View {
        VStack(spacing: 2) {
            ForEach(0..<visibleCount, id: \.self) { _ in
                shimmerRow
            }
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.top, Spacing.xl)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        ZStack {
            VStack(spacing: 2) {
                ForEach(0..<visibleCount, id: \.self) { _ in
                    placeholderRow
                }
            }
            .padding(.horizontal, Spacing.sm)

            VStack(spacing: Spacing.md) {
                Image(systemName: "airplane")
                    .font(.system(size: 36))
                    .foregroundStyle(Color.sgMuted)
                Text("No flights")
                    .font(SGFont.sectionHead)
                    .foregroundStyle(Color.sgWhiteDim)

                if let error = feedStore.error {
                    Text(error)
                        .font(SGFont.body(size: 13))
                        .foregroundStyle(Color.sgRed)
                        .multilineTextAlignment(.center)
                }

                Text(
                    feedStore.hasActiveFilters
                        ? "Try clearing filters or switching airports."
                        : "Try refreshing \(settingsStore.departureCode) or switching airports."
                )
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgMuted)
                    .multilineTextAlignment(.center)

                if feedStore.hasActiveFilters {
                    Text("No rows match your current filters.")
                        .font(SGFont.body(size: 13))
                        .foregroundStyle(Color.sgFaint)
                        .multilineTextAlignment(.center)

                    Button {
                        Task {
                            boardIndex = 0
                            await feedStore.clearFilters(origin: settingsStore.departureCode)
                        }
                    } label: {
                        HStack(spacing: Spacing.xs) {
                            Image(systemName: "line.3.horizontal.decrease.circle")
                            Text("Clear Filters")
                        }
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgBg)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.sm)
                        .background(Color.sgYellow, in: Capsule())
                    }
                } else {
                    HStack(spacing: Spacing.sm) {
                        ForEach(nearbyAirports, id: \.self) { code in
                            Button {
                                Task {
                                    boardIndex = 0
                                    if let airport = AirportPicker.airports.first(where: { $0.code == code }) {
                                        settingsStore.setDeparture(code: code, city: airport.city)
                                    } else {
                                        settingsStore.departureCode = code
                                    }
                                    await feedStore.fetchDeals(origin: code)
                                }
                            } label: {
                                Text(code)
                                    .font(SGFont.bodyBold(size: 14))
                                    .foregroundStyle(Color.sgYellow)
                                    .padding(.horizontal, Spacing.md)
                                    .padding(.vertical, Spacing.sm)
                                    .background(
                                        Capsule()
                                            .strokeBorder(Color.sgYellow.opacity(0.4), lineWidth: 1)
                                    )
                            }
                            .accessibilityLabel("Try \(code) airport")
                        }
                    }
                }

                HStack(spacing: Spacing.sm) {
                    Button {
                        Task {
                            await feedStore.fetchDeals(origin: settingsStore.departureCode)
                        }
                    } label: {
                        HStack(spacing: Spacing.xs) {
                            Image(systemName: "arrow.clockwise")
                            Text("Retry")
                        }
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgBg)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.sm)
                        .background(Color.sgYellow, in: Capsule())
                    }

                    Button {
                        router.showSearch()
                    } label: {
                        HStack(spacing: Spacing.xs) {
                            Image(systemName: "magnifyingglass")
                            Text("Search")
                        }
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgWhite)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.sm)
                        .background(
                            Capsule()
                                .strokeBorder(Color.sgBorder, lineWidth: 1)
                        )
                    }
                }
            }
            .padding(Spacing.lg)
            .background(Color.sgBg.opacity(0.85), in: RoundedRectangle(cornerRadius: Radius.md))
        }
    }

    // MARK: - Placeholder Row

    private var placeholderRow: some View {
        HStack(spacing: Spacing.sm) {
            RoundedRectangle(cornerRadius: 2)
                .strokeBorder(Color.sgFaint.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                .frame(width: 60, height: 28)

            RoundedRectangle(cornerRadius: 2)
                .strokeBorder(Color.sgFaint.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                .frame(maxWidth: .infinity, minHeight: 34, maxHeight: 34)

            RoundedRectangle(cornerRadius: 2)
                .strokeBorder(Color.sgFaint.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                .frame(width: 82, height: 28)
        }
        .padding(.vertical, Spacing.xs)
        .padding(.horizontal, Spacing.sm)
        .opacity(0.4)
    }

    // MARK: - Shimmer Row

    private var shimmerRow: some View {
        HStack(spacing: Spacing.sm) {
            ShimmerView()
                .frame(width: 60, height: 28)
                .clipShape(RoundedRectangle(cornerRadius: 2))

            ShimmerView()
                .frame(maxWidth: .infinity, minHeight: 34, maxHeight: 34)
                .clipShape(RoundedRectangle(cornerRadius: 2))

            ShimmerView()
                .frame(width: 82, height: 28)
                .clipShape(RoundedRectangle(cornerRadius: 2))
        }
        .padding(.vertical, Spacing.xs)
        .padding(.horizontal, Spacing.sm)
    }

    // MARK: - Pill Helper

    private func pill(text: String, icon: String?, color: Color = Color.sgWhiteDim) -> some View {
        HStack(spacing: Spacing.xs) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 10))
            }
            Text(text)
                .font(SGFont.caption)
        }
        .foregroundStyle(color)
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.xs)
        .background(
            Capsule()
                .fill(color.opacity(0.12))
        )
    }

    // MARK: - Gestures & Actions

    private var swipeGesture: some Gesture {
        DragGesture(minimumDistance: 30)
            .onChanged { value in
                guard !isBoardTransitioning else { return }
                dragOffset = min(0, value.translation.height)
            }
            .onEnded { value in
                withAnimation(.easeOut(duration: 0.2)) {
                    dragOffset = 0
                }
                guard !isBoardTransitioning else { return }
                if value.translation.height < -50 {
                    advanceBoard()
                }
            }
    }

    private func advanceBoard() {
        guard canAdvance else { return }
        HapticEngine.light()
        boardIndex += 1

        if boardIndex >= feedStore.deals.count - 3 {
            Task {
                await feedStore.fetchMore(origin: settingsStore.departureCode)
            }
        }
    }

    private func handleRowTap(index: Int, deal: Deal) {
        HapticEngine.medium()
        router.showDeal(deal)
    }

    private func triggerAnimation() {
        animationCycle += 1
    }

    private func syncBoardWindow(animated: Bool) {
        let nextSlots = boardSlots(for: boardIndex)

        if renderedSlots.isEmpty || !animated {
            boardTransitionTask?.cancel()
            isBoardTransitioning = false
            renderedSlots = nextSlots
            triggerAnimation()
            return
        }

        guard renderedSlots != nextSlots else { return }

        boardTransitionTask?.cancel()
        isBoardTransitioning = true
        renderedSlots = blankBoardSlots()
        triggerAnimation()

        boardTransitionTask = Task { @MainActor in
            defer {
                isBoardTransitioning = false
            }

            try? await Task.sleep(for: .milliseconds(180))
            guard !Task.isCancelled else { return }

            renderedSlots = nextSlots
            triggerAnimation()
        }
    }

    private func boardSlots(for startIndex: Int) -> [DepartureBoardSlot] {
        let deals = targetVisibleDeals
        if deals.isEmpty {
            return blankBoardSlots()
        }

        return (0..<visibleCount).map { slotIndex in
            let dealIndex = startIndex + slotIndex
            guard feedStore.deals.indices.contains(dealIndex) else {
                return .blank(slot: slotIndex)
            }
            return .fromDeal(feedStore.deals[dealIndex], slot: slotIndex)
        }
    }

    private func blankBoardSlots() -> [DepartureBoardSlot] {
        (0..<visibleCount).map { .blank(slot: $0) }
    }

    private var nearbyAirports: [String] {
        let nearby: [String: [String]] = [
            "JFK": ["EWR", "LGA", "PHL"],
            "EWR": ["JFK", "LGA", "PHL"],
            "LGA": ["JFK", "EWR", "PHL"],
            "LAX": ["SNA", "BUR", "LGB"],
            "SFO": ["OAK", "SJC"],
            "ORD": ["MDW"],
            "MDW": ["ORD"],
            "MIA": ["FLL", "PBI"],
            "FLL": ["MIA", "PBI"],
            "TPA": ["PIE", "SRQ", "MCO", "FLL"],
            "ATL": ["CLT"],
            "DFW": ["DAL", "IAH"],
            "SEA": ["PDX"],
            "BOS": ["PVD", "BDL"],
        ]
        return nearby[settingsStore.departureCode] ?? ["JFK", "LAX", "ORD"]
    }
}

// MARK: - Preview

#Preview("Departure Board") {
    DepartureBoardView()
        .environment(FeedStore())
        .environment(Router())
}
