import WidgetKit
import SwiftUI

// MARK: - Timeline Provider

struct DepartureBoardProvider: TimelineProvider {
    // MARK: Placeholder
    func placeholder(in context: Context) -> FlightEntry {
        FlightEntry.placeholder
    }

    // MARK: Snapshot (Widget Gallery)
    func getSnapshot(in context: Context, completion: @escaping (FlightEntry) -> Void) {
        if context.isPreview {
            completion(FlightEntry.snapshot)
            return
        }

        // Try a quick fetch for the snapshot
        Task {
            let code = SharedDefaults.departureCode
            let flights = await WidgetAPIClient.fetchFlights(origin: code, limit: 7)
            if flights.isEmpty {
                completion(FlightEntry.snapshot)
            } else {
                completion(FlightEntry(date: .now, flights: flights, departureCode: code))
            }
        }
    }

    // MARK: Timeline
    func getTimeline(in context: Context, completion: @escaping (Timeline<FlightEntry>) -> Void) {
        Task {
            let code = SharedDefaults.departureCode
            let allFlights = await WidgetAPIClient.fetchFlights(origin: code, limit: 7)

            if allFlights.isEmpty {
                // No data — show placeholder with short retry
                let entry = FlightEntry(date: .now, flights: WidgetFlight.samples, departureCode: code)
                let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(300)))
                completion(timeline)
                return
            }

            // Create 4 entries that rotate which flights are visible.
            // This creates a "scrolling board" effect across timeline updates.
            let rowCount = context.family == .systemLarge ? 5 : 3
            var entries: [FlightEntry] = []
            let now = Date()

            for offset in 0..<4 {
                let entryDate = now.addingTimeInterval(Double(offset) * 30)
                let rotated = rotateFlights(allFlights, by: offset, showing: rowCount)
                entries.append(FlightEntry(
                    date: entryDate,
                    flights: rotated,
                    departureCode: code
                ))
            }

            // Refresh after 15 minutes (WidgetKit minimum)
            let refreshDate = now.addingTimeInterval(900)
            let timeline = Timeline(entries: entries, policy: .after(refreshDate))
            completion(timeline)
        }
    }

    /// Rotate the flights array so different deals appear first in each timeline entry.
    private func rotateFlights(_ flights: [WidgetFlight], by offset: Int, showing count: Int) -> [WidgetFlight] {
        guard !flights.isEmpty else { return [] }
        let startIndex = offset % flights.count
        let rotated = Array(flights[startIndex...]) + Array(flights[..<startIndex])
        return Array(rotated.prefix(count))
    }
}

// MARK: - Widget Definition

struct DepartureBoardWidget: Widget {
    let kind = "DepartureBoardWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DepartureBoardProvider()) { entry in
            DepartureBoardEntryView(entry: entry)
                .containerBackground(Color(red: 0.039, green: 0.039, blue: 0.039), for: .widget)
        }
        .configurationDisplayName("Flight Deals")
        .description("Live departure board showing the cheapest flight deals from your airport.")
        .supportedFamilies([.systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

// MARK: - Entry View (Routes to Medium or Large)

struct DepartureBoardEntryView: View {
    let entry: FlightEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemLarge:
            LargeBoardView(entry: entry)
        default:
            MediumBoardView(entry: entry)
        }
    }
}

// MARK: - Previews

#Preview("Medium", as: .systemMedium) {
    DepartureBoardWidget()
} timeline: {
    FlightEntry.snapshot
    FlightEntry(
        date: .now.addingTimeInterval(30),
        flights: Array(WidgetFlight.samples.dropFirst(1).prefix(3)),
        departureCode: "TPA"
    )
}

#Preview("Large", as: .systemLarge) {
    DepartureBoardWidget()
} timeline: {
    FlightEntry.snapshot
    FlightEntry(
        date: .now.addingTimeInterval(30),
        flights: Array(WidgetFlight.samples.dropFirst(2).prefix(5)),
        departureCode: "JFK"
    )
}

#Preview("Placeholder Medium", as: .systemMedium) {
    DepartureBoardWidget()
} timeline: {
    FlightEntry.placeholder
}
