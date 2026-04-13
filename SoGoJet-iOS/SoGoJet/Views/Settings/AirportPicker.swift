import SwiftUI
@preconcurrency import CoreLocation

struct AirportPicker: View {
    @Binding var selectedCode: String
    @Environment(\.dismiss) private var dismiss
    @StateObject private var locator = AirportLocator()

    var dismissOnSelection = true

    @State private var searchText = ""

    private var selectedAirport: Airport? {
        Self.airports.first(where: { $0.code == selectedCode })
    }

    private var filteredAirports: [Airport] {
        let base: [Airport]
        if searchText.isEmpty {
            base = Self.airports
        } else {
            let query = searchText.lowercased()
            base = Self.airports.filter {
                $0.code.lowercased().contains(query)
                    || $0.city.lowercased().contains(query)
                    || $0.name.lowercased().contains(query)
            }
        }
        return base.sorted { $0.city.localizedCaseInsensitiveCompare($1.city) == .orderedAscending }
    }

    private var popularAirports: [Airport] {
        [selectedAirport].compactMap { $0 }
            + Self.airports.filter { ["TPA", "JFK", "LAX", "ORD", "MIA", "SEA"].contains($0.code) && $0.code != selectedCode }
    }

    private var resultsSubtitle: String {
        if searchText.isEmpty {
            return "Browse all airports or tap a quick pick above."
        }

        return "Matching airports for \(searchText)."
    }

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            VStack(spacing: Spacing.md) {
                summaryPanel
                quickActions

                if let error = locator.errorMessage {
                    VintageTerminalInsetPanel(tone: .ember) {
                        Text(error)
                            .font(SGFont.body(size: 12))
                            .foregroundStyle(Color.sgOrange)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.horizontal, Spacing.md)
                }

                resultsPanel
            }
            .padding(.top, Spacing.md)
        }
        .navigationTitle("Departure Airport")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onChange(of: locator.nearestAirport) { _, airport in
            guard let airport else { return }
            selectAirport(airport)
        }
    }

    private var summaryPanel: some View {
        VintageTerminalPanel(
            title: "Departure Gate",
            subtitle: "We'll show deals and prices from this airport.",
            stamp: "Origin",
            tone: .amber
        ) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                HStack(alignment: .top, spacing: Spacing.md) {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        SplitFlapRow(
                            text: selectedAirport?.code ?? selectedCode,
                            maxLength: 3,
                            size: .lg,
                            color: Color.sgWhite,
                            animate: true,
                            staggerMs: 30
                        )

                        Text(selectedAirport?.city ?? "Choose your airport")
                            .font(SGFont.sectionHead)
                            .foregroundStyle(Color.sgWhite)

                        if let airport = selectedAirport {
                            Text(airport.name)
                                .font(SGFont.body(size: 12))
                                .foregroundStyle(Color.sgMuted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    Spacer(minLength: 0)

                    VintageTerminalPassportStamp(
                        title: locator.isLocating ? "Scanning" : "Status",
                        subtitle: locator.isLocating ? "Finding nearest" : "Ready",
                        tone: locator.isLocating ? .moss : .ivory
                    )
                }

                VintageTerminalRouteDisplay(
                    originCode: selectedAirport?.code ?? selectedCode,
                    originLabel: selectedAirport?.city ?? "Departure city",
                    destinationCode: "ALL",
                    destinationLabel: "Feed and booking searches",
                    detail: "All deals and searches will use this as your starting point.",
                    tone: .amber
                )
            }
        }
        .padding(.horizontal, Spacing.md)
    }

    private var quickActions: some View {
        VStack(spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                VintageTerminalActionButton(
                    title: locator.isLocating ? "Detecting" : "Detect My Location",
                    subtitle: locator.isLocating ? "Locating nearest airport" : "Use a nearby airport estimate",
                    icon: locator.isLocating ? "location.circle.fill" : "location.fill",
                    tone: .amber,
                    fillsWidth: true
                ) {
                    locator.detectNearestAirport(from: Self.airports)
                }
                .disabled(locator.isLocating)

                VintageTerminalSecondaryButton(
                    title: "Keep Current",
                    subtitle: selectedAirport?.code ?? selectedCode,
                    icon: "checkmark.circle",
                    tone: .neutral,
                    fillsWidth: true
                ) {}
                .disabled(true)
            }
            .padding(.horizontal, Spacing.md)

            VintageTerminalSearchField(
                prompt: "Search airports or cities",
                text: $searchText,
                tone: .ivory
            )
            .padding(.horizontal, Spacing.md)

            if searchText.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.sm) {
                        ForEach(popularAirports, id: \.code) { airport in
                            VintageTerminalSelectablePill(
                                title: airport.code,
                                isSelected: airport.code == selectedCode,
                                tone: airport.code == selectedCode ? .amber : .ivory
                            ) {
                                selectAirport(airport)
                            }
                        }
                    }
                    .padding(.horizontal, Spacing.md)
                }
            }
        }
    }

    // MARK: - Ticker Results Header
    // When user types, top-3 IATA codes flap into a horizontal ticker row.

    private var tickerResultsHeader: some View {
        let topThree = Array(filteredAirports.prefix(3))
        return Group {
            if !searchText.isEmpty && !topThree.isEmpty {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "text.magnifyingglass")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.sgMuted)

                    ForEach(topThree, id: \.code) { airport in
                        SplitFlapText(
                            text: airport.code,
                            style: .tag,
                            maxLength: 3,
                            animate: true,
                            animationID: airport.code.hashValue
                        )
                        .onTapGesture { selectAirport(airport) }
                    }

                    Spacer(minLength: 0)
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.xs)
                .background(Color.sgSurfaceElevated)
                .overlay(
                    Rectangle()
                        .fill(Color.sgHairline)
                        .frame(height: 0.5),
                    alignment: .bottom
                )
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }

    private var resultsPanel: some View {
        VStack(spacing: 0) {
            // Animated ticker of top-3 matches
            tickerResultsHeader
                .animation(SGSpring.snappy, value: searchText)

            VintageTerminalManifestCard(
                title: searchText.isEmpty ? "All Airports" : "Search Results",
                subtitle: resultsSubtitle,
                tone: .ivory
            ) {
                resultsContent
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.md)
        }
    }

    private var resultsContent: some View {
        Group {
            if filteredAirports.isEmpty {
                VintageTerminalInfoRow(
                    icon: "magnifyingglass",
                    title: "No airport found",
                    value: "Try a city name, IATA code, or a broader search term.",
                    detail: "Examples: Tampa, TPA, New York, Seattle.",
                    tone: .neutral
                )
                .padding(.top, Spacing.sm)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(filteredAirports, id: \.code) { airport in
                            Button {
                                selectAirport(airport)
                            } label: {
                                airportRow(airport)
                            }
                            .buttonStyle(.plain)

                            if airport.code != filteredAirports.last?.code {
                                Divider()
                                    .overlay(Color.sgBorder)
                            }
                        }
                    }
                }
                .scrollDismissesKeyboard(.interactively)
                .frame(minHeight: 220, maxHeight: dismissOnSelection ? .infinity : 320)
            }
        }
    }

    private func airportRow(_ airport: Airport) -> some View {
        HStack(spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text(airport.code)
                    .font(SGFont.display(size: 28))
                    .foregroundStyle(airport.code == selectedCode ? Color.sgYellow : Color.sgWhite)
                Text(airport.city)
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgWhiteDim)
            }
            .frame(width: 84, alignment: .leading)

            Rectangle()
                .fill(Color.sgBorder)
                .frame(width: 1)
                .frame(maxHeight: .infinity)

            VStack(alignment: .leading, spacing: 3) {
                Text(airport.name)
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgWhite)
                    .lineLimit(2)
                Text("Departs from \(airport.city)")
                    .font(SGFont.body(size: 11))
                    .foregroundStyle(Color.sgMuted)
            }

            Spacer(minLength: 0)

            if airport.code == selectedCode {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.sgYellow)
            } else {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.sgFaint)
            }
        }
        .padding(.vertical, Spacing.sm)
        .contentShape(Rectangle())
        .accessibilityLabel("\(airport.code), \(airport.city), \(airport.name)")
        .accessibilityAddTraits(airport.code == selectedCode ? .isSelected : [])
    }

    private func selectAirport(_ airport: Airport) {
        HapticEngine.selection()
        selectedCode = airport.code
        if dismissOnSelection {
            dismiss()
        }
    }

    struct Airport: Hashable {
        let code: String
        let city: String
        let name: String
        let latitude: CLLocationDegrees
        let longitude: CLLocationDegrees
    }

    static let airports: [Airport] = [
        Airport(code: "JFK", city: "New York", name: "John F. Kennedy Intl", latitude: 40.6413, longitude: -73.7781),
        Airport(code: "LGA", city: "New York", name: "LaGuardia Airport", latitude: 40.7769, longitude: -73.8740),
        Airport(code: "LAX", city: "Los Angeles", name: "Los Angeles Intl", latitude: 33.9416, longitude: -118.4085),
        Airport(code: "SNA", city: "Orange County", name: "John Wayne Airport", latitude: 33.6757, longitude: -117.8678),
        Airport(code: "BUR", city: "Burbank", name: "Hollywood Burbank Airport", latitude: 34.2007, longitude: -118.3587),
        Airport(code: "LGB", city: "Long Beach", name: "Long Beach Airport", latitude: 33.8177, longitude: -118.1516),
        Airport(code: "ORD", city: "Chicago", name: "O'Hare Intl", latitude: 41.9742, longitude: -87.9073),
        Airport(code: "MDW", city: "Chicago", name: "Chicago Midway Intl", latitude: 41.7868, longitude: -87.7522),
        Airport(code: "ATL", city: "Atlanta", name: "Hartsfield-Jackson Intl", latitude: 33.6407, longitude: -84.4277),
        Airport(code: "DFW", city: "Dallas", name: "Dallas/Fort Worth Intl", latitude: 32.8998, longitude: -97.0403),
        Airport(code: "DAL", city: "Dallas", name: "Dallas Love Field", latitude: 32.8471, longitude: -96.8517),
        Airport(code: "DEN", city: "Denver", name: "Denver Intl", latitude: 39.8561, longitude: -104.6737),
        Airport(code: "SFO", city: "San Francisco", name: "San Francisco Intl", latitude: 37.6213, longitude: -122.3790),
        Airport(code: "OAK", city: "Oakland", name: "Oakland Intl", latitude: 37.7213, longitude: -122.2210),
        Airport(code: "SJC", city: "San Jose", name: "Norman Y. Mineta San Jose Intl", latitude: 37.3639, longitude: -121.9289),
        Airport(code: "SEA", city: "Seattle", name: "Seattle-Tacoma Intl", latitude: 47.4502, longitude: -122.3088),
        Airport(code: "MIA", city: "Miami", name: "Miami Intl", latitude: 25.7959, longitude: -80.2870),
        Airport(code: "PBI", city: "West Palm Beach", name: "Palm Beach Intl", latitude: 26.6832, longitude: -80.0956),
        Airport(code: "BOS", city: "Boston", name: "Logan Intl", latitude: 42.3656, longitude: -71.0096),
        Airport(code: "PVD", city: "Providence", name: "T. F. Green Intl", latitude: 41.7240, longitude: -71.4282),
        Airport(code: "BDL", city: "Hartford", name: "Bradley Intl", latitude: 41.9389, longitude: -72.6832),
        Airport(code: "TPA", city: "Tampa", name: "Tampa Intl", latitude: 27.9755, longitude: -82.5332),
        Airport(code: "PIE", city: "St. Petersburg", name: "St. Pete-Clearwater Intl", latitude: 27.9102, longitude: -82.6874),
        Airport(code: "SRQ", city: "Sarasota", name: "Sarasota Bradenton Intl", latitude: 27.3954, longitude: -82.5544),
        Airport(code: "MCO", city: "Orlando", name: "Orlando Intl", latitude: 28.4312, longitude: -81.3081),
        Airport(code: "IAH", city: "Houston", name: "George Bush Intercontinental", latitude: 29.9902, longitude: -95.3368),
        Airport(code: "EWR", city: "Newark", name: "Newark Liberty Intl", latitude: 40.6895, longitude: -74.1745),
        Airport(code: "MSP", city: "Minneapolis", name: "Minneapolis-Saint Paul Intl", latitude: 44.8848, longitude: -93.2223),
        Airport(code: "DTW", city: "Detroit", name: "Detroit Metro Wayne County", latitude: 42.2162, longitude: -83.3554),
        Airport(code: "PHL", city: "Philadelphia", name: "Philadelphia Intl", latitude: 39.8744, longitude: -75.2424),
        Airport(code: "CLT", city: "Charlotte", name: "Charlotte Douglas Intl", latitude: 35.2144, longitude: -80.9473),
        Airport(code: "FLL", city: "Fort Lauderdale", name: "Fort Lauderdale-Hollywood Intl", latitude: 26.0726, longitude: -80.1527),
        Airport(code: "SAN", city: "San Diego", name: "San Diego Intl", latitude: 32.7338, longitude: -117.1933),
        Airport(code: "PDX", city: "Portland", name: "Portland Intl", latitude: 45.5898, longitude: -122.5951),
        Airport(code: "STL", city: "St. Louis", name: "St. Louis Lambert Intl", latitude: 38.7487, longitude: -90.3700),
        Airport(code: "BWI", city: "Baltimore", name: "Baltimore/Washington Intl", latitude: 39.1754, longitude: -76.6684),
        Airport(code: "SLC", city: "Salt Lake City", name: "Salt Lake City Intl", latitude: 40.7899, longitude: -111.9791),
        Airport(code: "AUS", city: "Austin", name: "Austin-Bergstrom Intl", latitude: 30.1975, longitude: -97.6664),
        Airport(code: "RDU", city: "Raleigh", name: "Raleigh-Durham Intl", latitude: 35.8801, longitude: -78.7880),
        Airport(code: "BNA", city: "Nashville", name: "Nashville Intl", latitude: 36.1263, longitude: -86.6774),
        Airport(code: "MKE", city: "Milwaukee", name: "Milwaukee Mitchell Intl", latitude: 42.9472, longitude: -87.8966),
        Airport(code: "IND", city: "Indianapolis", name: "Indianapolis Intl", latitude: 39.7173, longitude: -86.2944),
        Airport(code: "CLE", city: "Cleveland", name: "Cleveland Hopkins Intl", latitude: 41.4117, longitude: -81.8498),
    ]
}

@MainActor
private final class AirportLocator: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var isLocating = false
    @Published var errorMessage: String?
    @Published var nearestAirport: AirportPicker.Airport?

    private let manager = CLLocationManager()
    private var airports: [AirportPicker.Airport] = []

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    func detectNearestAirport(from airports: [AirportPicker.Airport]) {
        self.airports = airports
        errorMessage = nil
        nearestAirport = nil
        isLocating = true

        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            manager.requestLocation()
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            isLocating = false
            errorMessage = "Location access is unavailable. Search for your airport instead."
        @unknown default:
            isLocating = false
            errorMessage = "Location detection is currently unavailable."
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            switch status {
            case .authorizedAlways, .authorizedWhenInUse:
                if isLocating {
                    manager.requestLocation()
                }
            case .denied, .restricted:
                isLocating = false
                errorMessage = "Location access is unavailable. Search for your airport instead."
            default:
                break
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let latestLocation = locations.last
        Task { @MainActor in
            guard let location = latestLocation else {
                isLocating = false
                errorMessage = "We couldn't determine your location."
                return
            }

            nearestAirport = airports.min { lhs, rhs in
                let lhsDistance = location.distance(
                    from: CLLocation(latitude: lhs.latitude, longitude: lhs.longitude)
                )
                let rhsDistance = location.distance(
                    from: CLLocation(latitude: rhs.latitude, longitude: rhs.longitude)
                )
                return lhsDistance < rhsDistance
            }

            isLocating = false
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            isLocating = false
            errorMessage = "We couldn't determine your location just now."
        }
    }
}

#Preview("Airport Picker") {
    NavigationStack {
        AirportPicker(selectedCode: .constant("JFK"))
    }
}
