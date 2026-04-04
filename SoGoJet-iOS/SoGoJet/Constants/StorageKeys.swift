import Foundation

// MARK: - Storage Keys
// Centralized UserDefaults and Keychain key constants.

enum StorageKeys {

    // MARK: Auth
    enum Auth {
        static let token = "sg_auth_token"
        static let userId = "sg_user_id"
        static let userName = "sg_user_name"
        static let userEmail = "sg_user_email"
    }

    // MARK: Settings
    enum Settings {
        static let departureCode = "sg_departure_code"
        static let departureCity = "sg_departure_city"
        static let preferredView = "sg_preferred_view"
        static let swipeMode = "sg_swipe_mode"
        static let notificationsEnabled = "sg_notifications_enabled"
        static let priceAlertsEnabled = "sg_price_alerts_enabled"
        static let alertEmail = "sg_alert_email"
        static let hasOnboarded = "sg_has_onboarded"
        static let usesMetric = "sg_uses_metric"
    }

    // MARK: Feed
    enum Feed {
        static let filterPrices = "sg_filter_prices"
        static let filterVibes = "sg_filter_vibes"
        static let filterRegions = "sg_filter_regions"
        static let filterMaxPrice = "sg_filter_max_price"
    }

    // MARK: Booking
    enum Booking {
        static let recentSearches = "SGRecentSearches"
        static let lastPassenger = "SGLastPassengerData"
    }

    // MARK: Saved
    enum Saved {
        static let deals = "sg_saved_deals"
        static let recentlyViewed = "sg_recently_viewed"
    }

    // MARK: Review
    enum Review {
        static let lastPromptDate = "sg_review_last_prompt_date"
        static let appOpenDays = "sg_review_app_open_days"
        static let lastRecordedDay = "sg_review_last_recorded_day"
    }
}
