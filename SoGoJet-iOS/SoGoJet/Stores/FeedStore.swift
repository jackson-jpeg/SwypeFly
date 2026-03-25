import Foundation
import Observation

// MARK: - Feed Store

@MainActor
@Observable
final class FeedStore {
    // MARK: State
    private var loadedDeals: [Deal] = []
    var page: Int = 0
    var isLoading: Bool = false
    var hasMore: Bool = true
    var error: String?
    private var activeOrigin: String?
    private var activeRequestID = UUID()
    private(set) var lastFetchDate: Date?

    /// How long before data is considered stale (seconds).
    static let stalenessThreshold: TimeInterval = 300 // 5 minutes

    /// Whether the current data is stale and should be refreshed.
    var isStale: Bool {
        guard let lastFetch = lastFetchDate else { return true }
        return Date().timeIntervalSince(lastFetch) > Self.stalenessThreshold
    }

    // MARK: Filters
    var selectedPrices: [String] = []
    var selectedVibes: [String] = []
    var selectedRegions: [String] = []

    // MARK: Derived
    var deals: [Deal] {
        loadedDeals.filter(matchesActiveFilters)
    }

    var allDeals: [Deal] {
        loadedDeals
    }

    var hasActiveFilters: Bool {
        !selectedPrices.isEmpty || !selectedVibes.isEmpty || !selectedRegions.isEmpty
    }

    var activeFilterCount: Int {
        selectedPrices.count + selectedVibes.count + selectedRegions.count
    }

    var isEmpty: Bool { deals.isEmpty && !isLoading }

    // MARK: Actions

    /// Fetch the first page of deals (replaces current list).
    func fetchDeals(origin: String) async {
        let requestID = UUID()
        activeRequestID = requestID
        activeOrigin = origin
        hasMore = true
        isLoading = true
        error = nil
        page = 0

        do {
            let response: FeedResponse = try await APIClient.shared.fetch(
                .feed(origin: origin, page: 1, vibes: selectedVibes, search: nil)
            )
            guard activeRequestID == requestID, activeOrigin == origin else { return }
            loadedDeals = deduplicatedDeals(response.destinations)
            hasMore = response.nextCursor != nil
            page = 1
            lastFetchDate = Date()

            do {
                try await expandFilteredResultsIfNeeded(origin: origin, requestID: requestID)
            } catch {
                guard activeRequestID == requestID, activeOrigin == origin else { return }
                if deals.isEmpty {
                    self.error = userFacingMessage(for: error)
                }
            }
        } catch {
            guard activeRequestID == requestID, activeOrigin == origin else { return }
            #if DEBUG
            print("❌ [FeedStore] fetchDeals failed: \(error)")
            #endif
            self.error = userFacingMessage(for: error)
        }

        guard activeRequestID == requestID, activeOrigin == origin else { return }
        isLoading = false
    }

    /// Fetch the next page and append to existing deals.
    func fetchMore(origin: String) async {
        guard !isLoading, hasMore else { return }
        guard activeOrigin == nil || activeOrigin == origin else { return }
        isLoading = true
        error = nil

        let requestID = activeRequestID
        let nextPage = page + 1

        do {
            let response: FeedResponse = try await APIClient.shared.fetch(
                .feed(origin: origin, page: nextPage, vibes: selectedVibes, search: nil)
            )
            guard activeRequestID == requestID, activeOrigin == origin else { return }
            loadedDeals = mergeDeals(existing: loadedDeals, incoming: response.destinations)
            hasMore = response.nextCursor != nil
            page = nextPage

            do {
                try await expandFilteredResultsIfNeeded(
                    origin: origin,
                    requestID: requestID,
                    maxAdditionalPages: 2
                )
            } catch {
                guard activeRequestID == requestID, activeOrigin == origin else { return }
                if deals.isEmpty {
                    self.error = userFacingMessage(for: error)
                }
            }
        } catch {
            guard activeRequestID == requestID, activeOrigin == origin else { return }
            self.error = userFacingMessage(for: error)
        }

        guard activeRequestID == requestID, activeOrigin == origin else { return }
        isLoading = false
    }

    /// Toggle a vibe filter and refresh from page 1.
    func toggleVibe(_ vibe: String, origin: String) async {
        if let idx = selectedVibes.firstIndex(of: vibe) {
            selectedVibes.remove(at: idx)
        } else {
            selectedVibes.append(vibe)
        }
        await fetchDeals(origin: origin)
    }

    /// Clear all filters and refresh.
    func clearFilters(origin: String) async {
        selectedPrices.removeAll()
        selectedVibes.removeAll()
        selectedRegions.removeAll()
        await fetchDeals(origin: origin)
    }

    /// Update local price and region filters without re-fetching.
    func applyLocalFilters(prices: [String], regions: [String]) {
        selectedPrices = prices
        selectedRegions = regions
    }

    /// Refresh the feed only if data is stale (e.g., returning from background).
    func refreshIfStale(origin: String) async {
        guard isStale, !isLoading else { return }
        await fetchDeals(origin: origin)
    }

    /// Record a swipe action (fire-and-forget).
    func recordSwipe(dealId: String, action: String) {
        Task {
            let _: EmptyResponse? = try? await APIClient.shared.fetch(
                .swipe(dealId: dealId, action: action)
            )
        }
    }

    private func matchesActiveFilters(_ deal: Deal) -> Bool {
        matchesPriceFilter(deal) && matchesRegionFilter(deal)
    }

    private func matchesPriceFilter(_ deal: Deal) -> Bool {
        guard !selectedPrices.isEmpty else { return true }
        guard let price = deal.displayPrice else { return false }

        return selectedPrices.contains { range in
            switch range {
            case "Under $200":
                return price < 200
            case "$200-400":
                return price >= 200 && price <= 400
            case "$400-600":
                return price > 400 && price <= 600
            case "$600+":
                return price > 600
            default:
                return true
            }
        }
    }

    private func matchesRegionFilter(_ deal: Deal) -> Bool {
        guard !selectedRegions.isEmpty else { return true }
        guard let region = Self.region(for: deal.country) else { return false }
        return selectedRegions.contains(region)
    }

    private var shouldExpandFilteredResults: Bool {
        hasActiveFilters && deals.isEmpty && hasMore
    }

    private func expandFilteredResultsIfNeeded(
        origin: String,
        requestID: UUID,
        maxAdditionalPages: Int = 3
    ) async throws {
        guard shouldExpandFilteredResults else { return }

        var additionalPagesLoaded = 0
        while shouldExpandFilteredResults,
              additionalPagesLoaded < maxAdditionalPages,
              activeRequestID == requestID,
              activeOrigin == origin {
            let nextPage = page + 1
            let response: FeedResponse = try await APIClient.shared.fetch(
                .feed(origin: origin, page: nextPage, vibes: selectedVibes, search: nil)
            )

            guard activeRequestID == requestID, activeOrigin == origin else { return }
            loadedDeals = mergeDeals(existing: loadedDeals, incoming: response.destinations)
            hasMore = response.nextCursor != nil
            page = nextPage
            additionalPagesLoaded += 1
        }
    }

    private func deduplicatedDeals(_ deals: [Deal]) -> [Deal] {
        mergeDeals(existing: [], incoming: deals)
    }

    private func mergeDeals(existing: [Deal], incoming: [Deal]) -> [Deal] {
        var merged = existing
        var indexByID = Dictionary(uniqueKeysWithValues: merged.enumerated().map { ($1.id, $0) })

        for deal in incoming {
            if let existingIndex = indexByID[deal.id] {
                merged[existingIndex] = deal
            } else {
                indexByID[deal.id] = merged.count
                merged.append(deal)
            }
        }

        return merged
    }

    /// Convert any error into a user-friendly message.
    private func userFacingMessage(for error: Error) -> String {
        // APIError already has user-friendly messages via errorDescription
        if let apiError = error as? APIError {
            return apiError.localizedDescription
        }

        // URLError — network/connectivity issues
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost:
                return "No internet connection. Check your Wi-Fi or cellular data and try again."
            case .timedOut:
                return "The request timed out. Please try again."
            case .cannotFindHost, .cannotConnectToHost:
                return "Couldn't connect to the server. Please try again later."
            default:
                return "A network error occurred. Please try again."
            }
        }

        // CancellationError — user or system cancelled, no message needed
        if error is CancellationError {
            return "Request was cancelled."
        }

        return "Something went wrong. Please try again."
    }

    static func region(for country: String) -> String? {
        switch country.lowercased() {
        case "spain", "france", "italy", "greece", "portugal", "united kingdom",
             "ireland", "netherlands", "germany", "switzerland", "croatia":
            return "Europe"
        case "japan", "thailand", "indonesia", "singapore", "vietnam", "south korea",
             "malaysia", "philippines", "india":
            return "Asia"
        case "mexico", "jamaica", "dominican republic", "bahamas", "aruba",
             "puerto rico", "turks and caicos", "barbados", "saint lucia":
            return "Caribbean"
        case "colombia", "brazil", "argentina", "peru", "chile", "ecuador":
            return "South America"
        case "morocco", "south africa", "kenya", "tanzania", "egypt":
            return "Africa"
        case "united arab emirates", "qatar", "israel", "jordan", "turkey":
            return "Middle East"
        default:
            return nil
        }
    }
}

// MARK: - Empty Response (for fire-and-forget POST endpoints)

private struct EmptyResponse: Codable {}
