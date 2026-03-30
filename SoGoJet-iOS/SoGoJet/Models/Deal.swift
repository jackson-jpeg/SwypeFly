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

    /// Whether this deal has a valid, displayable price.
    var hasPrice: Bool {
        guard let price = displayPrice else { return false }
        return price > 0
    }

    /// Formatted price string.
    /// Returns "Check price" when price is zero or nil (avoids showing "$0" in the UI).
    /// Prefixes with "from" when the price is from cached/promotional data
    /// to set expectations that live booking prices may differ.
    var priceFormatted: String {
        guard let price = displayPrice, price > 0 else { return "Check price" }
        return "$\(Int(price))"
    }

    /// Whether the displayed price is an estimate (from Travelpayouts cache)
    /// vs a confirmed live price (from Duffel).
    var isEstimatedPrice: Bool {
        // If we have a livePrice from Duffel, it's confirmed
        if (livePrice ?? 0) > 0 { return false }
        // flightPrice from Travelpayouts is always an estimate
        return flightPrice != nil
    }

    /// Price label for the card — "seen at $X" for estimates, "$X" for live prices
    var cardPriceLabel: String {
        guard let price = displayPrice, price > 0 else { return "Check price" }
        if isEstimatedPrice {
            return "seen at $\(Int(price))"
        }
        return "from $\(Int(price))"
    }

    /// Short price label without "from" prefix — used in split-flap board rows
    /// where space is tight and the prefix is shown separately.
    var priceShort: String {
        guard let price = displayPrice, price > 0 else { return "—" }
        return "$\(Int(price))"
    }

    /// Days until departure. Nil if no departure date or already passed.
    var daysUntilDeparture: Int? {
        guard let dateStr = bestDepartureDate else { return nil }
        let fmts = ["yyyy-MM-dd", "MM/dd/yyyy", "MMM dd, yyyy"]
        var date: Date?
        for fmt in fmts {
            let f = DateFormatter()
            f.dateFormat = fmt
            if let d = f.date(from: dateStr) { date = d; break }
        }
        guard let dep = date else { return nil }
        let days = Calendar.current.dateComponents([.day], from: Date(), to: dep).day ?? 0
        return days >= 0 ? days : nil
    }

    /// Human-readable countdown for departure.
    var countdownLabel: String? {
        guard let days = daysUntilDeparture else { return nil }
        if days == 0 { return "Departs today!" }
        if days == 1 { return "Departs tomorrow" }
        if days <= 7 { return "Departs in \(days) days" }
        if days <= 30 { return "In \(days / 7) weeks" }
        return nil // Don't show for far-future dates
    }

    /// Destination name (alias for city)
    var destination: String { city }

    /// Safe vibe tags (never nil)
    var safeVibeTags: [String] { vibeTags ?? [] }

    /// Safe flight duration
    var safeFlightDuration: String { flightDuration ?? "—" }

    /// Safe departure date
    var safeDepartureDate: String { departureDate ?? "—" }

    /// Safe return date
    var safeReturnDate: String { returnDate ?? "—" }

    /// Best available departure date for booking
    var bestDepartureDate: String? { cheapestDate ?? departureDate }

    /// Best available return date for booking
    var bestReturnDate: String? { cheapestReturnDate ?? returnDate }

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

    /// Price trend direction based on priceDirection field or previousPrice comparison
    /// Google Flights-style price level indicator using route percentile data.
    var priceLevelLabel: String? {
        if let pct = pricePercentile {
            if pct <= 15 { return "Price is low" }
            if pct <= 40 { return "Good price" }
            if pct >= 75 { return "Price is high" }
            return nil // typical range, don't show
        }
        // Fallback to deal tier
        switch dealTier {
        case .amazing: return "Price is low"
        case .great: return "Good price"
        default: return nil
        }
    }

    /// Color for the price level label.
    var priceLevelColor: String {
        if let pct = pricePercentile {
            if pct <= 15 { return "green" }
            if pct <= 40 { return "yellow" }
            if pct >= 75 { return "red" }
        }
        switch dealTier {
        case .amazing: return "green"
        case .great: return "yellow"
        default: return "muted"
        }
    }

    var priceTrend: PriceTrend {
        if let direction = priceDirection?.lowercased() {
            if direction.contains("down") || direction.contains("drop") { return .down }
            if direction.contains("up") || direction.contains("rise") { return .up }
        }
        if let prev = previousPrice, let curr = displayPrice, prev > 0 {
            let change = (curr - prev) / prev
            if change < -0.03 { return .down }
            if change > 0.03 { return .up }
        }
        return .stable
    }

    enum PriceTrend {
        case up, down, stable

        var icon: String {
            switch self {
            case .up: "arrow.up.right"
            case .down: "arrow.down.right"
            case .stable: ""
            }
        }

        var color: Color {
            switch self {
            case .up: Color.sgRed
            case .down: Color.sgDealAmazing
            case .stable: Color.sgMuted
            }
        }

        var label: String {
            switch self {
            case .up: "Price rising"
            case .down: "Price dropping"
            case .stable: "Price stable"
            }
        }
    }

    /// Whether the current month is one of the destination's best months to visit.
    var isGoodTimeToVisit: Bool {
        guard let months = bestMonths, !months.isEmpty else { return false }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        let currentMonth = formatter.string(from: Date()) // e.g. "Mar"
        let fullFormatter = DateFormatter()
        fullFormatter.dateFormat = "MMMM"
        let currentMonthFull = fullFormatter.string(from: Date()) // e.g. "March"
        return months.contains { m in
            m.localizedCaseInsensitiveContains(currentMonth) ||
            m.localizedCaseInsensitiveContains(currentMonthFull)
        }
    }

    /// Approximate time zone difference between user's current location and destination.
    /// Uses longitude / 15 to estimate the destination's UTC offset, then compares
    /// with the device's current UTC offset. Returns nil if longitude is unavailable.
    var timeZoneDifference: String? {
        guard let lon = longitude else { return nil }
        let destOffsetHours = Int((lon / 15.0).rounded())
        let localOffsetHours = TimeZone.current.secondsFromGMT() / 3600
        let diff = destOffsetHours - localOffsetHours
        if diff == 0 { return "Same time zone" }
        if diff > 0 { return "+\(diff)h ahead" }
        return "\(diff)h behind"
    }

    /// Human-readable stops label
    var stopsLabel: String {
        if isNonstop == true { return "Nonstop" }
        guard let stops = totalStops else { return "" }
        return stops == 1 ? "1 stop" : "\(stops) stops"
    }

    /// Airline display name — resolved from IATA code, falls back to raw code, then "—"
    var airlineName: String {
        if let code = airline {
            // Known airline name from lookup
            if let name = Airlines.name(for: code) {
                return name
            }
            // Valid IATA codes are exactly 2 characters; anything longer is likely a data source name
            if code.count <= 2 {
                return code
            }
            // Unrecognized long string (e.g. "TRAVELPAYOUTS") — hide it
            return "—"
        }
        return "—"
    }

    /// How long ago the price was fetched, as a human-readable string.
    /// Returns nil when priceFetchedAt is missing or unparseable.
    var priceFreshnessLabel: String? {
        guard let raw = priceFetchedAt, !raw.isEmpty else { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = iso.date(from: raw)
        if date == nil {
            iso.formatOptions = [.withInternetDateTime]
            date = iso.date(from: raw)
        }
        guard let fetched = date else { return nil }
        let seconds = Date().timeIntervalSince(fetched)
        guard seconds >= 0 else { return nil }
        let minutes = Int(seconds) / 60
        let hours = minutes / 60
        let days = hours / 24
        if days >= 1 { return "Seen \(days)d ago" }
        if hours >= 1 { return "Seen \(hours)h ago" }
        if minutes >= 1 { return "Seen \(minutes)m ago" }
        return "Seen just now"
    }

    /// Freshness category for coloring the price-updated label.
    enum PriceFreshness {
        case fresh, stale, old
    }

    var priceFreshness: PriceFreshness? {
        guard let raw = priceFetchedAt, !raw.isEmpty else { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = iso.date(from: raw)
        if date == nil {
            iso.formatOptions = [.withInternetDateTime]
            date = iso.date(from: raw)
        }
        guard let fetched = date else { return nil }
        let hours = Date().timeIntervalSince(fetched) / 3600
        if hours < 12 { return .fresh }
        if hours < 48 { return .stale }
        return .old
    }

    /// Canonical SoGoJet share URL for this destination.
    var shareURL: URL? {
        URL(string: "https://sogojet.com/destination/\(id)")
    }

    /// Apple Maps URL for this destination. Nil if coordinates are missing.
    var mapsURL: URL? {
        guard let lat = latitude, let lon = longitude else { return nil }
        return URL(string: "https://maps.apple.com/?ll=\(lat),\(lon)&q=\(city.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? city)")
    }

    /// Rich share text including destination, price, and URL.
    var shareText: String {
        let url = shareURL?.absoluteString ?? "https://sogojet.com"
        if hasPrice {
            return "Check out flights to \(city) from \(priceFormatted) on SoGoJet! ✈️\n\(url)"
        }
        return "Check out \(city) on SoGoJet! ✈️\n\(url)"
    }
}

// MARK: - Unit Formatting Helpers

extension Deal {
    /// Format a Celsius temperature for display, converting to Fahrenheit when metric is false.
    static func formatTemp(_ celsius: Double, metric: Bool) -> String {
        if metric {
            return "\(Int(celsius))°C"
        } else {
            let f = celsius * 9.0 / 5.0 + 32.0
            return "\(Int(f))°F"
        }
    }

    /// Format a distance in km for display, converting to miles when metric is false.
    static func formatDistance(_ km: Double, metric: Bool) -> String {
        if metric {
            return "\(Int(km)) km"
        } else {
            let miles = km * 0.621371
            return "\(Int(miles)) mi"
        }
    }
}

// MARK: - Geo Helpers

extension Deal {
    /// Haversine distance in kilometers between two deals.
    /// Returns nil if either deal lacks coordinates.
    static func distanceKm(from a: Deal, to b: Deal) -> Double? {
        guard let lat1 = a.latitude, let lon1 = a.longitude,
              let lat2 = b.latitude, let lon2 = b.longitude else { return nil }
        return Self.haversineKm(lat1: lat1, lon1: lon1, lat2: lat2, lon2: lon2)
    }

    /// Haversine distance in kilometers from arbitrary coordinates to this deal.
    /// Returns nil if the deal lacks coordinates.
    func distanceKm(fromLat lat1: Double, lon lon1: Double) -> Double? {
        guard let lat2 = latitude, let lon2 = longitude else { return nil }
        return Self.haversineKm(lat1: lat1, lon1: lon1, lat2: lat2, lon2: lon2)
    }

    /// Core Haversine formula — distance in km between two coordinate pairs.
    private static func haversineKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double) -> Double {
        let R = 6371.0 // Earth radius in km
        let dLat = (lat2 - lat1) * .pi / 180
        let dLon = (lon2 - lon1) * .pi / 180
        let a = sin(dLat / 2) * sin(dLat / 2) +
                cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180) *
                sin(dLon / 2) * sin(dLon / 2)
        let c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return R * c
    }

    /// Initial bearing (forward azimuth) in degrees from origin coordinates to this deal.
    /// Returns nil if the deal lacks coordinates.
    func bearing(fromLat lat1: Double, lon lon1: Double) -> Double? {
        guard let lat2 = latitude, let lon2 = longitude else { return nil }
        let lat1r = lat1 * .pi / 180
        let lat2r = lat2 * .pi / 180
        let dLon = (lon2 - lon1) * .pi / 180
        let y = sin(dLon) * cos(lat2r)
        let x = cos(lat1r) * sin(lat2r) - sin(lat1r) * cos(lat2r) * cos(dLon)
        let bearing = atan2(y, x) * 180 / .pi
        return bearing.truncatingRemainder(dividingBy: 360) + (bearing < 0 ? 360 : 0)
    }

    /// 8-point compass direction (N, NE, E, SE, S, SW, W, NW) from origin to this deal.
    /// Returns nil if bearing cannot be calculated.
    func compassDirection(fromLat lat: Double, lon: Double) -> String? {
        guard let deg = bearing(fromLat: lat, lon: lon) else { return nil }
        let directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        let index = Int((deg + 22.5).truncatingRemainder(dividingBy: 360) / 45.0)
        return directions[index]
    }

    /// Whether this destination is domestic US (used to decide km vs mi display).
    var isDomesticUS: Bool {
        let usNames = ["United States", "US", "USA", "U.S.", "U.S.A.", "Puerto Rico", "USVI",
                       "US Virgin Islands", "Guam", "American Samoa"]
        return usNames.contains { country.localizedCaseInsensitiveCompare($0) == .orderedSame }
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
    static let previewNonstop = Deal(
        id: "2", iataCode: "LHR", city: "London", country: "United Kingdom",
        tagline: "Where history meets the future",
        description: "Explore London's timeless charm.",
        imageUrl: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800",
        imageUrls: nil, flightPrice: 550, hotelPricePerNight: 180, currency: "USD",
        vibeTags: ["culture", "foodie", "historic"], bestMonths: ["May", "Jun", "Sep"],
        averageTemp: 15, flightDuration: "7h 10m", livePrice: 389,
        priceSource: "travelpayouts", priceFetchedAt: nil, liveHotelPrice: nil,
        hotelPriceSource: nil, availableFlightDays: nil, latitude: 51.5074, longitude: -0.1278,
        itinerary: nil, restaurants: nil,
        departureDate: "2026-05-01", returnDate: "2026-05-08", tripDurationDays: 7,
        airline: "BA", priceDirection: "down", previousPrice: 550, priceDropPercent: 29,
        offerJson: nil, offerExpiresAt: nil, airlineLogoUrl: nil,
        cheapestDate: "2026-05-01", cheapestReturnDate: "2026-05-08",
        affiliateUrl: "https://aviasales.com", priceHistory: [520, 490, 510, 470, 430, 400, 389],
        dealScore: 75, dealTier: .great, qualityScore: 95, pricePercentile: 20,
        isNonstop: true, totalStops: 0, maxLayoverMinutes: 0,
        usualPrice: 550, savingsAmount: 161, savingsPercent: 29,
        nearbyOrigin: nil, nearbyOriginLabel: nil
    )
}

// MARK: - FeedResponse

struct FeedResponse: Codable, Sendable {
    let destinations: [Deal]
    let nextCursor: String?
}
