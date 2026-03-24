import SwiftUI

// MARK: - Airport Picker
// Searchable list of top 30 US airports with IATA code and city name.

struct AirportPicker: View {
    @Binding var selectedCode: String
    @Environment(\.dismiss) private var dismiss

    @State private var searchText = ""

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            VStack(spacing: 0) {
                // Search field
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(Color.sgMuted)
                    TextField("Search airports", text: $searchText)
                        .font(SGFont.bodyDefault)
                        .foregroundStyle(Color.sgWhite)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.characters)
                }
                .padding(Spacing.sm + Spacing.xs)
                .background(Color.sgCell)
                .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
                .padding(.horizontal, Spacing.md)
                .padding(.top, Spacing.md)
                .padding(.bottom, Spacing.sm)

                // Airport list
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(filteredAirports, id: \.code) { airport in
                            Button {
                                HapticEngine.selection()
                                selectedCode = airport.code
                                dismiss()
                            } label: {
                                airportRow(airport)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Departure Airport")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }

    // MARK: - Row

    private func airportRow(_ airport: Airport) -> some View {
        HStack(spacing: Spacing.md) {
            // IATA code in display font
            Text(airport.code)
                .font(SGFont.display(size: 24))
                .foregroundStyle(Color.sgYellow)
                .frame(width: 56, alignment: .leading)

            // City name
            VStack(alignment: .leading, spacing: 2) {
                Text(airport.city)
                    .font(SGFont.bodyBold(size: 15))
                    .foregroundStyle(Color.sgWhite)
                Text(airport.name)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
                    .lineLimit(1)
            }

            Spacer()

            // Checkmark for selected
            if airport.code == selectedCode {
                Image(systemName: "checkmark")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.sgYellow)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm + Spacing.xs)
        .background(Color.sgBg)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.sgBorder)
                .frame(height: 0.5)
        }
    }

    // MARK: - Data

    private var filteredAirports: [Airport] {
        if searchText.isEmpty { return Self.airports }
        let query = searchText.lowercased()
        return Self.airports.filter {
            $0.code.lowercased().contains(query) ||
            $0.city.lowercased().contains(query) ||
            $0.name.lowercased().contains(query)
        }
    }

    // MARK: - Airport Model

    struct Airport {
        let code: String
        let city: String
        let name: String
    }

    static let airports: [Airport] = [
        Airport(code: "JFK", city: "New York", name: "John F. Kennedy Intl"),
        Airport(code: "LAX", city: "Los Angeles", name: "Los Angeles Intl"),
        Airport(code: "ORD", city: "Chicago", name: "O'Hare Intl"),
        Airport(code: "ATL", city: "Atlanta", name: "Hartsfield-Jackson Intl"),
        Airport(code: "DFW", city: "Dallas", name: "Dallas/Fort Worth Intl"),
        Airport(code: "DEN", city: "Denver", name: "Denver Intl"),
        Airport(code: "SFO", city: "San Francisco", name: "San Francisco Intl"),
        Airport(code: "SEA", city: "Seattle", name: "Seattle-Tacoma Intl"),
        Airport(code: "MIA", city: "Miami", name: "Miami Intl"),
        Airport(code: "BOS", city: "Boston", name: "Logan Intl"),
        Airport(code: "TPA", city: "Tampa", name: "Tampa Intl"),
        Airport(code: "MCO", city: "Orlando", name: "Orlando Intl"),
        Airport(code: "IAH", city: "Houston", name: "George Bush Intercontinental"),
        Airport(code: "EWR", city: "Newark", name: "Newark Liberty Intl"),
        Airport(code: "MSP", city: "Minneapolis", name: "Minneapolis-Saint Paul Intl"),
        Airport(code: "DTW", city: "Detroit", name: "Detroit Metro Wayne County"),
        Airport(code: "PHL", city: "Philadelphia", name: "Philadelphia Intl"),
        Airport(code: "CLT", city: "Charlotte", name: "Charlotte Douglas Intl"),
        Airport(code: "FLL", city: "Fort Lauderdale", name: "Fort Lauderdale-Hollywood Intl"),
        Airport(code: "SAN", city: "San Diego", name: "San Diego Intl"),
        Airport(code: "PDX", city: "Portland", name: "Portland Intl"),
        Airport(code: "STL", city: "St. Louis", name: "St. Louis Lambert Intl"),
        Airport(code: "BWI", city: "Baltimore", name: "Baltimore/Washington Intl"),
        Airport(code: "SLC", city: "Salt Lake City", name: "Salt Lake City Intl"),
        Airport(code: "AUS", city: "Austin", name: "Austin-Bergstrom Intl"),
        Airport(code: "RDU", city: "Raleigh", name: "Raleigh-Durham Intl"),
        Airport(code: "BNA", city: "Nashville", name: "Nashville Intl"),
        Airport(code: "MKE", city: "Milwaukee", name: "Milwaukee Mitchell Intl"),
        Airport(code: "IND", city: "Indianapolis", name: "Indianapolis Intl"),
        Airport(code: "CLE", city: "Cleveland", name: "Cleveland Hopkins Intl"),
    ]
}

// MARK: - Preview

#Preview("Airport Picker") {
    NavigationStack {
        AirportPicker(selectedCode: .constant("JFK"))
    }
}
