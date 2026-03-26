import Foundation
import Observation
import CoreSpotlight
import MobileCoreServices

// MARK: - Saved Store
// Persists saved deals to UserDefaults as JSON.
// Indexes saved destinations in Spotlight for search.

@MainActor
@Observable
final class SavedStore {
    // MARK: State
    var savedDeals: [Deal] = []

    private let storageKey = "sg_saved_deals"

    init() {
        loadFromDisk()
    }

    // MARK: Computed

    /// Total savings across all saved deals that have a savingsAmount.
    var totalSavings: Double {
        savedDeals.compactMap(\.savingsAmount).reduce(0, +)
    }

    /// Total value (sum of prices) of all saved deals.
    var totalValue: Double {
        savedDeals.filter(\.hasPrice).compactMap(\.displayPrice).reduce(0, +)
    }

    var count: Int { savedDeals.count }

    // MARK: Actions

    /// Check if a deal is saved.
    func isSaved(id: String) -> Bool {
        savedDeals.contains { $0.id == id }
    }

    /// Toggle save state for a deal. Returns the new saved state.
    @discardableResult
    func toggle(deal: Deal) -> Bool {
        if let idx = savedDeals.firstIndex(where: { $0.id == deal.id }) {
            savedDeals.remove(at: idx)
            saveToDisk()
            deindexFromSpotlight(deal.id)
            return false
        } else {
            savedDeals.insert(deal, at: 0)
            saveToDisk()
            indexInSpotlight(deal)
            HapticEngine.success()
            ReviewPrompter.shared.recordSave(totalSavedCount: savedDeals.count)
            return true
        }
    }

    /// Add a deal back (used by undo).
    func add(deal: Deal) {
        guard !savedDeals.contains(where: { $0.id == deal.id }) else { return }
        savedDeals.insert(deal, at: 0)
        saveToDisk()
        indexInSpotlight(deal)
    }

    /// Remove a specific deal by ID.
    func remove(id: String) {
        savedDeals.removeAll { $0.id == id }
        saveToDisk()
        deindexFromSpotlight(id)
    }

    /// Remove all saved deals.
    func clear() {
        savedDeals.removeAll()
        saveToDisk()
        CSSearchableIndex.default().deleteSearchableItems(
            withDomainIdentifiers: ["com.sogojet.saved-deals"]
        )
    }

    // MARK: Persistence

    private func saveToDisk() {
        guard let data = try? JSONEncoder().encode(savedDeals) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }

    private func loadFromDisk() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let deals = try? JSONDecoder().decode([Deal].self, from: data) else { return }
        savedDeals = deals
        // Sync Spotlight index with persisted data
        reindexSpotlight()
    }

    // MARK: Spotlight Search

    /// Index a single saved deal in Spotlight so it appears in iOS search.
    private func indexInSpotlight(_ deal: Deal) {
        let attributes = CSSearchableItemAttributeSet(contentType: .content)
        attributes.title = "\(deal.city), \(deal.country)"
        attributes.contentDescription = buildSpotlightDescription(deal)
        attributes.keywords = deal.safeVibeTags + [deal.city, deal.country, "flight", "travel", "SoGoJet"]

        // Thumbnail URL for Spotlight
        if let urlStr = deal.imageUrl, let url = URL(string: urlStr) {
            attributes.thumbnailURL = url
        }

        let item = CSSearchableItem(
            uniqueIdentifier: "sogojet-deal-\(deal.id)",
            domainIdentifier: "com.sogojet.saved-deals",
            attributeSet: attributes
        )
        // Keep in index for 30 days
        item.expirationDate = Date().addingTimeInterval(30 * 24 * 60 * 60)

        CSSearchableIndex.default().indexSearchableItems([item])
    }

    /// Remove a deal from Spotlight when unsaved.
    private func deindexFromSpotlight(_ dealId: String) {
        CSSearchableIndex.default().deleteSearchableItems(
            withIdentifiers: ["sogojet-deal-\(dealId)"]
        )
    }

    /// Re-index all saved deals (called on app launch).
    private func reindexSpotlight() {
        // Clear stale entries
        CSSearchableIndex.default().deleteSearchableItems(
            withDomainIdentifiers: ["com.sogojet.saved-deals"]
        ) { [weak self] _ in
            // Re-add current saved deals
            Task { @MainActor in
                self?.savedDeals.forEach { deal in
                    self?.indexInSpotlight(deal)
                }
            }
        }
    }

    private func buildSpotlightDescription(_ deal: Deal) -> String {
        var parts: [String] = []
        if deal.hasPrice {
            parts.append(deal.isEstimatedPrice ? "Flights from \(deal.priceFormatted)" : "Flights \(deal.priceFormatted)")
        }
        if deal.airlineName != "—" { parts.append(deal.airlineName) }
        if let duration = deal.flightDuration, !duration.isEmpty { parts.append(duration) }
        if !deal.safeVibeTags.isEmpty {
            parts.append(deal.safeVibeTags.prefix(3).joined(separator: ", "))
        }
        return parts.joined(separator: " · ")
    }
}
