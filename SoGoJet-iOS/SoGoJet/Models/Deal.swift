import Foundation
import SwiftUI

// MARK: - Deal
// Mirrors the TypeScript `BoardDeal` interface from types/deal.ts.
// All optional fields in TS map to Swift optionals.

struct Deal: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let departureTime: String
    let destination: String
    let destinationFull: String
    let country: String
    let iataCode: String
    let flightCode: String
    let price: Double?
    let priceFormatted: String
    let status: DealStatus
    let priceSource: String
    let airline: String
    let departureDate: String
    let returnDate: String
    let cheapestDate: String
    let cheapestReturnDate: String
    let tripDays: Int
    let flightDuration: String
    let vibeTags: [String]
    let imageUrl: String
    let blurHash: String?
    let tagline: String
    let description: String
    let affiliateUrl: String
    let itinerary: [ItineraryDay]?
    let restaurants: [Restaurant]?

    // Deal quality
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

    // Price trend (sparkline data)
    let priceHistory: [Double]?

    // Nearby airport fallback
    let nearbyOrigin: String?
    let nearbyOriginLabel: String?
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

// MARK: - Deal Status

enum DealStatus: String, Codable, Sendable {
    case deal = "DEAL"
    case hot  = "HOT"
    case new  = "NEW"
}

// MARK: - Computed Helpers

extension Deal {
    /// Formatted savings string, e.g. "Save $120 (34%)".
    var savingsLabel: String? {
        guard let amount = savingsAmount, let pct = savingsPercent else { return nil }
        return "Save $\(Int(amount)) (\(Int(pct))%)"
    }

    /// The deal tier colour, falling back to sgMuted.
    var tierColor: Color {
        (dealTier ?? .fair).color
    }

    /// Human-readable stops label.
    var stopsLabel: String {
        if isNonstop == true { return "Nonstop" }
        guard let stops = totalStops else { return "" }
        return stops == 1 ? "1 stop" : "\(stops) stops"
    }
}
