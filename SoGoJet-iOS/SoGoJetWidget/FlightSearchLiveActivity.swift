import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Flight Search Live Activity

/// Renders the Live Activity on the Lock Screen and Dynamic Island
/// while a flight search is in progress.
struct FlightSearchLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FlightSearchAttributes.self) { context in
            // Lock Screen / Banner view
            lockScreenView(context: context)
                .activityBackgroundTint(Color(red: 0.039, green: 0.039, blue: 0.039))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded view
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 4) {
                        Text(context.attributes.origin)
                            .font(.system(size: 16, weight: .bold, design: .monospaced))
                            .foregroundStyle(.white)
                        Image(systemName: "airplane")
                            .font(.system(size: 10))
                            .foregroundStyle(gold)
                        Text(context.attributes.destination)
                            .font(.system(size: 16, weight: .bold, design: .monospaced))
                            .foregroundStyle(.white)
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    if let price = context.state.bestPrice {
                        Text("$\(price)")
                            .font(.system(size: 20, weight: .bold, design: .monospaced))
                            .foregroundStyle(gold)
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.state.message)
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.7))
                        Spacer()
                        if context.state.offerCount > 0 {
                            Text("\(context.state.offerCount) fares")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(green)
                        }
                    }
                }
            } compactLeading: {
                // Compact: left side
                HStack(spacing: 2) {
                    Image(systemName: "airplane")
                        .font(.system(size: 10))
                        .foregroundStyle(gold)
                    Text(context.attributes.destination)
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(.white)
                }
            } compactTrailing: {
                // Compact: right side
                if let price = context.state.bestPrice {
                    Text("$\(price)")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(gold)
                } else {
                    ProgressView()
                        .tint(gold)
                        .scaleEffect(0.6)
                }
            } minimal: {
                // Minimal: just the icon
                Image(systemName: "airplane")
                    .font(.system(size: 10))
                    .foregroundStyle(gold)
            }
        }
    }

    // MARK: - Lock Screen View

    private func lockScreenView(context: ActivityViewContext<FlightSearchAttributes>) -> some View {
        VStack(spacing: 8) {
            // Route header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "airplane.departure")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(gold)
                    Text("SOGOJET")
                        .font(.system(size: 11, weight: .heavy, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.5))
                        .tracking(1.5)
                }
                Spacer()
                statusBadge(context.state.status)
            }

            // Main content
            HStack(alignment: .center) {
                // Origin → Destination
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(context.attributes.origin)
                            .font(.system(size: 22, weight: .bold, design: .monospaced))
                            .foregroundStyle(.white)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(gold)
                        Text(context.attributes.destination)
                            .font(.system(size: 22, weight: .bold, design: .monospaced))
                            .foregroundStyle(.white)
                    }
                    Text("\(context.attributes.destinationCity) · \(context.attributes.departureDate)")
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.5))
                }

                Spacer()

                // Price or searching indicator
                if let price = context.state.bestPrice {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("$\(price)")
                            .font(.system(size: 28, weight: .bold, design: .monospaced))
                            .foregroundStyle(gold)
                        if context.state.offerCount > 0 {
                            Text("\(context.state.offerCount) fares found")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(green)
                        }
                    }
                } else {
                    VStack(spacing: 4) {
                        ProgressView()
                            .tint(gold)
                        Text("Searching...")
                            .font(.system(size: 10))
                            .foregroundStyle(.white.opacity(0.5))
                    }
                }
            }
        }
        .padding(16)
    }

    private func statusBadge(_ status: FlightSearchAttributes.ContentState.SearchStatus) -> some View {
        let (text, color): (String, Color) = switch status {
        case .searching: ("SEARCHING", gold)
        case .found: ("FOUND", green)
        case .noResults: ("NO FARES", Color.red)
        case .booked: ("BOOKED", green)
        }
        return Text(text)
            .font(.system(size: 9, weight: .heavy, design: .monospaced))
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .overlay(
                RoundedRectangle(cornerRadius: 3)
                    .strokeBorder(color.opacity(0.4), lineWidth: 1)
            )
    }

    private var gold: Color { Color(red: 0.969, green: 0.910, blue: 0.627) }
    private var green: Color { Color(red: 0.29, green: 0.87, blue: 0.50) }
}
