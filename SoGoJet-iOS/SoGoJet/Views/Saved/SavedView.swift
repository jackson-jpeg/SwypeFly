import SwiftUI

// MARK: - Saved View
// Main saved tab screen with header, savings banner, and 2-column grid of saved deals.

struct SavedView: View {
    @Environment(SavedStore.self) private var savedStore

    @State private var sortMode: SortMode = .recent

    private enum SortMode: String, CaseIterable {
        case recent = "Recent"
        case priceUp = "Price \u{2191}"
        case priceDown = "Price \u{2193}"
    }

    private let columns = [
        GridItem(.flexible(), spacing: Spacing.sm),
        GridItem(.flexible(), spacing: Spacing.sm),
    ]

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            if savedStore.savedDeals.isEmpty {
                emptyState
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        header
                        savingsBanner
                        dealGrid
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.bottom, Spacing.xl)
                }
            }
        }
        .navigationTitle("")
        .navigationBarHidden(true)
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("SAVED")
                        .font(SGFont.display(size: 32))
                        .foregroundStyle(Color.sgWhite)
                        .tracking(2)

                    Text("\(savedStore.count) flight\(savedStore.count == 1 ? "" : "s") saved")
                        .font(SGFont.body(size: 13))
                        .foregroundStyle(Color.sgMuted)
                }

                Spacer()
            }

            // Sort chips
            HStack(spacing: Spacing.sm) {
                ForEach(SortMode.allCases, id: \.self) { mode in
                    Button {
                        HapticEngine.selection()
                        sortMode = mode
                    } label: {
                        Text(mode.rawValue)
                            .font(SGFont.bodyBold(size: 12))
                            .foregroundStyle(sortMode == mode ? Color.sgBg : Color.sgWhiteDim)
                            .padding(.horizontal, Spacing.sm + Spacing.xs)
                            .padding(.vertical, Spacing.xs + 2)
                            .background(
                                sortMode == mode
                                    ? AnyShapeStyle(Color.sgYellow)
                                    : AnyShapeStyle(Color.sgBorder)
                            )
                            .clipShape(Capsule())
                    }
                    .accessibilityLabel("Sort by \(mode.rawValue)")
                    .accessibilityAddTraits(sortMode == mode ? .isSelected : [])
                }
            }
        }
        .padding(.top, Spacing.md)
    }

    // MARK: - Savings Banner

    @ViewBuilder
    private var savingsBanner: some View {
        let banner = SavingsBanner(
            totalSavings: savedStore.totalSavings,
            totalValue: savedStore.totalValue,
            tripCount: savedStore.count
        )
        if banner.shouldShow {
            banner
        }
    }

    // MARK: - Deal Grid

    private var dealGrid: some View {
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
        VStack(spacing: Spacing.md) {
            Spacer()

            Image(systemName: "heart")
                .font(.system(size: 56))
                .foregroundStyle(Color.sgMuted)
                .accessibilityHidden(true)

            Text("No saved flights yet")
                .font(SGFont.sectionHead)
                .foregroundStyle(Color.sgWhiteDim)

            Text("Swipe through deals and tap the heart\nto save flights you love")
                .font(SGFont.bodyDefault)
                .foregroundStyle(Color.sgMuted)
                .multilineTextAlignment(.center)

            Spacer()
        }
        .frame(maxWidth: .infinity)
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
        // TODO: Navigate to booking flow
    }

    private func removeDeal(_ deal: Deal) {
        withAnimation(.easeOut(duration: 0.25)) {
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
}
