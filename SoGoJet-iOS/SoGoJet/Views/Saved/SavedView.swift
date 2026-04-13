import SwiftUI

// MARK: - Saved View
// Clean grid of saved destinations.
// Phase 4: cascade entrance, swipe-to-delete + undo toast, PDF print overlay.

struct SavedView: View {
    @Environment(SavedStore.self) private var savedStore
    @Environment(Router.self) private var router
    @Environment(ToastManager.self) private var toastManager
    @Environment(BookingHistoryStore.self) private var historyStore
    @Environment(AuthStore.self) private var auth

    @State private var activeSegment: SavedSegment = .flights
    @State private var sortMode: SortMode = .recent

    private enum SavedSegment: String, CaseIterable {
        case flights = "Saved Flights"
        case trips = "My Trips"
    }
    @State private var showComparePicker = false
    @State private var showCompareView = false
    @State private var compareA: Deal?
    @State private var compareB: Deal?

    // PDF export / print overlay
    @State private var showPrintOverlay = false
    @State private var printOverlayPhase: PrintPhase = .hidden
    @State private var showShareSheet = false
    @State private var exportPDFData: Data?

    @State private var compareBannerPulse = false
    /// Flip to true on first appear to kick off card cascade.
    @State private var gridAppeared = false

    private enum PrintPhase {
        case hidden, pulling, settled, sharing
    }

    private enum SortMode: String, CaseIterable {
        case recent = "Latest"
        case priceUp = "Lowest Fare"
        case priceDown = "Highest Fare"
    }

    private let columns = [
        GridItem(.flexible(), spacing: Spacing.sm),
        GridItem(.flexible(), spacing: Spacing.sm),
    ]

    var body: some View {
        ZStack {
            ScrollViewReader { proxy in
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        headerSection
                            .padding(.top, Spacing.lg)
                            .id("saved-top")

                        segmentPicker

                        if activeSegment == .flights {
                            savedFlightsContent
                        } else {
                            MyTripsView()
                        }
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.bottom, Spacing.xl)
                }
                .onChange(of: router.scrollToTopTrigger) { _, _ in
                    guard router.activeTab == .saved else { return }
                    withAnimation(.easeOut(duration: 0.3)) {
                        proxy.scrollTo("saved-top", anchor: .top)
                    }
                }
            }
            .refreshable {
                savedStore.syncFromServer()
                HapticEngine.light()
                try? await Task.sleep(for: .seconds(1))
            }
            .background(Color.sgBg)
            .navigationTitle("")
            .navigationBarHidden(true)
            .onAppear {
                SiriShortcuts.donateSaved(count: savedStore.count)
                // Trigger grid cascade on first appear
                if !gridAppeared {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                        gridAppeared = true
                    }
                }
            }

            // PDF print overlay
            if showPrintOverlay {
                printOverlayView
                    .ignoresSafeArea()
                    .zIndex(100)
            }
        }
        .sheet(isPresented: $showComparePicker) {
            ComparePickerView(
                deals: sortedDeals,
                selectedA: $compareA,
                selectedB: $compareB,
                onCompare: {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                        showCompareView = true
                    }
                }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showCompareView) {
            if let a = compareA, let b = compareB {
                CompareView(dealA: a, dealB: b)
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
            }
        }
        .sheet(isPresented: $showShareSheet) {
            if let data = exportPDFData {
                ActivityViewRepresentable(activityItems: [PDFDataItem(data: data)])
            }
        }
    }

    // MARK: - Segment Picker

    private var segmentPicker: some View {
        HStack(spacing: 0) {
            ForEach(SavedSegment.allCases, id: \.self) { segment in
                Button {
                    withAnimation(SGSpring.snappy) {
                        HapticEngine.selection()
                        activeSegment = segment
                    }
                } label: {
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: segment == .flights ? "heart.fill" : "airplane.departure")
                            .font(.system(size: 12, weight: .semibold))
                        Text(segment.rawValue)
                            .font(SGFont.bodyBold(size: 13))
                        if segment == .trips && auth.isAuthenticated && historyStore.hasBookings {
                            Text("\(historyStore.bookings.count)")
                                .font(SGFont.bodyBold(size: 10))
                                .foregroundStyle(activeSegment == segment ? Color.sgBg : Color.sgYellow)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(
                                    activeSegment == segment ? Color.sgYellow.opacity(0.3) : Color.sgYellow.opacity(0.15),
                                    in: Capsule()
                                )
                        }
                    }
                    .foregroundStyle(activeSegment == segment ? Color.sgBg : Color.sgWhiteDim)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        activeSegment == segment ? Color.sgYellow : Color.clear,
                        in: RoundedRectangle(cornerRadius: Radius.md)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(segment.rawValue)
                .accessibilityAddTraits(activeSegment == segment ? .isSelected : [])
            }
        }
        .background(Color.sgBorder, in: RoundedRectangle(cornerRadius: Radius.md))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(String(localized: "saved.segment_picker"))
    }

    // MARK: - Saved Flights Content

    @ViewBuilder
    private var savedFlightsContent: some View {
        if savedStore.savedDeals.isEmpty {
            emptyState
        } else {
            if savedStore.savedDeals.count >= 2 {
                let totalSavings = savedStore.totalSavings
                let totalValue = savedStore.savedDeals.compactMap(\.displayPrice).reduce(0, +)
                let banner = SavingsBanner(
                    totalSavings: totalSavings,
                    totalValue: totalValue,
                    tripCount: savedStore.count
                )
                if banner.shouldShow {
                    banner
                }
            }

            summaryLine

            if comparableDealsCount >= 2 {
                compareBanner
            }

            sortBar
            cardGrid
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(activeSegment == .flights ? "SAVED TRIPS" : "BOOKING HISTORY")
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgYellow)
                .tracking(1.5)
            Text(activeSegment == .flights ? "Saved Routes" : "My Trips")
                .font(SGFont.display(size: 28))
                .foregroundStyle(Color.sgWhite)
            Text(activeSegment == .flights ? "Your saved destinations." : "Your booked flights.")
                .font(SGFont.accent(size: 15))
                .foregroundStyle(Color.sgMuted)

            if activeSegment == .flights && !regionStamps.isEmpty {
                regionStampRow
                    .padding(.top, 6)
            }
        }
    }

    // MARK: - Region Stamps

    private var regionStamps: [String] {
        var seen = Set<String>()
        var result: [String] = []
        for deal in savedStore.savedDeals {
            let region = RegionMapper.region(for: deal.country)
            if seen.insert(region).inserted {
                result.append(region)
                if result.count >= 5 { break }
            }
        }
        return result
    }

    private var regionStampRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(regionStamps, id: \.self) { region in
                    Text(region.uppercased())
                        .font(SGFont.bodyBold(size: 10))
                        .foregroundStyle(Color.sgMuted)
                        .tracking(0.8)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .overlay(
                            Capsule()
                                .stroke(Color.sgFaint, lineWidth: 1)
                        )
                }
            }
        }
    }

    // MARK: - Summary Line

    private var summaryLine: some View {
        let count = savedStore.count
        let totalValue = savedStore.savedDeals.compactMap(\.displayPrice).reduce(0, +)
        let text: String = if totalValue > 0 {
            "\(count) saved \(count == 1 ? "route" : "routes") \u{00B7} $\(Int(totalValue)) total value"
        } else {
            "\(count) saved \(count == 1 ? "route" : "routes")"
        }

        return Text(text)
            .font(SGFont.body(size: 13))
            .foregroundStyle(Color.sgMuted)
            .padding(.horizontal, Spacing.xs)
    }

    // MARK: - Comparable Deals

    private var comparableDealsCount: Int {
        savedStore.savedDeals.count
    }

    // MARK: - Compare Banner

    private var compareBanner: some View {
        Button {
            HapticEngine.selection()
            compareA = nil
            compareB = nil
            showComparePicker = true
        } label: {
            HStack(spacing: Spacing.sm) {
                Image(systemName: "arrow.left.arrow.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.sgBg)
                    .frame(width: 28, height: 28)
                    .background(Color.sgYellow)
                    .clipShape(Circle())
                    .scaleEffect(compareBannerPulse ? 1.12 : 1.0)

                VStack(alignment: .leading, spacing: 1) {
                    Text("Compare Destinations")
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgWhite)
                    Text("See \(savedStore.count) routes side by side")
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                }

                Spacer()

                Text("\(savedStore.count)")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgBg)
                    .frame(width: 24, height: 24)
                    .background(Color.sgYellow)
                    .clipShape(Circle())

                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.sgMuted)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm + 2)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(Color.sgYellow.opacity(0.3), lineWidth: 1)
            )
        }
        .accessibilityLabel("Compare \(savedStore.count) saved destinations side by side")
        .onAppear {
            withAnimation(
                .easeInOut(duration: 0.8)
                .repeatCount(3, autoreverses: true)
            ) {
                compareBannerPulse = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 4.8) {
                compareBannerPulse = false
            }
        }
    }

    // MARK: - Sort Bar

    private var sortBar: some View {
        HStack(spacing: Spacing.sm) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.sm) {
                    ForEach(SortMode.allCases, id: \.self) { mode in
                        VintageTerminalSelectablePill(
                            title: mode.rawValue,
                            isSelected: sortMode == mode,
                            tone: .amber
                        ) {
                            sortMode = mode
                        }
                    }
                }
            }

            if !savedStore.savedDeals.isEmpty {
                Button {
                    HapticEngine.boardingPass()
                    triggerPrintAnimation()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 10, weight: .semibold))
                        Text("Export")
                            .font(SGFont.bodyBold(size: 12))
                    }
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, Spacing.sm + Spacing.xs)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.sgYellow.opacity(0.85))
                    .clipShape(Capsule())
                }
                .accessibilityLabel("Export trip plan")
            }

            if savedStore.savedDeals.count >= 2 {
                Button {
                    HapticEngine.selection()
                    compareA = nil
                    compareB = nil
                    showComparePicker = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.left.arrow.right")
                            .font(.system(size: 10, weight: .semibold))
                        Text("Compare")
                            .font(SGFont.bodyBold(size: 12))
                    }
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, Spacing.sm + Spacing.xs)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.sgYellow)
                    .clipShape(Capsule())
                }
                .accessibilityLabel("Compare saved destinations")
            }
        }
    }

    // MARK: - Card Grid

    private var cardGrid: some View {
        LazyVGrid(columns: columns, spacing: Spacing.sm) {
            ForEach(Array(sortedDeals.enumerated()), id: \.element.id) { index, deal in
                SavedCard(
                    deal: deal,
                    onTap: { router.showDeal(deal) },
                    onBook: { bookDeal(deal) },
                    onRemove: { removeDeal(deal) },
                    cardIndex: index,
                    appeared: gridAppeared
                )
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: Spacing.lg) {
            VStack(spacing: Spacing.sm) {
                Image(systemName: "heart")
                    .font(.system(size: 40, weight: .thin))
                    .foregroundStyle(Color.sgMuted)

                Text(String(localized: "saved.empty.title_routes"))
                    .font(SGFont.display(size: 22))
                    .foregroundStyle(Color.sgWhite)

                Text(String(localized: "saved.empty.hint"))
                    .font(SGFont.body(size: 14))
                    .foregroundStyle(Color.sgMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, Spacing.xl)

            VintageTerminalActionButton(
                title: String(localized: "saved.empty.explore"),
                subtitle: String(localized: "saved.empty.explore_subtitle"),
                icon: "airplane",
                tone: .amber,
                fillsWidth: true
            ) {
                router.activeTab = .feed
            }
        }
        .padding(.horizontal, Spacing.md)
    }

    // MARK: - Sorting

    private var sortedDeals: [Deal] {
        switch sortMode {
        case .recent:
            return savedStore.savedDeals
        case .priceUp:
            return savedStore.savedDeals.sorted { ($0.displayPrice ?? .infinity) < ($1.displayPrice ?? .infinity) }
        case .priceDown:
            return savedStore.savedDeals.sorted { ($0.displayPrice ?? 0) > ($1.displayPrice ?? 0) }
        }
    }

    // MARK: - Actions

    private func bookDeal(_ deal: Deal) {
        HapticEngine.medium()
        router.startBooking(deal)
    }

    private func removeDeal(_ deal: Deal) {
        HapticEngine.warning()
        let store = savedStore

        withAnimation(SGSpring.snappy) {
            store.remove(id: deal.id)
        }

        toastManager.show(
            message: "\(deal.city) removed",
            type: .info,
            duration: 4.0,
            actionLabel: "Undo"
        ) {
            withAnimation(SGSpring.bouncy) {
                store.add(deal: deal)
            }
            HapticEngine.success()
        }
    }

    // MARK: - PDF Print Animation

    private func triggerPrintAnimation() {
        let data = TripPlanPDFRenderer.render(deals: sortedDeals)
        exportPDFData = data
        showPrintOverlay = true

        // Phase 1: ticket pulls down (0 → base duration)
        withAnimation(
            UIAccessibility.isReduceMotionEnabled
                ? .easeOut(duration: SGDuration.fast)
                : .timingCurve(0.32, 0.04, 0.15, 0.98, duration: SGDuration.slow)
        ) {
            printOverlayPhase = .pulling
        }

        // Phase 2: settle + shimmer
        DispatchQueue.main.asyncAfter(deadline: .now() + SGDuration.slow) {
            withAnimation(SGSpring.mechanical) {
                printOverlayPhase = .settled
            }
        }

        // Phase 3: transition to share sheet after epic duration
        DispatchQueue.main.asyncAfter(deadline: .now() + SGDuration.epic) {
            showPrintOverlay = false
            printOverlayPhase = .hidden
            showShareSheet = true
        }
    }

    // MARK: - Print Overlay

    @ViewBuilder
    private var printOverlayView: some View {
        ZStack {
            Color.sgInk.opacity(0.92)
                .transition(.opacity)

            VStack(spacing: 0) {
                if printOverlayPhase != .hidden {
                    BoardingPassTicket(
                        deals: sortedDeals,
                        phase: printOverlayPhase
                    )
                    .transition(
                        .asymmetric(
                            insertion: .move(edge: .top).combined(with: .scale(scale: 0.92, anchor: .top)),
                            removal: .opacity
                        )
                    )
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .padding(.top, 60)
        }
        .animation(
            UIAccessibility.isReduceMotionEnabled
                ? .easeOut(duration: SGDuration.fast)
                : .timingCurve(0.32, 0.04, 0.15, 0.98, duration: SGDuration.slow),
            value: printOverlayPhase
        )
    }
}

// MARK: - Boarding Pass Ticket (print animation)

private struct BoardingPassTicket: View {
    let deals: [Deal]
    let phase: SavedView.PrintPhase

    private var isSettled: Bool { phase == .settled }

    var body: some View {
        VStack(spacing: 0) {
            // Perforated top edge
            perforationEdge

            // Ticket body
            VStack(alignment: .leading, spacing: Spacing.md) {
                // Header
                HStack {
                    Text("SOGOJET")
                        .sgFont(.micro)
                        .foregroundStyle(Color.sgYellow)
                        .tracking(3)
                    Spacer()
                    Text("TRIP PLAN")
                        .sgFont(.micro)
                        .foregroundStyle(Color.sgMuted)
                        .tracking(2)
                }

                Divider().overlay(Color.sgHairline)

                Text("PREPARING YOUR ITINERARY")
                    .sgFont(.ticker)
                    .foregroundStyle(Color.sgWhite)

                Text("\(deals.count) destinations")
                    .sgFont(.body)
                    .foregroundStyle(Color.sgMuted)

                // Runway shimmer bar
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.sgSurfaceHigh)
                    .frame(height: 6)
                    .runwayShimmer(active: isSettled)
            }
            .padding(Spacing.lg)
            .background(Color.sgSurfaceHigh)

            // Perforated bottom edge (inverted)
            perforationEdge
                .rotation3DEffect(.degrees(180), axis: (1, 0, 0))
        }
        .padding(.horizontal, Spacing.lg)
        .shadow(color: Color.sgYellow.opacity(isSettled ? 0.15 : 0), radius: 24, y: 8)
        .animation(SGSpring.mechanical, value: isSettled)
    }

    private var perforationEdge: some View {
        GeometryReader { geo in
            HStack(spacing: 0) {
                ForEach(0..<Int(geo.size.width / 12), id: \.self) { _ in
                    Circle()
                        .fill(Color.sgInk)
                        .frame(width: 10, height: 10)
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .frame(height: 10)
        .background(Color.sgSurfaceHigh)
    }
}

// MARK: - PDF Data Item

private final class PDFDataItem: NSObject, UIActivityItemSource {
    let data: Data

    init(data: Data) {
        self.data = data
        super.init()
    }

    func activityViewControllerPlaceholderItem(_ activityViewController: UIActivityViewController) -> Any {
        data
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        itemForActivityType activityType: UIActivity.ActivityType?
    ) -> Any? {
        data
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        dataTypeIdentifierForActivityType activityType: UIActivity.ActivityType?
    ) -> String {
        "com.adobe.pdf"
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        subjectForActivityType activityType: UIActivity.ActivityType?
    ) -> String {
        "SoGoJet Trip Plan"
    }
}

// MARK: - Activity View Representable

private struct ActivityViewRepresentable: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Preview

#Preview("Saved View") {
    NavigationStack {
        SavedView()
    }
    .environment(SavedStore())
    .environment(Router())
    .environment(ToastManager())
}
