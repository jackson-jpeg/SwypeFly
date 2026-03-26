import SwiftUI
import UIKit

// MARK: - Shake Detection

extension UIDevice {
    static let deviceDidShakeNotification = Notification.Name("deviceDidShakeNotification")
}

extension UIWindow {
    open override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        super.motionEnded(motion, with: event)
        if motion == .motionShake {
            NotificationCenter.default.post(name: UIDevice.deviceDidShakeNotification, object: nil)
        }
    }
}

// MARK: - Feed View
// Full-screen paging feed of flight deal cards with minimal header chrome.

struct FeedView: View {
    @Environment(FeedStore.self) private var feedStore
    @Environment(SavedStore.self) private var savedStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(Router.self) private var router
    @Environment(ToastManager.self) private var toastManager

    @State private var scrollToTop: Bool = false
    @State private var currentIndex: Int? = 0
    @State private var swipeCount: Int = 0
    @State private var headerVisible: Bool = true
    @State private var shareItem: SharedDealItem?
    @State private var headerHideTask: Task<Void, Never>?
    @State private var swipeModeIndex: Int = 0
    @State private var showMap: Bool = false

    private var currentDeal: Deal? {
        guard let currentIndex,
              currentIndex >= 0,
              currentIndex < feedStore.deals.count else {
            return feedStore.deals.first
        }

        return feedStore.deals[currentIndex]
    }

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            if feedStore.isLoading && feedStore.allDeals.isEmpty {
                loadingState
            } else if feedStore.isEmpty {
                emptyState
            } else if settingsStore.swipeMode {
                swipeFeedContent
            } else {
                feedContent
            }
        }
        .task {
            // Feed is preloaded at app launch (SoGoJetApp.task).
            // Only fetch here if not already loading/loaded (e.g., navigated back after a reset).
            if feedStore.allDeals.isEmpty && !feedStore.isLoading {
                await feedStore.fetchDeals(origin: settingsStore.departureCode)
            }
        }
        .onChange(of: settingsStore.departureCode) { _, newCode in
            currentIndex = 0
            swipeModeIndex = 0
            swipeCount = 0
            headerVisible = true
            headerHideTask?.cancel()
            Task {
                await feedStore.fetchDeals(origin: newCode)
            }
        }
        .onChange(of: feedStore.deals.map(\.id)) { _, deals in
            guard !deals.isEmpty else {
                currentIndex = 0
                return
            }

            if let index = currentIndex, index >= deals.count {
                currentIndex = 0
            }

            // Prefetch next images when feed first loads or reloads
            prefetchImages(around: currentIndex ?? 0)
        }
        .onChange(of: currentIndex) { oldValue, newValue in
            guard let newIdx = newValue, oldValue != newValue else { return }
            let oldIdx = oldValue ?? 0
            swipeCount += 1
            let deal = newIdx < feedStore.deals.count ? feedStore.deals[newIdx] : nil
            HapticEngine.forTier(deal?.dealTier)

            if swipeCount >= 2 && headerVisible {
                withAnimation(.easeOut(duration: 0.4)) {
                    headerVisible = false
                }
            }

            if oldIdx < feedStore.deals.count {
                let skippedDeal = feedStore.deals[oldIdx]
                if !savedStore.isSaved(id: skippedDeal.id) {
                    feedStore.recordSwipe(dealId: skippedDeal.id, action: "skipped")
                }
            }

            if newIdx >= feedStore.deals.count - 2 {
                Task {
                    await feedStore.fetchMore(origin: settingsStore.departureCode)
                }
            }

            if newIdx < feedStore.deals.count {
                let deal = feedStore.deals[newIdx]
                UIAccessibility.post(
                    notification: .announcement,
                    argument: "\(deal.destination), \(deal.priceFormatted)"
                )
            }

            // Prefetch images for the next 2 cards so swiping feels instant
            prefetchImages(around: newIdx)
        }
        .onChange(of: router.scrollToTopTrigger) { _, _ in
            guard router.activeTab == .feed else { return }
            withAnimation(.easeOut(duration: 0.3)) {
                currentIndex = 0
            }
            swipeModeIndex = 0
            swipeCount = 0
            if !headerVisible {
                withAnimation(.easeOut(duration: 0.3)) {
                    headerVisible = true
                }
            }
        }
        .sheet(item: $shareItem) { item in
            ShareSheet(activityItems: item.activityItems)
        }
        .fullScreenCover(isPresented: $showMap) {
            ExploreMapView(
                deals: feedStore.allDeals,
                onSelect: { deal in
                    showMap = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        router.showDeal(deal)
                    }
                }
            )
        }
        .onDisappear {
            headerHideTask?.cancel()
        }
        .onReceive(NotificationCenter.default.publisher(for: UIDevice.deviceDidShakeNotification)) { _ in
            guard router.activeTab == .feed else { return }
            shuffleFeed()
        }
        .overlay(alignment: .top) {
            if (headerVisible || settingsStore.swipeMode) && !feedStore.deals.isEmpty {
                headerOverlay
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .overlay(alignment: .bottom) {
            if !feedStore.allDeals.isEmpty {
                PriceFilterBar(feedStore: feedStore, toastManager: toastManager)
                    .padding(.bottom, 90) // above the tab bar
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }

    // MARK: - Swipe Feed Content (Card Stack)

    private var swipeFeedContent: some View {
        ZStack {
            SwipeableCardStack(
                deals: feedStore.deals,
                currentIndex: swipeModeIndex,
                isSaved: { savedStore.isSaved(id: $0) },
                onSave: { deal in swipeSaveDeal(deal) },
                onSkip: { deal in swipeSkipDeal(deal) },
                onTap: { deal in openDeal(deal) },
                onVibeFilter: { vibe in filterByVibe(vibe) },
                onAdvance: { advanceSwipeIndex() }
            )
            .ignoresSafeArea()

            // Bottom action buttons (undo, skip, save shortcuts)
            VStack {
                Spacer()
                swipeActionBar
            }
        }
        .onChange(of: feedStore.deals.map(\.id)) { _, _ in
            if swipeModeIndex >= feedStore.deals.count {
                swipeModeIndex = 0
            }
        }
    }

    private var swipeActionBar: some View {
        HStack(spacing: 24) {
            // Skip button
            Button {
                guard swipeModeIndex < feedStore.deals.count else { return }
                let deal = feedStore.deals[swipeModeIndex]
                swipeSkipDeal(deal)
                advanceSwipeIndex()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.sgRed)
                    .frame(width: 56, height: 56)
                    .background(Color.sgSurface)
                    .clipShape(Circle())
                    .overlay(
                        Circle().strokeBorder(Color.sgRed.opacity(0.3), lineWidth: 1.5)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Skip this deal")

            // Tap to view details
            Button {
                guard swipeModeIndex < feedStore.deals.count else { return }
                openDeal(feedStore.deals[swipeModeIndex])
            } label: {
                Image(systemName: "info.circle")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Color.sgYellow)
                    .frame(width: 48, height: 48)
                    .background(Color.sgSurface)
                    .clipShape(Circle())
                    .overlay(
                        Circle().strokeBorder(Color.sgYellow.opacity(0.3), lineWidth: 1.5)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("View deal details")

            // Save button
            Button {
                guard swipeModeIndex < feedStore.deals.count else { return }
                let deal = feedStore.deals[swipeModeIndex]
                swipeSaveDeal(deal)
                advanceSwipeIndex()
            } label: {
                Image(systemName: "heart.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.sgDealAmazing)
                    .frame(width: 56, height: 56)
                    .background(Color.sgSurface)
                    .clipShape(Circle())
                    .overlay(
                        Circle().strokeBorder(Color.sgDealAmazing.opacity(0.3), lineWidth: 1.5)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Save this deal")
        }
        .padding(.bottom, 36)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }

    private func swipeSaveDeal(_ deal: Deal) {
        let nowSaved = savedStore.toggle(deal: deal)
        feedStore.recordSwipe(dealId: deal.id, action: nowSaved ? "saved" : "unsaved")
        toastManager.show(
            message: nowSaved ? saveToastMessage(for: deal) : "\(deal.city) removed",
            type: nowSaved ? .success : .info,
            duration: 1.2
        )
    }

    private func swipeSkipDeal(_ deal: Deal) {
        feedStore.recordSwipe(dealId: deal.id, action: "skipped")
    }

    private func advanceSwipeIndex() {
        swipeModeIndex += 1

        // Prefetch images
        if swipeModeIndex < feedStore.deals.count {
            prefetchImages(around: swipeModeIndex)
        }

        // Fetch more when approaching end
        if swipeModeIndex >= feedStore.deals.count - 3 {
            Task {
                await feedStore.fetchMore(origin: settingsStore.departureCode)
            }
        }

        // Reset if we've gone past the end
        if swipeModeIndex >= feedStore.deals.count && !feedStore.hasMore {
            swipeModeIndex = 0
            toastManager.show(
                message: "You've seen all deals! Starting over.",
                type: .info,
                duration: 2.0
            )
        }
    }

    // MARK: - Feed Content

    private var feedContent: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(spacing: 0) {
                ForEach(Array(feedStore.deals.enumerated()), id: \.element.id) { index, deal in
                    DealCard(
                        deal: deal,
                        isSaved: savedStore.isSaved(id: deal.id),
                        isFirst: index == 0,
                        isTopPick: deal.id == feedStore.topPickDealId,
                        livePriceOverride: feedStore.livePriceOverrides[deal.id],
                        animate: abs((currentIndex ?? 0) - index) <= 1,
                        animationTrigger: currentIndex ?? 0,
                        onSave: { saveDeal(deal) },
                        onShare: { shareDeal(deal) },
                        onBook: { bookDeal(deal) },
                        onTap: { openDeal(deal) },
                        onVibeFilter: { vibe in filterByVibe(vibe) }
                    )
                    .containerRelativeFrame([.horizontal, .vertical])
                    .id(index)
                }

                // End-of-feed indicator
                if !feedStore.hasMore && !feedStore.deals.isEmpty {
                    endOfFeedView
                        .containerRelativeFrame([.horizontal, .vertical])
                        .id(feedStore.deals.count)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $currentIndex)
        .ignoresSafeArea()
        .refreshable {
            await feedStore.fetchDeals(origin: settingsStore.departureCode)
        }
        .accessibilityHint("Swipe up or down to browse flight deals")
    }

    // MARK: - Header Overlay

    private var headerOverlay: some View {
        VStack(spacing: 0) {
            Spacer().frame(height: 0)
            headerControls
                .padding(.horizontal, Spacing.md)
                .padding(.top, Spacing.sm)
                .padding(.bottom, Spacing.xs)

            if !feedStore.deals.isEmpty {
                statsRow
                    .padding(.horizontal, Spacing.md)
                    .padding(.bottom, Spacing.sm)
            }
        }
        .background(Color.sgBg.opacity(0.84))
        .background(.ultraThinMaterial)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge) // Cap scaling — header controls
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.sgBorder.opacity(0.45))
                .frame(height: 1)
        }
    }

    private var statsRow: some View {
        let deals = feedStore.deals
        let cheapest = deals.compactMap(\.displayPrice).filter { $0 > 0 }.min()
        let nonstopCount = deals.filter { $0.isNonstop == true }.count

        return HStack(spacing: Spacing.sm) {
            if let cheapest {
                statPill(label: "$\(Int(cheapest))", detail: "cheapest")
            }
            statPill(label: "\(deals.count)", detail: deals.count == 1 ? "deal" : "deals")
            if nonstopCount > 0 {
                statPill(label: "\(nonstopCount)", detail: "direct")
            }
        }
    }

    private func statPill(label: String, detail: String) -> some View {
        HStack(spacing: 3) {
            Text(label)
                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                .foregroundStyle(Color.sgWhite)
            Text(detail)
                .font(SGFont.body(size: 11))
                .foregroundStyle(Color.sgWhiteDim)
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, 3)
        .background(Color.sgWhite.opacity(0.06), in: Capsule())
    }

    private var headerControls: some View {
        HStack(spacing: Spacing.sm) {
            Button {
                HapticEngine.selection()
                router.showDeparturePicker()
            } label: {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "airplane.circle.fill")
                        .font(.system(size: 13, weight: .semibold))
                    Text(settingsStore.departureCode)
                        .font(SGFont.bodyBold(size: 13))
                    Text(settingsStore.departureCity)
                        .font(SGFont.body(size: 12))
                        .lineLimit(1)
                }
                .foregroundStyle(Color.sgYellow)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.sm)
                .background(Color.sgYellow.opacity(0.1), in: RoundedRectangle(cornerRadius: Radius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md)
                        .strokeBorder(Color.sgYellow.opacity(0.28), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Departure airport \(settingsStore.departureCode)")
            .accessibilityHint("Open airport picker")

            Spacer(minLength: 0)

            FeedHeaderButton(
                systemName: settingsStore.swipeMode ? "rectangle.stack" : "hand.draw",
                isActive: settingsStore.swipeMode,
                action: {
                    HapticEngine.medium()
                    settingsStore.swipeMode.toggle()
                    if settingsStore.swipeMode {
                        // Sync swipe index to current scroll position
                        swipeModeIndex = currentIndex ?? 0
                        toastManager.show(
                            message: "Swipe mode: Right to save, left to skip",
                            type: .info,
                            duration: 2.5
                        )
                    } else {
                        // Sync scroll position to swipe index
                        currentIndex = swipeModeIndex
                    }
                }
            )
            .accessibilityLabel(settingsStore.swipeMode ? "Switch to scroll mode" : "Switch to swipe mode")
            .accessibilityHint("Toggle between swipe-to-save cards and vertical scrolling")

            FeedHeaderButton(
                systemName: "map",
                action: {
                    HapticEngine.light()
                    showMap = true
                }
            )
            .accessibilityLabel("Explore on map")

            FeedHeaderButton(
                systemName: "magnifyingglass",
                action: {
                    HapticEngine.light()
                    router.showSearch()
                }
            )
            .accessibilityLabel("Search destinations")

            FeedHeaderButton(
                systemName: "slider.horizontal.3",
                badge: feedStore.activeFilterCount > 0 ? "\(feedStore.activeFilterCount)" : nil,
                isActive: feedStore.activeFilterCount > 0,
                action: {
                    HapticEngine.light()
                    router.showFilters()
                }
            )
            .accessibilityLabel(feedStore.activeFilterCount > 0 ? "Filters, \(feedStore.activeFilterCount) active" : "Open filters")
        }
    }

    // MARK: - Loading State

    private var loadingState: some View {
        VStack(spacing: Spacing.md) {
            Spacer()

            ProgressView()
                .progressViewStyle(.circular)
                .tint(Color.sgYellow)
                .scaleEffect(1.3)

            Text("Loading flights from \(settingsStore.departureCode)…")
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgWhiteDim)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                // Title
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text(feedStore.hasActiveFilters ? "No Matches" : "No Routes")
                        .font(SGFont.display(size: 28))
                        .foregroundStyle(Color.sgWhite)

                    Text(feedStore.hasActiveFilters
                        ? "Your filters ruled out all routes. Clear them or try a nearby airport."
                        : "No live routes from \(settingsStore.departureCode) right now. Try a nearby airport.")
                        .font(SGFont.body(size: 14))
                        .foregroundStyle(Color.sgWhiteDim)
                }

                // Error detail
                if let error = feedStore.error {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color.sgOrange)
                        Text(error)
                            .font(SGFont.body(size: 13))
                            .foregroundStyle(Color.sgWhiteDim)
                    }
                    .padding(Spacing.md)
                    .background(Color.sgOrange.opacity(0.1), in: RoundedRectangle(cornerRadius: Radius.md))
                }

                // Clear filters
                if feedStore.hasActiveFilters {
                    Button {
                        Task {
                            await feedStore.clearFilters(origin: settingsStore.departureCode)
                        }
                    } label: {
                        Label("Clear Filters", systemImage: "line.3.horizontal.decrease.circle")
                            .font(SGFont.bodyBold(size: 14))
                            .foregroundStyle(Color.sgYellow)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Spacing.md)
                            .background(Color.sgYellow.opacity(0.1), in: RoundedRectangle(cornerRadius: Radius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.md)
                                    .strokeBorder(Color.sgYellow.opacity(0.28), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }

                // Nearby airports
                if !feedStore.hasActiveFilters {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        Text("Nearby Airports")
                            .font(SGFont.bodyBold(size: 13))
                            .foregroundStyle(Color.sgWhiteDim)

                        HStack(spacing: Spacing.sm) {
                            ForEach(nearbyAirports, id: \.self) { code in
                                NearbyAirportButton(code: code) {
                                    Task {
                                        if let airport = AirportPicker.airports.first(where: { $0.code == code }) {
                                            settingsStore.setDeparture(code: code, city: airport.city)
                                        } else {
                                            settingsStore.departureCode = code
                                        }
                                        await feedStore.fetchDeals(origin: code)
                                    }
                                }
                            }
                        }
                    }
                }

                // Retry
                Button {
                    Task {
                        await feedStore.fetchDeals(origin: settingsStore.departureCode)
                    }
                } label: {
                    Label("Retry", systemImage: "arrow.clockwise")
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgWhite)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.md)
                        .background(Color.sgWhite.opacity(0.08), in: RoundedRectangle(cornerRadius: Radius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.md)
                                .strokeBorder(Color.sgWhiteDim.opacity(0.28), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.top, Spacing.xl)
            .padding(.bottom, Spacing.xl)
        }
    }

    // MARK: - End of Feed

    private var endOfFeedView: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()

            Image(systemName: "checkmark.circle")
                .font(.system(size: 48, weight: .light))
                .foregroundStyle(Color.sgYellow.opacity(0.7))

            VStack(spacing: Spacing.xs) {
                Text("You've seen all \(feedStore.deals.count) deals")
                    .font(SGFont.display(size: 22))
                    .foregroundStyle(Color.sgWhite)

                Text("from \(settingsStore.departureCode)")
                    .font(SGFont.body(size: 14))
                    .foregroundStyle(Color.sgWhiteDim)
            }

            Button {
                HapticEngine.medium()
                currentIndex = 0
                swipeCount = 0
                headerVisible = true
                headerHideTask?.cancel()
                Task {
                    await feedStore.fetchDeals(origin: settingsStore.departureCode)
                }
            } label: {
                Label("Refresh Deals", systemImage: "arrow.clockwise")
                    .font(SGFont.bodyBold(size: 15))
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, Spacing.xl)
                    .padding(.vertical, Spacing.md)
                    .background(Color.sgYellow, in: Capsule())
            }
            .buttonStyle(.plain)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.sgBg)
    }

    // MARK: - Actions

    private func shuffleFeed() {
        guard feedStore.deals.count > 1 else { return }
        let current = settingsStore.swipeMode ? swipeModeIndex : (currentIndex ?? 0)
        var randomIndex: Int
        repeat {
            randomIndex = Int.random(in: 0..<feedStore.deals.count)
        } while randomIndex == current && feedStore.deals.count > 1

        HapticEngine.medium()

        if settingsStore.swipeMode {
            swipeModeIndex = randomIndex
        } else {
            withAnimation(.easeInOut(duration: 0.35)) {
                currentIndex = randomIndex
            }
        }

        let deal = feedStore.deals[randomIndex]
        toastManager.show(
            message: "Shuffled to \(deal.city)",
            type: .info,
            duration: 1.5
        )
    }

    private func saveDeal(_ deal: Deal) {
        HapticEngine.forTier(deal.dealTier)
        let nowSaved = savedStore.toggle(deal: deal)
        feedStore.recordSwipe(dealId: deal.id, action: nowSaved ? "saved" : "unsaved")
        toastManager.show(
            message: nowSaved ? saveToastMessage(for: deal) : "\(deal.city) removed",
            type: nowSaved ? .success : .info,
            duration: 1.5
        )
    }

    /// Urgency-aware save toast: shows countdown when departure is imminent.
    private func saveToastMessage(for deal: Deal) -> String {
        guard let days = deal.daysUntilDeparture else {
            return "\(deal.city) saved!"
        }
        if days <= 3 {
            return "Saved! Departs in \(days) days -- book now"
        }
        if days <= 7 {
            return "Saved! Departs in \(days) days -- time to pack"
        }
        if days <= 14 {
            return "Saved! Departs in \(days) days"
        }
        return "\(deal.city) saved!"
    }

    private func shareDeal(_ deal: Deal) {
        HapticEngine.light()
        Task {
            let image = await ShareCardRenderer.render(deal: deal, size: .story)
            shareItem = SharedDealItem(deal: deal, cardImage: image)
        }
    }

    private func openDeal(_ deal: Deal) {
        HapticEngine.light()
        feedStore.recordSwipe(dealId: deal.id, action: "viewed")
        router.showDeal(deal)
    }

    private func bookDeal(_ deal: Deal) {
        HapticEngine.medium()
        feedStore.recordSwipe(dealId: deal.id, action: "viewed")
        router.startBooking(deal)
    }

    private func filterByVibe(_ vibe: String) {
        // Toggle the vibe filter and scroll back to top
        if feedStore.selectedVibes.contains(vibe) {
            feedStore.selectedVibes.removeAll { $0 == vibe }
        } else {
            feedStore.selectedVibes = [vibe] // Single vibe filter for quick discovery
        }
        currentIndex = 0
        swipeCount = 0

        toastManager.show(
            message: feedStore.selectedVibes.isEmpty ? "Showing all deals" : "Filtered: \(vibe.lowercased())",
            type: .info,
            duration: 1.5
        )

        // Reload with the vibe filter
        Task {
            await feedStore.fetchDeals(origin: settingsStore.departureCode)
        }
    }

    // MARK: - Prefetching

    /// Prefetch images for cards adjacent to the current index.
    /// This warms the memory cache so the next swipe shows the photo instantly.
    private func prefetchImages(around index: Int) {
        let deals = feedStore.deals
        for offset in 1...2 {
            let i = index + offset
            guard i < deals.count, let url = deals[i].imageUrl else { continue }
            Task {
                await ImageCache.shared.prefetch(url)
            }
        }
    }

    // MARK: - Helpers

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

// MARK: - Local Components

private struct FeedHeaderButton: View {
    let systemName: String
    var badge: String? = nil
    var isActive: Bool = false
    let action: () -> Void

    private var foreground: Color { isActive ? Color.sgYellow : Color.sgWhite }
    private var fill: Color { isActive ? Color.sgYellow.opacity(0.11) : Color.sgWhite.opacity(0.08) }
    private var border: Color { isActive ? Color.sgYellow.opacity(0.28) : Color.sgWhiteDim.opacity(0.28) }

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: systemName)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(foreground)
                    .frame(width: 40, height: 40)
                    .background(fill, in: RoundedRectangle(cornerRadius: Radius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md)
                            .strokeBorder(border, lineWidth: 1)
                    )

                if let badge {
                    Text(badge)
                        .font(SGFont.bodyBold(size: 10))
                        .foregroundStyle(Color.sgBg)
                        .frame(minWidth: 18, minHeight: 18)
                        .background(Color.sgYellow, in: Circle())
                        .offset(x: 5, y: -5)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

private struct NearbyAirportButton: View {
    let code: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(code)
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgYellow)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.sm)
                .background(
                    Capsule()
                        .strokeBorder(Color.sgYellow.opacity(0.35), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

private struct SharedDealItem: Identifiable {
    let id = UUID()
    let deal: Deal
    let cardImage: UIImage?

    var activityItems: [Any] {
        var items: [Any] = []
        if let image = cardImage {
            items.append(image)
        }
        items.append(deal.shareText)
        if let url = deal.shareURL {
            items.append(url)
        }
        return items
    }
}

// MARK: - Share Sheet (UIKit bridge)

private struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Price Filter Bar

private struct PriceFilterBar: View {
    var feedStore: FeedStore
    let toastManager: ToastManager

    private struct Tier: Identifiable {
        let id: String   // internal key
        let label: String // pill text
        let maxPrice: Int? // nil = show all
    }

    private let tiers: [Tier] = [
        Tier(id: "all",  label: "All",    maxPrice: nil),
        Tier(id: "200",  label: "$200",   maxPrice: 200),
        Tier(id: "500",  label: "$500",   maxPrice: 500),
        Tier(id: "1000", label: "$1K",    maxPrice: 1000),
    ]

    private func isActive(_ tier: Tier) -> Bool {
        feedStore.maxPriceFilter == tier.maxPrice
    }

    private func select(_ tier: Tier) {
        HapticEngine.light()
        withAnimation(.easeInOut(duration: 0.2)) {
            feedStore.maxPriceFilter = tier.maxPrice
        }

        let message: String
        if let max = tier.maxPrice {
            let formatted = max >= 1000 ? "$\(max / 1000),000" : "$\(max)"
            message = "Showing deals under \(formatted)"
        } else {
            message = "Showing all deals"
        }
        toastManager.show(message: message, type: .info, duration: 1.2)
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            ForEach(tiers) { tier in
                Button {
                    select(tier)
                } label: {
                    HStack(spacing: 4) {
                        if tier.maxPrice == nil {
                            Image(systemName: "line.3.horizontal.decrease")
                                .font(.system(size: 10, weight: .semibold))
                        }
                        Text(tier.label)
                            .font(SGFont.bodyBold(size: 12))
                    }
                    .foregroundStyle(isActive(tier) ? Color.sgBg : Color.sgWhiteDim)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.sm)
                    .background(
                        isActive(tier) ? Color.sgYellow : Color.sgSurface.opacity(0.9),
                        in: Capsule()
                    )
                    .overlay(
                        Capsule()
                            .strokeBorder(
                                isActive(tier) ? Color.sgYellow.opacity(0.5) : Color.sgBorder,
                                lineWidth: 1
                            )
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(
                    tier.maxPrice == nil
                        ? "Show all deals"
                        : "Filter to deals under \(tier.label)"
                )
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .background(
            Capsule()
                .fill(Color.sgBg.opacity(0.8))
                .background(.ultraThinMaterial, in: Capsule())
        )
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }
}

// MARK: - Preview

#Preview("Feed View") {
    FeedView()
        .environment(FeedStore())
        .environment(SavedStore())
        .environment(SettingsStore())
        .environment(Router())
}
