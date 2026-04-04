import Foundation
import os

// MARK: - Analytics
// Lightweight event tracking foundation. Currently logs to os.Logger for debugging.
// Swap the `track` implementation to wire up Amplitude, Mixpanel, or a custom backend.

@MainActor
enum Analytics {
    private static let logger = Logger(subsystem: "com.sogojet.app", category: "analytics")

    // MARK: - Events

    enum Event: String {
        // Feed
        case feedViewed = "feed_viewed"
        case feedFiltered = "feed_filtered"
        case feedShuffled = "feed_shuffled"

        // Swipe
        case swipeSaved = "swipe_saved"
        case swipeSkipped = "swipe_skipped"

        // Destination
        case destinationViewed = "destination_viewed"
        case destinationShared = "destination_shared"

        // Booking
        case bookingStarted = "booking_started"
        case bookingSearched = "booking_searched"
        case bookingOfferSelected = "booking_offer_selected"
        case bookingPaymentStarted = "booking_payment_started"
        case bookingCompleted = "booking_completed"
        case bookingFailed = "booking_failed"

        // Hotels
        case hotelSearched = "hotel_searched"
        case hotelQuoteViewed = "hotel_quote_viewed"
        case hotelBooked = "hotel_booked"

        // AI
        case tripPlanGenerated = "trip_plan_generated"
        case tripPlanShared = "trip_plan_shared"

        // Saved
        case dealSaved = "deal_saved"
        case dealUnsaved = "deal_unsaved"
        case savedCompared = "saved_compared"
        case savedExported = "saved_exported"

        // Alerts
        case alertCreated = "alert_created"
        case alertDeleted = "alert_deleted"

        // Auth
        case signInStarted = "sign_in_started"
        case signInCompleted = "sign_in_completed"
        case signedOut = "signed_out"

        // Settings
        case departureChanged = "departure_changed"
        case viewModeChanged = "view_mode_changed"

        // Search
        case searchPerformed = "search_performed"
    }

    // MARK: - Track

    /// Track an event with optional properties.
    /// Currently logs to os.Logger. Replace with your analytics SDK.
    static func track(_ event: Event, properties: [String: String]? = nil) {
        #if DEBUG
        if let properties {
            let propsStr = properties.map { "\($0.key)=\($0.value)" }.joined(separator: ", ")
            logger.debug("[\(event.rawValue)] \(propsStr)")
        } else {
            logger.debug("[\(event.rawValue)]")
        }
        #endif

        // TODO: Wire to analytics backend
        // Amplitude.instance().logEvent(event.rawValue, withEventProperties: properties)
        // Mixpanel.mainInstance().track(event: event.rawValue, properties: properties)
    }

    /// Track a screen view.
    static func screen(_ name: String) {
        track(.feedViewed, properties: ["screen": name])
    }
}
