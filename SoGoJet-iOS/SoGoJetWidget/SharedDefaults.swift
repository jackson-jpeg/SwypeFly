import Foundation

// MARK: - Shared Defaults (Widget Copy)
// Duplicated from SoGoJet/Services/SharedDefaults.swift.
// Both the main app and the widget extension read from the same App Group.
// Keep these two files in sync.

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
}
