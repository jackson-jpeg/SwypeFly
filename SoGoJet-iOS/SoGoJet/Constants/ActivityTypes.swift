import Foundation

// MARK: - Activity Types
// Centralized NSUserActivity type identifiers for Siri Shortcuts, Spotlight, and Quick Actions.

enum ActivityTypes {
    // MARK: Quick Actions (Home Screen)
    static let search = "com.sogojet.search"
    static let saved = "com.sogojet.saved"
    static let board = "com.sogojet.board"

    // MARK: Siri Shortcuts
    static let searchFlights = "com.sogojet.search-flights"
    static let viewDeal = "com.sogojet.view-deal"
    static let viewSaved = "com.sogojet.saved"
}
