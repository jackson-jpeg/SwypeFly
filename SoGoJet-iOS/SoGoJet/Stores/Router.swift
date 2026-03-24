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

        var id: String {
            switch self {
            case .dealDetail(let deal): return "detail-\(deal.id)"
            case .search:               return "search"
            case .departurePicker:      return "departure"
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
        activeSheet = .dealDetail(deal)
    }

    /// Start booking flow full-screen.
    func startBooking(_ deal: Deal) {
        fullScreenDestination = .booking(deal)
    }

    /// Dismiss any presented sheet.
    func dismissSheet() {
        activeSheet = nil
    }

    /// Dismiss full-screen cover.
    func dismissFullScreen() {
        fullScreenDestination = nil
    }
}
