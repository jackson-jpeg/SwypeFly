import SwiftUI

// MARK: - Saved View
// Clean grid of saved destinations with minimal chrome.

struct SavedView: View {
    @Environment(SavedStore.self) private var savedStore
    @Environment(Router.self) private var router
    @Environment(ToastManager.self) private var toastManager

    @State private var sortMode: SortMode = .recent
    @State private var showComparePicker = false
    @State private var showCompareView = false
    @State private var compareA: Deal?
    @State private var compareB: Deal?
    @State private var showExportSheet = false
    @State private var exportPDFData: Data?
    @State private var compareBannerPulse = false

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
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    headerSection
                        .padding(.top, Spacing.lg)
                        .id("saved-top")

                    if savedStore.savedDeals.isEmpty {
                        emptyState
                    } else {
                        // Savings banner (2+ deals with savings data)
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
        .background(Color.sgBg)
        .navigationTitle("")
        .navigationBarHidden(true)
        .onAppear {
            // Donate Siri shortcut so "Show my saved flights" appears in suggestions
            SiriShortcuts.donateSaved(count: savedStore.count)
        }
        .sheet(isPresented: $showComparePicker) {
            ComparePickerView(
                deals: sortedDeals,
                selectedA: $compareA,
                selectedB: $compareB,
                onCompare: {
                    // Small delay so picker sheet dismisses first
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
        .sheet(isPresented: $showExportSheet) {
            if let data = exportPDFData {
                ActivityViewRepresentable(activityItems: [PDFDataItem(data: data)])
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("SAVED TRIPS")
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgYellow)
                .tracking(1.5)
            Text("Saved Routes")
                .font(SGFont.display(size: 28))
                .foregroundStyle(Color.sgWhite)
            Text("Your saved destinations.")
                .font(SGFont.accent(size: 15))
                .foregroundStyle(Color.sgMuted)

            if !regionStamps.isEmpty {
                regionStampRow
                    .padding(.top, 6)
            }
        }
    }

    // MARK: - Region Stamps

    /// Unique regions derived from saved deals, capped at 5.
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

    /// Number of saved deals available for comparison.
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
            // Subtle pulse to draw attention, then stop
            withAnimation(
                .easeInOut(duration: 0.8)
                .repeatCount(3, autoreverses: true)
            ) {
                compareBannerPulse = true
            }
            // Reset after animation completes
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

            // Export button (1+ saved)
            if !savedStore.savedDeals.isEmpty {
                Button {
                    HapticEngine.selection()
                    exportTripPlan()
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
            ForEach(sortedDeals) { deal in
                SavedCard(
                    deal: deal,
                    onTap: { router.showDeal(deal) },
                    onBook: { bookDeal(deal) },
                    onRemove: { removeDeal(deal) }
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

                Text("No Saved Routes")
                    .font(SGFont.display(size: 22))
                    .foregroundStyle(Color.sgWhite)

                Text("Tap the heart on any deal to save it here.")
                    .font(SGFont.body(size: 14))
                    .foregroundStyle(Color.sgMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, Spacing.xl)

            VintageTerminalActionButton(
                title: "Explore Deals",
                subtitle: "Find routes worth saving",
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

    private func exportTripPlan() {
        let data = TripPlanPDFRenderer.render(deals: sortedDeals)
        exportPDFData = data
        showExportSheet = true
    }

    private func removeDeal(_ deal: Deal) {
        let store = savedStore

        // Optimistically remove from list
        withAnimation(.easeOut(duration: 0.25)) {
            store.remove(id: deal.id)
        }

        // Show undo toast (4s auto-dismiss; tap Undo to re-add)
        toastManager.show(
            message: "\(deal.city) removed",
            type: .info,
            duration: 4.0,
            actionLabel: "Undo"
        ) {
            withAnimation(.easeOut(duration: 0.25)) {
                store.add(deal: deal)
            }
            HapticEngine.success()
        }
    }
}

// MARK: - PDF Data Item
// Wraps raw Data as a named PDF file for UIActivityViewController.

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
// Bridges UIActivityViewController into SwiftUI via a sheet.

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
