import SwiftUI
import Observation

// MARK: - Router
// Centralised navigation state for the app.

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
            try? await Task.sleep(for: .milliseconds(220))
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
            try? await Task.sleep(for: .milliseconds(220))
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
