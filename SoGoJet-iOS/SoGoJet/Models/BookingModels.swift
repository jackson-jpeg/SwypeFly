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
    var baggageIncluded: Bool? {
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
    var gender: Gender = .male
    var passportNumber: String = ""
    var passportExpiry: String = ""
    var nationality: String = "US"

    enum Gender: String, Codable, CaseIterable, Sendable {
        case male, female, other

        var bookingValue: String {
            switch self {
            case .female:
                return "f"
            case .male, .other:
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

struct CreateOrderPassenger: Codable, Hashable, Sendable {
    let id: String
    let givenName: String
    let familyName: String
    let bornOn: String
    let gender: String
    let title: String
    let email: String
    let phoneNumber: String

    enum CodingKeys: String, CodingKey {
        case id
        case givenName = "given_name"
        case familyName = "family_name"
        case bornOn = "born_on"
        case gender
        case title
        case email
        case phoneNumber = "phone_number"
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

    var type: SeatType {
        if extraLegroom {
            return .extra
        }

        switch column.uppercased() {
        case "A", "F":
            return .window
        case "C", "D":
            return .aisle
        default:
            return .middle
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

// MARK: - Helpers

private extension String {
    var formattedClockTime: String {
        guard let date = ISO8601DateFormatter().date(from: self) else { return self }

        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }
}
