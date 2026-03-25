import Foundation

enum Airlines {
    static let names: [String: String] = [
        "2B": "Albawings", "4O": "Interjet", "5J": "Cebu Pacific",
        "6E": "IndiGo", "7C": "Jeju Air", "8M": "Myanmar Airways",
        "9W": "Jet Airways", "AA": "American", "AC": "Air Canada",
        "AF": "Air France", "AI": "Air India", "AM": "Aeromexico",
        "AR": "Aerolineas Argentinas", "AS": "Alaska", "AT": "Royal Air Maroc",
        "AV": "Avianca", "AY": "Finnair", "AZ": "ITA Airways",
        "B6": "JetBlue", "BA": "British Airways", "BR": "EVA Air",
        "CA": "Air China", "CI": "China Airlines", "CM": "Copa Airlines",
        "CO": "Copa Airlines", "CX": "Cathay Pacific", "CZ": "China Southern",
        "DE": "Condor", "DL": "Delta", "DY": "Norwegian",
        "EI": "Aer Lingus", "EK": "Emirates", "ET": "Ethiopian",
        "EV": "ExpressJet", "EW": "Eurowings", "EY": "Etihad",
        "F8": "Flair", "F9": "Frontier", "FI": "Icelandair",
        "FJ": "Fiji Airways", "FR": "Ryanair", "G4": "Allegiant",
        "GA": "Garuda Indonesia", "GF": "Gulf Air", "HA": "Hawaiian",
        "HU": "Hainan Airlines", "IB": "Iberia", "JL": "Japan Airlines",
        "JQ": "Jetstar", "KE": "Korean Air", "KL": "KLM",
        "KQ": "Kenya Airways", "LA": "LATAM", "LH": "Lufthansa",
        "LO": "LOT Polish", "LU": "LAN Express", "LX": "Swiss",
        "MH": "Malaysia Airlines", "MS": "EgyptAir", "MU": "China Eastern",
        "NH": "ANA", "NK": "Spirit", "NZ": "Air New Zealand",
        "OK": "Czech Airlines", "OS": "Austrian", "OZ": "Asiana",
        "PC": "Pegasus", "PG": "Bangkok Airways", "PR": "Philippine Airlines",
        "PS": "UIA", "QF": "Qantas", "QR": "Qatar Airways",
        "RO": "TAROM", "SA": "South African", "SK": "SAS",
        "SN": "Brussels Airlines", "SQ": "Singapore Airlines", "SU": "Aeroflot",
        "SV": "Saudia", "TG": "Thai Airways", "TK": "Turkish Airlines",
        "TN": "Air Tahiti Nui", "TP": "TAP Portugal", "TU": "Tunisair",
        "UA": "United", "UL": "SriLankan", "UX": "Air Europa",
        "VA": "Virgin Australia", "VB": "VivaAerobus", "VN": "Vietnam Airlines",
        "VS": "Virgin Atlantic", "VY": "Vueling", "W6": "Wizz Air",
        "WN": "Southwest", "WS": "WestJet", "XP": "Xtra Airways",
        "Y4": "Volaris",
    ]

    static func name(for code: String?) -> String? {
        guard let code, !code.isEmpty else { return nil }
        return names[code.uppercased()]
    }
}
