import Testing
import Foundation
@testable import SoGoJet

@Suite("APIClient Endpoint Construction")
struct APIClientTests {

    // MARK: - Path

    @Test("Feed endpoint path")
    func feedPath() {
        let endpoint = APIClient.Endpoint.feed(origin: "JFK", page: 1, vibes: [], search: nil)
        #expect(endpoint.path == "/feed")
    }

    @Test("Booking endpoints share /booking path")
    func bookingPaths() {
        let search = APIClient.Endpoint.bookingSearch(
            origin: "JFK", destination: "LAX", date: "2026-05-01",
            returnDate: nil, passengers: 1, cabinClass: nil, priceHint: nil, cachedOfferId: nil
        )
        #expect(search.path == "/booking")

        let history = APIClient.Endpoint.bookingHistory
        #expect(history.path == "/booking")
    }

    @Test("AI trip plan path")
    func tripPlanPath() {
        let request = TripPlanRequest(city: "Tokyo", country: "Japan", duration: 5, style: .comfort, interests: nil, destinationId: nil)
        let endpoint = APIClient.Endpoint.aiTripPlan(request)
        #expect(endpoint.path == "/ai/trip-plan")
    }

    @Test("Hotel endpoints use /booking path")
    func hotelPath() {
        let search = APIClient.Endpoint.hotelSearch(
            HotelSearchRequest(latitude: 35.6, longitude: 139.7, checkIn: "2026-05-01", checkOut: "2026-05-04", guests: 1)
        )
        #expect(search.path == "/booking")
    }

    @Test("Alert endpoints use /alerts path")
    func alertPath() {
        #expect(APIClient.Endpoint.alertList.path == "/alerts")
        #expect(APIClient.Endpoint.alertDelete(id: "abc").path == "/alerts")
        #expect(APIClient.Endpoint.alertCreate(destination: "xyz", maxPrice: 300).path == "/alerts")
    }

    // MARK: - Method

    @Test("GET endpoints")
    func getMethods() {
        let feed = APIClient.Endpoint.feed(origin: "JFK", page: 1, vibes: [], search: nil)
        #expect(feed.method == "GET")

        #expect(APIClient.Endpoint.savedList.method == "GET")
        #expect(APIClient.Endpoint.alertList.method == "GET")
        #expect(APIClient.Endpoint.bookingHistory.method == "GET")
    }

    @Test("POST endpoints")
    func postMethods() {
        let request = TripPlanRequest(city: "Tokyo", country: nil, duration: 3, style: .budget, interests: nil, destinationId: nil)
        #expect(APIClient.Endpoint.aiTripPlan(request).method == "POST")
        #expect(APIClient.Endpoint.swipe(dealId: "d1", action: "like").method == "POST")
        #expect(APIClient.Endpoint.alertCreate(destination: "x", maxPrice: 100).method == "POST")
    }

    @Test("DELETE endpoints")
    func deleteMethods() {
        #expect(APIClient.Endpoint.alertDelete(id: "abc").method == "DELETE")
        #expect(APIClient.Endpoint.travelerDelete(id: "t1").method == "DELETE")
    }

    // MARK: - Query Items

    @Test("Feed query items include origin and page")
    func feedQueryItems() {
        let endpoint = APIClient.Endpoint.feed(origin: "LAX", page: 3, vibes: ["beach", "nightlife"], search: "Tokyo")
        let items = endpoint.queryItems
        #expect(items.contains { $0.name == "origin" && $0.value == "LAX" })
        #expect(items.contains { $0.name == "page" && $0.value == "3" })
        #expect(items.contains { $0.name == "vibes" && $0.value == "beach,nightlife" })
        #expect(items.contains { $0.name == "search" && $0.value == "Tokyo" })
    }

    @Test("Feed omits empty vibes and nil search")
    func feedQueryItemsMinimal() {
        let endpoint = APIClient.Endpoint.feed(origin: "JFK", page: 1, vibes: [], search: nil)
        let items = endpoint.queryItems
        #expect(!items.contains { $0.name == "vibes" })
        #expect(!items.contains { $0.name == "search" })
    }

    @Test("Hotel search uses hotel-search action")
    func hotelSearchAction() {
        let endpoint = APIClient.Endpoint.hotelSearch(
            HotelSearchRequest(latitude: 0, longitude: 0, checkIn: "2026-01-01", checkOut: "2026-01-02", guests: 1)
        )
        #expect(endpoint.queryItems.contains { $0.name == "action" && $0.value == "hotel-search" })
    }

    @Test("Alert list uses list action")
    func alertListAction() {
        #expect(APIClient.Endpoint.alertList.queryItems.contains { $0.name == "action" && $0.value == "list" })
    }

    @Test("Alert delete uses delete action")
    func alertDeleteAction() {
        #expect(APIClient.Endpoint.alertDelete(id: "x").queryItems.contains { $0.name == "action" && $0.value == "delete" })
    }

    // MARK: - Body

    @Test("Swipe body contains dealId and action")
    func swipeBody() throws {
        let endpoint = APIClient.Endpoint.swipe(dealId: "deal_123", action: "like")
        let body = try #require(endpoint.body)
        let json = try JSONSerialization.jsonObject(with: body) as? [String: String]
        #expect(json?["dealId"] == "deal_123")
        #expect(json?["action"] == "like")
    }

    @Test("Trip plan body encodes correctly")
    func tripPlanBody() throws {
        let request = TripPlanRequest(city: "Paris", country: "France", duration: 7, style: .luxury, interests: "art", destinationId: "d1")
        let endpoint = APIClient.Endpoint.aiTripPlan(request)
        let body = try #require(endpoint.body)
        let json = try JSONDecoder().decode(TripPlanRequest.self, from: body)
        #expect(json.city == "Paris")
        #expect(json.country == "France")
        #expect(json.duration == 7)
        #expect(json.style == .luxury)
        #expect(json.interests == "art")
    }

    @Test("Alert delete body contains alertId")
    func alertDeleteBody() throws {
        let endpoint = APIClient.Endpoint.alertDelete(id: "alert_abc")
        let body = try #require(endpoint.body)
        let json = try JSONSerialization.jsonObject(with: body) as? [String: String]
        #expect(json?["alertId"] == "alert_abc")
    }
}
