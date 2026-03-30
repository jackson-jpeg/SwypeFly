import Foundation
import Observation
import SwiftUI
import WidgetKit

// MARK: - Settings Store
// Lightweight user preferences backed by UserDefaults.
// Uses stored properties (required for @Observable tracking) with didSet persistence.

@MainActor
@Observable
final class SettingsStore {

    var departureCode: String {
        didSet { UserDefaults.standard.set(departureCode, forKey: "sg_departure_code") }
    }

    var departureCity: String {
        didSet { UserDefaults.standard.set(departureCity, forKey: "sg_departure_city") }
    }

    /// "grid" or "list"
    var preferredView: String {
        didSet { UserDefaults.standard.set(preferredView, forKey: "sg_preferred_view") }
    }

    /// Whether the feed uses swipe-to-save card stack mode vs vertical scroll.
    var swipeMode: Bool {
        didSet { UserDefaults.standard.set(swipeMode, forKey: "sg_swipe_mode") }
    }

    var notificationsEnabled: Bool {
        didSet {
            UserDefaults.standard.set(notificationsEnabled, forKey: "sg_notifications_enabled")
            if notificationsEnabled {
                DealNotificationManager.requestAndSchedule(departureCode: departureCode)
            } else {
                DealNotificationManager.cancelDailyDeal()
            }
        }
    }

    var priceAlertsEnabled: Bool {
        didSet { UserDefaults.standard.set(priceAlertsEnabled, forKey: "sg_price_alerts_enabled") }
    }

    var alertEmail: String {
        didSet { UserDefaults.standard.set(alertEmail, forKey: "sg_alert_email") }
    }

    var hasOnboarded: Bool {
        didSet { UserDefaults.standard.set(hasOnboarded, forKey: "sg_has_onboarded") }
    }

    /// Whether to display measurements in metric (°C / km) or imperial (°F / mi).
    var usesMetric: Bool {
        didSet { UserDefaults.standard.set(usesMetric, forKey: "sg_uses_metric") }
    }

    // MARK: Init — hydrate from UserDefaults

    init() {
        let ud = UserDefaults.standard
        self.departureCode = ud.string(forKey: "sg_departure_code") ?? "TPA"
        self.departureCity = ud.string(forKey: "sg_departure_city") ?? "Tampa"
        self.preferredView = ud.string(forKey: "sg_preferred_view") ?? "grid"
        self.swipeMode = ud.bool(forKey: "sg_swipe_mode")
        self.notificationsEnabled = ud.bool(forKey: "sg_notifications_enabled")
        self.priceAlertsEnabled = ud.bool(forKey: "sg_price_alerts_enabled")
        self.alertEmail = ud.string(forKey: "sg_alert_email") ?? ""
        self.hasOnboarded = ud.bool(forKey: "sg_has_onboarded")

        if ud.object(forKey: "sg_uses_metric") != nil {
            self.usesMetric = ud.bool(forKey: "sg_uses_metric")
        } else {
            self.usesMetric = Locale.current.measurementSystem == .metric
        }
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
