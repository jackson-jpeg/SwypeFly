import Foundation

// MARK: - Booking Search

struct BookingSearchResponse: Codable, Sendable {
    let offers: [TripOption]
    let priceDiscrepancy: PriceDiscrepancy?
}

struct BookingSearchSnapshot: Hashable, Sendable {
    let origin: String
    let destination: String
    let departureDate: String
    let returnDate: String?
    let cabinClass: BookingCabinClass
    let passengers: Int
    let offerCount: Int
    let bestPrice: Double?
    let searchedAt: Date
}

// MARK: - Recent Search

struct RecentSearch: Codable, Identifiable, Hashable, Sendable {
    var id: String { "\(origin)-\(destination)-\(departureDate)" }
    let origin: String
    let destination: String
    let destinationCity: String
    let departureDate: String
    let returnDate: String?
    let bestPrice: Double?
    let offerCount: Int
    let searchedAt: Date
}

struct PriceDiscrepancy: Codable, Hashable, Sendable {
    let tier: String
    let message: String
    let feedPrice: Double
    let bookingPrice: Double
    let percentDiff: Int
    let feedDatesMatch: Bool?  // nil for backwards compat
}

enum BookingCabinClass: String, Codable, CaseIterable, Sendable {
    case economy
    case premiumEconomy = "premium_economy"
    case business
    case first

    var displayName: String {
        switch self {
        case .economy:
            return "Economy"
        case .premiumEconomy:
            return "Premium"
        case .business:
            return "Business"
        case .first:
            return "First"
        }
    }
}

// MARK: - Destination Market Intel

struct DestinationMarketResponse: Codable, Sendable {
    let otherPrices: [AlternativeOriginPrice]
    let similarDestinations: [SimilarDestinationDeal]
}

struct AlternativeOriginPrice: Codable, Hashable, Sendable {
    let origin: String
    let price: Double
    let source: String
}

struct SimilarDestinationDeal: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let city: String
    let flightPrice: Double
    let imageUrl: String?
}

struct DestinationMonthlyResponse: Codable, Sendable {
    let months: [MonthlyFare]
    let cheapestMonth: String?
    let cheapestPrice: Double?
}

struct MonthlyFare: Codable, Hashable, Sendable {
    let month: String
    let price: Double
    let airline: String?
    let transferCount: Int?
}

// MARK: - Flight Segment (Duffel rich data)

struct FlightSegment: Codable, Sendable, Identifiable, Hashable {
    var id: String { "\(origin)-\(destination)-\(departureTime)" }
    let origin: String
    let originCityName: String
    let destination: String
    let destinationCityName: String
    let departureTime: String
    let arrivalTime: String
    let duration: String
    let airline: String
    let airlineCode: String
    let flightNumber: String
    let aircraft: String
    let aircraftCode: String
    let cabinClass: String

    // API returns camelCase — match exactly
}

// MARK: - Baggage Info

struct BaggageInfo: Codable, Sendable, Hashable {
    let type: String       // "carry_on" or "checked"
    let quantity: Int
}

// MARK: - Meal Info

struct MealInfo: Codable, Sendable, Hashable {
    let rank: String?
    let name: String?
}

// MARK: - Booking Conditions

struct BookingConditions: Codable, Sendable, Hashable {
    let refundable: Bool?
    let refundPenalty: String?
    let changeable: Bool?
    let changePenalty: String?

    // API returns camelCase
}

// MARK: - Trip Option

struct TripOption: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let totalAmount: Double
    let totalCurrency: String
    let baseAmount: Double
    let taxAmount: Double
    let slices: [FlightSlice]
    let cabinClass: String?
    let passengers: [OfferPassenger]?
    let expiresAt: String?
    let availableServices: [AvailableService]?
    let baggageIncluded: [BaggageInfo]?
    let mealInfo: MealInfo?
    let conditions: BookingConditions?

    // API returns camelCase keys — no CodingKeys needed for standard fields
    // Only map fields where Swift name differs from JSON key
    enum CodingKeys: String, CodingKey {
        case id, totalAmount, totalCurrency, baseAmount, taxAmount
        case slices, cabinClass, passengers, expiresAt
        case availableServices, baggageIncluded, mealInfo, conditions
    }

    var outboundSlice: FlightSlice? { slices.first }
    var returnSlice: FlightSlice? { slices.dropFirst().first }

    var airline: String { outboundSlice?.airline ?? "—" }
    var flightNumber: String { outboundSlice?.flightNumber ?? "—" }
    var departureTime: String {
        outboundSlice.map { $0.departureTime.formattedClockTime } ?? "—"
    }
    var arrivalTime: String {
        outboundSlice.map { $0.arrivalTime.formattedClockTime } ?? "—"
    }
    var duration: String { outboundSlice?.duration ?? "—" }
    var stops: Int { outboundSlice?.stops ?? 0 }
    var price: Double { totalAmount }
    var currency: String { totalCurrency }
    var seatsRemaining: Int? { nil }
    var hasBaggageService: Bool? {
        availableServices?.contains(where: { $0.type == "baggage" && $0.amount == 0 }) == true
            ? true
            : nil
    }
    var offerJson: String? { nil }
}

struct FlightSlice: Codable, Hashable, Sendable {
    let origin: String
    let destination: String
    let departureTime: String
    let arrivalTime: String
    let duration: String
    let stops: Int
    let airline: String
    let flightNumber: String
    let aircraft: String
    let segments: [FlightSegment]?
}

struct OfferPassenger: Codable, Hashable, Sendable {
    let id: String?
    let type: String?
}

struct AvailableService: Codable, Hashable, Sendable {
    let id: String
    let type: String
    let name: String
    let amount: Double
    let currency: String
}

// MARK: - Confirm Offer (live-price parity)

/// Response from POST /api/booking?action=confirm-offer.
/// Called right before payment to verify the cached offer is still valid and priced as expected.
struct ConfirmOfferResponse: Codable, Sendable {
    let status: String              // "valid" | "expired"
    let reason: String?             // "offer_expired" when expired
    let offer: TripOption?          // present when status == "valid"
    let priceMatched: Bool?         // present when status == "valid"
    let price: Double?              // present when status == "valid"
    let newOffer: TripOption?       // present when status == "expired", may be null if no fares
    let oldPrice: Double?
    let newPrice: Double?
}

struct BookingOfferResponse: Codable, Sendable {
    let offer: TripOption
    let seatMap: SeatMap?
    let refreshed: Bool?
    let priceChanged: Bool?
    let oldPrice: Double?
    let newPrice: Double?
}

// MARK: - Passenger Data

struct PassengerData: Codable, Hashable, Sendable {
    var title: String = ""
    var firstName: String = ""
    var lastName: String = ""
    var email: String = ""
    var phone: String = ""
    var dateOfBirth: String = ""
    var gender: Gender = .notSpecified
    var passportNumber: String = ""
    var passportExpiry: String = ""
    var nationality: String = "US"

    enum Gender: String, Codable, CaseIterable, Sendable {
        case notSpecified = "notSpecified"
        case male, female, other

        var bookingValue: String {
            switch self {
            case .female:
                return "f"
            case .male, .other, .notSpecified:
                return "m"
            }
        }
    }

    var isValid: Bool {
        !firstName.isEmpty
        && !lastName.isEmpty
        && !email.isEmpty
        && !phone.isEmpty
        && !dateOfBirth.isEmpty
    }
}

/// Valid Duffel passenger title values.
enum DuffelTitle: String, Codable, CaseIterable, Sendable {
    case mr, mrs, ms, miss, dr

    /// Attempt to map a free-form string to a valid Duffel title.
    /// Falls back to `.mr` when the input doesn't match any known value.
    init(from raw: String) {
        self = DuffelTitle(rawValue: raw.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)) ?? .mr
    }

    var displayName: String { rawValue.capitalized }
}

struct CreateOrderPassenger: Codable, Hashable, Sendable {
    let id: String
    let givenName: String
    let familyName: String
    let bornOn: String
    let gender: String
    let title: DuffelTitle
    let email: String
    let phoneNumber: String
    let passportNumber: String?
    let passportExpiry: String?
    let nationality: String?

    enum CodingKeys: String, CodingKey {
        case id
        case givenName = "given_name"
        case familyName = "family_name"
        case bornOn = "born_on"
        case gender
        case title
        case email
        case phoneNumber = "phone_number"
        case passportNumber = "passport_number"
        case passportExpiry = "passport_expiry"
        case nationality
    }
}

struct CreateOrderSelectedService: Codable, Hashable, Sendable {
    let id: String
    let quantity: Int
}

struct BookingCreateOrderRequest: Codable, Sendable {
    let offerId: String
    let passengers: [CreateOrderPassenger]
    let selectedServices: [CreateOrderSelectedService]?
    let paymentIntentId: String
    let amount: Int?
    let currency: String?
    let destinationCity: String?
    let destinationIata: String?
    let originIata: String?
    let departureDate: String?
    let returnDate: String?
}

struct PaymentIntentResponse: Codable, Sendable {
    let clientSecret: String
    let paymentIntentId: String
}

// MARK: - Seat Map

struct SeatMap: Codable, Sendable {
    let columns: [String]
    let exitRows: [Int]
    let aisleAfterColumns: [String]
    let rows: [SeatRow]

    // MARK: - Layout-aware seat classification

    /// Columns that sit next to an aisle (immediately before or after an aisle break).
    var aisleColumns: Set<String> {
        let sorted = columns.map { $0.uppercased() }.sorted()
        let breaks = Set(aisleAfterColumns.map { $0.uppercased() })
        var result = Set<String>()
        for (i, col) in sorted.enumerated() {
            if breaks.contains(col) {
                result.insert(col)                        // left of aisle
                if i + 1 < sorted.count {
                    result.insert(sorted[i + 1])          // right of aisle
                }
            }
        }
        return result
    }

    /// Columns at the outer edges of the cabin (first and last in sorted order).
    var windowColumns: Set<String> {
        let sorted = columns.map { $0.uppercased() }.sorted()
        var result = Set<String>()
        if let first = sorted.first { result.insert(first) }
        if let last = sorted.last { result.insert(last) }
        return result
    }

    /// Determine the seat type for a given column using the actual cabin layout.
    func seatType(column: String, extraLegroom: Bool) -> SeatInfo.SeatType {
        if extraLegroom { return .extra }
        let col = column.uppercased()
        if windowColumns.contains(col) { return .window }
        if aisleColumns.contains(col) { return .aisle }
        return .middle
    }

    // MARK: - Smart seat scoring

    /// Preference for seat recommendation.
    enum SeatPreference: String, Codable, Sendable {
        case window, aisle, cheapest, legroom, frontRow
    }

    /// Score every available seat and return them ranked best-first.
    /// Higher score = better seat.
    func rankedSeats(preference: SeatPreference = .aisle) -> [SeatInfo] {
        let totalRows = rows.count
        guard totalRows > 0 else { return [] }
        let exitSet = Set(exitRows)
        let allAvailable = rows.flatMap { row in
            row.seats.filter(\.available).map { (row.rowNumber, $0) }
        }
        guard !allAvailable.isEmpty else { return [] }

        // Price stats for normalization
        let prices = allAvailable.compactMap { $0.1.price }
        let minPrice = prices.min() ?? 0
        let maxPrice = prices.max() ?? 1
        let priceRange = max(maxPrice - minPrice, 1)

        let scored: [(SeatInfo, Double)] = allAvailable.map { rowNum, seat in
            let type = seatType(column: seat.column, extraLegroom: seat.extraLegroom)
            var score = 50.0 // base score

            // 1) Position preference (0–30 pts)
            switch preference {
            case .window:
                if type == .window { score += 30 }
                else if type == .aisle { score += 10 }
                // middle gets 0
            case .aisle:
                if type == .aisle { score += 30 }
                else if type == .window { score += 10 }
            case .legroom:
                if seat.extraLegroom { score += 30 }
                if type == .aisle { score += 10 }
                else if type == .window { score += 8 }
            case .cheapest:
                // handled by price bonus below
                break
            case .frontRow:
                // handled by row bonus below
                if type == .aisle { score += 10 }
                else if type == .window { score += 8 }
            }

            // 2) Row position (0–20 pts) — front rows are better (faster deplane)
            let rowIndex = rows.firstIndex { $0.rowNumber == rowNum } ?? totalRows
            let frontBonus = Double(totalRows - rowIndex) / Double(totalRows) * 20
            score += frontBonus
            if preference == .frontRow { score += frontBonus } // double bonus

            // 3) Exit row proximity (0–10 pts) — near exit = more legroom, faster exit
            if exitSet.contains(rowNum) {
                score += 10
            } else {
                let minDist = exitSet.map { abs($0 - rowNum) }.min() ?? totalRows
                if minDist <= 2 { score += 5 }
            }

            // 4) Extra legroom bonus (0–15 pts)
            if seat.extraLegroom { score += 15 }

            // 5) Price value (0–15 pts) — cheaper is better
            if let price = seat.price {
                let normalized = (price - minPrice) / priceRange
                score += (1.0 - normalized) * 15
            } else {
                score += 15 // free seat = best price
            }
            if preference == .cheapest {
                // Additional 20 pts for cheapest preference
                if let price = seat.price {
                    let normalized = (price - minPrice) / priceRange
                    score += (1.0 - normalized) * 20
                } else {
                    score += 20
                }
            }

            // 6) Avoid middle seats (penalty)
            if type == .middle { score -= 15 }

            return (seat, score)
        }

        return scored
            .sorted { $0.1 > $1.1 }
            .map(\.0)
    }
}

struct SeatRow: Codable, Sendable {
    let rowNumber: Int
    let seats: [SeatInfo]
}

struct SeatInfo: Codable, Identifiable, Hashable, Sendable {
    let column: String
    let available: Bool
    let extraLegroom: Bool
    private let rawPrice: Double
    let currency: String?
    let designator: String
    let serviceId: String?

    enum CodingKeys: String, CodingKey {
        case column
        case available
        case extraLegroom
        case rawPrice = "price"
        case currency
        case designator
        case serviceId
    }

    var id: String { designator }
    var label: String { designator }

    var price: Double? {
        rawPrice > 0 ? rawPrice : nil
    }

    /// Seat type — requires SeatMap context for accurate detection.
    /// Use `seatMap.seatType(column:extraLegroom:)` when a SeatMap is available.
    /// This fallback uses common 3-3 layout assumptions.
    var type: SeatType {
        if extraLegroom { return .extra }
        switch column.uppercased() {
        case "A", "F", "K": return .window
        case "C", "D", "G", "H": return .aisle
        default: return .middle
        }
    }

    enum SeatType: String, Codable, Sendable {
        case window, middle, aisle, extra = "extra_legroom"
    }
}

// MARK: - Booking Order

struct BookingOrder: Codable, Identifiable, Sendable {
    let orderId: String
    let bookingReference: String
    let status: String
    let passengers: [BookedPassenger]
    let slices: [FlightSlice]
    let totalPaid: Double
    let currency: String

    var id: String { orderId }
}

struct BookedPassenger: Codable, Hashable, Sendable {
    let id: String
    let name: String
    let seatDesignator: String?
}

// MARK: - Booking History

struct BookingHistoryResponse: Codable, Sendable {
    let bookings: [BookingHistoryItem]
}

struct BookingHistoryItem: Codable, Identifiable, Sendable {
    let id: String
    let duffelOrderId: String
    let status: String
    let totalAmount: Double
    let currency: String
    let passengerCount: Int
    let destinationCity: String
    let destinationIata: String
    let originIata: String
    let departureDate: String
    let returnDate: String
    let airline: String
    let bookingReference: String
    let createdAt: String
    let passengers: [BookingHistoryPassenger]

    /// True if the departure date is in the future.
    var isUpcoming: Bool {
        guard let date = Self.dateFormatter.date(from: departureDate) else { return false }
        return date > Date()
    }

    /// Formatted departure date for display (e.g. "Apr 15, 2026").
    var formattedDepartureDate: String {
        guard let date = Self.dateFormatter.date(from: departureDate) else { return departureDate }
        return Self.displayFormatter.string(from: date)
    }

    /// Formatted return date for display.
    var formattedReturnDate: String? {
        guard !returnDate.isEmpty,
              let date = Self.dateFormatter.date(from: returnDate) else { return nil }
        return Self.displayFormatter.string(from: date)
    }

    /// Formatted price for display.
    var formattedPrice: String {
        let symbol = currency == "USD" ? "$" : currency
        if totalAmount == totalAmount.rounded() {
            return "\(symbol)\(Int(totalAmount))"
        }
        return String(format: "%@%.2f", symbol, totalAmount)
    }

    /// Status display info.
    var statusInfo: (label: String, color: String) {
        switch status.lowercased() {
        case "confirmed":
            return ("Confirmed", "green")
        case "cancelled", "canceled":
            return ("Cancelled", "red")
        case "schedule_changed":
            return ("Schedule Changed", "yellow")
        case "pending":
            return ("Pending", "muted")
        default:
            return (status.capitalized, "muted")
        }
    }

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    private static let displayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMM d, yyyy"
        return f
    }()
}

struct BookingHistoryPassenger: Codable, Sendable {
    let givenName: String
    let familyName: String
    let email: String
}

// MARK: - Flight Status

struct FlightStatusResponse: Codable, Sendable {
    let bookingId: String
    let status: String
    let segments: [FlightStatusSegment]
    let lastUpdated: String
}

struct FlightStatusSegment: Codable, Identifiable, Sendable {
    var id: String { "\(origin)-\(destination)-\(flightNumber)" }
    let flightNumber: String
    let origin: String
    let destination: String
    let scheduledDeparture: String
    let estimatedDeparture: String?
    let scheduledArrival: String?
    let estimatedArrival: String?
    let gate: String?
    let terminal: String?
    let delayMinutes: Int?
    let status: String
}

// MARK: - Helpers

private extension String {
    var formattedClockTime: String {
        // Try ISO8601 with timezone
        var date = ISO8601DateFormatter().date(from: self)
        // Try without timezone (Duffel: "2026-04-15T09:55:00")
        if date == nil {
            let fmt = DateFormatter()
            fmt.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
            fmt.locale = Locale(identifier: "en_US_POSIX")
            date = fmt.date(from: self)
        }
        guard let parsed = date else { return self }

        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: parsed)
    }
}
