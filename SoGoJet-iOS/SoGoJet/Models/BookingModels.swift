import Foundation

// MARK: - Trip Option
// A bookable flight offer returned by the booking search endpoint.

struct TripOption: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let airline: String
    let flightNumber: String
    let departureTime: String
    let arrivalTime: String
    let duration: String
    let stops: Int
    let price: Double
    let currency: String
    let cabinClass: String?
    let seatsRemaining: Int?
    let baggageIncluded: Bool?
    let offerJson: String?
    let expiresAt: String?
}

// MARK: - Passenger Data

struct PassengerData: Codable, Hashable, Sendable {
    var firstName: String = ""
    var lastName: String = ""
    var email: String = ""
    var phone: String = ""
    var dateOfBirth: String = ""
    var gender: Gender = .male
    var passportNumber: String = ""
    var passportExpiry: String = ""
    var nationality: String = "US"

    enum Gender: String, Codable, CaseIterable, Sendable {
        case male, female, other
    }

    var isValid: Bool {
        !firstName.isEmpty && !lastName.isEmpty && !email.isEmpty && !dateOfBirth.isEmpty
    }
}

// MARK: - Seat Map

struct SeatMap: Codable, Sendable {
    let segmentId: String
    let rows: [SeatRow]
}

struct SeatRow: Codable, Sendable {
    let rowNumber: Int
    let seats: [SeatInfo]
}

struct SeatInfo: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let label: String
    let available: Bool
    let type: SeatType
    let price: Double?
    let currency: String?

    enum SeatType: String, Codable, Sendable {
        case window, middle, aisle, extra = "extra_legroom"
    }
}

// MARK: - Booking Order

struct BookingOrder: Codable, Identifiable, Sendable {
    let id: String
    let bookingReference: String
    let status: String
    let totalAmount: Double
    let currency: String
    let airline: String
    let passengers: [PassengerData]
    let createdAt: String
}
