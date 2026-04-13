import SwiftUI
import Observation

// MARK: - Router
// Centralised navigation state for the app.

@MainActor
@Observable
final class Router {
    // MARK: Tab

    enum Tab: String, CaseIterable, Sendable {
        case feed
        case saved
        case settings

        var title: String {
            switch self {
            case .feed:     return "Explore"
            case .saved:    return "Saved"
            case .settings: return "Settings"
            }
        }

        var iconName: String {
            switch self {
            case .feed:     return "airplane"
            case .saved:    return "heart.fill"
            case .settings: return "gearshape.fill"
            }
        }
    }

    // MARK: Sheets

    enum Sheet: Identifiable, Sendable {
        case dealDetail(Deal)
        case search
        case departurePicker
        case filters

        var id: String {
            switch self {
            case .dealDetail(let deal): return "detail-\(deal.id)"
            case .search:               return "search"
            case .departurePicker:      return "departure"
            case .filters:              return "filters"
            }
        }
    }

    // MARK: Full Screen

    enum FullScreenDestination: Identifiable, Sendable {
        case booking(Deal)
        case onboarding

        var id: String {
            switch self {
            case .booking(let deal): return "booking-\(deal.id)"
            case .onboarding:        return "onboarding"
            }
        }
    }

    // MARK: State

    var activeTab: Tab = .feed
    /// Incremented when the user taps the already-active tab (scroll-to-top convention).
    var scrollToTopTrigger: Int = 0

    /// Call from the tab selection binding when the same tab is re-tapped.
    func tabSelected(_ tab: Tab) {
        if tab == activeTab {
            scrollToTopTrigger += 1
        }
        activeTab = tab
    }
    var feedPath = NavigationPath()
    var savedPath = NavigationPath()
    var settingsPath = NavigationPath()
    var activeSheet: Sheet?
    var fullScreenDestination: FullScreenDestination?
    @ObservationIgnored private var queuedSheet: Sheet?
    @ObservationIgnored private var queuedFullScreenDestination: FullScreenDestination?
    @ObservationIgnored private var queuedPresentationTask: Task<Void, Never>?
    @ObservationIgnored private var isDismissingSheet = false
    @ObservationIgnored private var isDismissingFullScreen = false

    // MARK: Convenience

    /// Get the NavigationPath for the currently active tab.
    var activePath: NavigationPath {
        get {
            switch activeTab {
            case .feed:     return feedPath
            case .saved:    return savedPath
            case .settings: return settingsPath
            }
        }
        set {
            switch activeTab {
            case .feed:     feedPath = newValue
            case .saved:    savedPath = newValue
            case .settings: settingsPath = newValue
            }
        }
    }

    /// Pop to root on the active tab.
    func popToRoot() {
        activePath = NavigationPath()
    }

    /// Show a deal detail sheet.
    func showDeal(_ deal: Deal) {
        presentSheet(.dealDetail(deal))
    }

    /// Show the search sheet.
    func showSearch() {
        presentSheet(.search)
    }

    /// Show the departure picker sheet.
    func showDeparturePicker() {
        presentSheet(.departurePicker)
    }

    /// Show the filter sheet.
    func showFilters() {
        presentSheet(.filters)
    }

    /// Start booking flow full-screen.
    func startBooking(_ deal: Deal) {
        presentFullScreen(.booking(deal))
    }

    /// Dismiss any presented sheet.
    func dismissSheet() {
        queuedPresentationTask?.cancel()
        queuedSheet = nil
        queuedFullScreenDestination = nil
        isDismissingSheet = activeSheet != nil || isDismissingSheet
        activeSheet = nil
    }

    /// Dismiss full-screen cover.
    func dismissFullScreen() {
        queuedPresentationTask?.cancel()
        queuedFullScreenDestination = nil
        isDismissingFullScreen = fullScreenDestination != nil || isDismissingFullScreen
        fullScreenDestination = nil
    }

    /// Continue a queued sheet transition after the current sheet finishes dismissing.
    func handleSheetDismissed() {
        let nextSheet = queuedSheet
        let nextFullScreen = queuedFullScreenDestination
        self.queuedSheet = nil
        self.queuedFullScreenDestination = nil
        isDismissingSheet = false
        queuedPresentationTask?.cancel()
        queuedPresentationTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            if let nextFullScreen {
                self?.fullScreenDestination = nextFullScreen
            } else if let nextSheet {
                self?.activeSheet = nextSheet
            }
        }
    }

    func handleFullScreenDismissed() {
        let nextFullScreen = queuedFullScreenDestination
        let nextSheet = queuedSheet
        self.queuedFullScreenDestination = nil
        self.queuedSheet = nil
        isDismissingFullScreen = false
        queuedPresentationTask?.cancel()
        queuedPresentationTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            if let nextFullScreen {
                self?.fullScreenDestination = nextFullScreen
            } else if let nextSheet {
                self?.activeSheet = nextSheet
            }
        }
    }

    private func presentSheet(_ sheet: Sheet) {
        queuedPresentationTask?.cancel()
        if activeSheet?.id == sheet.id || queuedSheet?.id == sheet.id {
            return
        }

        if activeSheet != nil || isDismissingSheet {
            queuedSheet = sheet
            queuedFullScreenDestination = nil
            if activeSheet != nil {
                isDismissingSheet = true
                activeSheet = nil
            }
        } else {
            queuedSheet = nil
            activeSheet = sheet
        }
    }

    // MARK: Deep Links

    /// Handle sogojet:// custom scheme URLs (from widgets, Siri, Spotlight, etc.).
    /// Supports:
    ///   sogojet://destination/{id} — open a deal detail
    ///   sogojet://search           — open the search sheet
    ///   sogojet://saved            — switch to the saved tab
    ///   sogojet://board            — switch to the departure board
    ///   sogojet://home             — go to the feed tab
    @MainActor func handleCustomSchemeURL(_ url: URL, feedStore: FeedStore) {
        guard url.scheme == "sogojet" else { return }
        let host = url.host() ?? url.host ?? ""
        let pathComponents = url.pathComponents.filter { $0 != "/" }

        switch host {
        case "destination":
            // sogojet://destination/{id}
            if let destinationId = pathComponents.first {
                activeTab = .feed
                if let deal = feedStore.allDeals.first(where: { $0.id == destinationId }) {
                    showDeal(deal)
                } else {
                    pendingDeepLinkId = destinationId
                }
            }
        case "search":
            handleQuickAction(ActivityTypes.search)
        case "saved":
            handleQuickAction(ActivityTypes.saved)
        case "board":
            handleQuickAction(ActivityTypes.board)
        case "cheapest":
            handleQuickAction(ActivityTypes.cheapest)
        case "home":
            activeTab = .feed
        default:
            SGLogger.router.warning("Unrecognized sogojet:// URL: \(url)")
        }
    }

    /// Handle an incoming deep link URL.
    /// Supports: https://sogojet.com/destination/{id}
    /// Returns the destination ID if parsed successfully, or nil.
    @MainActor @discardableResult
    func handleDeepLink(_ url: URL, feedStore: FeedStore) -> String? {
        // Accept both sogojet.com and www.sogojet.com
        guard let host = url.host(), host.hasSuffix("sogojet.com") else { return nil }

        let pathComponents = url.pathComponents.filter { $0 != "/" }
        // /destination/{id}
        guard pathComponents.count >= 2,
              pathComponents[0] == "destination" else { return nil }

        let destinationId = pathComponents[1]

        // Switch to feed tab and look up the deal
        activeTab = .feed

        if let deal = feedStore.allDeals.first(where: { $0.id == destinationId }) {
            showDeal(deal)
        } else {
            // Store the pending deep link ID so the app can resolve it after feed loads
            pendingDeepLinkId = destinationId
        }

        return destinationId
    }

    /// A destination ID from a deep link that hasn't been resolved yet
    /// (feed wasn't loaded when the link arrived).
    var pendingDeepLinkId: String?

    /// Try to resolve a pending deep link against the current feed.
    /// If the deal is not in the feed (e.g., different origin or paginated out),
    /// fetch it directly from the API.
    @MainActor func resolvePendingDeepLink(feedStore: FeedStore, savedStore: SavedStore? = nil) {
        guard let id = pendingDeepLinkId else { return }
        if let deal = feedStore.allDeals.first(where: { $0.id == id }) {
            pendingDeepLinkId = nil
            showDeal(deal)
            return
        }
        // Also check saved deals
        if let deal = savedStore?.savedDeals.first(where: { $0.id == id }) {
            pendingDeepLinkId = nil
            showDeal(deal)
            return
        }
        // If the feed is still loading, wait for it
        guard !feedStore.isLoading else { return }
        // Feed loaded but deal not found -- fetch it from the API
        pendingDeepLinkId = nil
        Task { @MainActor in
            await fetchAndShowDeal(id: id)
        }
    }

    /// Fetch a single destination by searching for it and show the detail sheet.
    @MainActor private func fetchAndShowDeal(id: String, origin: String = "JFK") async {
        do {
            let response: FeedResponse = try await APIClient.shared.fetch(
                .feed(origin: origin, page: 1, vibes: [], search: id)
            )
            if let deal = response.destinations.first(where: { $0.id == id }) {
                showDeal(deal)
            }
        } catch {
            SGLogger.router.error("Failed to fetch deal for deep link \(id): \(error)")
        }
    }

    // MARK: - Notification Handling

    /// Handle a deal ID from a notification tap (fare drop or deal of the day).
    /// Switches to the feed tab and shows the deal detail.
    @MainActor func handleNotificationDealId(_ dealId: String, feedStore: FeedStore, savedStore: SavedStore) {
        activeTab = .feed

        if let deal = savedStore.savedDeals.first(where: { $0.id == dealId }) {
            showDeal(deal)
        } else if let deal = feedStore.allDeals.first(where: { $0.id == dealId }) {
            showDeal(deal)
        } else {
            pendingDeepLinkId = dealId
            // If the feed is already loaded, try to resolve immediately
            if !feedStore.isLoading && !feedStore.allDeals.isEmpty {
                resolvePendingDeepLink(feedStore: feedStore, savedStore: savedStore)
            }
        }
    }

    // MARK: - Quick Actions (Home Screen Shortcuts)

    func handleQuickAction(_ type: String) {
        switch type {
        case ActivityTypes.search, ActivityTypes.searchFlights:
            activeTab = .feed
            showSearch()
        case ActivityTypes.saved:
            activeTab = .saved
        case ActivityTypes.board:
            activeTab = .feed
            // The board view is toggled via SettingsStore.preferredView
        case ActivityTypes.cheapest:
            // "Cheapest From Here" — switch to feed and signal cheapest-sort
            activeTab = .feed
            cheapestSortRequested = true
        default:
            break
        }
    }

    // MARK: - Cheapest Sort Signal
    // Set to true when the "Cheapest From Here" quick action fires.
    // FeedView observes this and applies the price-asc sort preset.
    var cheapestSortRequested: Bool = false

    private func presentFullScreen(_ destination: FullScreenDestination) {
        queuedPresentationTask?.cancel()
        if fullScreenDestination?.id == destination.id || queuedFullScreenDestination?.id == destination.id {
            return
        }

        if activeSheet != nil || isDismissingSheet {
            queuedFullScreenDestination = destination
            queuedSheet = nil
            if activeSheet != nil {
                isDismissingSheet = true
                activeSheet = nil
            }
        } else if fullScreenDestination != nil || isDismissingFullScreen {
            queuedFullScreenDestination = destination
            if fullScreenDestination != nil {
                isDismissingFullScreen = true
                fullScreenDestination = nil
            }
        } else {
            queuedFullScreenDestination = nil
            fullScreenDestination = destination
        }
    }
}
