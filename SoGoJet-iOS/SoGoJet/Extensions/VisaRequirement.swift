import SwiftUI

// MARK: - Visa Requirement for US Citizens

/// Visa status categories for US passport holders.
/// This is a helpful travel indicator, not legal advice.
enum VisaStatus {
    case visaFree
    case visaOnArrival
    case visaRequired
    case unknown

    var label: String {
        switch self {
        case .visaFree:      return "Visa-free for US citizens"
        case .visaOnArrival: return "Visa on arrival"
        case .visaRequired:  return "Visa required — apply before travel"
        case .unknown:       return ""
        }
    }

    var icon: String {
        switch self {
        case .visaFree:      return "checkmark.shield.fill"
        case .visaOnArrival: return "shield.fill"
        case .visaRequired:  return "shield.slash.fill"
        case .unknown:       return ""
        }
    }

    var color: Color {
        switch self {
        case .visaFree:      return Color.sgDealAmazing
        case .visaOnArrival: return Color.sgYellow
        case .visaRequired:  return Color.sgRed
        case .unknown:       return Color.sgMuted
        }
    }
}

// MARK: - Country Lookup

enum VisaRequirement {

    /// Returns the visa status for a US citizen traveling to the given country.
    static func status(for country: String) -> VisaStatus {
        let key = country.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if visaFreeCountries.contains(key) { return .visaFree }
        if visaOnArrivalCountries.contains(key) { return .visaOnArrival }
        if visaRequiredCountries.contains(key) { return .visaRequired }
        return .unknown
    }

    // MARK: - Visa-free (90+ countries)

    private static let visaFreeCountries: Set<String> = [
        // Europe — Schengen & EU
        "austria", "belgium", "croatia", "czech republic", "czechia",
        "denmark", "estonia", "finland", "france", "germany",
        "greece", "hungary", "iceland", "ireland", "italy",
        "latvia", "lithuania", "luxembourg", "malta", "netherlands",
        "norway", "poland", "portugal", "romania", "slovakia",
        "slovenia", "spain", "sweden", "switzerland",
        // Europe — non-Schengen
        "united kingdom", "uk", "england", "scotland", "wales",
        "albania", "andorra", "bosnia and herzegovina", "bulgaria",
        "cyprus", "georgia", "kosovo", "liechtenstein", "monaco",
        "montenegro", "north macedonia", "san marino", "serbia",
        "vatican city",
        // Americas
        "canada", "mexico", "bahamas", "barbados", "belize",
        "bermuda", "british virgin islands", "cayman islands",
        "chile", "colombia", "costa rica", "dominica",
        "dominican republic", "ecuador", "el salvador",
        "grenada", "guatemala", "haiti", "honduras", "jamaica",
        "nicaragua", "panama", "paraguay", "peru",
        "saint kitts and nevis", "saint lucia",
        "saint vincent and the grenadines",
        "trinidad and tobago", "turks and caicos",
        "turks and caicos islands", "uruguay",
        "aruba", "curacao",
        // Asia-Pacific
        "japan", "south korea", "taiwan", "hong kong", "macau",
        "singapore", "malaysia", "philippines", "brunei",
        "mongolia", "israel",
        // Oceania
        "australia", "new zealand", "fiji", "guam",
        "french polynesia", "tahiti",
        // Caribbean & Atlantic
        "antigua and barbuda", "puerto rico",
        "us virgin islands", "usvi",
        // Africa
        "morocco", "tunisia", "south africa", "botswana",
        "mauritius", "namibia",
    ]

    // MARK: - Visa on arrival

    private static let visaOnArrivalCountries: Set<String> = [
        "turkey", "turkiye",
        "cambodia", "laos", "nepal", "bangladesh", "maldives",
        "jordan", "egypt", "ethiopia", "kenya", "tanzania",
        "uganda", "rwanda", "madagascar", "mozambique",
        "seychelles", "comoros", "cape verde",
        "indonesia", "bali",
        "qatar", "bahrain", "oman",
        "bolivia", "suriname",
        "samoa", "tonga", "tuvalu", "palau",
        "timor-leste", "east timor",
        "zimbabwe", "zambia",
    ]

    // MARK: - Visa required (apply in advance)

    private static let visaRequiredCountries: Set<String> = [
        "china", "russia", "india", "vietnam",
        "brazil", "argentina",
        "saudi arabia", "iran", "iraq",
        "nigeria", "ghana", "cameroon", "congo",
        "democratic republic of the congo",
        "cuba", "north korea", "venezuela",
        "pakistan", "afghanistan", "syria", "yemen", "libya",
        "myanmar", "burma",
        "angola", "chad", "mali", "niger", "sudan", "south sudan",
        "algeria", "eritrea", "central african republic",
        "equatorial guinea", "libya",
        "turkmenistan", "uzbekistan", "tajikistan",
        "thailand",
    ]
}
