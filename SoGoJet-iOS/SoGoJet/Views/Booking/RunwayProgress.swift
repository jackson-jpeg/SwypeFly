import SwiftUI

// MARK: - RunwayProgress
//
// Runway-light dot progress indicator for the booking flow. Replaces plain
// text "Step N of M" with a row of dots that feel mechanical and alive:
//   • Completed steps: solid sgYellow
//   • Current step: sgYellow at 1.0–1.2× scale pulsing via TimelineView
//   • Future steps: sgHairline
// Connecting lines between dots fill with SGSpring.silky on transition.
// Reduce Motion: collapses the pulse to a static scale of 1.0.

struct RunwayProgress: View {
    let stepCount: Int
    let currentIndex: Int

    /// Label strings shown under each dot (optional — pass [] to hide).
    var labels: [String] = []

    @State private var appeared = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            dotsRow
            if !labels.isEmpty {
                labelsRow
            }
        }
        .onAppear { appeared = true }
    }

    // MARK: - Dots + Connecting Lines

    private var dotsRow: some View {
        HStack(spacing: 0) {
            ForEach(0..<stepCount, id: \.self) { index in
                dot(for: index)

                if index < stepCount - 1 {
                    connectorLine(for: index)
                }
            }
        }
    }

    @ViewBuilder
    private func dot(for index: Int) -> some View {
        let state = dotState(for: index)

        if state == .current {
            PulsingDot()
        } else {
            Circle()
                .fill(state == .completed ? Color.sgYellow : Color.sgHairline)
                .frame(width: 10, height: 10)
                .overlay(
                    Circle()
                        .strokeBorder(
                            state == .completed ? Color.sgYellow : Color.sgHairline,
                            lineWidth: 1
                        )
                )
                .animation(SGSpring.silky.respectingReduceMotion(), value: state)
        }
    }

    private func connectorLine(for index: Int) -> some View {
        let filled = index < currentIndex

        return Rectangle()
            .fill(filled ? Color.sgYellow : Color.sgHairline)
            .frame(maxWidth: .infinity)
            .frame(height: 1.5)
            .padding(.horizontal, 4)
            .animation(SGSpring.silky.respectingReduceMotion(), value: filled)
    }

    // MARK: - Labels

    private var labelsRow: some View {
        HStack(spacing: 0) {
            ForEach(Array(labels.enumerated()), id: \.offset) { index, label in
                Text(label.uppercased())
                    .font(SGFont.bodyBold(size: 8))
                    .foregroundStyle(index <= currentIndex ? Color.sgYellow : Color.sgMuted)
                    .tracking(0.9)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .animation(SGSpring.silky.respectingReduceMotion(), value: index <= currentIndex)
            }
        }
    }

    // MARK: - State helpers

    private enum DotState: Equatable {
        case completed, current, future
    }

    private func dotState(for index: Int) -> DotState {
        if index < currentIndex { return .completed }
        if index == currentIndex { return .current }
        return .future
    }
}

// MARK: - PulsingDot

private struct PulsingDot: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if reduceMotion {
            staticDot
        } else {
            animatedDot
        }
    }

    private var staticDot: some View {
        Circle()
            .fill(Color.sgYellow)
            .frame(width: 12, height: 12)
            .overlay(
                Circle().strokeBorder(Color.sgYellow, lineWidth: 1)
            )
    }

    private var animatedDot: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            // Smooth sine pulse between 1.0 and 1.25 at epic cadence
            let period = SGDuration.epic
            let phase = (t.truncatingRemainder(dividingBy: period)) / period
            let scale = 1.0 + 0.25 * sin(phase * .pi * 2)

            Circle()
                .fill(Color.sgYellow)
                .frame(width: 10, height: 10)
                .overlay(
                    Circle().strokeBorder(Color.sgYellow, lineWidth: 1)
                )
                .scaleEffect(scale)
        }
    }
}

// MARK: - Preview

#Preview("RunwayProgress") {
    VStack(spacing: Spacing.lg) {
        RunwayProgress(
            stepCount: 5,
            currentIndex: 0,
            labels: ["Search", "Traveler", "Seats", "Review", "Done"]
        )

        RunwayProgress(
            stepCount: 5,
            currentIndex: 2,
            labels: ["Search", "Traveler", "Seats", "Review", "Done"]
        )

        RunwayProgress(
            stepCount: 5,
            currentIndex: 4,
            labels: ["Search", "Traveler", "Seats", "Review", "Done"]
        )
    }
    .padding()
    .background(Color.sgBg)
}
