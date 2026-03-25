import SwiftUI

// MARK: - Saved View
// Clean grid of saved destinations with minimal chrome.

struct SavedView: View {
    @Environment(SavedStore.self) private var savedStore
    @Environment(Router.self) private var router

    @State private var sortMode: SortMode = .recent

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
        VintageTerminalScreen(headerSpacing: Spacing.md) {
            headerSection
        } content: {
            if savedStore.savedDeals.isEmpty {
                emptyState
            } else {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    summaryLine
                    sortBar
                    cardGrid
                }
            }
        }
        .navigationTitle("")
        .navigationBarHidden(true)
    }

    // MARK: - Header

    private var headerSection: some View {
        VintageTerminalHeroLockup(
            eyebrow: "Saved Trips",
            title: "Saved Routes",
            subtitle: "Your saved destinations.",
            accent: .amber
        )
        .padding(.top, Spacing.sm)
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
    }

    // MARK: - Card Grid

    private var cardGrid: some View {
        LazyVGrid(columns: columns, spacing: Spacing.sm) {
            ForEach(sortedDeals) { deal in
                SavedCard(
                    deal: deal,
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
        _ = withAnimation(.easeOut(duration: 0.25)) {
            savedStore.toggle(deal: deal)
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
}
