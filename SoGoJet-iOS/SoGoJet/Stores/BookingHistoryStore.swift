import Foundation
import Observation

// MARK: - Booking History Store
// Fetches and caches the user's booking history from the API.

@MainActor
@Observable
final class BookingHistoryStore {
    var bookings: [BookingHistoryItem] = []
    var isLoading = false
    var error: String?

    /// Upcoming bookings (departure date in the future), sorted nearest-first.
    var upcomingBookings: [BookingHistoryItem] {
        bookings
            .filter(\.isUpcoming)
            .sorted { $0.departureDate < $1.departureDate }
    }

    /// Past bookings (departure date in the past), sorted most-recent-first.
    var pastBookings: [BookingHistoryItem] {
        bookings
            .filter { !$0.isUpcoming }
            .sorted { $0.departureDate > $1.departureDate }
    }

    var hasBookings: Bool { !bookings.isEmpty }

    /// Fetch booking history from the API.
    func fetchHistory() async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let response: BookingHistoryResponse = try await APIClient.shared.fetch(.bookingHistory)
            bookings = response.bookings
        } catch let apiError as APIError {
            // 401 means not authenticated — don't show error, just empty
            if case .httpError(let code, _) = apiError, code == 401 {
                bookings = []
                return
            }
            error = apiError.errorDescription
        } catch {
            self.error = "Failed to load bookings"
        }
    }
}
