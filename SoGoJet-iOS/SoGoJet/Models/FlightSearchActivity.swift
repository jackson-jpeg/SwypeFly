import ActivityKit
import Foundation

/// Defines the data for the flight search Live Activity.
/// Shared between the main app (starts/updates) and widget extension (renders).
struct FlightSearchAttributes: ActivityAttributes {
    /// Static data that doesn't change during the activity.
    let origin: String
    let destination: String
    let destinationCity: String
    let departureDate: String

    /// Dynamic data that updates as the search progresses.
    struct ContentState: Codable, Hashable {
        enum SearchStatus: String, Codable, Hashable {
            case searching
            case found
            case noResults
            case booked
        }

        let status: SearchStatus
        let bestPrice: Int?          // Cheapest fare found so far
        let offerCount: Int          // Number of offers found
        let airline: String?         // Airline for the best fare
        let message: String          // Human-readable status text
    }
}
