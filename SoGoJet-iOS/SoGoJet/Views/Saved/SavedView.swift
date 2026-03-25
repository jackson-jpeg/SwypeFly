import SwiftUI

// MARK: - Saved View
// Curated archive of saved routes presented like a warm operations ledger.

struct SavedView: View {
    @Environment(SavedStore.self) private var savedStore
    @Environment(Router.self) private var router

    @State private var sortMode: SortMode = .recent

    private enum SortMode: String, CaseIterable {
        case recent = "Latest"
        case priceUp = "Lowest Fare"
        case priceDown = "Highest Fare"

        var subtitle: String {
            switch self {
            case .recent:
                return "Newest saves first"
            case .priceUp:
                return "Cheapest first"
            case .priceDown:
                return "Most expensive first"
            }
        }
    }

    private let columns = [
        GridItem(.flexible(), spacing: Spacing.sm),
        GridItem(.flexible(), spacing: Spacing.sm),
    ]

    private var featuredDeal: Deal? {
        sortedDeals.first
    }

    private var cheapestDeal: Deal? {
        savedStore.savedDeals.min { ($0.displayPrice ?? .infinity) < ($1.displayPrice ?? .infinity) }
    }

    private var strongestSavingsDeal: Deal? {
        savedStore.savedDeals.max { ($0.savingsAmount ?? 0) < ($1.savingsAmount ?? 0) }
    }

    private var averageSavedFare: Double {
        let fares = savedStore.savedDeals.compactMap(\.displayPrice)
        guard !fares.isEmpty else { return 0 }
        return fares.reduce(0, +) / Double(fares.count)
    }

    private var savedRegions: [String] {
        let regions = savedStore.savedDeals.compactMap { FeedStore.region(for: $0.country) }
        return Array(NSOrderedSet(array: regions)).compactMap { $0 as? String }
    }

    var body: some View {
        VintageTerminalScreen(headerSpacing: Spacing.md) {
            headerSection
        } content: {
            if savedStore.savedDeals.isEmpty {
                emptyState
            } else {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    travelLedger
                    archiveManifest
                    sortDeck
                    if let featuredDeal {
                        featuredTicket(for: featuredDeal)
                    }
                    collectionSection
                }
            }
        }
        .navigationTitle("")
        .navigationBarHidden(true)
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack(alignment: .top) {
                VintageTerminalHeroLockup(
                    eyebrow: "Saved Trips",
                    title: "Saved Routes",
                    subtitle: "Your saved destinations.",
                    accent: .amber
                )

                Spacer(minLength: 0)

                VintageTerminalPassportStamp(
                    title: "Saved",
                    subtitle: "\(savedStore.count) saved",
                    tone: .ember
                )
            }

            if !savedRegions.isEmpty {
                VintageTerminalTagCloud(tags: savedRegions, tone: .ivory)
            }
        }
        .padding(.top, Spacing.sm)
    }

    // MARK: - Ledger

    private var travelLedger: some View {
        VintageTerminalPanel(
            title: "Overview",
            subtitle: "",
            stamp: "Overview",
            tone: .amber
        ) {
            VintageTerminalMetricDeck(metrics: [
                .init(
                    title: "Saved Routes",
                    value: "\(savedStore.count)",
                    footnote: "Saved trips",
                    tone: .amber
                ),
                .init(
                    title: "Tracked Savings",
                    value: savedStore.totalSavings == 0 ? "No delta" : "$\(Int(savedStore.totalSavings))",
                    footnote: strongestSavingsDeal.map { "Best deal: \($0.destination)" } ?? "Waiting on the next drop",
                    tone: .moss
                ),
                .init(
                    title: "Average Fare",
                    value: averageSavedFare == 0 ? "No fare" : "$\(Int(averageSavedFare))",
                    footnote: cheapestDeal.map { "Cheapest now: \($0.destination)" } ?? "No route data yet",
                    tone: .ivory
                ),
                .init(
                    title: "Regions",
                    value: "\(savedRegions.count)",
                    footnote: savedRegions.isEmpty ? "No regions catalogued yet" : savedRegions.joined(separator: ", "),
                    tone: .ember
                ),
            ])
        }
    }

    // MARK: - Manifest

    private var archiveManifest: some View {
        VintageTerminalManifestCard(
            title: "Top Picks",
            subtitle: "Your best saved deals.",
            tone: .ember
        ) {
            ForEach(Array(sortedDeals.prefix(3).enumerated()), id: \.element.id) { index, deal in
                VStack(spacing: 0) {
                    VintageTerminalManifestRow(
                        prefix: "\(index + 1)",
                        title: deal.iataCode,
                        value: "\(deal.destination), \(deal.country)",
                        subtitle: "\(deal.priceFormatted) roundtrip · \(deal.safeFlightDuration)",
                        tone: index == 0 ? .amber : .neutral
                    )

                    if index < min(sortedDeals.count, 3) - 1 {
                        Divider()
                            .overlay(Color.sgBorder)
                    }
                }
            }
        }
    }

    // MARK: - Sort Deck

    private var sortDeck: some View {
        VintageTerminalPanel(
            title: "Sort",
            subtitle: sortMode.subtitle,
            stamp: "Sort",
            tone: .neutral
        ) {
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
    }

    // MARK: - Featured Ticket

    private func featuredTicket(for deal: Deal) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            VintageTerminalCollectionHeader(
                title: "Featured",
                subtitle: "A highlight from your saved trips."
            )

            VintageTravelTicket(tone: .amber) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        VintageTerminalSectionLabel(text: "Featured Trip", tone: .amber)
                        Text(deal.destination.uppercased())
                            .font(SGFont.display(size: 34))
                            .foregroundStyle(Color.sgWhite)
                            .tracking(1.2)
                        Text(deal.country)
                            .font(SGFont.body(size: 13))
                            .foregroundStyle(Color.sgWhiteDim)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 4) {
                        Text(deal.priceFormatted)
                            .font(SGFont.display(size: 36))
                            .foregroundStyle(Color.sgYellow)

                        if let savings = deal.savingsAmount {
                            Text("Save $\(Int(savings))")
                                .font(SGFont.bodyBold(size: 12))
                                .foregroundStyle(Color.sgGreen)
                        }
                    }
                }
            } content: {
                VintageTerminalRouteDisplay(
                    originCode: deal.nearbyOrigin ?? "TPA",
                    originLabel: deal.nearbyOriginLabel ?? "Saved origin",
                    destinationCode: deal.iataCode,
                    destinationLabel: deal.destination,
                    detail: "\(deal.safeDepartureDate.shortDate) to \(deal.safeReturnDate.shortDate) · \(deal.safeFlightDuration)",
                    tone: .amber
                )
            } footer: {
                HStack(spacing: Spacing.sm) {
                    VintageTerminalSecondaryButton(
                        title: "Remove",
                        subtitle: "Remove",
                        icon: "heart.slash",
                        tone: .ember,
                        fillsWidth: true
                    ) {
                        removeDeal(deal)
                    }

                    VintageTerminalActionButton(
                        title: "Search Flights",
                        subtitle: "Open live booking flow",
                        icon: "airplane.departure",
                        tone: .amber,
                        fillsWidth: true
                    ) {
                        bookDeal(deal)
                    }
                }
            }
        }
    }

    // MARK: - Collection

    private var collectionSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            VintageTerminalCollectionHeader(
                title: "All Saved",
                subtitle: "Every saved card stays bookable from here."
            )

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
    }

    // MARK: - Empty

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VintageTerminalPoster(
                imageURL: Deal.preview.imageUrl,
                title: "Start Your Archive",
                subtitle: "Save destinations to find them here.",
                eyebrow: "Saved Routes",
                tone: .amber
            )

            VintageTerminalPanel(
                title: "What happens here",
                subtitle: "Easily book your saved destinations.",
                stamp: "Empty",
                tone: .neutral
            ) {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    VintageTerminalChecklistItem(
                        title: "Save from the feed",
                        detail: "Use the heart on any destination card to save it here.",
                        tone: .amber
                    )
                    VintageTerminalChecklistItem(
                        title: "Track price drops",
                        detail: "When savings data exists, we highlight the best deals.",
                        tone: .moss
                    )
                    VintageTerminalChecklistItem(
                        title: "Jump back into booking",
                        detail: "Every saved route stays one tap away from the live booking flow.",
                        tone: .ember
                    )
                }
            }

            VintageTerminalActionCluster {
                VintageTerminalActionButton(
                    title: "Return to Explore",
                    subtitle: "Find routes worth saving",
                    icon: "airplane",
                    tone: .amber,
                    fillsWidth: true
                ) {
                    router.activeTab = .feed
                }
            } secondary: {
                VintageTerminalSecondaryButton(
                    title: "Saved space is empty",
                    subtitle: "Nothing saved yet",
                    icon: "heart",
                    tone: .neutral,
                    fillsWidth: true
                ) {}
                .disabled(true)
            }
        }
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
