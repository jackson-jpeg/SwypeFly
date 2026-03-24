import Foundation
import Observation

// MARK: - Feed Store

@Observable
final class FeedStore {
    // MARK: State
    var deals: [Deal] = []
    var page: Int = 1
    var isLoading: Bool = false
    var hasMore: Bool = true
    var error: String?

    // MARK: Filters
    var selectedVibes: [String] = []
    var origin: String = "JFK"

    // MARK: Derived
    var isEmpty: Bool { deals.isEmpty && !isLoading }

    // MARK: Actions

    /// Fetch the first page of deals (replaces current list).
    func fetchDeals(origin: String? = nil) async {
        if let origin { self.origin = origin }
        page = 1
        hasMore = true
        isLoading = true
        error = nil

        do {
            let response: FeedResponse = try await APIClient.shared.fetch(
                .feed(origin: self.origin, page: 1, vibes: selectedVibes)
            )
            deals = response.destinations
            hasMore = response.hasMore
            page = response.page
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Fetch the next page and append to existing deals.
    func fetchMore() async {
        guard !isLoading, hasMore else { return }
        isLoading = true
        error = nil

        let nextPage = page + 1

        do {
            let response: FeedResponse = try await APIClient.shared.fetch(
                .feed(origin: origin, page: nextPage, vibes: selectedVibes)
            )
            deals.append(contentsOf: response.destinations)
            hasMore = response.hasMore
            page = response.page
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Toggle a vibe filter and refresh from page 1.
    func toggleVibe(_ vibe: String) async {
        if let idx = selectedVibes.firstIndex(of: vibe) {
            selectedVibes.remove(at: idx)
        } else {
            selectedVibes.append(vibe)
        }
        await fetchDeals()
    }

    /// Clear all filters and refresh.
    func clearFilters() async {
        selectedVibes.removeAll()
        await fetchDeals()
    }

    /// Record a swipe action (fire-and-forget).
    func recordSwipe(dealId: String, action: String) {
        Task {
            let _: EmptyResponse? = try? await APIClient.shared.fetch(
                .swipe(dealId: dealId, action: action)
            )
        }
    }
}

// MARK: - Empty Response (for fire-and-forget POST endpoints)

private struct EmptyResponse: Codable {}
