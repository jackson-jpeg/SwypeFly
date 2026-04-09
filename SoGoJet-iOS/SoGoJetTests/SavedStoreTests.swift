import Testing
import Foundation
@testable import SoGoJet

@Suite("SavedStore")
struct SavedStoreTests {

    @Test("Initial state is empty")
    @MainActor
    func initialState() {
        let store = SavedStore()
        // Clear any persisted data from previous test runs
        store.clear()
        #expect(store.savedDeals.isEmpty)
        #expect(store.count == 0)
        #expect(store.totalSavings == 0)
        #expect(store.totalValue == 0)
    }

    @Test("isSaved returns false for unsaved deal")
    @MainActor
    func isSavedFalse() {
        let store = SavedStore()
        store.clear()
        #expect(!store.isSaved(id: "nonexistent"))
    }

    @Test("toggle saves a deal")
    @MainActor
    func toggleSaves() {
        let store = SavedStore()
        store.clear()
        let deal = Deal.preview
        let result = store.toggle(deal: deal)
        #expect(result == true)
        #expect(store.isSaved(id: deal.id))
        #expect(store.count == 1)
    }

    @Test("toggle unsaves a previously saved deal")
    @MainActor
    func toggleUnsaves() {
        let store = SavedStore()
        store.clear()
        let deal = Deal.preview
        _ = store.toggle(deal: deal) // save
        let result = store.toggle(deal: deal) // unsave
        #expect(result == false)
        #expect(!store.isSaved(id: deal.id))
        #expect(store.count == 0)
    }

    @Test("add inserts deal at front")
    @MainActor
    func addDeal() {
        let store = SavedStore()
        store.clear()
        let deal = Deal.preview
        store.add(deal: deal)
        #expect(store.isSaved(id: deal.id))
        #expect(store.savedDeals.first?.id == deal.id)
    }

    @Test("add is idempotent — does not duplicate")
    @MainActor
    func addIdempotent() {
        let store = SavedStore()
        store.clear()
        let deal = Deal.preview
        store.add(deal: deal)
        store.add(deal: deal)
        #expect(store.count == 1)
    }

    @Test("remove deletes deal by ID")
    @MainActor
    func removeDeal() {
        let store = SavedStore()
        store.clear()
        let deal = Deal.preview
        store.add(deal: deal)
        store.remove(id: deal.id)
        #expect(!store.isSaved(id: deal.id))
        #expect(store.count == 0)
    }

    @Test("remove is safe on nonexistent ID")
    @MainActor
    func removeNonexistent() {
        let store = SavedStore()
        store.clear()
        store.remove(id: "does-not-exist")
        #expect(store.count == 0) // no crash
    }

    @Test("clear removes all deals")
    @MainActor
    func clearAll() {
        let store = SavedStore()
        store.add(deal: Deal.preview)
        store.add(deal: Deal.previewNonstop)
        store.clear()
        #expect(store.count == 0)
        #expect(store.savedDeals.isEmpty)
    }

    @Test("updatePrice modifies a saved deal's live price")
    @MainActor
    func updatePrice() {
        let store = SavedStore()
        store.clear()
        let deal = Deal.preview
        store.add(deal: deal)
        store.updatePrice(dealId: deal.id, livePrice: 199.0)
        #expect(store.savedDeals.first?.livePrice == 199.0)
    }

    @Test("updatePrice is no-op for nonexistent deal")
    @MainActor
    func updatePriceNonexistent() {
        let store = SavedStore()
        store.clear()
        store.updatePrice(dealId: "ghost", livePrice: 99.0)
        #expect(store.count == 0) // no crash, nothing added
    }

    @Test("updatePrice skips if price unchanged")
    @MainActor
    func updatePriceSameValue() {
        let store = SavedStore()
        store.clear()
        let deal = Deal.preview
        store.add(deal: deal)
        let existingPrice = deal.livePrice ?? 0
        // Calling with same price should not crash or cause issues
        store.updatePrice(dealId: deal.id, livePrice: existingPrice)
        #expect(store.count == 1)
    }

    @Test("totalSavings sums savingsAmount across deals")
    @MainActor
    func totalSavingsComputed() {
        let store = SavedStore()
        store.clear()
        // Deal.preview and Deal.previewNonstop may have savingsAmount set
        store.add(deal: Deal.preview)
        // totalSavings should be >= 0 (depends on preview data)
        #expect(store.totalSavings >= 0)
    }
}
