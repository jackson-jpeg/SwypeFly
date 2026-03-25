import WidgetKit

// MARK: - Timeline Entry

struct FlightEntry: TimelineEntry {
    let date: Date
    let flights: [WidgetFlight]
    let departureCode: String
    let isPlaceholder: Bool

    init(date: Date, flights: [WidgetFlight], departureCode: String, isPlaceholder: Bool = false) {
        self.date = date
        self.flights = flights
        self.departureCode = departureCode
        self.isPlaceholder = isPlaceholder
    }
}

// MARK: - Widget Flight Model

struct WidgetFlight: Identifiable, Codable, Hashable {
    let id: String
    let city: String
    let iataCode: String
    let country: String
    let price: Int           // Rounded dollar amount
    let airline: String      // IATA code or display name
    let duration: String     // e.g. "9h 30m"
    let dealTier: String?    // "amazing", "great", "good", "fair"
}

// MARK: - Sample Data

extension WidgetFlight {
    static let samples: [WidgetFlight] = [
        WidgetFlight(id: "1", city: "Barcelona", iataCode: "BCN", country: "Spain",
                     price: 287, airline: "DL", duration: "9h 30m", dealTier: "amazing"),
        WidgetFlight(id: "2", city: "London", iataCode: "LHR", country: "UK",
                     price: 389, airline: "BA", duration: "7h 10m", dealTier: "great"),
        WidgetFlight(id: "3", city: "Tokyo", iataCode: "NRT", country: "Japan",
                     price: 612, airline: "NH", duration: "14h 5m", dealTier: "good"),
        WidgetFlight(id: "4", city: "Cancun", iataCode: "CUN", country: "Mexico",
                     price: 198, airline: "NK", duration: "3h 20m", dealTier: "amazing"),
        WidgetFlight(id: "5", city: "Paris", iataCode: "CDG", country: "France",
                     price: 425, airline: "AF", duration: "8h 45m", dealTier: "great"),
        WidgetFlight(id: "6", city: "Lisbon", iataCode: "LIS", country: "Portugal",
                     price: 342, airline: "TP", duration: "7h 55m", dealTier: "good"),
        WidgetFlight(id: "7", city: "Bali", iataCode: "DPS", country: "Indonesia",
                     price: 718, airline: "SQ", duration: "22h 10m", dealTier: "fair"),
    ]
}

// MARK: - Placeholder Entry

extension FlightEntry {
    static let placeholder = FlightEntry(
        date: .now,
        flights: WidgetFlight.samples,
        departureCode: "TPA",
        isPlaceholder: true
    )

    static let snapshot = FlightEntry(
        date: .now,
        flights: Array(WidgetFlight.samples.prefix(5)),
        departureCode: "TPA"
    )
}
