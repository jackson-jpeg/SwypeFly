import Foundation
import Observation

// MARK: - Saved Store
// Persists saved deals to UserDefaults as JSON.

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
            return false
        } else {
            savedDeals.insert(deal, at: 0)
            saveToDisk()
            HapticEngine.success()
            return true
        }
    }

    /// Remove all saved deals.
    func clear() {
        savedDeals.removeAll()
        saveToDisk()
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
    }
}
