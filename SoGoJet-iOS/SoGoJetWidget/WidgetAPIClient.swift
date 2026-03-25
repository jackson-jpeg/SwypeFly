import Foundation

// MARK: - Widget API Client
// Lightweight network client for the widget extension.
// Fetches the feed endpoint and maps deals to WidgetFlight models.

enum WidgetAPIClient {
    private static let baseURL = "https://www.sogojet.com/api"

    /// Fetch flights from the SoGoJet feed API.
    /// Returns up to `limit` flights sorted by price.
    static func fetchFlights(origin: String, limit: Int = 7) async -> [WidgetFlight] {
        guard var components = URLComponents(string: "\(baseURL)/feed") else { return [] }
        components.queryItems = [
            URLQueryItem(name: "origin", value: origin),
            URLQueryItem(name: "page", value: "1"),
        ]
        guard let url = components.url else { return [] }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("SoGoJet-Widget/1.0", forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 15

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse,
                  (200...299).contains(http.statusCode) else {
                return []
            }

            let feedResponse = try JSONDecoder().decode(WidgetFeedResponse.self, from: data)

            // Map to WidgetFlight, filter to deals with prices, sort cheapest first
            let flights = feedResponse.destinations
                .compactMap { deal -> WidgetFlight? in
                    let price = deal.livePrice ?? deal.flightPrice
                    guard let price, price > 0 else { return nil }
                    return WidgetFlight(
                        id: deal.id,
                        city: deal.city,
                        iataCode: deal.iataCode,
                        country: deal.country,
                        price: Int(price),
                        airline: deal.airline ?? "—",
                        duration: deal.flightDuration ?? "—",
                        dealTier: deal.dealTier
                    )
                }
                .sorted { $0.price < $1.price }

            return Array(flights.prefix(limit))
        } catch {
            #if DEBUG
            print("[Widget] API fetch failed: \(error.localizedDescription)")
            #endif
            return []
        }
    }
}

// MARK: - Minimal Feed Response (Widget-only decoding)

private struct WidgetFeedResponse: Codable {
    let destinations: [WidgetDeal]
}

private struct WidgetDeal: Codable {
    let id: String
    let iataCode: String
    let city: String
    let country: String
    let flightPrice: Double?
    let livePrice: Double?
    let flightDuration: String?
    let airline: String?
    let dealTier: String?
}
