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
            let allFlights = await WidgetAPIClient.fetchFlights(origin: code, limit: 12)

            if allFlights.isEmpty {
                // API failed — rotate samples so widget still feels alive
                let rowCount = context.family == .systemLarge ? 5 : 3
                let samples = WidgetFlight.samples
                var fallbackEntries: [FlightEntry] = []
                let now = Date()
                for offset in 0..<3 {
                    let entryDate = now.addingTimeInterval(Double(offset) * 300) // 5 min apart
                    let rotated = Array(samples.dropFirst(offset).prefix(rowCount))
                        + Array(samples.prefix(max(0, rowCount - (samples.count - offset))))
                    fallbackEntries.append(FlightEntry(
                        date: entryDate,
                        flights: Array(rotated.prefix(rowCount)),
                        departureCode: code
                    ))
                }
                let timeline = Timeline(entries: fallbackEntries, policy: .after(Date().addingTimeInterval(900)))
                completion(timeline)
                return
            }

            // Create entries that rotate flights every ~3-4 minutes.
            // WidgetKit coalesces rapid updates, so space them 3+ min apart.
            // With 12 flights and showing 3-5 at a time, this creates a
            // "scrolling departure board" effect throughout the hour.
            let rowCount = context.family == .systemLarge ? 5 : 3
            var entries: [FlightEntry] = []
            let now = Date()
            let rotationCount = max(allFlights.count / rowCount, 4)

            for offset in 0..<rotationCount {
                // Space entries 3 minutes apart so WidgetKit actually shows each one
                let entryDate = now.addingTimeInterval(Double(offset) * 180)
                let rotated = rotateFlights(allFlights, by: offset * rowCount, showing: rowCount)
                entries.append(FlightEntry(
                    date: entryDate,
                    flights: rotated,
                    departureCode: code
                ))
            }

            // Refresh when all rotations have played (or max 1 hour)
            let refreshDate = now.addingTimeInterval(Double(rotationCount) * 180)
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
