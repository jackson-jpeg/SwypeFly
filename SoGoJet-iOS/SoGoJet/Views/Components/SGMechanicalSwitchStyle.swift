import SwiftUI

// MARK: - SGMechanicalSwitchStyle
//
// Custom Toggle style for Settings.
// - Knob slides with SGSpring.mechanical
// - Track color lerps from sgHairline → sgYellow
// - Haptic selection() tick fires at ~50% slide (handled via onChange)
// - Reduce Motion: collapses to instant state change with same haptic

struct SGMechanicalSwitchStyle: ToggleStyle {
    private let trackWidth: CGFloat = 46
    private let trackHeight: CGFloat = 26
    private let knobSize: CGFloat = 20
    private let padding: CGFloat = 3

    func makeBody(configuration: Configuration) -> some View {
        HStack {
            configuration.label

            Spacer()

            ZStack {
                // Track
                RoundedRectangle(cornerRadius: trackHeight / 2, style: .continuous)
                    .fill(configuration.isOn ? Color.sgYellow : Color.sgHairline)
                    .animation(
                        UIAccessibility.isReduceMotionEnabled
                            ? .easeOut(duration: SGDuration.instant)
                            : SGSpring.mechanical,
                        value: configuration.isOn
                    )

                // Knob
                Circle()
                    .fill(configuration.isOn ? Color.sgBg : Color.sgMuted)
                    .frame(width: knobSize, height: knobSize)
                    .offset(x: configuration.isOn
                            ? (trackWidth / 2) - knobSize / 2 - padding
                            : -(trackWidth / 2) + knobSize / 2 + padding)
                    .shadow(color: Color.sgInk.opacity(0.3), radius: 2, y: 1)
                    .animation(
                        UIAccessibility.isReduceMotionEnabled
                            ? .easeOut(duration: SGDuration.instant)
                            : SGSpring.mechanical,
                        value: configuration.isOn
                    )
            }
            .frame(width: trackWidth, height: trackHeight)
            .contentShape(Rectangle())
            .onTapGesture {
                HapticEngine.selection()
                withAnimation(
                    UIAccessibility.isReduceMotionEnabled
                        ? .easeOut(duration: SGDuration.instant)
                        : SGSpring.mechanical
                ) {
                    configuration.isOn.toggle()
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(configuration.label)
        .accessibilityValue(configuration.isOn ? "On" : "Off")
        .accessibilityAddTraits(.isButton)
        .accessibilityHint("Double tap to toggle")
    }
}

// MARK: - Preview

#Preview("SGMechanicalSwitchStyle") {
    struct Demo: View {
        @State private var on1 = true
        @State private var on2 = false

        var body: some View {
            VStack(spacing: Spacing.lg) {
                Toggle("Push Notifications", isOn: $on1)
                    .toggleStyle(SGMechanicalSwitchStyle())
                    .sgFont(.body)
                    .foregroundStyle(Color.sgWhite)

                Toggle("Price Alert Emails", isOn: $on2)
                    .toggleStyle(SGMechanicalSwitchStyle())
                    .sgFont(.body)
                    .foregroundStyle(Color.sgWhite)
            }
            .padding(Spacing.lg)
            .background(Color.sgSurface)
            .padding()
            .background(Color.sgBg)
        }
    }
    return Demo()
}
