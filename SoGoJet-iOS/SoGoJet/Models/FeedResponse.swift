import Foundation

// MARK: - Feed Response
// Wrapper for the paginated /api/feed response.

struct FeedResponse: Codable, Sendable {
    let destinations: [Deal]
    let page: Int
    let hasMore: Bool
}
