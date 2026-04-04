import Foundation

// MARK: - Hotel Search

struct HotelSearchRequest: Codable, Sendable {
    let latitude: Double
    let longitude: Double
    let checkIn: String
    let checkOut: String
    let guests: Int?
}

struct HotelSearchResult: Codable, Sendable, Identifiable {
    var id: String { accommodationId }
    let accommodationId: String
    let name: String
    let rating: Int
    let reviewScore: Double?
    let reviewCount: Int?
    let photoUrl: String?
    let cheapestTotalAmount: Double
    let currency: String
    let boardType: String?
    let rooms: [HotelRoom]
}

struct HotelRoom: Codable, Sendable, Identifiable {
    var id: String { roomId }
    let roomId: String
    let name: String
    let pricePerNight: Double

    private enum CodingKeys: String, CodingKey {
        case roomId = "id"
        case name
        case pricePerNight
    }
}

// MARK: - Hotel Quote

struct HotelQuoteRequest: Codable, Sendable {
    let accommodationId: String
    let roomId: String
    let checkIn: String
    let checkOut: String
}

struct HotelQuote: Codable, Sendable {
    let quoteId: String
    let accommodationId: String
    let roomId: String
    let totalAmount: Double
    let currency: String
    let checkIn: String
    let checkOut: String
    let cancellationPolicy: String?
    let expiresAt: String?
    let hotelName: String?
    let roomName: String?
    let pricePerNight: Double?
    let nights: Int?
}

// MARK: - Hotel Booking

struct HotelBookRequest: Codable, Sendable {
    let quoteId: String
    let paymentIntentId: String
    let guestName: String
    let guestEmail: String
}

struct HotelBookingConfirmation: Codable, Sendable {
    let bookingId: String
    let confirmationReference: String
    let status: String
    let hotelName: String?
    let checkIn: String?
    let checkOut: String?
    let totalAmount: Double?
    let currency: String?
}
