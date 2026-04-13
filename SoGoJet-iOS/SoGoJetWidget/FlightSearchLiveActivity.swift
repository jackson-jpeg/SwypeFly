import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Flight Search Live Activity
//
// Lock Screen: boarding-pass strip with SplitFlapText city + price.
// Dynamic Island: compact ticker of city + price; expanded boarding-pass full view.

struct FlightSearchLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FlightSearchAttributes.self) { context in
            lockScreenView(context: context)
                .activityBackgroundTint(Color(red: 0.039, green: 0.039, blue: 0.039))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded — boarding-pass panel
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 4) {
                            // Origin code flap
                            SplitFlapText(
                                text: context.attributes.origin,
                                length: 3,
                                color: .white,
                                w: 14, h: 20, fs: 13
                            )
                            Image(systemName: "arrow.right")
                                .font(.system(size: 10))
                                .foregroundStyle(gold)
                            // Destination code flap
                            SplitFlapText(
                                text: context.attributes.destination,
                                length: 3,
                                color: .white,
                                w: 14, h: 20, fs: 13
                            )
                        }
                        Text(context.attributes.destinationCity)
                            .font(.system(size: 10))
                            .foregroundStyle(.white.opacity(0.5))
                            .lineLimit(1)
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    if let price = context.state.bestPrice {
                        VStack(alignment: .trailing, spacing: 1) {
                            SplitFlapText(
                                text: "$\(price)",
                                length: 5,
                                color: gold,
                                w: 13, h: 18, fs: 12,
                                align: .trailing
                            )
                            if context.state.offerCount > 0 {
                                Text("\(context.state.offerCount) fares")
                                    .font(.system(size: 9, weight: .medium))
                                    .foregroundStyle(green)
                            }
                        }
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.state.message)
                            .font(.system(size: 11))
                            .foregroundStyle(.white.opacity(0.65))
                            .lineLimit(1)
                        Spacer()
                        statusPill(context.state.status)
                    }
                }
            } compactLeading: {
                // Compact left: airplane + destination flap
                HStack(spacing: 2) {
                    Image(systemName: context.state.status == .searching ? "airplane.departure" : "airplane")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(gold)
                        .contentTransition(.symbolEffect(.replace))
                    SplitFlapText(
                        text: context.attributes.destination,
                        length: 3,
                        color: .white,
                        w: 10, h: 14, fs: 10
                    )
                }
            } compactTrailing: {
                // Compact right: price or searching
                if let price = context.state.bestPrice {
                    SplitFlapText(
                        text: "$\(price)",
                        length: 5,
                        color: gold,
                        w: 10, h: 14, fs: 10,
                        align: .trailing
                    )
                } else {
                    Text("···")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(gold)
                        .contentTransition(.numericText())
                }
            } minimal: {
                Image(systemName: context.state.status == .found ? "airplane.arrival" : "airplane.departure")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(gold)
                    .contentTransition(.symbolEffect(.replace))
            }
        }
    }

    // MARK: - Lock Screen / Banner — boarding-pass strip

    private func lockScreenView(context: ActivityViewContext<FlightSearchAttributes>) -> some View {
        VStack(spacing: 0) {
            // Top row: branding + status
            HStack {
                HStack(spacing: 5) {
                    Image(systemName: "airplane.departure")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(gold)
                    Text("SOGOJET")
                        .font(.system(size: 10, weight: .heavy, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.45))
                        .tracking(1.5)
                }
                Spacer()
                statusPill(context.state.status)
            }
            .padding(.bottom, 10)

            // Perforation divider (boarding pass aesthetic)
            perforationLine

            // Main content — boarding pass body
            HStack(alignment: .center, spacing: 12) {
                // Left: route display
                VStack(alignment: .leading, spacing: 4) {
                    // Route codes — flap text
                    HStack(spacing: 6) {
                        SplitFlapText(
                            text: context.attributes.origin,
                            length: 3,
                            color: .white,
                            w: 16, h: 22, fs: 14
                        )
                        Image(systemName: "arrow.right")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(gold)
                        SplitFlapText(
                            text: context.attributes.destination,
                            length: 3,
                            color: .white,
                            w: 16, h: 22, fs: 14
                        )
                    }
                    Text("\(context.attributes.destinationCity)  ·  \(context.attributes.departureDate)")
                        .font(.system(size: 11))
                        .foregroundStyle(.white.opacity(0.45))
                        .lineLimit(1)
                }

                Spacer()

                // Right: price display
                if let price = context.state.bestPrice {
                    VStack(alignment: .trailing, spacing: 2) {
                        SplitFlapText(
                            text: "$\(price)",
                            length: 5,
                            color: gold,
                            w: 15, h: 22, fs: 14,
                            align: .trailing
                        )
                        if context.state.offerCount > 0 {
                            Text("\(context.state.offerCount) fares found")
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(green)
                        }
                    }
                } else {
                    VStack(spacing: 3) {
                        ProgressView()
                            .tint(gold)
                        Text("Scanning...")
                            .font(.system(size: 9))
                            .foregroundStyle(.white.opacity(0.45))
                    }
                }
            }
            .padding(.top, 10)

            // Status message
            Text(context.state.message)
                .font(.system(size: 11))
                .foregroundStyle(.white.opacity(0.4))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 6)
                .lineLimit(1)
        }
        .padding(16)
    }

    // MARK: - Helpers

    private var perforationLine: some View {
        HStack(spacing: 3) {
            ForEach(0..<18, id: \.self) { _ in
                Circle()
                    .fill(.white.opacity(0.12))
                    .frame(width: 3, height: 3)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func statusPill(_ status: FlightSearchAttributes.ContentState.SearchStatus) -> some View {
        let (text, color): (String, Color) = switch status {
        case .searching: ("SEARCHING", gold)
        case .found:     ("FOUND", green)
        case .noResults: ("NO FARES", Color.red)
        case .booked:    ("BOOKED", green)
        }
        return Text(text)
            .font(.system(size: 8, weight: .heavy, design: .monospaced))
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
