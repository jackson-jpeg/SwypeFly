import SwiftUI
import UserNotifications

// MARK: - PermissionBriefingSheet
//
// "Gate agent briefing" pre-prompt for notification permission.
// Shown as the last step of onboarding so the user gets context before the
// system dialog appears. Uses SGSheet, SGButton, and terminal iconography.

struct PermissionBriefingSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var didRequest = false

    var body: some View {
        VStack(spacing: Spacing.xl) {
            // Illustrated glyph
            ZStack {
                Circle()
                    .fill(Color.sgYellow.opacity(0.12))
                    .frame(width: 80, height: 80)
                Image(systemName: "airplane.circle.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(Color.sgYellow)
            }
            .padding(.top, Spacing.xl)

            VStack(spacing: Spacing.sm) {
                Text("GATE AGENT BRIEFING")
                    .sgFont(.section)
                    .foregroundStyle(Color.sgYellow)
                    .tracking(2)

                Text("Before we depart, we'd like to send you fare drop alerts, deal-of-the-day notifications, and boarding reminders for your saved trips.")
                    .font(SGFont.accent(size: 16))
                    .foregroundStyle(Color.sgWhiteDim)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .padding(.horizontal, Spacing.md)
            }

            Spacer()

            VStack(spacing: Spacing.sm) {
                SGButton(action: {
                    Task { await requestNotifications() }
                }, style: .primary, size: .prominent) {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "bell.badge.fill")
                        Text("Allow Notifications")
                    }
                }
                .disabled(didRequest)

                SGButton(action: { dismiss() }, style: .ghost, size: .regular) {
                    Text("Not Now")
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
        .frame(maxWidth: .infinity)
        .background(Color.sgSurfaceHigh)
        .accessibilityElement(children: .contain)
    }

    private func requestNotifications() async {
        didRequest = true
        _ = try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .badge, .sound])
        HapticEngine.success()
        dismiss()
    }
}

#Preview("PermissionBriefingSheet") {
    Color.sgBg
        .ignoresSafeArea()
        .sheet(isPresented: .constant(true)) {
            PermissionBriefingSheet()
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
                .presentationBackground(Color.sgSurfaceHigh)
        }
}
