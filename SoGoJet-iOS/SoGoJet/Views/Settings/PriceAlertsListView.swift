import SwiftUI
import Charts

// MARK: - Price Alerts List View
// Phase 6: each alert shows a mini sparkline + live flap price cell.
// Tap → detail sheet (SGSheet .medium).

struct PriceAlertsListView: View {
    @Environment(AlertStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var selectedAlert: PriceAlert?

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
        .sheet(item: $selectedAlert) { alert in
            AlertDetailSheet(alert: alert)
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Alerts List

    private var alertsList: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                if !store.activeAlerts.isEmpty {
                    alertSection(title: "ACTIVE", alerts: store.activeAlerts)
                }
                if !store.triggeredAlerts.isEmpty {
                    alertSection(title: "TRIGGERED", alerts: store.triggeredAlerts)
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
    }

    private func alertSection(title: String, alerts: [PriceAlert]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title)
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgMuted)
                .tracking(1.2)
                .padding(.leading, Spacing.xs)

            SGCard(elevation: .lifted, padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(alerts.enumerated()), id: \.element.id) { index, alert in
                        AlertRow(
                            alert: alert,
                            isActive: title == "ACTIVE",
                            onTap: { selectedAlert = alert },
                            onDelete: {
                                Task { await store.deleteAlert(id: alert.id) }
                            }
                        )
                        if index < alerts.count - 1 {
                            Divider()
                                .overlay(Color.sgHairline)
                                .padding(.horizontal, Spacing.md)
                        }
                    }
                }
            }
        }
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

// MARK: - Alert Row (swipe-to-delete + sparkline + live flap price)

private struct AlertRow: View {
    let alert: PriceAlert
    let isActive: Bool
    let onTap: () -> Void
    let onDelete: () -> Void

    @State private var animatePrice = false
    @State private var offset: CGFloat = 0
    @State private var showDeleteButton = false
    private let deleteThreshold: CGFloat = -70

    /// Mock 30-day price series — in a real app this would come from the store.
    private var mockPriceSeries: [Double] {
        let base = Double(alert.targetPrice)
        let seed = abs(alert.id.hashValue)
        return (0..<30).map { i in
            let variation = Double((seed &+ i) % 40) - 20
            let trend = Double(i) * 0.5
            return max(base * 0.7, min(base * 1.35, base + variation + trend))
        }
    }

    var body: some View {
        ZStack(alignment: .trailing) {
            // Delete button revealed on swipe
            if showDeleteButton {
                Button(role: .destructive, action: onDelete) {
                    VStack(spacing: 4) {
                        Image(systemName: "trash")
                            .font(.system(size: 16, weight: .semibold))
                        Text("Delete")
                            .font(SGFont.body(size: 11))
                    }
                    .foregroundStyle(Color.sgWhite)
                    .frame(width: 72)
                    .frame(maxHeight: .infinity)
                    .background(Color.sgRed)
                }
                .accessibilityLabel("Delete alert for \(alert.destinationId)")
            }

            // Row content
            HStack(spacing: Spacing.sm) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(alert.destinationId)
                        .font(SGFont.bodyBold(size: 15))
                        .foregroundStyle(Color.sgWhite)

                    Text("Target: $\(alert.targetPrice)")
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)

                    if let triggered = alert.triggeredPrice {
                        Text("Triggered at $\(Int(triggered))")
                            .font(SGFont.body(size: 11))
                            .foregroundStyle(Color.sgDealAmazing)
                    }
                }

                Spacer()

                // Mini sparkline (last 30 days)
                AlertSparkline(series: mockPriceSeries, targetPrice: Double(alert.targetPrice))
                    .frame(width: 56, height: 28)

                // Live flap price cell
                SplitFlapText(
                    text: "$\(alert.targetPrice)",
                    style: .price,
                    maxLength: 7,
                    animate: animatePrice,
                    hapticOnSettle: false
                )
                .frame(width: 60)

                Image(systemName: isActive ? "bell.fill" : "checkmark.circle.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(isActive ? Color.sgYellow : Color.sgDealAmazing)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm + 2)
            .background(Color.sgSurfaceElevated)
            .offset(x: offset)
            .gesture(
                DragGesture(minimumDistance: 10)
                    .onChanged { value in
                        guard value.translation.width < 0 else { return }
                        offset = max(value.translation.width, deleteThreshold - 10)
                        if value.translation.width < deleteThreshold / 2 && !showDeleteButton {
                            HapticEngine.warning()
                        }
                    }
                    .onEnded { value in
                        withAnimation(SGSpring.snappy) {
                            if value.translation.width < deleteThreshold {
                                offset = deleteThreshold
                                showDeleteButton = true
                            } else {
                                offset = 0
                                showDeleteButton = false
                            }
                        }
                    }
            )
            .onTapGesture {
                // Reset swipe then open detail
                withAnimation(SGSpring.snappy) {
                    offset = 0
                    showDeleteButton = false
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    onTap()
                }
            }
        }
        .clipped()
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                animatePrice = true
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(alert.destinationId), target price \(alert.targetPrice) dollars, \(isActive ? "active" : "triggered")")
        .accessibilityHint("Swipe left to delete, tap to view details")
    }
}

// MARK: - Alert Sparkline (mini 30-day price chart)

private struct AlertSparkline: View {
    let series: [Double]
    let targetPrice: Double

    private var minVal: Double { series.min() ?? 0 }
    private var maxVal: Double { max(series.max() ?? 1, minVal + 1) }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let points = series.enumerated().map { i, v in
                CGPoint(
                    x: w * CGFloat(i) / CGFloat(max(series.count - 1, 1)),
                    y: h * CGFloat(1 - (v - minVal) / (maxVal - minVal))
                )
            }
            let targetY = h * CGFloat(1 - (targetPrice - minVal) / (maxVal - minVal))

            ZStack {
                // Sparkline path
                Path { path in
                    guard let first = points.first else { return }
                    path.move(to: first)
                    for point in points.dropFirst() {
                        path.addLine(to: point)
                    }
                }
                .stroke(Color.sgMuted.opacity(0.6), lineWidth: 1)

                // Target price dashed line
                Path { path in
                    path.move(to: CGPoint(x: 0, y: targetY))
                    path.addLine(to: CGPoint(x: w, y: targetY))
                }
                .stroke(
                    Color.sgYellow.opacity(0.7),
                    style: StrokeStyle(lineWidth: 1, dash: [3, 2])
                )
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Alert Detail Sheet

private struct AlertDetailSheet: View {
    let alert: PriceAlert
    @Environment(\.dismiss) private var dismiss
    @Environment(AlertStore.self) private var store

    @State private var animatePrice = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.sgBg.ignoresSafeArea()

                VStack(spacing: Spacing.lg) {
                    // Destination header
                    SGCard(elevation: .hero) {
                        VStack(spacing: Spacing.sm) {
                            Text(alert.destinationId)
                                .sgFont(.hero)
                                .foregroundStyle(Color.sgWhite)

                            SplitFlapText(
                                text: "$\(alert.targetPrice)",
                                style: .price,
                                maxLength: 8,
                                animate: animatePrice,
                                hapticOnSettle: true
                            )

                            Text(alert.isActive ? "WATCHING FOR DROPS" : "ALERT TRIGGERED")
                                .sgFont(.micro)
                                .foregroundStyle(alert.isActive ? Color.sgYellow : Color.sgDealAmazing)
                                .tracking(2)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.sm)
                    }
                    .padding(.horizontal, Spacing.md)

                    // Delete button
                    SGButton("Delete Alert", style: .destructive) {
                        Task {
                            _ = await store.deleteAlert(id: alert.id)
                            dismiss()
                        }
                    }
                    .padding(.horizontal, Spacing.md)

                    Spacer()
                }
                .padding(.top, Spacing.md)
            }
            .navigationTitle("Alert Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Color.sgYellow)
                }
            }
            .toolbarBackground(Color.sgSurface, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                animatePrice = true
            }
        }
    }
}
