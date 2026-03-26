import Foundation
import Observation

// MARK: - Recently Viewed Store
// Tracks the last 10 destinations the user opened, persisted to UserDefaults.
// Stores minimal data (ID, city, country, price) — not full Deal objects.

@MainActor
@Observable
final class RecentlyViewedStore {
    // MARK: Types

    struct RecentItem: Codable, Identifiable, Equatable {
        let id: String        // Deal ID
        let city: String
        let country: String
        let iataCode: String
        let price: Double?    // displayPrice at time of view
        let viewedAt: Date
    }

    // MARK: State

    private(set) var items: [RecentItem] = []

    private let storageKey = "sg_recently_viewed"
    private let maxItems = 10

    init() {
        loadFromDisk()
    }

    // MARK: Actions

    /// Record that the user viewed a deal's detail page.
    /// Deduplicates: if already present, moves it to the front with updated timestamp.
    func recordView(deal: Deal) {
        // Remove existing entry for this destination (deduplicate)
        items.removeAll { $0.id == deal.id }

        // Insert at front
        let item = RecentItem(
            id: deal.id,
            city: deal.city,
            country: deal.country,
            iataCode: deal.iataCode,
            price: deal.displayPrice,
            viewedAt: Date()
        )
        items.insert(item, at: 0)

        // Trim to max
        if items.count > maxItems {
            items = Array(items.prefix(maxItems))
        }

        saveToDisk()
    }

    /// Clear all recently viewed items.
    func clear() {
        items.removeAll()
        saveToDisk()
    }

    var isEmpty: Bool { items.isEmpty }

    // MARK: Persistence

    private func saveToDisk() {
        guard let data = try? JSONEncoder().encode(items) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }

    private func loadFromDisk() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([RecentItem].self, from: data) else { return }
        items = decoded
    }
}
