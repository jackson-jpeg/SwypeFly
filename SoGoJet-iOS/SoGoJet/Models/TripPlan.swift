import Foundation

// MARK: - Trip Plan Request

struct TripPlanRequest: Codable, Sendable {
    let city: String
    let country: String?
    let duration: Int
    let style: TripStyle
    let interests: String?
    let destinationId: String?

    enum TripStyle: String, Codable, CaseIterable, Sendable {
        case budget
        case comfort
        case luxury

        var label: String {
            switch self {
            case .budget:  return "Budget"
            case .comfort: return "Comfort"
            case .luxury:  return "Luxury"
            }
        }

        var icon: String {
            switch self {
            case .budget:  return "dollarsign.circle"
            case .comfort: return "star.circle"
            case .luxury:  return "crown"
            }
        }

        var description: String {
            switch self {
            case .budget:  return "Hostels, street food, free activities"
            case .comfort: return "Mid-range hotels, good restaurants"
            case .luxury:  return "High-end hotels, fine dining, private tours"
            }
        }
    }

    enum CodingKeys: String, CodingKey {
        case city, country, duration, style, interests
        case destinationId = "destination_id"
    }
}
