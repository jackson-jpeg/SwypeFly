import SwiftUI

// MARK: - Settings View

struct SettingsView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(SavedStore.self) private var savedStore
    @Environment(Router.self) private var router
    @Environment(\.openURL) private var openURL
    @Environment(AuthStore.self) private var auth

    @State private var showClearConfirmation = false
    @State private var showSignOutConfirmation = false
    @State private var showDeleteAccountConfirmation = false

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                // Header
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("Settings")
                        .font(SGFont.cardTitle)
                        .foregroundStyle(Color.sgWhite)
                    Text("v\(appVersion)")
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                }
                .padding(.top, Spacing.lg)

                accountSection
                departureSection
                displaySection
                unitsSection
                notificationsSection
                savedSection
                aboutSection

                if auth.isAuthenticated {
                    dangerZoneSection
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
        .background(Color.sgBg)
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

    // MARK: - Account

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Account")
                .font(SGFont.bodyBold(size: 16))
                .foregroundStyle(Color.sgWhite)

            if auth.isAuthenticated {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    if let name = auth.userName {
                        HStack(spacing: 8) {
                            Image(systemName: "person.circle.fill")
                                .font(.system(size: 24))
                                .foregroundStyle(Color.sgYellow)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(name)
                                    .font(SGFont.bodyBold(size: 15))
                                    .foregroundStyle(Color.sgWhite)
                                if let email = auth.userEmail {
                                    Text(email)
                                        .font(SGFont.body(size: 12))
                                        .foregroundStyle(Color.sgMuted)
                                }
                            }
                        }
                    }

                    Button {
                        showSignOutConfirmation = true
                    } label: {
                        Text("Sign Out")
                            .font(SGFont.bodyBold(size: 14))
                            .foregroundStyle(Color.sgRed)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Color.sgRed.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Sign out of your account")

                }
            } else {
                HStack(spacing: 8) {
                    Image(systemName: "person.circle")
                        .font(.system(size: 24))
                        .foregroundStyle(Color.sgMuted)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Guest Mode")
                            .font(SGFont.bodyBold(size: 15))
                            .foregroundStyle(Color.sgWhite)
                        Text("Sign in to save preferences and book flights")
                            .font(SGFont.body(size: 12))
                            .foregroundStyle(Color.sgMuted)
                    }
                }

                // Sign in with Apple
                Button {
                    auth.signInWithApple()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "apple.logo")
                            .font(.system(size: 14))
                        Text("Sign in with Apple")
                            .font(SGFont.bodyBold(size: 14))
                    }
                    .foregroundStyle(Color.sgBg)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.sgWhite)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                }
                .buttonStyle(.plain)
                .disabled(auth.isLoading)
                .accessibilityLabel("Sign in with Apple")

                HStack(spacing: 8) {
                    // Sign in with Google
                    Button {
                        auth.signInWithGoogle()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "g.circle.fill")
                                .font(.system(size: 14))
                            Text("Google")
                                .font(SGFont.bodyBold(size: 13))
                        }
                        .foregroundStyle(Color.sgBg)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.sgWhite)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                    }
                    .buttonStyle(.plain)
                    .disabled(auth.isLoading)
                    .accessibilityLabel("Sign in with Google")

                    // Sign in with TikTok
                    Button {
                        auth.signInWithTikTok()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "play.rectangle.fill")
                                .font(.system(size: 12))
                            Text("TikTok")
                                .font(SGFont.bodyBold(size: 13))
                        }
                        .foregroundStyle(Color.sgWhite)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.sgSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.md)
                                .strokeBorder(Color.sgBorder, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(auth.isLoading)
                    .accessibilityLabel("Sign in with TikTok")
                }

                if auth.isLoading {
                    ProgressView()
                        .tint(Color.sgYellow)
                }

                if let error = auth.authError {
                    Text(error)
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgRed)
                }
            }
        }
        .alert("Sign Out?", isPresented: $showSignOutConfirmation) {
            Button("Sign Out", role: .destructive) {
                auth.signOut()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You can still browse deals as a guest, but you won't be able to book flights.")
        }
    }

    // MARK: - Delete Account

    private func deleteAccount() async {
        // Call backend to delete user data
        do {
            if let token = auth.authToken {
                let _: EmptyResponse = try await APIClient.shared.fetch(.deleteAccount(authToken: token))
            }
        } catch {
            // Even if backend fails, sign out locally
        }
        auth.signOut()
        settings.hasOnboarded = false // Reset to onboarding
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
                .accessibilityLabel("Change departure airport")
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
        .accessibilityLabel("Switch to \(label) view mode")
    }

    // MARK: - Units

    private var unitsSection: some View {
        settingsSection("Units") {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(spacing: 0) {
                    unitButton(metric: false, label: "°F / mi", icon: "ruler")
                    unitButton(metric: true, label: "°C / km", icon: "ruler")
                }
                .background(Color.sgBorder, in: RoundedRectangle(cornerRadius: Radius.md))

                Text(settings.usesMetric
                     ? "Temperatures in Celsius, distances in kilometers."
                     : "Temperatures in Fahrenheit, distances in miles.")
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            }
        }
    }

    private func unitButton(metric: Bool, label: String, icon: String) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                HapticEngine.selection()
                settings.usesMetric = metric
            }
        } label: {
            HStack(spacing: Spacing.xs) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .semibold))
                Text(label)
                    .font(SGFont.bodyBold(size: 13))
            }
            .foregroundStyle(settings.usesMetric == metric ? Color.sgBg : Color.sgWhiteDim)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                settings.usesMetric == metric ? Color.sgYellow : Color.clear,
                in: RoundedRectangle(cornerRadius: Radius.md)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Switch to \(label) units")
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
                .accessibilityLabel("Toggle \(title)")
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
                    .accessibilityLabel("View saved flights")

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
                    .accessibilityLabel("Clear all saved flights")
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

    // MARK: - Danger Zone

    private var dangerZoneSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("DANGER ZONE")
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgRed)
                .tracking(1.2)

            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("Permanently delete your account, saved trips, and all personal data. This cannot be undone.")
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgMuted)

                Button(role: .destructive) {
                    showDeleteAccountConfirmation = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "trash")
                            .font(.system(size: 14))
                        Text("Delete Account")
                            .font(SGFont.bodyBold(size: 14))
                    }
                    .foregroundStyle(Color.sgRed)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.sgRed.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md)
                            .strokeBorder(Color.sgRed.opacity(0.3), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Delete your account and all data")
            }
            .padding(Spacing.md)
            .background(Color.sgRed.opacity(0.04), in: RoundedRectangle(cornerRadius: Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.lg)
                    .strokeBorder(Color.sgRed.opacity(0.15), lineWidth: 1)
            )
        }
        .padding(.top, Spacing.md)
        .alert("Delete Account?", isPresented: $showDeleteAccountConfirmation) {
            Button("Delete", role: .destructive) {
                Task { await deleteAccount() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will permanently delete your account, saved trips, and all personal data. This cannot be undone.")
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
        .accessibilityLabel(title)
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
