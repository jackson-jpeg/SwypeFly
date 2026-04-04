import Foundation

// MARK: - Airport Graph
// Centralized nearby airport lookup. Eliminates duplicated dictionaries in FeedView and DepartureBoardView.

enum AirportGraph {
    private static let nearby: [String: [String]] = [
        "JFK": ["EWR", "LGA", "PHL"],
        "EWR": ["JFK", "LGA", "PHL"],
        "LGA": ["JFK", "EWR", "PHL"],
        "LAX": ["SNA", "BUR", "LGB"],
        "SNA": ["LAX", "BUR", "LGB"],
        "BUR": ["LAX", "SNA", "LGB"],
        "LGB": ["LAX", "SNA", "BUR"],
        "SFO": ["OAK", "SJC"],
        "OAK": ["SFO", "SJC"],
        "SJC": ["SFO", "OAK"],
        "ORD": ["MDW"],
        "MDW": ["ORD"],
        "MIA": ["FLL", "PBI"],
        "FLL": ["MIA", "PBI"],
        "PBI": ["MIA", "FLL"],
        "TPA": ["PIE", "SRQ", "MCO", "FLL"],
        "MCO": ["TPA", "SFB"],
        "ATL": ["CLT"],
        "CLT": ["ATL", "RDU"],
        "DFW": ["DAL", "IAH"],
        "DAL": ["DFW", "IAH"],
        "IAH": ["DFW", "DAL"],
        "SEA": ["PDX"],
        "PDX": ["SEA"],
        "BOS": ["PVD", "BDL"],
        "PVD": ["BOS", "BDL"],
        "BDL": ["BOS", "PVD"],
        "IAD": ["DCA", "BWI"],
        "DCA": ["IAD", "BWI"],
        "BWI": ["IAD", "DCA"],
        "PHL": ["JFK", "EWR"],
        "DTW": ["CLE"],
        "CLE": ["DTW"],
        "MSP": ["RST"],
        "DEN": ["COS"],
        "PHX": ["TUS"],
        "SAN": ["LAX"],
    ]

    private static let defaultFallback = ["JFK", "LAX", "ORD"]

    /// Returns nearby airports for the given IATA code, or a sensible fallback.
    static func nearbyAirports(for code: String) -> [String] {
        nearby[code.uppercased()] ?? defaultFallback
    }
}
