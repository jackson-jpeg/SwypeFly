import SwiftUI

// MARK: - Settings View
// Phase 6: grouped SGCard sections, profile header, mechanical toggles,
// CRT easter egg on long-press version number.

struct SettingsView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(SavedStore.self) private var savedStore
    @Environment(Router.self) private var router
    @Environment(\.openURL) private var openURL
    @Environment(AuthStore.self) private var auth
    @Environment(TravelerStore.self) private var travelerStore
    @Environment(BookingHistoryStore.self) private var historyStore

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

    // CRT easter egg
    @State private var showCRTOverlay = false

    var body: some View {
        ZStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    profileHeader
                        .padding(.top, Spacing.lg)

                    settingsCard(title: "DEPARTURE") { departureContent }
                    settingsCard(title: "VIEW MODE") { displayContent }
                    settingsCard(title: "UNITS") { unitsContent }
                    settingsCard(title: "NOTIFICATIONS") { notificationsContent }

                    if auth.isAuthenticated {
                        settingsCard(title: "TRAVELERS") { travelersContent }
                    }

                    settingsCard(title: "SAVED FLIGHTS") { savedContent }
                    settingsCard(title: "ABOUT") { aboutContent }

                    if auth.isAuthenticated {
                        dangerZoneSection
                    }

                    // Version number — long-press triggers CRT easter egg
                    versionFooter
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

            // CRT Easter Egg Overlay
            if showCRTOverlay {
                CRTOverlay(appVersion: appVersion) {
                    withAnimation(.easeOut(duration: SGDuration.base)) {
                        showCRTOverlay = false
                    }
                }
                .ignoresSafeArea()
                .zIndex(100)
                .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: SGDuration.base), value: showCRTOverlay)
    }

    // MARK: - Profile Header

    private var profileHeader: some View {
        SGCard(elevation: .hero) {
            ZStack {
                PaperTexture(intensity: 0.04)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))

                VStack(spacing: Spacing.md) {
                    if auth.isAuthenticated {
                        authenticatedProfileContent
                    } else {
                        guestProfileContent
                    }
                }
            }
        }
        .task { if auth.isAuthenticated { await loadProfile() } }
    }

    private var authenticatedProfileContent: some View {
        VStack(spacing: Spacing.sm) {
            // Avatar + name row
            HStack(spacing: Spacing.md) {
                // Avatar circle
                ZStack {
                    Circle()
                        .fill(Color.sgYellow.opacity(0.15))
                        .frame(width: 56, height: 56)
                    Image(systemName: "person.circle.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(Color.sgYellow)
                }

                VStack(alignment: .leading, spacing: 4) {
                    if let name = auth.userName {
                        Text(name)
                            .font(SGFont.accent(size: 22))
                            .foregroundStyle(Color.sgWhite)
                            .lineLimit(1)
                    }
                    if let email = auth.userEmail {
                        Text(email)
                            .font(SGFont.body(size: 12))
                            .foregroundStyle(Color.sgMuted)
                            .lineLimit(1)
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
                        .frame(width: 32, height: 32)
                        .background(Color.sgYellow.opacity(0.12), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Edit your name")
            }

            Divider().overlay(Color.sgHairline)

            // Stats row
            HStack(spacing: 0) {
                statCell(value: "\(savedStore.count)", label: "trips saved")
                Divider()
                    .frame(height: 30)
                    .overlay(Color.sgHairline)
                statCell(value: "\(historyStore.bookings.count)", label: "booked")
                Divider()
                    .frame(height: 30)
                    .overlay(Color.sgHairline)
                statCell(value: "\(travelerStore.travelers.count)", label: "travelers")
            }

            if isEditingName {
                nameEditForm
            }

            // Sign out
            if !isEditingName {
                SGButton(String(localized: "settings.sign_out"), style: .destructive) {
                    showSignOutConfirmation = true
                }
                .alert(String(localized: "settings.sign_out_confirm.title"), isPresented: $showSignOutConfirmation) {
                    Button(String(localized: "settings.sign_out"), role: .destructive) { auth.signOut() }
                    Button(String(localized: "common.cancel"), role: .cancel) {}
                } message: {
                    Text(String(localized: "settings.sign_out_confirm.message"))
                }
            }
        }
    }

    private func statCell(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .sgFont(.cardTitle)
                .foregroundStyle(Color.sgYellow)
            Text(label)
                .font(SGFont.body(size: 10))
                .foregroundStyle(Color.sgMuted)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(value) \(label)")
    }

    @ViewBuilder
    private var nameEditForm: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(spacing: 8) {
                TextField(String(localized: "common.first"), text: $editFirstName)
                    .sgTextField()
                TextField(String(localized: "common.last"), text: $editLastName)
                    .sgTextField()
            }

            HStack(spacing: 8) {
                SGButton(String(localized: "common.cancel"), style: .ghost) {
                    isEditingName = false
                }
                SGButton(isSavingProfile ? "Saving…" : String(localized: "common.save"), style: .primary) {
                    Task { await saveProfileName() }
                }
                .disabled(isSavingProfile || editFirstName.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    private var guestProfileContent: some View {
        VStack(spacing: Spacing.md) {
            HStack(spacing: Spacing.sm) {
                Image(systemName: "person.circle")
                    .font(.system(size: 32))
                    .foregroundStyle(Color.sgMuted)
                VStack(alignment: .leading, spacing: 2) {
                    Text(String(localized: "settings.guest_mode"))
                        .font(SGFont.accent(size: 18))
                        .foregroundStyle(Color.sgWhite)
                    Text(String(localized: "settings.guest_mode.subtitle"))
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                }
                Spacer()
            }

            SGButton("Sign in with Apple", style: .primary) {
                auth.signInWithApple()
            }
            .disabled(auth.isLoading)

            HStack(spacing: Spacing.sm) {
                SGButton("Google", style: .ghost) { auth.signInWithGoogle() }
                    .disabled(auth.isLoading)
                SGButton("TikTok", style: .ghost) { auth.signInWithTikTok() }
                    .disabled(auth.isLoading)
            }

            if auth.isLoading {
                ProgressView().tint(Color.sgYellow)
            }
            if let error = auth.authError {
                Text(error).font(SGFont.body(size: 12)).foregroundStyle(Color.sgRed)
            }
        }
    }

    // MARK: - Card Helper

    private func settingsCard<Content: View>(
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title)
                .font(SGFont.accent(size: 14))
                .foregroundStyle(Color.sgMuted)
                .padding(.leading, Spacing.xs)

            SGCard(elevation: .flush) {
                content()
            }
        }
    }

    // MARK: - Departure Content

    private var departureContent: some View {
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

            SGButton(String(localized: "settings.change_airport"), style: .primary) {
                HapticEngine.selection()
                router.showDeparturePicker()
            }
        }
    }

    // MARK: - Display Content

    private var displayContent: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
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

    private func viewModeButton(id: String, label: String, icon: String) -> some View {
        Button {
            withAnimation(SGSpring.snappy) {
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

    // MARK: - Units Content

    private var unitsContent: some View {
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

    private func unitButton(metric: Bool, label: String, icon: String) -> some View {
        Button {
            withAnimation(SGSpring.snappy) {
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

    // MARK: - Notifications Content

    private var notificationsContent: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Toggle(isOn: notificationBinding) {
                Label {
                    Text(String(localized: "settings.push_notifications"))
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgWhite)
                } icon: {
                    Image(systemName: "bell.badge.fill")
                        .foregroundStyle(Color.sgYellow)
                        .frame(width: 20)
                }
            }
            .toggleStyle(SGMechanicalSwitchStyle())

            Divider().overlay(Color.sgHairline)

            Toggle(isOn: priceAlertsBinding) {
                Label {
                    Text(String(localized: "settings.price_alert_emails"))
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgWhite)
                } icon: {
                    Image(systemName: "tag.fill")
                        .foregroundStyle(Color.sgYellow)
                        .frame(width: 20)
                }
            }
            .toggleStyle(SGMechanicalSwitchStyle())

            if !settings.alertEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(maskedEmail(settings.alertEmail.trimmingCharacters(in: .whitespacesAndNewlines)))
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
                    .padding(.leading, 28)
            }

            Divider().overlay(Color.sgHairline)

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

    // MARK: - Travelers Content

    private var travelersContent: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            if !travelerStore.travelers.isEmpty {
                HStack {
                    Text("\(travelerStore.travelers.count)")
                        .sgFont(.cardTitle)
                        .foregroundStyle(Color.sgYellow)
                    Text(travelerStore.travelers.count == 1
                         ? String(localized: "settings.traveler_saved")
                         : String(localized: "settings.travelers_saved"))
                        .font(SGFont.body(size: 14))
                        .foregroundStyle(Color.sgMuted)
                    Spacer()
                }
            } else {
                Text(String(localized: "settings.saved_travelers.empty"))
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgMuted)
            }

            SGButton(
                travelerStore.travelers.isEmpty
                    ? String(localized: "settings.add_traveler")
                    : String(localized: "settings.manage_travelers"),
                style: .ghost
            ) {
                showTravelers = true
            }
            .accessibilityLabel(travelerStore.travelers.isEmpty ? "Add a traveler" : "Manage saved travelers")
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

    // MARK: - Saved Content

    private var savedContent: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack {
                Text("\(savedStore.count)")
                    .sgFont(.cardTitle)
                    .foregroundStyle(Color.sgYellow)
                Text(savedStore.count == 1
                     ? String(localized: "settings.trip_saved")
                     : String(localized: "settings.trips_saved"))
                    .font(SGFont.body(size: 14))
                    .foregroundStyle(Color.sgMuted)
                Spacer()
            }

            HStack(spacing: Spacing.sm) {
                SGButton(String(localized: "settings.view_saved"), style: .ghost) {
                    router.activeTab = .saved
                }
                .accessibilityLabel("View saved flights")

                SGButton(String(localized: "settings.clear_all"), style: .destructive) {
                    showClearConfirmation = true
                }
                .disabled(savedStore.count == 0)
                .opacity(savedStore.count == 0 ? 0.4 : 1)
                .accessibilityLabel("Clear all saved flights")
            }
        }
    }

    // MARK: - About Content

    private var aboutContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            linkRow(icon: "lock.shield", title: String(localized: "settings.privacy_policy")) {
                if let url = URL(string: "https://sogojet.com/legal/privacy") { openURL(url) }
            }
            Divider().overlay(Color.sgHairline)
            linkRow(icon: "doc.text", title: String(localized: "settings.terms")) {
                if let url = URL(string: "https://sogojet.com/legal/terms") { openURL(url) }
            }
            Divider().overlay(Color.sgHairline)
            linkRow(icon: "envelope", title: String(localized: "settings.contact_us")) {
                if let url = URL(string: "mailto:hello@sogojet.com") { openURL(url) }
            }
        }
    }

    // MARK: - Danger Zone

    private var dangerZoneSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(String(localized: "settings.danger_zone"))
                .font(SGFont.accent(size: 14))
                .foregroundStyle(Color.sgRed)
                .padding(.leading, Spacing.xs)

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

    // MARK: - Version Footer (CRT long-press trigger)

    private var versionFooter: some View {
        HStack {
            Spacer()
            Text("v\(appVersion)")
                .font(SGFont.body(size: 12))
                .foregroundStyle(Color.sgFaint)
                .onLongPressGesture(minimumDuration: 1.0) {
                    HapticEngine.boardingPass()
                    withAnimation(.easeOut(duration: SGDuration.base)) {
                        showCRTOverlay = true
                    }
                }
                .accessibilityLabel("App version \(appVersion)")
                .accessibilityHint("Long press for a surprise")
            Spacer()
        }
        .padding(.vertical, Spacing.sm)
    }

    // MARK: - Reusable Row

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
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    private func maskedEmail(_ email: String) -> String {
        let parts = email.split(separator: "@", maxSplits: 1).map(String.init)
        guard parts.count == 2 else { return email }
        let local = parts[0]
        let prefix = String(local.prefix(2))
        return "\(prefix)\(String(repeating: "*", count: max(local.count - prefix.count, 2)))@\(parts[1])"
    }

    private func loadProfile() async {
        do {
            let profile: ProfileResponse = try await APIClient.shared.fetch(.profile)
            if let createdAt = profile.createdAt {
                let iso = ISO8601DateFormatter()
                if let date = iso.date(from: createdAt) {
                    let fmt = DateFormatter()
                    fmt.dateFormat = "MMM yyyy"
                    profileCreatedAt = fmt.string(from: date)
                }
            }
        } catch { /* non-critical */ }
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
            await MainActor.run {
                auth.userName = profile.name
                isEditingName = false
            }
            HapticEngine.success()
        } catch {
            HapticEngine.error()
        }
    }

    private func deleteAccount() async {
        do {
            if let token = auth.authToken {
                let _: EmptyResponse = try await APIClient.shared.fetch(.deleteAccount(authToken: token))
            }
        } catch { }
        auth.signOut()
        settings.hasOnboarded = false
    }
}

// MARK: - TextField SGStyle Helper

private extension View {
    func sgTextField() -> some View {
        self
            .font(SGFont.body(size: 14))
            .foregroundStyle(Color.sgWhite)
            .padding(10)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .strokeBorder(Color.sgBorder)
            )
    }
}

// MARK: - CRT Easter Egg Overlay

private struct CRTOverlay: View {
    let appVersion: String
    let onDismiss: () -> Void

    @State private var scanlinesOpacity: Double = 0
    @State private var textVisible = false
    @State private var creditsVisible = false

    var body: some View {
        ZStack {
            Color.sgInk.ignoresSafeArea()

            // Scanlines
            CRTScanlines()
                .opacity(scanlinesOpacity)
                .ignoresSafeArea()

            // Runway shimmer over scanlines
            RunwayShimmer(duration: SGDuration.epic, intensity: 0.15, isActive: textVisible)
                .ignoresSafeArea()

            VStack(spacing: Spacing.lg) {
                Spacer()

                if textVisible {
                    SplitFlapText(
                        text: "SOGOJET",
                        style: .headline,
                        animate: true
                    )
                    .transition(.opacity)

                    Text("v\(appVersion)")
                        .sgFont(.ticker)
                        .foregroundStyle(Color.sgYellow)
                        .transition(.opacity)
                }

                if creditsVisible {
                    VStack(spacing: Spacing.xs) {
                        Text("THE WORLD AS A LIVING DEPARTURE BOARD")
                            .sgFont(.micro)
                            .foregroundStyle(Color.sgMuted)
                            .tracking(2)

                        Text("Built with intention.")
                            .font(SGFont.accent(size: 14))
                            .foregroundStyle(Color.sgWhiteDim)
                    }
                    .transition(.opacity)
                }

                Spacer()

                Text("Tap anywhere to dismiss")
                    .sgFont(.caption)
                    .foregroundStyle(Color.sgFaint)
                    .opacity(creditsVisible ? 1 : 0)
                    .padding(.bottom, Spacing.xl)
            }
        }
        .onTapGesture { onDismiss() }
        .onAppear {
            // Phase 1: scanlines fade in
            withAnimation(.easeIn(duration: SGDuration.slow)) {
                scanlinesOpacity = 1
            }
            // Phase 2: text flaps in
            DispatchQueue.main.asyncAfter(deadline: .now() + SGDuration.slow) {
                withAnimation(.easeOut(duration: SGDuration.base)) {
                    textVisible = true
                }
                HapticEngine.flapSettle(count: 8, staggerMs: 40)
            }
            // Phase 3: credits
            DispatchQueue.main.asyncAfter(deadline: .now() + SGDuration.slow + SGDuration.slow) {
                withAnimation(.easeOut(duration: SGDuration.base)) {
                    creditsVisible = true
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Easter egg. Tap to dismiss.")
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - CRT Scanlines

private struct CRTScanlines: View {
    var body: some View {
        GeometryReader { geo in
            Canvas { context, size in
                let lineHeight: CGFloat = 3
                let gap: CGFloat = 3
                var y: CGFloat = 0
                while y < size.height {
                    let rect = CGRect(x: 0, y: y, width: size.width, height: lineHeight)
                    context.fill(Path(rect), with: .color(Color.black.opacity(0.35)))
                    y += lineHeight + gap
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

// MARK: - Liquid Glass Modifiers

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

// MARK: - Preview

#Preview("Settings View") {
    NavigationStack {
        SettingsView()
    }
    .environment(SettingsStore())
    .environment(SavedStore())
    .environment(Router())
    .environment(AuthStore())
    .environment(TravelerStore())
    .environment(BookingHistoryStore())
}
