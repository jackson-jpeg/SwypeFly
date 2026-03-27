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
    @Environment(NetworkMonitor.self) private var network

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
        .safeAreaInset(edge: .top, spacing: 0) {
            if !network.isConnected {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "wifi.slash")
                        .font(.system(size: 12, weight: .semibold))
                    Text("You're offline. Showing cached deals.")
                        .font(SGFont.body(size: 12))
                }
                .foregroundStyle(Color.sgWhite)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.sm)
                .background(Color.sgOrange.opacity(0.85))
            }
        }
        .task {
            // Feed is preloaded at app launch (SoGoJetApp.task).
            // Only fetch here if not already loading/loaded (e.g., navigated back after a reset).
            if feedStore.allDeals.isEmpty && !feedStore.isLoading {
                await feedStore.fetchDeals(origin: settingsStore.departureCode)
            }

            // Donate Siri shortcut so "Search Flights" appears in suggestions
            SiriShortcuts.donateSearch(origin: settingsStore.departureCode)
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

            if swipeCount >= 5 && headerVisible {
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

            if newIdx >= feedStore.deals.count - 5 {
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
            } else if !headerVisible && !feedStore.deals.isEmpty {
                collapsedHeaderPill
                    .transition(.move(edge: .top).combined(with: .opacity))
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
                onBook: { deal in bookDeal(deal) },
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

            // Book button — jump straight to booking flow
            Button {
                guard swipeModeIndex < feedStore.deals.count else { return }
                bookDeal(feedStore.deals[swipeModeIndex])
            } label: {
                Image(systemName: "airplane.departure")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Color.sgWhite)
                    .frame(width: 48, height: 48)
                    .background(Color.sgSurface)
                    .clipShape(Circle())
                    .overlay(
                        Circle().strokeBorder(Color.sgWhite.opacity(0.3), lineWidth: 1.5)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Search flights for this deal")

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

        // Fetch more when approaching end (prefetch early so next batch is ready)
        if swipeModeIndex >= feedStore.deals.count - 5 {
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
            HapticEngine.light()
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

    private var collapsedHeaderPill: some View {
        Button {
            withAnimation(.easeOut(duration: 0.3)) {
                headerVisible = true
                swipeCount = 0
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .bold))
                Text("\(settingsStore.departureCode)")
                    .font(SGFont.bodyBold(size: 11))
                Text("·")
                    .font(.system(size: 9))
                    .foregroundStyle(Color.sgWhiteDim)
                Text("Filters")
                    .font(SGFont.body(size: 11))
                    .foregroundStyle(Color.sgWhiteDim)
            }
            .foregroundStyle(Color.sgYellow)
            .padding(.horizontal, 12)
            .padding(.vertical, 5)
            .background(Color.sgBg.opacity(0.8))
            .background(.ultraThinMaterial)
            .clipShape(Capsule())
            .overlay(
                Capsule().strokeBorder(Color.sgYellow.opacity(0.25), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .padding(.top, 4)
        .accessibilityLabel("Show header controls")
        .accessibilityHint("Tap to show departure airport and filter controls")
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
        FeedLoadingView(departureCode: settingsStore.departureCode)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                // Title — distinguish network errors from empty results
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    if feedStore.error != nil && feedStore.allDeals.isEmpty {
                        Text("Couldn't Load Deals")
                            .font(SGFont.display(size: 28))
                            .foregroundStyle(Color.sgWhite)

                        Text(feedStore.error ?? "Something went wrong. Please try again.")
                            .font(SGFont.body(size: 14))
                            .foregroundStyle(Color.sgWhiteDim)
                    } else {
                        Text(feedStore.hasActiveFilters ? "No Matches" : "No Routes")
                            .font(SGFont.display(size: 28))
                            .foregroundStyle(Color.sgWhite)

                        Text(feedStore.hasActiveFilters
                            ? "Your filters ruled out all routes. Clear them or try a nearby airport."
                            : "No live routes from \(settingsStore.departureCode) right now. Try a nearby airport.")
                            .font(SGFont.body(size: 14))
                            .foregroundStyle(Color.sgWhiteDim)
                    }
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

                // Nearby airports (only when no error — not helpful during network failures)
                if !feedStore.hasActiveFilters && feedStore.error == nil {
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

                // Try Again
                Button {
                    Task {
                        await feedStore.fetchDeals(origin: settingsStore.departureCode)
                    }
                } label: {
                    Label("Try Again", systemImage: "arrow.clockwise")
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


// MARK: - Feed Loading Animation

/// Full-screen departure board loading with a flying plane that swooshes across the
/// screen in randomized curved arcs, leaving a gold dashed trail behind it.
private struct FeedLoadingView: View {
    let departureCode: String

    // Split-flap / status state
    @State private var currentDestIndex = 0
    @State private var animateFlap = false
    @State private var showSubtext = false
    @State private var statusPhase = 0

    // Flying plane state
    @State private var planePos: CGPoint = .zero
    @State private var planeAngle: Double = 0
    @State private var trail: [CGPoint] = []
    @State private var containerSize: CGSize = .zero

    // Flight path parameters (regenerated each arc)
    @State private var flightStart: CGPoint = .zero
    @State private var flightEnd: CGPoint = .zero
    @State private var controlA: CGPoint = .zero
    @State private var controlB: CGPoint = .zero
    @State private var flightT: CGFloat = 0

    private let planeTimer = Timer.publish(every: 0.025, on: .main, in: .common).autoconnect()

    private let destinations = [
        ("BCN", "Barcelona"), ("NRT", "Tokyo"), ("CDG", "Paris"),
        ("FCO", "Rome"), ("LHR", "London"), ("DPS", "Bali"),
        ("JFK", "New York"), ("SIN", "Singapore"), ("GIG", "Rio"),
    ]

    private let statusLines = [
        "Connecting to airlines",
        "Scanning live inventory",
        "Comparing fares",
        "Ranking deals",
        "Almost ready",
    ]

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Trail canvas — drawn behind everything
                Canvas { context, size in
                    guard trail.count > 1 else { return }
                    let total = trail.count
                    // Draw fading trail segments so older parts are dimmer
                    for i in 1..<total {
                        let opacity = Double(i) / Double(total) * 0.5
                        var seg = Path()
                        seg.move(to: trail[i - 1])
                        seg.addLine(to: trail[i])
                        context.stroke(
                            seg,
                            with: .color(Color.sgYellow.opacity(opacity)),
                            style: StrokeStyle(lineWidth: 1.8, dash: [5, 4])
                        )
                    }
                }

                // Plane icon — follows the bezier path and rotates to face the flight direction
                Image(systemName: "airplane")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Color.sgYellow)
                    .shadow(color: Color.sgYellow.opacity(0.5), radius: 6)
                    .rotationEffect(.degrees(planeAngle))
                    .position(planePos)

                // Center content overlay (departure board + status)
                VStack(spacing: 0) {
                    Spacer()

                    // Departure board header
                    VStack(spacing: Spacing.xs) {
                        Text("DEPARTURES")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.sgYellow.opacity(0.6))
                            .tracking(4)

                        Rectangle()
                            .fill(Color.sgYellow.opacity(0.2))
                            .frame(width: 120, height: 1)
                    }

                    Spacer().frame(height: Spacing.lg)

                    // Origin code — big and bold
                    SplitFlapRow(
                        text: departureCode,
                        maxLength: 3,
                        size: .lg,
                        color: Color.sgYellow,
                        alignment: .center,
                        animate: animateFlap,
                        staggerMs: 50
                    )

                    Spacer().frame(height: Spacing.lg)

                    // Arrow between origin and destination
                    Image(systemName: "arrow.down")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.sgYellow.opacity(0.4))

                    Spacer().frame(height: Spacing.lg)

                    // Cycling destination
                    VStack(spacing: 4) {
                        SplitFlapRow(
                            text: destinations[currentDestIndex].0,
                            maxLength: 3,
                            size: .md,
                            color: Color.sgWhite,
                            alignment: .center,
                            animate: animateFlap,
                            staggerMs: 35,
                            animationID: currentDestIndex
                        )

                        if showSubtext {
                            Text(destinations[currentDestIndex].1)
                                .font(.system(size: 12, weight: .medium, design: .monospaced))
                                .foregroundStyle(Color.sgMuted)
                                .transition(.opacity)
                        }
                    }

                    Spacer().frame(height: Spacing.xl)

                    // Status line with progress
                    VStack(spacing: Spacing.sm) {
                        Rectangle()
                            .fill(
                                LinearGradient(
                                    colors: [Color.sgYellow.opacity(0), Color.sgYellow.opacity(0.4), Color.sgYellow.opacity(0)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(height: 1)
                            .padding(.horizontal, Spacing.xl)

                        Text(statusLines[min(statusPhase, statusLines.count - 1)].uppercased())
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.sgYellow.opacity(0.7))
                            .tracking(1.5)
                            .contentTransition(.numericText())
                            .animation(.easeInOut(duration: 0.3), value: statusPhase)

                        // Progress dots
                        HStack(spacing: 6) {
                            ForEach(0..<5, id: \.self) { i in
                                Circle()
                                    .fill(i <= statusPhase ? Color.sgYellow : Color.sgBorder)
                                    .frame(width: 6, height: 6)
                                    .animation(.easeInOut(duration: 0.3).delay(Double(i) * 0.1), value: statusPhase)
                            }
                        }
                    }

                    Spacer()
                }
            }
            .onAppear {
                containerSize = geo.size
                initializeFlight(in: geo.size)
                startAnimations()
            }
            .onChange(of: geo.size) { _, newSize in
                containerSize = newSize
            }
            .onReceive(planeTimer) { _ in
                advancePlane()
            }
        }
    }

    // MARK: - Plane Flight Logic

    /// Pick a random start edge, end edge, and two control points for a swooping cubic bezier arc.
    private func initializeFlight(in size: CGSize) {
        guard size.width > 0, size.height > 0 else { return }

        let margin: CGFloat = 40
        let w = size.width
        let h = size.height

        // Random edge: 0 = left, 1 = top, 2 = right, 3 = bottom
        let startEdge = Int.random(in: 0...3)
        var endEdge = Int.random(in: 0...3)
        if endEdge == startEdge { endEdge = (endEdge + 2) % 4 }

        flightStart = edgePoint(edge: startEdge, w: w, h: h, margin: margin)
        flightEnd = edgePoint(edge: endEdge, w: w, h: h, margin: margin)

        // Control points biased toward the center for nice wide arcs
        controlA = CGPoint(
            x: CGFloat.random(in: w * 0.15...w * 0.85),
            y: CGFloat.random(in: h * 0.15...h * 0.85)
        )
        controlB = CGPoint(
            x: CGFloat.random(in: w * 0.15...w * 0.85),
            y: CGFloat.random(in: h * 0.15...h * 0.85)
        )

        flightT = 0
        planePos = flightStart

        // Keep a tail of the old trail for continuity, then it fades naturally
        if trail.count > 30 {
            trail = Array(trail.suffix(30))
        }
    }

    private func edgePoint(edge: Int, w: CGFloat, h: CGFloat, margin: CGFloat) -> CGPoint {
        switch edge {
        case 0: return CGPoint(x: -margin, y: CGFloat.random(in: h * 0.1...h * 0.9))
        case 1: return CGPoint(x: CGFloat.random(in: w * 0.1...w * 0.9), y: -margin)
        case 2: return CGPoint(x: w + margin, y: CGFloat.random(in: h * 0.1...h * 0.9))
        default: return CGPoint(x: CGFloat.random(in: w * 0.1...w * 0.9), y: h + margin)
        }
    }

    /// Evaluate cubic bezier at parameter t.
    private func bezierPoint(t: CGFloat) -> CGPoint {
        let u = 1 - t
        let tt = t * t
        let uu = u * u
        let uuu = uu * u
        let ttt = tt * t

        let x = uuu * flightStart.x
            + 3 * uu * t * controlA.x
            + 3 * u * tt * controlB.x
            + ttt * flightEnd.x

        let y = uuu * flightStart.y
            + 3 * uu * t * controlA.y
            + 3 * u * tt * controlB.y
            + ttt * flightEnd.y

        return CGPoint(x: x, y: y)
    }

    /// Tangent angle at parameter t so the plane icon points in the direction of travel.
    private func bezierAngle(t: CGFloat) -> Double {
        let dt: CGFloat = 0.001
        let p1 = bezierPoint(t: max(0, t - dt))
        let p2 = bezierPoint(t: min(1, t + dt))
        let dx = p2.x - p1.x
        let dy = p2.y - p1.y
        return atan2(dy, dx) * 180 / .pi
    }

    /// Called every 25 ms to move the plane along its current arc and record the trail.
    private func advancePlane() {
        guard containerSize.width > 0 else { return }

        let speed: CGFloat = 0.004 // roughly 4 seconds per arc
        flightT += speed

        if flightT >= 1.0 {
            initializeFlight(in: containerSize)
            return
        }

        let newPos = bezierPoint(t: flightT)
        planePos = newPos
        planeAngle = bezierAngle(t: flightT)

        trail.append(newPos)
        if trail.count > 200 {
            trail.removeFirst(trail.count - 200)
        }
    }

    // MARK: - Split-Flap & Status Animations

    private func startAnimations() {
        withAnimation { animateFlap = true }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            withAnimation(.easeOut(duration: 0.3)) { showSubtext = true }
        }

        // Cycle destinations + advance status phase
        Task { @MainActor in
            var destIdx = 0
            var statusIdx = 0
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                guard !Task.isCancelled else { return }

                withAnimation(.easeOut(duration: 0.15)) { showSubtext = false }
                try? await Task.sleep(nanoseconds: 150_000_000)

                destIdx = (destIdx + 1) % destinations.count
                currentDestIndex = destIdx
                animateFlap = false
                try? await Task.sleep(nanoseconds: 80_000_000)
                animateFlap = true

                withAnimation(.easeOut(duration: 0.3)) { showSubtext = true }

                if statusIdx < statusLines.count - 1 {
                    statusIdx += 1
                    statusPhase = statusIdx
                }
            }
        }
    }
}

// MARK: - Preview

#Preview("Feed View") {
    FeedView()
        .environment(FeedStore())
        .environment(SavedStore())
        .environment(SettingsStore())
        .environment(Router())
        .environment(ToastManager())
        .environment(NetworkMonitor())
}
