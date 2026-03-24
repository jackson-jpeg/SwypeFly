import SwiftUI

// MARK: - Settings View
// Native List with sections matching the Expo settings screen.

struct SettingsView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(SavedStore.self) private var savedStore

    @State private var showAirportPicker = false
    @State private var showClearConfirmation = false

    var body: some View {
        @Bindable var settings = settings
        ZStack {
            Color.sgBg.ignoresSafeArea()

            List {
                departureSection
                displaySection
                notificationsSection
                dataSection
                aboutSection
            }
            .scrollContentBackground(.hidden)
            .listStyle(.insetGrouped)
        }
        .navigationTitle("Settings")
        .toolbarColorScheme(.dark, for: .navigationBar)
        .navigationDestination(isPresented: $showAirportPicker) {
            AirportPicker(selectedCode: Binding(
                get: { settings.departureCode },
                set: { newCode in
                    // Look up city name from airport list
                    if let airport = AirportPicker.airports.first(where: { $0.code == newCode }) {
                        settings.setDeparture(code: newCode, city: airport.city)
                    } else {
                        settings.departureCode = newCode
                    }
                }
            ))
        }
        .alert("Clear Saved Flights", isPresented: $showClearConfirmation) {
            Button("Clear All", role: .destructive) {
                HapticEngine.heavy()
                savedStore.clear()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will remove all \(savedStore.count) saved flights. This action cannot be undone.")
        }
    }

    // MARK: - Departure

    private var departureSection: some View {
        Section {
            Button {
                showAirportPicker = true
            } label: {
                HStack {
                    Label("Airport", systemImage: "airplane.departure")
                        .font(SGFont.bodyDefault)
                        .foregroundStyle(Color.sgWhite)

                    Spacer()

                    SplitFlapRow(
                        text: settings.departureCode,
                        maxLength: 3,
                        size: .sm,
                        color: Color.sgYellow,
                        animate: true,
                        staggerMs: 50
                    )

                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.sgFaint)
                }
            }
            .listRowBackground(Color.sgCell)
        } header: {
            Text("DEPARTURE")
                .font(SGFont.caption)
                .foregroundStyle(Color.sgMuted)
        }
    }

    // MARK: - Display

    private var displaySection: some View {
        Section {
            HStack {
                Label("View", systemImage: "rectangle.grid.2x2")
                    .font(SGFont.bodyDefault)
                    .foregroundStyle(Color.sgWhite)

                Spacer()

                Picker("View Mode", selection: Binding(
                    get: { settings.preferredView },
                    set: { settings.preferredView = $0 }
                )) {
                    Text("Swipe").tag("grid")
                    Text("Board").tag("list")
                }
                .pickerStyle(.segmented)
                .frame(width: 140)
            }
            .listRowBackground(Color.sgCell)
        } header: {
            Text("DISPLAY")
                .font(SGFont.caption)
                .foregroundStyle(Color.sgMuted)
        }
    }

    // MARK: - Notifications

    private var notificationsSection: some View {
        Section {
            Toggle(isOn: Binding(
                get: { settings.notificationsEnabled },
                set: { settings.notificationsEnabled = $0 }
            )) {
                Label("Push Notifications", systemImage: "bell.fill")
                    .font(SGFont.bodyDefault)
                    .foregroundStyle(Color.sgWhite)
            }
            .tint(Color.sgGreen)
            .listRowBackground(Color.sgCell)

            Toggle(isOn: Binding(
                get: { settings.priceAlertsEnabled },
                set: { settings.priceAlertsEnabled = $0 }
            )) {
                Label("Price Alerts", systemImage: "tag.fill")
                    .font(SGFont.bodyDefault)
                    .foregroundStyle(Color.sgWhite)
            }
            .tint(Color.sgGreen)
            .listRowBackground(Color.sgCell)
        } header: {
            Text("NOTIFICATIONS")
                .font(SGFont.caption)
                .foregroundStyle(Color.sgMuted)
        }
    }

    // MARK: - Data

    private var dataSection: some View {
        Section {
            Button {
                showClearConfirmation = true
            } label: {
                HStack {
                    Label("Clear Saved Flights", systemImage: "trash")
                        .font(SGFont.bodyDefault)
                        .foregroundStyle(Color.sgRed)

                    Spacer()

                    if savedStore.count > 0 {
                        Text("\(savedStore.count)")
                            .font(SGFont.bodyBold(size: 13))
                            .foregroundStyle(Color.sgMuted)
                    }
                }
            }
            .disabled(savedStore.count == 0)
            .listRowBackground(Color.sgCell)
        } header: {
            Text("DATA")
                .font(SGFont.caption)
                .foregroundStyle(Color.sgMuted)
        }
    }

    // MARK: - About

    private var aboutSection: some View {
        Section {
            Link(destination: URL(string: "https://sogojet.com/legal/privacy")!) {
                HStack {
                    Label("Privacy Policy", systemImage: "lock.shield")
                        .font(SGFont.bodyDefault)
                        .foregroundStyle(Color.sgWhite)
                    Spacer()
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.sgFaint)
                }
            }
            .listRowBackground(Color.sgCell)

            Link(destination: URL(string: "https://sogojet.com/legal/terms")!) {
                HStack {
                    Label("Terms of Service", systemImage: "doc.text")
                        .font(SGFont.bodyDefault)
                        .foregroundStyle(Color.sgWhite)
                    Spacer()
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.sgFaint)
                }
            }
            .listRowBackground(Color.sgCell)

            Link(destination: URL(string: "mailto:hello@sogojet.com")!) {
                HStack {
                    Label("Contact", systemImage: "envelope")
                        .font(SGFont.bodyDefault)
                        .foregroundStyle(Color.sgWhite)
                    Spacer()
                    Text("hello@sogojet.com")
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                }
            }
            .listRowBackground(Color.sgCell)

            HStack {
                Label("Version", systemImage: "info.circle")
                    .font(SGFont.bodyDefault)
                    .foregroundStyle(Color.sgWhite)
                Spacer()
                Text("2.0.0")
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgMuted)
            }
            .listRowBackground(Color.sgCell)
        } header: {
            Text("ABOUT")
                .font(SGFont.caption)
                .foregroundStyle(Color.sgMuted)
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
}
