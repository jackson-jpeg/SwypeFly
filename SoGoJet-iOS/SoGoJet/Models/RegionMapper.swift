import Foundation

// MARK: - Region Mapper
// Maps country names to broad travel regions for the passport-stamp UI.

enum RegionMapper {
    static func region(for country: String) -> String {
        let key = country.lowercased().trimmingCharacters(in: .whitespaces)

        // Caribbean & Central America
        let caribbean: Set<String> = [
            "jamaica", "bahamas", "cuba", "dominican republic", "puerto rico",
            "barbados", "trinidad and tobago", "aruba", "curacao", "st. lucia",
            "antigua and barbuda", "grenada", "turks and caicos", "cayman islands",
            "belize", "costa rica", "panama", "guatemala", "honduras", "el salvador",
            "nicaragua", "haiti", "bermuda", "u.s. virgin islands",
        ]
        if caribbean.contains(key) { return "Caribbean" }

        // Europe
        let europe: Set<String> = [
            "spain", "france", "italy", "germany", "united kingdom", "portugal",
            "greece", "netherlands", "belgium", "switzerland", "austria", "ireland",
            "sweden", "norway", "denmark", "finland", "iceland", "poland", "czechia",
            "czech republic", "hungary", "croatia", "turkey", "romania", "bulgaria",
            "serbia", "montenegro", "albania", "north macedonia", "bosnia and herzegovina",
            "slovenia", "slovakia", "estonia", "latvia", "lithuania", "malta", "cyprus",
            "luxembourg", "liechtenstein", "monaco", "andorra", "san marino",
        ]
        if europe.contains(key) { return "Europe" }

        // Asia
        let asia: Set<String> = [
            "japan", "south korea", "china", "taiwan", "hong kong", "thailand",
            "vietnam", "indonesia", "philippines", "malaysia", "singapore",
            "cambodia", "laos", "myanmar", "india", "sri lanka", "nepal",
            "bangladesh", "pakistan", "maldives", "mongolia", "uzbekistan",
            "kazakhstan", "georgia", "armenia", "azerbaijan",
        ]
        if asia.contains(key) { return "Asia" }

        // Middle East
        let middleEast: Set<String> = [
            "united arab emirates", "qatar", "saudi arabia", "oman", "bahrain",
            "kuwait", "jordan", "israel", "lebanon", "iraq", "iran",
        ]
        if middleEast.contains(key) { return "Middle East" }

        // Africa
        let africa: Set<String> = [
            "morocco", "egypt", "south africa", "kenya", "tanzania", "ethiopia",
            "nigeria", "ghana", "senegal", "namibia", "botswana", "zimbabwe",
            "mozambique", "madagascar", "mauritius", "seychelles", "tunisia",
            "algeria", "rwanda", "uganda", "ivory coast", "cameroon",
        ]
        if africa.contains(key) { return "Africa" }

        // South America
        let southAmerica: Set<String> = [
            "brazil", "argentina", "colombia", "peru", "chile", "ecuador",
            "bolivia", "uruguay", "paraguay", "venezuela", "guyana", "suriname",
        ]
        if southAmerica.contains(key) { return "South America" }

        // Oceania
        let oceania: Set<String> = [
            "australia", "new zealand", "fiji", "french polynesia", "samoa",
            "tonga", "vanuatu", "papua new guinea", "palau", "guam",
        ]
        if oceania.contains(key) { return "Oceania" }

        // North America (US, Canada, Mexico)
        let northAmerica: Set<String> = [
            "united states", "canada", "mexico",
        ]
        if northAmerica.contains(key) { return "North America" }

        return "International"
    }
}
