import Foundation
import os

// MARK: - Analytics
// Lightweight event tracking with batched network delivery.
// Events are queued in memory and flushed periodically or when the batch reaches a threshold.
// Falls back to os.Logger in DEBUG builds for local visibility.

@MainActor
enum Analytics {
    private static let logger = Logger(subsystem: "com.sogojet.app", category: "analytics")

    /// Pending events waiting to be flushed to the backend.
    private static var eventQueue: [EventPayload] = []

    /// Maximum events to accumulate before auto-flushing.
    private static let batchSize = 20

    /// Timer that triggers periodic flushes (every 30 seconds).
    private static var flushTimer: Timer?

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
    /// Events are batched and sent to the diagnostics endpoint periodically.
    static func track(_ event: Event, properties: [String: String]? = nil) {
        #if DEBUG
        if let properties {
            let propsStr = properties.map { "\($0.key)=\($0.value)" }.joined(separator: ", ")
            logger.debug("[\(event.rawValue)] \(propsStr)")
        } else {
            logger.debug("[\(event.rawValue)]")
        }
        #endif

        let payload = EventPayload(
            event: event.rawValue,
            properties: properties,
            timestamp: ISO8601DateFormatter().string(from: Date())
        )
        eventQueue.append(payload)

        // Auto-flush when batch is full
        if eventQueue.count >= batchSize {
            flush()
        }

        // Start periodic flush timer if not running
        startFlushTimerIfNeeded()
    }

    /// Track a screen view.
    static func screen(_ name: String) {
        track(.feedViewed, properties: ["screen": name])
    }

    // MARK: - Flush

    /// Send all queued events to the backend and clear the queue.
    static func flush() {
        guard !eventQueue.isEmpty else { return }
        let events = eventQueue
        eventQueue.removeAll()

        Task {
            do {
                let batch = AnalyticsBatchBody(events: events)
                let body = try JSONEncoder().encode(batch)
                let _: EmptyResponse = try await APIClient.shared.fetch(.diagnosticsReport(body))
            } catch {
                // Re-queue events on failure so they aren't lost (cap to avoid unbounded growth)
                await MainActor.run {
                    let combined = events + eventQueue
                    eventQueue = Array(combined.suffix(batchSize * 3))
                }
                logger.warning("Analytics flush failed: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Timer

    private static func startFlushTimerIfNeeded() {
        guard flushTimer == nil else { return }
        flushTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in
            Task { @MainActor in
                Analytics.flush()
            }
        }
    }
}

// MARK: - Event Payload

private struct EventPayload: Codable, Sendable {
    let event: String
    let properties: [String: String]?
    let timestamp: String
}

/// Wrapper to make the diagnostics body Encodable.
private struct AnalyticsBatchBody: Encodable {
    let type = "analytics"
    let events: [EventPayload]
}
