import Testing
@testable import SoGoJet

@Suite("AirportGraph")
struct AirportGraphTests {

    @Test("Known airport returns nearby airports")
    func knownAirport() {
        let nearby = AirportGraph.nearbyAirports(for: "JFK")
        #expect(nearby.contains("EWR"))
        #expect(nearby.contains("LGA"))
        #expect(nearby.contains("PHL"))
    }

    @Test("Case insensitive lookup")
    func caseInsensitive() {
        let nearby = AirportGraph.nearbyAirports(for: "jfk")
        #expect(nearby.contains("EWR"))
    }

    @Test("Unknown airport returns default fallback")
    func unknownAirport() {
        let nearby = AirportGraph.nearbyAirports(for: "ZZZ")
        #expect(nearby == ["JFK", "LAX", "ORD"])
    }

    @Test("Bidirectional — if A lists B, B should list A")
    func bidirectional() {
        // SFO lists OAK
        let sfoNearby = AirportGraph.nearbyAirports(for: "SFO")
        #expect(sfoNearby.contains("OAK"))
        // OAK should list SFO
        let oakNearby = AirportGraph.nearbyAirports(for: "OAK")
        #expect(oakNearby.contains("SFO"))
    }

    @Test("DC area airports cross-reference")
    func dcArea() {
        let iadNearby = AirportGraph.nearbyAirports(for: "IAD")
        #expect(iadNearby.contains("DCA"))
        #expect(iadNearby.contains("BWI"))

        let dcaNearby = AirportGraph.nearbyAirports(for: "DCA")
        #expect(dcaNearby.contains("IAD"))
    }
}

@Suite("StorageKeys")
struct StorageKeysTests {

    @Test("Keys use sg_ prefix for settings")
    func settingsPrefix() {
        #expect(StorageKeys.Settings.departureCode.hasPrefix("sg_"))
        #expect(StorageKeys.Settings.hasOnboarded.hasPrefix("sg_"))
    }

    @Test("Auth keys use sg_ prefix")
    func authPrefix() {
        #expect(StorageKeys.Auth.token.hasPrefix("sg_"))
        #expect(StorageKeys.Auth.userId.hasPrefix("sg_"))
    }

    @Test("All keys are unique")
    func uniqueKeys() {
        let allKeys = [
            StorageKeys.Auth.token,
            StorageKeys.Auth.userId,
            StorageKeys.Auth.userName,
            StorageKeys.Auth.userEmail,
            StorageKeys.Settings.departureCode,
            StorageKeys.Settings.departureCity,
            StorageKeys.Settings.preferredView,
            StorageKeys.Settings.swipeMode,
            StorageKeys.Settings.notificationsEnabled,
            StorageKeys.Settings.priceAlertsEnabled,
            StorageKeys.Settings.alertEmail,
            StorageKeys.Settings.hasOnboarded,
            StorageKeys.Settings.usesMetric,
            StorageKeys.Feed.filterPrices,
            StorageKeys.Feed.filterVibes,
            StorageKeys.Feed.filterRegions,
            StorageKeys.Feed.filterMaxPrice,
            StorageKeys.Booking.recentSearches,
            StorageKeys.Booking.lastPassenger,
            StorageKeys.Saved.deals,
            StorageKeys.Saved.recentlyViewed,
            StorageKeys.Review.lastPromptDate,
            StorageKeys.Review.appOpenDays,
            StorageKeys.Review.lastRecordedDay,
        ]
        let unique = Set(allKeys)
        #expect(unique.count == allKeys.count, "Duplicate storage keys found")
    }
}
