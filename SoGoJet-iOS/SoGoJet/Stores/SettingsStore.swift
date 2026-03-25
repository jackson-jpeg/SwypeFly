import Foundation
import Observation
import SwiftUI
import WidgetKit

// MARK: - Settings Store
// Lightweight user preferences backed by @AppStorage (UserDefaults).

@MainActor
@Observable
final class SettingsStore {
    // Using a wrapper to bridge @AppStorage into @Observable.
    // Each property reads/writes UserDefaults directly.

    var departureCode: String {
        get { UserDefaults.standard.string(forKey: "sg_departure_code") ?? "TPA" }
        set { UserDefaults.standard.set(newValue, forKey: "sg_departure_code") }
    }

    var departureCity: String {
        get { UserDefaults.standard.string(forKey: "sg_departure_city") ?? "Tampa" }
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

    var alertEmail: String {
        get { UserDefaults.standard.string(forKey: "sg_alert_email") ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: "sg_alert_email") }
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
    /// Also syncs to the shared App Group so the widget can read it,
    /// and tells WidgetKit to refresh the departure board widget.
    func setDeparture(code: String, city: String) {
        departureCode = code
        departureCity = city

        // Sync to App Group for the widget extension
        SharedDefaults.syncDeparture(code: code, city: city)
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// One-time sync of current departure to shared defaults.
    /// Called on app launch to ensure the widget has up-to-date data.
    func syncToWidget() {
        SharedDefaults.syncDeparture(code: departureCode, city: departureCity)
    }
}
