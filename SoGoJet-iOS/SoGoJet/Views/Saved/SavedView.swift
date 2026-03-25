import SwiftUI

// MARK: - Saved View
// Clean grid of saved destinations with minimal chrome.

struct SavedView: View {
    @Environment(SavedStore.self) private var savedStore
    @Environment(Router.self) private var router
    @Environment(ToastManager.self) private var toastManager

    @State private var sortMode: SortMode = .recent
    @State private var showComparePicker = false
    @State private var showCompareView = false
    @State private var compareA: Deal?
    @State private var compareB: Deal?

    private enum SortMode: String, CaseIterable {
        case recent = "Latest"
        case priceUp = "Lowest Fare"
        case priceDown = "Highest Fare"
    }

    private let columns = [
        GridItem(.flexible(), spacing: Spacing.sm),
        GridItem(.flexible(), spacing: Spacing.sm),
    ]

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                headerSection
                    .padding(.top, Spacing.lg)

                if savedStore.savedDeals.isEmpty {
                    emptyState
                } else {
                    summaryLine
                    sortBar
                    cardGrid
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
        .background(Color.sgBg)
        .navigationTitle("")
        .navigationBarHidden(true)
        .sheet(isPresented: $showComparePicker) {
            ComparePickerView(
                deals: sortedDeals,
                selectedA: $compareA,
                selectedB: $compareB,
                onCompare: {
                    // Small delay so picker sheet dismisses first
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                        showCompareView = true
                    }
                }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showCompareView) {
            if let a = compareA, let b = compareB {
                CompareView(dealA: a, dealB: b)
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("SAVED TRIPS")
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgYellow)
                .tracking(1.5)
            Text("Saved Routes")
                .font(SGFont.display(size: 28))
                .foregroundStyle(Color.sgWhite)
            Text("Your saved destinations.")
                .font(SGFont.accent(size: 15))
                .foregroundStyle(Color.sgMuted)
        }
    }

    // MARK: - Summary Line

    private var summaryLine: some View {
        let count = savedStore.count
        let totalValue = savedStore.savedDeals.compactMap(\.displayPrice).reduce(0, +)
        let text: String = if totalValue > 0 {
            "\(count) saved \(count == 1 ? "route" : "routes") \u{00B7} $\(Int(totalValue)) total value"
        } else {
            "\(count) saved \(count == 1 ? "route" : "routes")"
        }

        return Text(text)
            .font(SGFont.body(size: 13))
            .foregroundStyle(Color.sgMuted)
            .padding(.horizontal, Spacing.xs)
    }

    // MARK: - Sort Bar

    private var sortBar: some View {
        HStack(spacing: Spacing.sm) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.sm) {
                    ForEach(SortMode.allCases, id: \.self) { mode in
                        VintageTerminalSelectablePill(
                            title: mode.rawValue,
                            isSelected: sortMode == mode,
                            tone: .amber
                        ) {
                            HapticEngine.selection()
                            sortMode = mode
                        }
                    }
                }
            }

            if savedStore.savedDeals.count >= 2 {
                Button {
                    HapticEngine.selection()
                    compareA = nil
                    compareB = nil
                    showComparePicker = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.left.arrow.right")
                            .font(.system(size: 10, weight: .semibold))
                        Text("Compare")
                            .font(SGFont.bodyBold(size: 12))
                    }
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, Spacing.sm + Spacing.xs)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.sgYellow)
                    .clipShape(Capsule())
                }
            }
        }
    }

    // MARK: - Card Grid

    private var cardGrid: some View {
        LazyVGrid(columns: columns, spacing: Spacing.sm) {
            ForEach(sortedDeals) { deal in
                SavedCard(
                    deal: deal,
                    onTap: { router.showDeal(deal) },
                    onBook: { bookDeal(deal) },
                    onRemove: { removeDeal(deal) }
                )
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: Spacing.lg) {
            VStack(spacing: Spacing.sm) {
                Image(systemName: "heart")
                    .font(.system(size: 40, weight: .thin))
                    .foregroundStyle(Color.sgMuted)

                Text("No Saved Routes")
                    .font(SGFont.display(size: 22))
                    .foregroundStyle(Color.sgWhite)

                Text("Tap the heart on any deal to save it here.")
                    .font(SGFont.body(size: 14))
                    .foregroundStyle(Color.sgMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, Spacing.xl)

            VintageTerminalActionButton(
                title: "Explore Deals",
                subtitle: "Find routes worth saving",
                icon: "airplane",
                tone: .amber,
                fillsWidth: true
            ) {
                router.activeTab = .feed
            }
        }
        .padding(.horizontal, Spacing.md)
    }

    // MARK: - Sorting

    private var sortedDeals: [Deal] {
        switch sortMode {
        case .recent:
            return savedStore.savedDeals
        case .priceUp:
            return savedStore.savedDeals.sorted { ($0.displayPrice ?? .infinity) < ($1.displayPrice ?? .infinity) }
        case .priceDown:
            return savedStore.savedDeals.sorted { ($0.displayPrice ?? 0) > ($1.displayPrice ?? 0) }
        }
    }

    // MARK: - Actions

    private func bookDeal(_ deal: Deal) {
        HapticEngine.medium()
        router.startBooking(deal)
    }

    private func removeDeal(_ deal: Deal) {
        let store = savedStore

        // Optimistically remove from list
        withAnimation(.easeOut(duration: 0.25)) {
            store.remove(id: deal.id)
        }

        // Show undo toast (4s auto-dismiss; tap Undo to re-add)
        toastManager.show(
            message: "\(deal.city) removed",
            type: .info,
            duration: 4.0,
            actionLabel: "Undo"
        ) {
            withAnimation(.easeOut(duration: 0.25)) {
                store.add(deal: deal)
            }
            HapticEngine.success()
        }
    }
}

// MARK: - Preview

#Preview("Saved View") {
    NavigationStack {
        SavedView()
    }
    .environment(SavedStore())
    .environment(Router())
    .environment(ToastManager())
}
