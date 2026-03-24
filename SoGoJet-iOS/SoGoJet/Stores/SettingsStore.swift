import Foundation
import Observation
import SwiftUI

// MARK: - Settings Store
// Lightweight user preferences backed by @AppStorage (UserDefaults).

@Observable
final class SettingsStore {
    // Using a wrapper to bridge @AppStorage into @Observable.
    // Each property reads/writes UserDefaults directly.

    var departureCode: String {
        get { UserDefaults.standard.string(forKey: "sg_departure_code") ?? "JFK" }
        set { UserDefaults.standard.set(newValue, forKey: "sg_departure_code") }
    }

    var departureCity: String {
        get { UserDefaults.standard.string(forKey: "sg_departure_city") ?? "New York" }
        set { UserDefaults.standard.set(newValue, forKey: "sg_departure_city") }
    }

    /// "grid" or "list"
    var preferredView: String {
        get { UserDefaults.standard.string(forKey: "sg_preferred_view") ?? "grid" }
        set { UserDefaults.standard.set(newValue, forKey: "sg_preferred_view") }
    }

    var notificationsEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: "sg_notifications_enabled") }
        set { UserDefaults.standard.set(newValue, forKey: "sg_notifications_enabled") }
    }

    var priceAlertsEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: "sg_price_alerts_enabled") }
        set { UserDefaults.standard.set(newValue, forKey: "sg_price_alerts_enabled") }
    }

    var hasOnboarded: Bool {
        get { UserDefaults.standard.bool(forKey: "sg_has_onboarded") }
        set { UserDefaults.standard.set(newValue, forKey: "sg_has_onboarded") }
    }

    // MARK: Convenience

    /// Formatted departure label, e.g. "New York (JFK)".
    var departureLabel: String {
        "\(departureCity) (\(departureCode))"
    }

    /// Update departure in one call.
    func setDeparture(code: String, city: String) {
        departureCode = code
        departureCity = city
    }
}
