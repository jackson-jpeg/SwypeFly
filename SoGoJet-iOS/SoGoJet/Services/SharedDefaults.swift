import Foundation

// MARK: - Shared Defaults
// App Group UserDefaults shared between the main app and the WidgetKit extension.
// Both targets must add the "group.com.sogojet.shared" App Group capability.

enum SharedDefaults {
    static let suiteName = "group.com.sogojet.shared"

    static var suite: UserDefaults {
        UserDefaults(suiteName: suiteName) ?? .standard
    }

    // MARK: Keys

    private enum Key {
        static let departureCode = "widget_departure_code"
        static let departureCity = "widget_departure_city"
    }

    // MARK: Departure Airport

    static var departureCode: String {
        get { suite.string(forKey: Key.departureCode) ?? "TPA" }
        set { suite.set(newValue, forKey: Key.departureCode) }
    }

    static var departureCity: String {
        get { suite.string(forKey: Key.departureCity) ?? "Tampa" }
        set { suite.set(newValue, forKey: Key.departureCity) }
    }

    /// Write departure info from the main app so the widget can read it.
    /// Silently fails if the App Group isn't provisioned yet.
    static func syncDeparture(code: String, city: String) {
        guard UserDefaults(suiteName: suiteName) != nil else { return }
        departureCode = code
        departureCity = city
    }
}
