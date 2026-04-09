import SwiftUI

// MARK: - Settings View

struct SettingsView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(SavedStore.self) private var savedStore
    @Environment(Router.self) private var router
    @Environment(\.openURL) private var openURL
    @Environment(AuthStore.self) private var auth
    @Environment(TravelerStore.self) private var travelerStore

    @State private var showClearConfirmation = false
    @State private var showSignOutConfirmation = false
    @State private var showDeleteAccountConfirmation = false
    @State private var isEditingName = false
    @State private var editFirstName = ""
    @State private var editLastName = ""
    @State private var isSavingProfile = false
    @State private var profileCreatedAt: String?
    @State private var showTravelers = false
    @State private var showPriceAlerts = false

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                // Header
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text(String(localized: "settings.title"))
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

                if auth.isAuthenticated {
                    travelersSection
                }

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
        .alert(String(localized: "settings.clear_saved.title"), isPresented: $showClearConfirmation) {
            Button(String(localized: "settings.clear_all"), role: .destructive) {
                HapticEngine.heavy()
                savedStore.clear()
            }
            Button(String(localized: "common.cancel"), role: .cancel) {}
        } message: {
            Text(String(format: String(localized: "settings.clear_saved.message"), savedStore.count))
        }
    }

    // MARK: - Account

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(String(localized: "settings.account"))
                .font(SGFont.bodyBold(size: 16))
                .foregroundStyle(Color.sgWhite)

            if auth.isAuthenticated {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    if isEditingName {
                        // Inline name edit
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            HStack(spacing: 8) {
                                Image(systemName: "person.circle.fill")
                                    .font(.system(size: 24))
                                    .foregroundStyle(Color.sgYellow)
                                Text(String(localized: "settings.edit_name"))
                                    .font(SGFont.bodyBold(size: 15))
                                    .foregroundStyle(Color.sgWhite)
                            }

                            HStack(spacing: 8) {
                                TextField(String(localized: "common.first"), text: $editFirstName)
                                    .font(SGFont.body(size: 14))
                                    .foregroundStyle(Color.sgWhite)
                                    .padding(8)
                                    .background(Color.sgSurface)
                                    .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
                                    .overlay(RoundedRectangle(cornerRadius: Radius.sm).strokeBorder(Color.sgBorder))

                                TextField(String(localized: "common.last"), text: $editLastName)
                                    .font(SGFont.body(size: 14))
                                    .foregroundStyle(Color.sgWhite)
                                    .padding(8)
                                    .background(Color.sgSurface)
                                    .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
                                    .overlay(RoundedRectangle(cornerRadius: Radius.sm).strokeBorder(Color.sgBorder))
                            }

                            HStack(spacing: 8) {
                                Button {
                                    isEditingName = false
                                } label: {
                                    Text(String(localized: "common.cancel"))
                                        .font(SGFont.bodyBold(size: 13))
                                        .foregroundStyle(Color.sgMuted)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 8)
                                        .background(Color.sgBorder, in: RoundedRectangle(cornerRadius: Radius.md))
                                }
                                .buttonStyle(.plain)

                                Button {
                                    Task { await saveProfileName() }
                                } label: {
                                    HStack(spacing: 4) {
                                        if isSavingProfile {
                                            ProgressView()
                                                .tint(Color.sgBg)
                                                .scaleEffect(0.8)
                                        }
                                        Text(String(localized: "common.save"))
                                            .font(SGFont.bodyBold(size: 13))
                                    }
                                    .foregroundStyle(Color.sgBg)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                                    .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
                                }
                                .buttonStyle(.plain)
                                .disabled(isSavingProfile || editFirstName.trimmingCharacters(in: .whitespaces).isEmpty)
                            }
                        }
                    } else {
                        // Display mode
                        HStack(spacing: 8) {
                            Image(systemName: "person.circle.fill")
                                .font(.system(size: 24))
                                .foregroundStyle(Color.sgYellow)
                            VStack(alignment: .leading, spacing: 2) {
                                if let name = auth.userName {
                                    Text(name)
                                        .font(SGFont.bodyBold(size: 15))
                                        .foregroundStyle(Color.sgWhite)
                                }
                                if let email = auth.userEmail {
                                    Text(email)
                                        .font(SGFont.body(size: 12))
                                        .foregroundStyle(Color.sgMuted)
                                }
                                if let created = profileCreatedAt {
                                    Text(String(format: String(localized: "settings.member_since"), created))
                                        .font(SGFont.body(size: 11))
                                        .foregroundStyle(Color.sgMuted.opacity(0.7))
                                }
                            }
                            Spacer()
                            Button {
                                editFirstName = auth.userName?.components(separatedBy: " ").first ?? ""
                                editLastName = auth.userName?.components(separatedBy: " ").dropFirst().joined(separator: " ") ?? ""
                                isEditingName = true
                            } label: {
                                Image(systemName: "pencil")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color.sgYellow)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Edit your name")
                        }
                    }

                    Button {
                        showSignOutConfirmation = true
                    } label: {
                        Text(String(localized: "settings.sign_out"))
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
                .task { await loadProfile() }
            } else {
                HStack(spacing: 8) {
                    Image(systemName: "person.circle")
                        .font(.system(size: 24))
                        .foregroundStyle(Color.sgMuted)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(String(localized: "settings.guest_mode"))
                            .font(SGFont.bodyBold(size: 15))
                            .foregroundStyle(Color.sgWhite)
                        Text(String(localized: "settings.guest_mode.subtitle"))
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
                        Text(String(localized: "settings.sign_in_apple"))
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
        .alert(String(localized: "settings.sign_out_confirm.title"), isPresented: $showSignOutConfirmation) {
            Button(String(localized: "settings.sign_out"), role: .destructive) {
                auth.signOut()
            }
            Button(String(localized: "common.cancel"), role: .cancel) {}
        } message: {
            Text(String(localized: "settings.sign_out_confirm.message"))
        }
    }

    // MARK: - Profile

    private func loadProfile() async {
        do {
            let profile: ProfileResponse = try await APIClient.shared.fetch(.profile)
            if let createdAt = profile.createdAt {
                let isoFormatter = ISO8601DateFormatter()
                if let date = isoFormatter.date(from: createdAt) {
                    let displayFormatter = DateFormatter()
                    displayFormatter.dateFormat = "MMM yyyy"
                    profileCreatedAt = displayFormatter.string(from: date)
                }
            }
        } catch {
            // Non-critical — silently ignore
        }
    }

    private func saveProfileName() async {
        isSavingProfile = true
        defer { isSavingProfile = false }

        let first = editFirstName.trimmingCharacters(in: .whitespaces)
        let last = editLastName.trimmingCharacters(in: .whitespaces)

        do {
            let profile: ProfileResponse = try await APIClient.shared.fetch(
                .updateProfile(firstName: first, lastName: last)
            )
            // Update AuthStore with new name
            await MainActor.run {
                auth.userName = profile.name
                isEditingName = false
            }
            HapticEngine.success()
        } catch {
            HapticEngine.error()
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
        settingsSection(String(localized: "settings.departure")) {
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

                        Text(String(localized: "settings.departure_subtitle"))
                            .font(SGFont.body(size: 12))
                            .foregroundStyle(Color.sgMuted)
                    }

                    Spacer(minLength: 0)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Departure airport: \(settings.departureCode), \(settings.departureCity)")

                Button {
                    HapticEngine.selection()
                    router.showDeparturePicker()
                } label: {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "airplane.departure")
                            .font(.system(size: 14, weight: .semibold))
                        Text(String(localized: "settings.change_airport"))
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
        settingsSection(String(localized: "settings.view_mode")) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                // Segmented-style picker
                HStack(spacing: 0) {
                    viewModeButton(id: "grid", label: String(localized: "settings.view_mode.swipe"), icon: "rectangle.portrait.on.rectangle.portrait")
                    viewModeButton(id: "list", label: String(localized: "settings.view_mode.board"), icon: "rectangle.grid.1x2")
                }
                .modifier(GlassSegmentModifier())

                Text(settings.preferredView == "list"
                     ? String(localized: "settings.view_mode.board_desc")
                     : String(localized: "settings.view_mode.swipe_desc"))
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
        .accessibilityLabel("\(label) view mode")
        .accessibilityValue(settings.preferredView == id ? "Selected" : "Not selected")
        .accessibilityAddTraits(settings.preferredView == id ? .isSelected : [])
    }

    // MARK: - Units

    private var unitsSection: some View {
        settingsSection(String(localized: "settings.units")) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(spacing: 0) {
                    unitButton(metric: false, label: "°F / mi", icon: "ruler")
                    unitButton(metric: true, label: "°C / km", icon: "ruler")
                }
                .modifier(GlassSegmentModifier())

                Text(settings.usesMetric
                     ? String(localized: "settings.units.metric_desc")
                     : String(localized: "settings.units.imperial_desc"))
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
        .accessibilityLabel("\(label) units")
        .accessibilityValue(settings.usesMetric == metric ? "Selected" : "Not selected")
        .accessibilityAddTraits(settings.usesMetric == metric ? .isSelected : [])
    }

    // MARK: - Notifications

    private var notificationsSection: some View {
        settingsSection(String(localized: "settings.notifications")) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                toggleRow(
                    icon: "bell.badge.fill",
                    title: String(localized: "settings.push_notifications"),
                    isOn: notificationBinding
                )

                Divider().overlay(Color.sgBorder)

                toggleRow(
                    icon: "tag.fill",
                    title: String(localized: "settings.price_alert_emails"),
                    isOn: priceAlertsBinding
                )

                if !settings.alertEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(maskedEmail(settings.alertEmail.trimmingCharacters(in: .whitespacesAndNewlines)))
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                        .padding(.leading, 28)
                }

                Divider().overlay(Color.sgBorder)

                Button {
                    HapticEngine.light()
                    showPriceAlerts = true
                } label: {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "bell.badge")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.sgYellow)
                            .frame(width: 20)

                        Text(String(localized: "settings.manage_alerts"))
                            .font(SGFont.bodyBold(size: 14))
                            .foregroundStyle(Color.sgWhite)

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.sgMuted)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Manage price alerts")
                .sheet(isPresented: $showPriceAlerts) {
                    PriceAlertsListView()
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
                .accessibilityLabel(title)
                .accessibilityValue(isOn.wrappedValue ? "On" : "Off")
        }
        .contentShape(Rectangle())
    }

    // MARK: - Travelers

    private var travelersSection: some View {
        settingsSection(String(localized: "settings.saved_travelers")) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                if travelerStore.travelers.isEmpty {
                    Text(String(localized: "settings.saved_travelers.empty"))
                        .font(SGFont.body(size: 13))
                        .foregroundStyle(Color.sgMuted)
                } else {
                    HStack {
                        Text("\(travelerStore.travelers.count)")
                            .font(SGFont.cardTitle)
                            .foregroundStyle(Color.sgYellow)
                        Text(travelerStore.travelers.count == 1 ? String(localized: "settings.traveler_saved") : String(localized: "settings.travelers_saved"))
                            .font(SGFont.body(size: 14))
                            .foregroundStyle(Color.sgMuted)
                        Spacer()
                    }
                }

                Button {
                    showTravelers = true
                } label: {
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "person.2.fill")
                            .font(.system(size: 12))
                        Text(travelerStore.travelers.isEmpty ? String(localized: "settings.add_traveler") : String(localized: "settings.manage_travelers"))
                            .font(SGFont.bodyBold(size: 14))
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
                .accessibilityLabel(travelerStore.travelers.isEmpty ? "Add a traveler" : "Manage saved travelers")
            }
        }
        .sheet(isPresented: $showTravelers) {
            TravelerListView()
        }
        .task {
            if travelerStore.travelers.isEmpty {
                await travelerStore.fetchTravelers()
            }
        }
    }

    // MARK: - Saved

    private var savedSection: some View {
        settingsSection(String(localized: "settings.saved_flights")) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                HStack {
                    Text("\(savedStore.count)")
                        .font(SGFont.cardTitle)
                        .foregroundStyle(Color.sgYellow)
                    Text(savedStore.count == 1 ? String(localized: "settings.trip_saved") : String(localized: "settings.trips_saved"))
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
                            Text(String(localized: "settings.view_saved"))
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
                            Text(String(localized: "settings.clear_all"))
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
        settingsSection(String(localized: "settings.about")) {
            VStack(alignment: .leading, spacing: 0) {
                linkRow(icon: "lock.shield", title: String(localized: "settings.privacy_policy")) {
                    if let url = URL(string: "https://sogojet.com/legal/privacy") { openURL(url) }
                }

                Divider().overlay(Color.sgBorder)

                linkRow(icon: "doc.text", title: String(localized: "settings.terms")) {
                    if let url = URL(string: "https://sogojet.com/legal/terms") { openURL(url) }
                }

                Divider().overlay(Color.sgBorder)

                linkRow(icon: "envelope", title: String(localized: "settings.contact_us")) {
                    if let url = URL(string: "mailto:hello@sogojet.com") { openURL(url) }
                }
            }
        }
    }

    // MARK: - Danger Zone

    private var dangerZoneSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(String(localized: "settings.danger_zone"))
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgRed)
                .tracking(1.2)

            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text(String(localized: "settings.delete_account.description"))
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgMuted)

                Button(role: .destructive) {
                    showDeleteAccountConfirmation = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "trash")
                            .font(.system(size: 14))
                        Text(String(localized: "settings.delete_account"))
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
            .modifier(GlassDangerModifier())
        }
        .padding(.top, Spacing.md)
        .alert(String(localized: "settings.delete_account.title"), isPresented: $showDeleteAccountConfirmation) {
            Button(String(localized: "common.delete"), role: .destructive) {
                Task { await deleteAccount() }
            }
            Button(String(localized: "common.cancel"), role: .cancel) {}
        } message: {
            Text(String(localized: "settings.delete_account.message"))
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
            .modifier(GlassSectionModifier())
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

// MARK: - Liquid Glass Section Modifier

/// Liquid glass tinted red for danger zone, falling back to solid red tint.
private struct GlassDangerModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content
                .glassEffect(.regular.tint(Color.sgRed.opacity(0.1)), in: .rect(cornerRadius: Radius.lg))
        } else {
            content
                .background(Color.sgRed.opacity(0.04), in: RoundedRectangle(cornerRadius: Radius.lg))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.lg)
                        .strokeBorder(Color.sgRed.opacity(0.15), lineWidth: 1)
                )
        }
    }
}

/// Liquid glass for segmented pickers, falling back to solid border on older iOS.
private struct GlassSegmentModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content
                .glassEffect(.regular.tint(Color.sgWhite.opacity(0.04)), in: .rect(cornerRadius: Radius.md))
        } else {
            content
                .background(Color.sgBorder, in: RoundedRectangle(cornerRadius: Radius.md))
        }
    }
}

/// Uses liquid glass on iOS 26+, falls back to a subtle tinted card on earlier versions.
private struct GlassSectionModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content
                .glassEffect(.regular.tint(Color.sgWhite.opacity(0.06)), in: .rect(cornerRadius: Radius.lg))
        } else {
            content
                .background(Color.sgWhite.opacity(0.04), in: RoundedRectangle(cornerRadius: Radius.lg))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.lg)
                        .strokeBorder(Color.sgBorder, lineWidth: 1)
                )
        }
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
