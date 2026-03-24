import SwiftUI

// MARK: - Deal Tier

enum DealTier: String, Codable, Sendable, CaseIterable {
    case amazing
    case great
    case good
    case fair

    /// The accent colour for this tier.
    var color: Color {
        switch self {
        case .amazing: return .sgDealAmazing
        case .great:   return .sgDealGreat
        case .good:    return .sgDealGood
        case .fair:    return .sgMuted
        }
    }

    /// Human-readable label for badges.
    var label: String {
        switch self {
        case .amazing: return "Amazing Deal"
        case .great:   return "Great Deal"
        case .good:    return "Good Deal"
        case .fair:    return "Fair Price"
        }
    }

    /// SF Symbol name for the tier badge.
    var iconName: String {
        switch self {
        case .amazing: return "flame.fill"
        case .great:   return "star.fill"
        case .good:    return "hand.thumbsup.fill"
        case .fair:    return "equal.circle.fill"
        }
    }
}
