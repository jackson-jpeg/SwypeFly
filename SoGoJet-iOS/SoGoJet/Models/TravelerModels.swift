import Foundation

// MARK: - Saved Traveler

struct SavedTraveler: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var givenName: String
    var familyName: String
    var bornOn: String?
    var gender: String?
    var title: String?
    var email: String?
    var phoneNumber: String?
    var passportNumber: String?
    var passportExpiry: String?
    var nationality: String
    var isPrimary: Bool

    var fullName: String {
        [givenName, familyName].filter { !$0.isEmpty }.joined(separator: " ")
    }

    /// Masked passport for display (e.g. "****5678").
    var maskedPassport: String? {
        guard let pp = passportNumber, !pp.isEmpty else { return nil }
        let visible = String(pp.suffix(4))
        let masked = String(repeating: "*", count: max(pp.count - 4, 0))
        return masked + visible
    }
}

struct TravelerListResponse: Codable, Sendable {
    let travelers: [SavedTraveler]
}

struct TravelerSingleResponse: Codable, Sendable {
    let traveler: SavedTraveler
}
