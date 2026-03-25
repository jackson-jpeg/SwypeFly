import SwiftUI
import UIKit

// MARK: - Feed View
// Full-screen paging feed of flight deal cards with minimal header chrome.

struct FeedView: View {
    @Environment(FeedStore.self) private var feedStore
    @Environment(SavedStore.self) private var savedStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(Router.self) private var router
    @Environment(ToastManager.self) private var toastManager

    @State private var currentIndex: Int? = 0
    @State private var swipeCount: Int = 0
    @State private var headerVisible: Bool = true
    @State private var shareItem: SharedDealItem?
    @State private var headerHideTask: Task<Void, Never>?

    private var currentDeal: Deal? {
        guard let currentIndex,
              currentIndex >= 0,
              currentIndex < feedStore.deals.count else {
            return feedStore.deals.first
        }

        return feedStore.deals[currentIndex]
    }

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            if feedStore.isLoading && feedStore.allDeals.isEmpty {
                loadingState
            } else if feedStore.isEmpty {
                emptyState
            } else {
                feedContent
            }
        }
        .task {
            // Feed is preloaded at app launch (SoGoJetApp.task).
            // Only fetch here if not already loading/loaded (e.g., navigated back after a reset).
            if feedStore.allDeals.isEmpty && !feedStore.isLoading {
                await feedStore.fetchDeals(origin: settingsStore.departureCode)
            }
        }
        .onChange(of: settingsStore.departureCode) { _, newCode in
            currentIndex = 0
            swipeCount = 0
            headerVisible = true
            headerHideTask?.cancel()
            Task {
                await feedStore.fetchDeals(origin: newCode)
            }
        }
        .onChange(of: feedStore.deals.map(\.id)) { _, deals in
            guard !deals.isEmpty else {
                currentIndex = 0
                return
            }

            if let index = currentIndex, index >= deals.count {
                currentIndex = 0
            }
        }
        .onChange(of: currentIndex) { oldValue, newValue in
            guard let newIdx = newValue, oldValue != newValue else { return }
            let oldIdx = oldValue ?? 0
            swipeCount += 1
            HapticEngine.light()

            if swipeCount >= 2 && headerVisible {
                withAnimation(.easeOut(duration: 0.4)) {
                    headerVisible = false
                }
            }

            if oldIdx < feedStore.deals.count {
                let skippedDeal = feedStore.deals[oldIdx]
                if !savedStore.isSaved(id: skippedDeal.id) {
                    feedStore.recordSwipe(dealId: skippedDeal.id, action: "skipped")
                }
            }

            if newIdx >= feedStore.deals.count - 2 {
                Task {
                    await feedStore.fetchMore(origin: settingsStore.departureCode)
                }
            }

            if newIdx < feedStore.deals.count {
                let deal = feedStore.deals[newIdx]
                UIAccessibility.post(
                    notification: .announcement,
                    argument: "\(deal.destination), \(deal.priceFormatted)"
                )
            }
        }
        .sheet(item: $shareItem) { item in
            ShareSheet(activityItems: item.activityItems)
        }
        .onDisappear {
            headerHideTask?.cancel()
        }
        .overlay(alignment: .top) {
            if headerVisible && !feedStore.deals.isEmpty {
                headerOverlay
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }

    // MARK: - Feed Content

    private var feedContent: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(spacing: 0) {
                ForEach(Array(feedStore.deals.enumerated()), id: \.element.id) { index, deal in
                    DealCard(
                        deal: deal,
                        isSaved: savedStore.isSaved(id: deal.id),
                        isFirst: index == 0,
                        animate: abs((currentIndex ?? 0) - index) <= 1,
                        onSave: { saveDeal(deal) },
                        onShare: { shareDeal(deal) },
                        onBook: { bookDeal(deal) },
                        onTap: { openDeal(deal) }
                    )
                    .containerRelativeFrame([.horizontal, .vertical])
                    .id(index)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $currentIndex)
        .ignoresSafeArea()
        .refreshable {
            await feedStore.fetchDeals(origin: settingsStore.departureCode)
        }
        .accessibilityHint("Swipe up or down to browse flight deals")
    }

    // MARK: - Header Overlay

    private var headerOverlay: some View {
        VStack(spacing: 0) {
            Spacer().frame(height: 0)
            headerControls
                .padding(.horizontal, Spacing.md)
                .padding(.top, Spacing.sm)
                .padding(.bottom, Spacing.sm)
        }
        .background(Color.sgBg.opacity(0.84))
        .background(.ultraThinMaterial)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge) // Cap scaling — header controls
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.sgBorder.opacity(0.45))
                .frame(height: 1)
        }
    }

    private var headerControls: some View {
        HStack(spacing: Spacing.sm) {
            Button {
                HapticEngine.selection()
                router.showDeparturePicker()
            } label: {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "airplane.circle.fill")
                        .font(.system(size: 13, weight: .semibold))
                    Text(settingsStore.departureCode)
                        .font(SGFont.bodyBold(size: 13))
                    Text(settingsStore.departureCity)
                        .font(SGFont.body(size: 12))
                        .lineLimit(1)
                }
                .foregroundStyle(Color.sgYellow)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.sm)
                .background(Color.sgYellow.opacity(0.1), in: RoundedRectangle(cornerRadius: Radius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md)
                        .strokeBorder(Color.sgYellow.opacity(0.28), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Departure airport \(settingsStore.departureCode)")
            .accessibilityHint("Open airport picker")

            Spacer(minLength: 0)

            FeedHeaderButton(
                systemName: "magnifyingglass",
                action: {
                    HapticEngine.light()
                    router.showSearch()
                }
            )
            .accessibilityLabel("Search destinations")

            FeedHeaderButton(
                systemName: "slider.horizontal.3",
                badge: feedStore.activeFilterCount > 0 ? "\(feedStore.activeFilterCount)" : nil,
                isActive: feedStore.activeFilterCount > 0,
                action: {
                    HapticEngine.light()
                    router.showFilters()
                }
            )
            .accessibilityLabel(feedStore.activeFilterCount > 0 ? "Filters, \(feedStore.activeFilterCount) active" : "Open filters")
        }
    }

    // MARK: - Loading State

    private var loadingState: some View {
        VStack(spacing: Spacing.md) {
            Spacer()

            ProgressView()
                .progressViewStyle(.circular)
                .tint(Color.sgYellow)
                .scaleEffect(1.3)

            Text("Loading flights from \(settingsStore.departureCode)…")
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgWhiteDim)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                // Title
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text(feedStore.hasActiveFilters ? "No Matches" : "No Routes")
                        .font(SGFont.display(size: 28))
                        .foregroundStyle(Color.sgWhite)

                    Text(feedStore.hasActiveFilters
                        ? "Your filters ruled out all routes. Clear them or try a nearby airport."
                        : "No live routes from \(settingsStore.departureCode) right now. Try a nearby airport.")
                        .font(SGFont.body(size: 14))
                        .foregroundStyle(Color.sgWhiteDim)
                }

                // Error detail
                if let error = feedStore.error {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color.sgOrange)
                        Text(error)
                            .font(SGFont.body(size: 13))
                            .foregroundStyle(Color.sgWhiteDim)
                    }
                    .padding(Spacing.md)
                    .background(Color.sgOrange.opacity(0.1), in: RoundedRectangle(cornerRadius: Radius.md))
                }

                // Clear filters
                if feedStore.hasActiveFilters {
                    Button {
                        Task {
                            await feedStore.clearFilters(origin: settingsStore.departureCode)
                        }
                    } label: {
                        Label("Clear Filters", systemImage: "line.3.horizontal.decrease.circle")
                            .font(SGFont.bodyBold(size: 14))
                            .foregroundStyle(Color.sgYellow)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Spacing.md)
                            .background(Color.sgYellow.opacity(0.1), in: RoundedRectangle(cornerRadius: Radius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.md)
                                    .strokeBorder(Color.sgYellow.opacity(0.28), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }

                // Nearby airports
                if !feedStore.hasActiveFilters {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        Text("Nearby Airports")
                            .font(SGFont.bodyBold(size: 13))
                            .foregroundStyle(Color.sgWhiteDim)

                        HStack(spacing: Spacing.sm) {
                            ForEach(nearbyAirports, id: \.self) { code in
                                NearbyAirportButton(code: code) {
                                    Task {
                                        if let airport = AirportPicker.airports.first(where: { $0.code == code }) {
                                            settingsStore.setDeparture(code: code, city: airport.city)
                                        } else {
                                            settingsStore.departureCode = code
                                        }
                                        await feedStore.fetchDeals(origin: code)
                                    }
                                }
                            }
                        }
                    }
                }

                // Retry
                Button {
                    Task {
                        await feedStore.fetchDeals(origin: settingsStore.departureCode)
                    }
                } label: {
                    Label("Retry", systemImage: "arrow.clockwise")
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgWhite)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.md)
                        .background(Color.sgWhite.opacity(0.08), in: RoundedRectangle(cornerRadius: Radius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.md)
                                .strokeBorder(Color.sgWhiteDim.opacity(0.28), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.top, Spacing.xl)
            .padding(.bottom, Spacing.xl)
        }
    }

    // MARK: - Actions

    private func saveDeal(_ deal: Deal) {
        HapticEngine.medium()
        let nowSaved = savedStore.toggle(deal: deal)
        feedStore.recordSwipe(dealId: deal.id, action: nowSaved ? "saved" : "unsaved")
        toastManager.show(
            message: nowSaved ? "\(deal.city) saved!" : "\(deal.city) removed",
            type: nowSaved ? .success : .info,
            duration: 1.5
        )
    }

    private func shareDeal(_ deal: Deal) {
        HapticEngine.light()
        shareItem = SharedDealItem(deal: deal)
    }

    private func openDeal(_ deal: Deal) {
        HapticEngine.light()
        feedStore.recordSwipe(dealId: deal.id, action: "viewed")
        router.showDeal(deal)
    }

    private func bookDeal(_ deal: Deal) {
        HapticEngine.medium()
        feedStore.recordSwipe(dealId: deal.id, action: "viewed")
        router.startBooking(deal)
    }

    // MARK: - Helpers

    private var nearbyAirports: [String] {
        let nearby: [String: [String]] = [
            "JFK": ["EWR", "LGA", "PHL"],
            "EWR": ["JFK", "LGA", "PHL"],
            "LGA": ["JFK", "EWR", "PHL"],
            "LAX": ["SNA", "BUR", "LGB"],
            "SFO": ["OAK", "SJC"],
            "ORD": ["MDW"],
            "MDW": ["ORD"],
            "MIA": ["FLL", "PBI"],
            "FLL": ["MIA", "PBI"],
            "TPA": ["PIE", "SRQ", "MCO", "FLL"],
            "ATL": ["CLT"],
            "DFW": ["DAL", "IAH"],
            "SEA": ["PDX"],
            "BOS": ["PVD", "BDL"],
        ]
        return nearby[settingsStore.departureCode] ?? ["JFK", "LAX", "ORD"]
    }
}

// MARK: - Local Components

private struct FeedHeaderButton: View {
    let systemName: String
    var badge: String? = nil
    var isActive: Bool = false
    let action: () -> Void

    private var foreground: Color { isActive ? Color.sgYellow : Color.sgWhite }
    private var fill: Color { isActive ? Color.sgYellow.opacity(0.11) : Color.sgWhite.opacity(0.08) }
    private var border: Color { isActive ? Color.sgYellow.opacity(0.28) : Color.sgWhiteDim.opacity(0.28) }

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: systemName)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(foreground)
                    .frame(width: 40, height: 40)
                    .background(fill, in: RoundedRectangle(cornerRadius: Radius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md)
                            .strokeBorder(border, lineWidth: 1)
                    )

                if let badge {
                    Text(badge)
                        .font(SGFont.bodyBold(size: 10))
                        .foregroundStyle(Color.sgBg)
                        .frame(minWidth: 18, minHeight: 18)
                        .background(Color.sgYellow, in: Circle())
                        .offset(x: 5, y: -5)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

private struct NearbyAirportButton: View {
    let code: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(code)
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgYellow)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.sm)
                .background(
                    Capsule()
                        .strokeBorder(Color.sgYellow.opacity(0.35), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

private struct SharedDealItem: Identifiable {
    let id = UUID()
    let deal: Deal

    var activityItems: [Any] {
        var items: [Any] = [deal.shareText]
        if let url = deal.shareURL {
            items.append(url)
        }
        return items
    }
}

// MARK: - Share Sheet (UIKit bridge)

private struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Preview

#Preview("Feed View") {
    FeedView()
        .environment(FeedStore())
        .environment(SavedStore())
        .environment(SettingsStore())
        .environment(Router())
}
