import Foundation
import SwiftUI

// MARK: - Deal
// Matches the actual JSON returned by GET /api/feed?origin=TPA
// Many fields are optional since not all destinations have price calendar data.

struct Deal: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let iataCode: String
    let city: String
    let country: String
    let tagline: String
    let description: String
    let imageUrl: String?
    let imageUrls: [String]?
    let flightPrice: Double?
    let hotelPricePerNight: Double?
    let currency: String?
    let vibeTags: [String]?
    let bestMonths: [String]?
    let averageTemp: Double?
    let flightDuration: String?
    let livePrice: Double?
    let priceSource: String?
    let priceFetchedAt: String?
    let liveHotelPrice: Double?
    let hotelPriceSource: String?
    let availableFlightDays: [String]?
    let latitude: Double?
    let longitude: Double?
    let itinerary: [ItineraryDay]?
    let restaurants: [Restaurant]?
    let departureDate: String?
    let returnDate: String?
    let tripDurationDays: Int?
    let airline: String?
    let priceDirection: String?
    let previousPrice: Double?
    let priceDropPercent: Double?
    let offerJson: String?
    let offerExpiresAt: String?
    let airlineLogoUrl: String?
    let cheapestDate: String?
    let cheapestReturnDate: String?
    let affiliateUrl: String?
    let priceHistory: [Double]?

    // Deal quality (from price_calendar enrichment)
    let dealScore: Double?
    let dealTier: DealTier?
    let qualityScore: Double?
    let pricePercentile: Double?
    let isNonstop: Bool?
    let totalStops: Int?
    let maxLayoverMinutes: Int?
    let usualPrice: Double?
    let savingsAmount: Double?
    let savingsPercent: Double?

    // Nearby airport fallback
    let nearbyOrigin: String?
    let nearbyOriginLabel: String?

    // CodingKeys for snake_case JSON fields
    enum CodingKeys: String, CodingKey {
        case id, iataCode, city, country, tagline, description
        case imageUrl, imageUrls
        case flightPrice, hotelPricePerNight, currency
        case vibeTags, bestMonths, averageTemp, flightDuration
        case livePrice, priceSource, priceFetchedAt
        case liveHotelPrice, hotelPriceSource
        case availableFlightDays = "available_flight_days"
        case latitude, longitude
        case itinerary, restaurants
        case departureDate, returnDate, tripDurationDays
        case airline, priceDirection, previousPrice, priceDropPercent
        case offerJson, offerExpiresAt, airlineLogoUrl
        case cheapestDate, cheapestReturnDate, affiliateUrl
        case priceHistory
        case dealScore, dealTier, qualityScore, pricePercentile
        case isNonstop, totalStops, maxLayoverMinutes
        case usualPrice, savingsAmount, savingsPercent
        case nearbyOrigin, nearbyOriginLabel
    }
}

// MARK: - Nested Types

struct ItineraryDay: Codable, Hashable, Sendable {
    let day: Int
    let activities: [String]
}

struct Restaurant: Codable, Hashable, Sendable {
    let name: String
    let type: String
    let rating: Double
}

// MARK: - Computed Helpers

extension Deal {
    /// The effective price to display (livePrice preferred, fallback to flightPrice)
    var displayPrice: Double? {
        livePrice ?? flightPrice
    }

    /// Formatted price string
    var priceFormatted: String {
        guard let price = displayPrice else { return "—" }
        return "$\(Int(price))"
    }

    /// Destination name (alias for city)
    var destination: String { city }

    /// Trip duration in days
    var tripDays: Int {
        tripDurationDays ?? 0
    }

    /// Formatted savings string
    var savingsLabel: String? {
        guard let amount = savingsAmount, let pct = savingsPercent, amount > 0 else { return nil }
        return "Save $\(Int(amount)) (\(Int(pct))%)"
    }

    /// The deal tier color, falling back to sgMuted
    var tierColor: Color {
        (dealTier ?? .fair).color
    }

    /// Human-readable stops label
    var stopsLabel: String {
        if isNonstop == true { return "Nonstop" }
        guard let stops = totalStops else { return "" }
        return stops == 1 ? "1 stop" : "\(stops) stops"
    }

    /// Airline display name (IATA code or "—")
    var airlineName: String {
        airline ?? "—"
    }
}

// MARK: - Preview Mock

extension Deal {
    static let preview = Deal(
        id: "1", iataCode: "BCN", city: "Barcelona", country: "Spain",
        tagline: "Gothic quarters and Gaudí dreams",
        description: "Mediterranean city with stunning architecture.",
        imageUrl: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800",
        imageUrls: nil, flightPrice: 450, hotelPricePerNight: 120, currency: "USD",
        vibeTags: ["culture", "beach", "foodie"], bestMonths: ["May", "Jun", "Sep"],
        averageTemp: 22, flightDuration: "9h 30m", livePrice: 287,
        priceSource: "travelpayouts", priceFetchedAt: nil, liveHotelPrice: nil,
        hotelPriceSource: nil, availableFlightDays: nil, latitude: 41.3851, longitude: 2.1734,
        itinerary: [ItineraryDay(day: 1, activities: ["Walk La Rambla", "Visit Sagrada Familia"])],
        restaurants: [Restaurant(name: "Cal Pep", type: "Tapas", rating: 4.8)],
        departureDate: "2026-04-15", returnDate: "2026-04-22", tripDurationDays: 7,
        airline: "DL", priceDirection: "down", previousPrice: 450, priceDropPercent: 36,
        offerJson: nil, offerExpiresAt: nil, airlineLogoUrl: nil,
        cheapestDate: "2026-04-15", cheapestReturnDate: "2026-04-22",
        affiliateUrl: "https://aviasales.com", priceHistory: [450, 420, 380, 310, 287],
        dealScore: 88, dealTier: .amazing, qualityScore: 90, pricePercentile: 15,
        isNonstop: true, totalStops: 0, maxLayoverMinutes: 0,
        usualPrice: 450, savingsAmount: 163, savingsPercent: 36,
        nearbyOrigin: nil, nearbyOriginLabel: nil
    )
}

// MARK: - FeedResponse

struct FeedResponse: Codable, Sendable {
    let destinations: [Deal]
    let nextCursor: String?
}
