import SwiftUI

// MARK: - Settings View
// Vintage control lounge for departure preferences, archive management, and app policies.

struct SettingsView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(SavedStore.self) private var savedStore
    @Environment(Router.self) private var router
    @Environment(\.openURL) private var openURL

    @State private var showClearConfirmation = false
    @State private var diagnosticsExpanded = false

    private let modeCards: [ModeOption] = [
        .init(
            id: "grid",
            title: "Swipe Feed",
            subtitle: "TikTok-style discovery with immersive destination cards.",
            stamp: "Feed",
            tone: .amber
        ),
        .init(
            id: "list",
            title: "Terminal Board",
            subtitle: "Compact rows in a departure-board layout.",
            stamp: "Board",
            tone: .ivory
        ),
    ]

    var body: some View {
        VintageTerminalScreen(headerSpacing: Spacing.md) {
            headerSection
        } content: {
            VStack(alignment: .leading, spacing: Spacing.md) {
                operationsLounge
                displayDeck
                alertDeck
                archiveDeck
                aboutDeck
                diagnosticsDeck
                footerCluster
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
            Text("This will remove all \(savedStore.count) saved flights from your archive. This action cannot be undone.")
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack(alignment: .top, spacing: Spacing.md) {
                VintageTerminalHeroLockup(
                    eyebrow: "Settings",
                    title: "Settings",
                    subtitle: "",
                    accent: .amber
                )

                Spacer(minLength: 0)

                VintageTerminalPassportStamp(
                    title: "Version",
                    subtitle: appVersion,
                    tone: .ember
                )
            }

            VintageTerminalTagCloud(
                tags: activeTags,
                tone: .ivory
            )
        }
        .padding(.top, Spacing.sm)
    }

    // MARK: - Operations

    private var operationsLounge: some View {
        VintageTerminalPanel(
            title: "Departure",
            subtitle: "Change your home airport.",
            stamp: "Origin",
            tone: .amber
        ) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                HStack(alignment: .top, spacing: Spacing.md) {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        Text("Airport")
                            .font(SGFont.bodyBold(size: 10))
                            .foregroundStyle(Color.sgMuted)
                            .tracking(1.4)

                        SplitFlapRow(
                            text: settings.departureCode,
                            maxLength: 3,
                            size: .lg,
                            color: Color.sgYellow,
                            animate: true,
                            staggerMs: 35
                        )

                        Text(settings.departureCity)
                            .font(SGFont.sectionHead)
                            .foregroundStyle(Color.sgWhite)

                        Text("Every live price refresh is anchored to this airport unless a booking flow overrides it.")
                            .font(SGFont.body(size: 12))
                            .foregroundStyle(Color.sgMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Spacer(minLength: 0)

                    VintageTerminalPassportStamp(
                        title: "Mode",
                        subtitle: preferredViewLabel,
                        tone: settings.preferredView == "list" ? .ivory : .amber
                    )
                }

                VintageTerminalRouteDisplay(
                    originCode: settings.departureCode,
                    originLabel: settings.departureCity,
                    destinationCode: settings.preferredView == "list" ? "LST" : "CRD",
                    destinationLabel: settings.preferredView == "list" ? "Board view" : "Card view",
                    detail: "Change the origin once here and the rest of the app follows.",
                    tone: .amber
                )

                VintageTerminalActionCluster {
                    VintageTerminalActionButton(
                        title: "Choose Departure Airport",
                        subtitle: "Open the airport picker",
                        icon: "airplane.departure",
                        tone: .amber,
                        fillsWidth: true
                    ) {
                        HapticEngine.selection()
                        router.showDeparturePicker()
                    }
                } secondary: {
                    VintageTerminalSecondaryButton(
                        title: "Return to Explore",
                        subtitle: "Jump back into active deal discovery",
                        icon: "airplane",
                        tone: .neutral,
                        fillsWidth: true
                    ) {
                        router.activeTab = .feed
                    }
                }
            }
        }
    }

    // MARK: - Display

    private var displayDeck: some View {
        VintageTerminalPanel(
            title: "Display",
            subtitle: "",
            stamp: "View",
            tone: .ivory
        ) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                ForEach(modeCards) { option in
                    modeCard(for: option)
                }

                VintageTerminalInsetPanel(tone: settings.preferredView == "list" ? .ivory : .amber) {
                    VintageTerminalInfoRow(
                        icon: settings.preferredView == "list" ? "rectangle.grid.1x2" : "rectangle.portrait.on.rectangle.portrait",
                        title: currentModeHeadline,
                        value: currentModeExplanation,
                        detail: "Both surfaces use the same deals. This setting only changes presentation.",
                        tone: settings.preferredView == "list" ? .ivory : .amber
                    )
                }
            }
        }
    }

    private func modeCard(for option: ModeOption) -> some View {
        Button {
            HapticEngine.selection()
            settings.preferredView = option.id
        } label: {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(spacing: Spacing.sm) {
                    VintageTerminalSelectablePill(
                        title: option.stamp,
                        isSelected: settings.preferredView == option.id,
                        tone: option.tone
                    ) {}
                    .allowsHitTesting(false)

                    Spacer(minLength: 0)

                    if settings.preferredView == option.id {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(option.tone.accent)
                    }
                }

                Text(option.title)
                    .font(SGFont.sectionHead)
                    .foregroundStyle(Color.sgWhite)

                Text(option.subtitle)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgWhiteDim)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.md)
            .background(option.tone.softFill, in: RoundedRectangle(cornerRadius: Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .strokeBorder(
                        settings.preferredView == option.id ? option.tone.accent : option.tone.border,
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Alerts

    private var alertDeck: some View {
        VintageTerminalPanel(
            title: "Notifications",
            subtitle: "Manage your notification preferences.",
            stamp: "Alerts",
            tone: .moss
        ) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                VintageTerminalToggleRow(
                    icon: "bell.badge.fill",
                    title: "Push notifications",
                    subtitle: "Trip nudges, booking reminders, and major app notices.",
                    isOn: notificationBinding,
                    tone: .moss
                )

                VintageTerminalToggleRow(
                    icon: "tag.fill",
                    title: "Price alert emails",
                    subtitle: "Enable destination email alerts from detail cards and booking surfaces.",
                    isOn: priceAlertsBinding,
                    tone: .amber
                )

                VintageTerminalInsetPanel(tone: settings.priceAlertsEnabled ? .amber : .neutral) {
                    VintageTerminalInfoRow(
                        icon: settings.priceAlertsEnabled ? "envelope.badge.fill" : "envelope.open",
                        title: settings.priceAlertsEnabled ? "Alert route active" : "Alerts paused",
                        value: alertSummaryTitle,
                        detail: alertSummaryDetail,
                        tone: settings.priceAlertsEnabled ? .amber : .neutral
                    )
                }
            }
        }
    }

    // MARK: - Archive

    private var archiveDeck: some View {
        VintageTerminalPanel(
            title: "Saved Stats",
            subtitle: "",
            stamp: "Saved",
            tone: .ember
        ) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                VintageTerminalMetricDeck(metrics: [
                    VintageTerminalMetric(
                        title: "Saved Routes",
                        value: "\(savedStore.count)",
                        footnote: savedStore.count == 0 ? "No trips saved yet" : "Trips saved for quick access",
                        tone: .amber
                    ),
                    VintageTerminalMetric(
                        title: "Tracked Savings",
                        value: savedStore.totalSavings == 0 ? "$0" : "$\(Int(savedStore.totalSavings))",
                        footnote: savedStore.totalSavings == 0 ? "Waiting on the next fare drop" : "Total savings across saved trips",
                        tone: .moss
                    ),
                    VintageTerminalMetric(
                        title: "Archive Value",
                        value: savedStore.totalValue == 0 ? "$0" : "$\(Int(savedStore.totalValue))",
                        footnote: "Combined fare value of saved trips",
                        tone: .ivory
                    ),
                    VintageTerminalMetric(
                        title: "Collection",
                        value: savedStore.count >= 6 ? "Stacked" : savedStore.count >= 1 ? "Growing" : "Empty",
                        footnote: savedStore.count >= 6 ? "Your collection status" : "A few more saves will make this useful",
                        tone: .ember
                    ),
                ])

                VintageTerminalActionCluster {
                    VintageTerminalActionButton(
                        title: "Open Saved Archive",
                        subtitle: "Review your saved trips",
                        icon: "heart.fill",
                        tone: .ember,
                        fillsWidth: true
                    ) {
                        router.activeTab = .saved
                    }
                } secondary: {
                    VintageTerminalSecondaryButton(
                        title: "Clear Saved Flights",
                        subtitle: savedStore.count == 0 ? "Nothing saved yet" : "Remove all saved trips",
                        icon: "trash",
                        tone: .neutral,
                        fillsWidth: true
                    ) {
                        showClearConfirmation = true
                    }
                    .disabled(savedStore.count == 0)
                }
            }
        }
    }

    // MARK: - About

    private var aboutDeck: some View {
        VintageTerminalPanel(
            title: "About",
            subtitle: "",
            stamp: "Info",
            tone: .neutral
        ) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                VintageTerminalLinkRow(
                    icon: "lock.shield",
                    title: "Privacy Policy",
                    detail: "How SoGoJet handles account, pricing, and alert data.",
                    tone: .neutral
                ) {
                    openURL(URL(string: "https://sogojet.com/legal/privacy")!)
                }

                VintageTerminalLinkRow(
                    icon: "doc.text",
                    title: "Terms of Service",
                    detail: "Usage terms, booking assumptions, and affiliate disclosures.",
                    tone: .neutral
                ) {
                    openURL(URL(string: "https://sogojet.com/legal/terms")!)
                }

                VintageTerminalLinkRow(
                    icon: "envelope",
                    title: "Contact SoGoJet",
                    detail: "hello@sogojet.com",
                    tone: .neutral
                ) {
                    openURL(URL(string: "mailto:hello@sogojet.com")!)
                }
            }
        }
    }

    // MARK: - Diagnostics

    private var diagnosticsDeck: some View {
        VintageTerminalPanel(
            title: "App Info",
            subtitle: "",
            stamp: diagnosticsExpanded ? "Expanded" : "Summary",
            tone: .ivory
        ) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                VintageTerminalActionCluster {
                    VintageTerminalSecondaryButton(
                        title: diagnosticsExpanded ? "Collapse notes" : "Expand notes",
                        subtitle: "Show what these controls actually influence in the app",
                        icon: diagnosticsExpanded ? "chevron.up" : "chevron.down",
                        tone: .ivory,
                        fillsWidth: true
                    ) {
                        HapticEngine.selection()
                        withAnimation(.easeInOut(duration: 0.22)) {
                            diagnosticsExpanded.toggle()
                        }
                    }
                } secondary: {
                    VintageTerminalSecondaryButton(
                        title: "Current departure label",
                        subtitle: settings.departureLabel,
                        icon: "location",
                        tone: .neutral,
                        fillsWidth: true
                    ) {}
                    .disabled(true)
                }

                if diagnosticsExpanded {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        VintageTerminalChecklistItem(
                            title: "Origin synchronization",
                            detail: "Feed searches, board mode, and booking all read from the same departure code unless a route-specific override is in play.",
                            tone: .amber
                        )
                        VintageTerminalChecklistItem(
                            title: "Display mode",
                            detail: "Swipe Feed and Terminal Board are just two presentations over the same deal pool, so changing the mode does not change your data source.",
                            tone: .ivory
                        )
                        VintageTerminalChecklistItem(
                            title: "Alerts",
                            detail: "Email alerts are active. Native push alerts coming soon.",
                            tone: .moss
                        )
                    }
                }
            }
        }
    }

    // MARK: - Footer

    private var footerCluster: some View {
        VintageTerminalActionCluster {
            VintageTerminalActionButton(
                title: "Return to Explore",
                subtitle: "Browse deals",
                icon: "airplane.departure",
                tone: .amber,
                fillsWidth: true
            ) {
                router.activeTab = .feed
            }
        } secondary: {
            VintageTerminalSecondaryButton(
                title: "Current build",
                subtitle: "SoGoJet \(appVersion)",
                icon: "info.circle",
                tone: .neutral,
                fillsWidth: true
            ) {}
            .disabled(true)
        }
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

    private var preferredViewLabel: String {
        settings.preferredView == "list" ? "Terminal Board" : "Swipe Feed"
    }

    private var currentModeHeadline: String {
        settings.preferredView == "list" ? "Board mode is live" : "Swipe mode is live"
    }

    private var currentModeExplanation: String {
        settings.preferredView == "list"
            ? "The explore tab opens on the departure board with compact deal rows."
            : "The explore tab opens on full-bleed destination cards with vertical paging and richer imagery."
    }

    private var alertSummaryTitle: String {
        let trimmedEmail = settings.alertEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedEmail.isEmpty else {
            return "No alert email on file yet"
        }

        return maskedEmail(trimmedEmail)
    }

    private var alertSummaryDetail: String {
        let trimmedEmail = settings.alertEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedEmail.isEmpty else {
            return "Set up a destination alert from a detail screen or booking flow and the email appears here."
        }

        return "Email notifications are enabled."
    }

    private var activeTags: [String] {
        var tags = [settings.departureCode, preferredViewLabel]
        tags.append(settings.notificationsEnabled ? "Push On" : "Push Off")
        tags.append(settings.priceAlertsEnabled ? "Alerts On" : "Alerts Off")
        return tags
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

private struct ModeOption: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let stamp: String
    let tone: VintageTerminalTone
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
