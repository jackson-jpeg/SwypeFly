import Foundation

// MARK: - Price Alert

struct PriceAlert: Codable, Sendable, Identifiable {
    let id: String
    let destinationId: String
    let targetPrice: Int
    let isActive: Bool
    let createdAt: String
    let triggeredAt: String?
    let triggeredPrice: Double?
}

struct PriceAlertListResponse: Codable, Sendable {
    let alerts: [PriceAlert]
    let total: Int
}

struct PriceAlertDeleteResponse: Codable, Sendable {
    let deleted: Bool
    let alertId: String
}
