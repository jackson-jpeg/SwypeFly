import SwiftUI

// MARK: - Settings View

struct SettingsView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(SavedStore.self) private var savedStore
    @Environment(Router.self) private var router
    @Environment(\.openURL) private var openURL

    @State private var showClearConfirmation = false

    var body: some View {
        VintageTerminalScreen(headerSpacing: Spacing.md) {
            // Header
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Settings")
                    .font(SGFont.cardTitle)
                    .foregroundStyle(Color.sgWhite)

                Text("v\(appVersion)")
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            }
            .padding(.top, Spacing.sm)
        } content: {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                departureSection
                displaySection
                notificationsSection
                savedSection
                aboutSection
            }
        }
        .navigationTitle("")
        .navigationBarHidden(true)
        .alert("Clear Saved Flights", isPresented: $showClearConfirmation) {
            Button("Clear All", role: .destructive) {
                HapticEngine.heavy()
                savedStore.clear()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will remove all \(savedStore.count) saved flights. This cannot be undone.")
        }
    }

    // MARK: - Departure Airport

    private var departureSection: some View {
        settingsSection("Departure Airport") {
            VStack(alignment: .leading, spacing: Spacing.md) {
                HStack(alignment: .center, spacing: Spacing.md) {
                    SplitFlapRow(
                        text: settings.departureCode,
                        maxLength: 3,
                        size: .lg,
                        color: Color.sgWhite,
                        animate: true,
                        staggerMs: 35
                    )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(settings.departureCity)
                            .font(SGFont.sectionHead)
                            .foregroundStyle(Color.sgWhite)

                        Text("All prices shown from this airport")
                            .font(SGFont.body(size: 12))
                            .foregroundStyle(Color.sgMuted)
                    }

                    Spacer(minLength: 0)
                }

                Button {
                    HapticEngine.selection()
                    router.showDeparturePicker()
                } label: {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "airplane.departure")
                            .font(.system(size: 14, weight: .semibold))
                        Text("Change Airport")
                            .font(SGFont.bodyBold(size: 14))
                    }
                    .foregroundStyle(Color.sgBg)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Display Mode

    private var displaySection: some View {
        settingsSection("View Mode") {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                // Segmented-style picker
                HStack(spacing: 0) {
                    viewModeButton(id: "grid", label: "Swipe Feed", icon: "rectangle.portrait.on.rectangle.portrait")
                    viewModeButton(id: "list", label: "Board", icon: "rectangle.grid.1x2")
                }
                .background(Color.sgBorder, in: RoundedRectangle(cornerRadius: Radius.md))

                Text(settings.preferredView == "list"
                     ? "Compact rows in a departure-board layout."
                     : "Full-bleed destination cards with vertical paging.")
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            }
        }
    }

    private func viewModeButton(id: String, label: String, icon: String) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                HapticEngine.selection()
                settings.preferredView = id
            }
        } label: {
            HStack(spacing: Spacing.xs) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .semibold))
                Text(label)
                    .font(SGFont.bodyBold(size: 13))
            }
            .foregroundStyle(settings.preferredView == id ? Color.sgBg : Color.sgWhiteDim)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                settings.preferredView == id ? Color.sgYellow : Color.clear,
                in: RoundedRectangle(cornerRadius: Radius.md)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Notifications

    private var notificationsSection: some View {
        settingsSection("Notifications") {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                toggleRow(
                    icon: "bell.badge.fill",
                    title: "Push Notifications",
                    isOn: notificationBinding
                )

                Divider().overlay(Color.sgBorder)

                toggleRow(
                    icon: "tag.fill",
                    title: "Price Alert Emails",
                    isOn: priceAlertsBinding
                )

                if !settings.alertEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(maskedEmail(settings.alertEmail.trimmingCharacters(in: .whitespacesAndNewlines)))
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                        .padding(.leading, 28)
                }
            }
        }
    }

    private func toggleRow(icon: String, title: String, isOn: Binding<Bool>) -> some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(Color.sgYellow)
                .frame(width: 20)

            Text(title)
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgWhite)

            Spacer()

            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(Color.sgYellow)
        }
    }

    // MARK: - Saved

    private var savedSection: some View {
        settingsSection("Saved Flights") {
            VStack(alignment: .leading, spacing: Spacing.md) {
                HStack {
                    Text("\(savedStore.count)")
                        .font(SGFont.cardTitle)
                        .foregroundStyle(Color.sgYellow)
                    Text(savedStore.count == 1 ? "trip saved" : "trips saved")
                        .font(SGFont.body(size: 14))
                        .foregroundStyle(Color.sgMuted)
                    Spacer()
                }

                HStack(spacing: Spacing.sm) {
                    Button {
                        router.activeTab = .saved
                    } label: {
                        HStack(spacing: Spacing.xs) {
                            Image(systemName: "heart.fill")
                                .font(.system(size: 12))
                            Text("View Saved")
                                .font(SGFont.bodyBold(size: 13))
                        }
                        .foregroundStyle(Color.sgYellow)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.sgYellow.opacity(0.12), in: RoundedRectangle(cornerRadius: Radius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.md)
                                .strokeBorder(Color.sgYellow.opacity(0.28), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)

                    Button {
                        showClearConfirmation = true
                    } label: {
                        HStack(spacing: Spacing.xs) {
                            Image(systemName: "trash")
                                .font(.system(size: 12))
                            Text("Clear All")
                                .font(SGFont.bodyBold(size: 13))
                        }
                        .foregroundStyle(Color.sgMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.sgBorder, in: RoundedRectangle(cornerRadius: Radius.md))
                    }
                    .buttonStyle(.plain)
                    .disabled(savedStore.count == 0)
                    .opacity(savedStore.count == 0 ? 0.4 : 1)
                }
            }
        }
    }

    // MARK: - About

    private var aboutSection: some View {
        settingsSection("About") {
            VStack(alignment: .leading, spacing: 0) {
                linkRow(icon: "lock.shield", title: "Privacy Policy") {
                    openURL(URL(string: "https://sogojet.com/legal/privacy")!)
                }

                Divider().overlay(Color.sgBorder)

                linkRow(icon: "doc.text", title: "Terms of Service") {
                    openURL(URL(string: "https://sogojet.com/legal/terms")!)
                }

                Divider().overlay(Color.sgBorder)

                linkRow(icon: "envelope", title: "Contact Us") {
                    openURL(URL(string: "mailto:hello@sogojet.com")!)
                }
            }
        }
    }

    // MARK: - Reusable Components

    private func settingsSection<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title.uppercased())
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgMuted)
                .tracking(1.2)

            VStack(alignment: .leading, spacing: Spacing.sm) {
                content()
            }
            .padding(Spacing.md)
            .background(Color.sgWhite.opacity(0.04), in: RoundedRectangle(cornerRadius: Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.lg)
                    .strokeBorder(Color.sgBorder, lineWidth: 1)
            )
        }
    }

    private func linkRow(icon: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundStyle(Color.sgMuted)
                    .frame(width: 20)

                Text(title)
                    .font(SGFont.body(size: 14))
                    .foregroundStyle(Color.sgWhite)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.sgMuted)
            }
            .padding(.vertical, Spacing.sm)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Bindings and Helpers

    private var notificationBinding: Binding<Bool> {
        Binding(
            get: { settings.notificationsEnabled },
            set: { settings.notificationsEnabled = $0 }
        )
    }

    private var priceAlertsBinding: Binding<Bool> {
        Binding(
            get: { settings.priceAlertsEnabled },
            set: { settings.priceAlertsEnabled = $0 }
        )
    }

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "-"
    }

    private func maskedEmail(_ email: String) -> String {
        let parts = email.split(separator: "@", maxSplits: 1).map(String.init)
        guard parts.count == 2 else { return email }

        let local = parts[0]
        let visiblePrefix = String(local.prefix(2))
        let maskCount = max(local.count - visiblePrefix.count, 2)
        return "\(visiblePrefix)\(String(repeating: "*", count: maskCount))@\(parts[1])"
    }
}

// MARK: - Preview

#Preview("Settings View") {
    NavigationStack {
        SettingsView()
    }
    .environment(SettingsStore())
    .environment(SavedStore())
    .environment(Router())
}
