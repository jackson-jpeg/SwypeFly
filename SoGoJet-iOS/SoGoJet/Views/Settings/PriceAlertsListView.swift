import SwiftUI

// MARK: - Price Alerts List View
// Displays and manages the user's price alerts with swipe-to-delete.

struct PriceAlertsListView: View {
    @Environment(AlertStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.sgBg.ignoresSafeArea()

                if store.isLoading && store.alerts.isEmpty {
                    ProgressView()
                        .tint(Color.sgYellow)
                } else if store.alerts.isEmpty {
                    emptyState
                } else {
                    alertsList
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .foregroundStyle(Color.sgWhite)
                    }
                    .accessibilityLabel("Close price alerts")
                }
                ToolbarItem(placement: .principal) {
                    Text("Price Alerts")
                        .font(SGFont.bodyBold(size: 16))
                        .foregroundStyle(Color.sgWhite)
                }
            }
            .task {
                await store.fetchAlerts()
            }
        }
    }

    // MARK: - Alerts List

    private var alertsList: some View {
        List {
            if !store.activeAlerts.isEmpty {
                Section {
                    ForEach(store.activeAlerts) { alert in
                        alertRow(alert, isActive: true)
                    }
                    .onDelete { offsets in
                        let alerts = store.activeAlerts
                        for offset in offsets {
                            let alert = alerts[offset]
                            Task { await store.deleteAlert(id: alert.id) }
                        }
                    }
                } header: {
                    Text("ACTIVE")
                        .font(SGFont.caption)
                        .foregroundStyle(Color.sgMuted)
                }
                .listRowBackground(Color.sgSurface)
            }

            if !store.triggeredAlerts.isEmpty {
                Section {
                    ForEach(store.triggeredAlerts) { alert in
                        alertRow(alert, isActive: false)
                    }
                    .onDelete { offsets in
                        let alerts = store.triggeredAlerts
                        for offset in offsets {
                            let alert = alerts[offset]
                            Task { await store.deleteAlert(id: alert.id) }
                        }
                    }
                } header: {
                    Text("TRIGGERED")
                        .font(SGFont.caption)
                        .foregroundStyle(Color.sgMuted)
                }
                .listRowBackground(Color.sgSurface)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    private func alertRow(_ alert: PriceAlert, isActive: Bool) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(alert.destinationId)
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgWhite)

                Text("Target: $\(alert.targetPrice)")
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgMuted)

                if let triggeredPrice = alert.triggeredPrice {
                    Text("Triggered at $\(Int(triggeredPrice))")
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgGreen)
                }
            }

            Spacer()

            if isActive {
                Image(systemName: "bell.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.sgYellow)
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.sgGreen)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(alert.destinationId), target price \(alert.targetPrice) dollars\(isActive ? ", active" : ", triggered")")
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "bell.slash")
                .font(.system(size: 40))
                .foregroundStyle(Color.sgMuted)

            Text("No Price Alerts")
                .font(SGFont.bodyBold(size: 18))
                .foregroundStyle(Color.sgWhite)

            Text("Set a price alert from any destination page to get notified when fares drop.")
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Button { dismiss() } label: {
                Text("Browse Deals")
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgYellow)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.sgYellow.opacity(0.12))
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Browse deals")
        }
    }
}
