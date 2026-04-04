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
        didSet { UserDefaults.standard.set(departureCode, forKey: StorageKeys.Settings.departureCode) }
    }

    var departureCity: String {
        didSet { UserDefaults.standard.set(departureCity, forKey: StorageKeys.Settings.departureCity) }
    }

    /// "grid" or "list"
    var preferredView: String {
        didSet { UserDefaults.standard.set(preferredView, forKey: StorageKeys.Settings.preferredView) }
    }

    /// Whether the feed uses swipe-to-save card stack mode vs vertical scroll.
    var swipeMode: Bool {
        didSet { UserDefaults.standard.set(swipeMode, forKey: StorageKeys.Settings.swipeMode) }
    }

    var notificationsEnabled: Bool {
        didSet {
            UserDefaults.standard.set(notificationsEnabled, forKey: StorageKeys.Settings.notificationsEnabled)
            if notificationsEnabled {
                DealNotificationManager.requestAndSchedule(departureCode: departureCode)
            } else {
                DealNotificationManager.cancelDailyDeal()
            }
        }
    }

    var priceAlertsEnabled: Bool {
        didSet { UserDefaults.standard.set(priceAlertsEnabled, forKey: StorageKeys.Settings.priceAlertsEnabled) }
    }

    var alertEmail: String {
        didSet { UserDefaults.standard.set(alertEmail, forKey: StorageKeys.Settings.alertEmail) }
    }

    var hasOnboarded: Bool {
        didSet { UserDefaults.standard.set(hasOnboarded, forKey: StorageKeys.Settings.hasOnboarded) }
    }

    /// Whether to display measurements in metric (°C / km) or imperial (°F / mi).
    var usesMetric: Bool {
        didSet { UserDefaults.standard.set(usesMetric, forKey: StorageKeys.Settings.usesMetric) }
    }

    // MARK: Init — hydrate from UserDefaults

    init() {
        let ud = UserDefaults.standard
        self.departureCode = ud.string(forKey: StorageKeys.Settings.departureCode) ?? "TPA"
        self.departureCity = ud.string(forKey: StorageKeys.Settings.departureCity) ?? "Tampa"
        self.preferredView = ud.string(forKey: StorageKeys.Settings.preferredView) ?? "grid"
        self.swipeMode = ud.bool(forKey: StorageKeys.Settings.swipeMode)
        self.notificationsEnabled = ud.bool(forKey: StorageKeys.Settings.notificationsEnabled)
        self.priceAlertsEnabled = ud.bool(forKey: StorageKeys.Settings.priceAlertsEnabled)
        self.alertEmail = ud.string(forKey: StorageKeys.Settings.alertEmail) ?? ""
        self.hasOnboarded = ud.bool(forKey: StorageKeys.Settings.hasOnboarded)

        if ud.object(forKey: StorageKeys.Settings.usesMetric) != nil {
            self.usesMetric = ud.bool(forKey: StorageKeys.Settings.usesMetric)
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
