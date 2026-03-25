import SwiftUI

struct SearchView: View {
    @Environment(FeedStore.self) private var feedStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(Router.self) private var router

    @State private var query = ""
    @State private var remoteResults: [Deal] = []
    @State private var isSearching = false
    @State private var searchError: String?
    @State private var searchTask: Task<Void, Never>?
    @State private var popularResults: [Deal] = []
    @State private var isLoadingPopular = false
    @State private var popularError: String?

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var archiveMatches: [Deal] {
        guard !trimmedQuery.isEmpty else { return [] }
        let needle = trimmedQuery.lowercased()

        return feedStore.allDeals
            .filter { deal in
                deal.city.lowercased().contains(needle)
                || deal.country.lowercased().contains(needle)
                || deal.iataCode.lowercased().contains(needle)
                || deal.safeVibeTags.contains(where: { $0.lowercased().contains(needle) })
            }
            .sorted { lhs, rhs in
                let lhsScore = lhs.dealScore ?? lhs.displayPrice.map { 10_000 - $0 } ?? 0
                let rhsScore = rhs.dealScore ?? rhs.displayPrice.map { 10_000 - $0 } ?? 0
                return lhsScore > rhsScore
            }
    }

    private var liveMatches: [Deal] {
        guard !trimmedQuery.isEmpty else { return [] }
        let archiveIDs = Set(archiveMatches.map(\.id))
        return remoteResults.filter { !archiveIDs.contains($0.id) }
    }

    private var combinedResults: [Deal] {
        archiveMatches + liveMatches
    }

    private var popularDeals: [Deal] {
        let source = feedStore.allDeals.isEmpty ? popularResults : feedStore.allDeals
        return source
            .sorted { ($0.dealScore ?? 0) > ($1.dealScore ?? 0) }
            .prefix(6)
            .map { $0 }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.sgBg.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        header
                        searchTelemetryDeck
                        resultsDeck
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.md)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .onAppear {
                scheduleSearch(for: trimmedQuery)
                Task {
                    await loadPopularIfNeeded()
                }
            }
            .onChange(of: trimmedQuery) { _, newValue in
                scheduleSearch(for: newValue)
            }
            .onChange(of: settingsStore.departureCode) { _, _ in
                Task {
                    await loadPopularIfNeeded(force: true)
                }
            }
            .onDisappear {
                searchTask?.cancel()
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        router.dismissSheet()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(Color.sgMuted)
                    }
                    .accessibilityLabel("Close search")
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            VintageTerminalTopBar(
                eyebrow: "Search Desk",
                title: "Route Search",
                subtitle: "Scan the saved archive and the live feed from \(settingsStore.departureCode) without losing the terminal mood.",
                stamp: settingsStore.departureCode,
                tone: .amber,
                leadingIcon: nil,
                leadingAction: nil,
                trailingIcon: nil,
                trailingAction: nil
            )

            VintageTravelTicket(tone: .amber) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        VintageTerminalSectionLabel(text: "Search", tone: .amber)
                        SplitFlapRow(
                            text: trimmedQuery.isEmpty ? "POPULAR" : trimmedQuery.uppercased(),
                            maxLength: 8,
                            size: .md,
                            color: Color.sgYellow,
                            alignment: .leading,
                            animate: true,
                            staggerMs: 24
                        )
                    }

                    Spacer(minLength: 0)

                    VintageTerminalPassportStamp(
                        title: "Mode",
                        subtitle: trimmedQuery.isEmpty ? "Browse" : "Live + archive",
                        tone: .ivory
                    )
                }
            } content: {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    VintageTerminalSearchField(
                        prompt: "Where to?",
                        text: $query,
                        tone: .amber
                    )

                    HStack(spacing: Spacing.sm) {
                        summaryChip(title: "Archive", value: "\(archiveMatches.count)", tone: .ivory)
                        summaryChip(title: "Live", value: "\(liveMatches.count)", tone: .moss)
                        summaryChip(title: "Popular", value: "\(popularDeals.count)", tone: .amber)
                    }
                }
            } footer: {
                VintageTerminalRouteDisplay(
                    originCode: settingsStore.departureCode,
                    originLabel: settingsStore.departureCity,
                    destinationCode: trimmedQuery.isEmpty ? "ANY" : String(trimmedQuery.prefix(3)).uppercased().padding(toLength: 3, withPad: " ", startingAt: 0),
                    destinationLabel: trimmedQuery.isEmpty ? "Any route" : trimmedQuery,
                    detail: trimmedQuery.isEmpty
                        ? "Popular departures ranked by the current board score."
                        : "Search checks both loaded cards and the live feed before opening detail.",
                    tone: .amber
                )
            }
        }
    }

    @ViewBuilder
    private var searchTelemetryDeck: some View {
        if trimmedQuery.isEmpty {
            VintageTerminalPanel(
                title: "Popular Scan",
                subtitle: "The top board-worthy routes from the currently selected departure market.",
                stamp: isLoadingPopular ? "Loading" : "Ready",
                tone: .ivory
            ) {
                if isLoadingPopular && popularDeals.isEmpty {
                    loadingRow(text: "Loading popular departures from \(settingsStore.departureCode)...")
                } else if let popularError, popularDeals.isEmpty {
                    errorRow(
                        title: "Popular routes are still loading.",
                        detail: popularError
                    )
                } else {
                    VintageTerminalMetricDeck(metrics: [
                        .init(title: "Top route", value: popularDeals.first?.destination ?? "Waiting", footnote: popularDeals.first?.priceFormatted, tone: .amber),
                        .init(title: "Loaded", value: "\(popularDeals.count)", footnote: "Popular cards ready", tone: .moss),
                        .init(title: "Origin", value: settingsStore.departureCode, footnote: settingsStore.departureCity, tone: .ivory),
                        .init(title: "Mode", value: "Browse", footnote: "Type to switch into live search", tone: .ember),
                    ])
                }
            }
        } else {
            VintageTerminalPanel(
                title: "Search Results",
                subtitle: "",
                stamp: isSearching ? "Searching" : "Synced",
                tone: .moss
            ) {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    if isSearching && combinedResults.isEmpty {
                        loadingRow(text: "Searching all departures from \(settingsStore.departureCode)...")
                    }

                    if let searchError, combinedResults.isEmpty {
                        errorRow(
                            title: "Search unavailable right now.",
                            detail: searchError
                        )
                    }

                    VintageTerminalMetricDeck(metrics: [
                        .init(title: "Archive", value: "\(archiveMatches.count)", footnote: archiveMatches.isEmpty ? "No loaded card matches yet" : "Loaded matches", tone: .ivory),
                        .init(title: "Live feed", value: "\(liveMatches.count)", footnote: liveMatches.isEmpty ? "No additional live routes" : "New routes from backend", tone: .moss),
                        .init(title: "Combined", value: "\(combinedResults.count)", footnote: "Deduped visible routes", tone: .amber),
                        .init(title: "Query", value: trimmedQuery.uppercased(), footnote: "City, country, IATA, and vibe tags", tone: .ember),
                    ])
                }
            }
        }
    }

    @ViewBuilder
    private var resultsDeck: some View {
        if trimmedQuery.isEmpty {
            resultsSection(
                title: "Popular Departures",
                subtitle: "The board routes most worth opening from \(settingsStore.departureCode) right now.",
                deals: popularDeals,
                tone: .amber,
                sourceLabel: "Popular board rank"
            )
        } else if combinedResults.isEmpty {
            VintageTerminalPanel(
                title: "No Routes Found",
                subtitle: "The board and the live feed both came back empty for this search.",
                stamp: "Empty",
                tone: .ember
            ) {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    VintageTerminalChecklistItem(
                        title: "Try a city, country, airport code, or vibe",
                        detail: "Search checks all four, so broader words usually open up more routes.",
                        tone: .amber
                    )
                    VintageTerminalChecklistItem(
                        title: "Popular mode is still available",
                        detail: "Clear the query to fall back to the current best departures from \(settingsStore.departureCode).",
                        tone: .ivory
                    )
                }
            }
        } else {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                if !archiveMatches.isEmpty {
                    resultsSection(
                        title: "Archive Matches",
                        subtitle: "Routes already loaded into the app that match your search instantly.",
                        deals: archiveMatches,
                        tone: .ivory,
                        sourceLabel: "Loaded archive match"
                    )
                }

                if !liveMatches.isEmpty {
                    resultsSection(
                        title: "Live Feed Matches",
                        subtitle: "Additional routes surfaced by the backend feed search.",
                        deals: liveMatches,
                        tone: .moss,
                        sourceLabel: "Live feed result"
                    )
                }
            }
        }
    }

    private func resultsSection(
        title: String,
        subtitle: String,
        deals: [Deal],
        tone: VintageTerminalTone,
        sourceLabel: String
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VintageTerminalCollectionHeader(
                title: title,
                subtitle: subtitle,
                tone: tone
            )

            VStack(spacing: Spacing.md) {
                ForEach(deals) { deal in
                    resultCard(for: deal, tone: tone, sourceLabel: sourceLabel)
                }
            }
        }
    }

    private func resultCard(for deal: Deal, tone: VintageTerminalTone, sourceLabel: String) -> some View {
        Button {
            HapticEngine.medium()
            router.showDeal(deal)
        } label: {
            VintageTravelTicket(tone: tone) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        VintageTerminalSectionLabel(text: deal.country, tone: tone)
                        Text(deal.destination)
                            .font(SGFont.display(size: 30))
                            .foregroundStyle(Color.sgWhite)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }

                    Spacer(minLength: 0)

                    VStack(alignment: .trailing, spacing: Spacing.xs) {
                        Text(deal.priceFormatted)
                            .font(SGFont.display(size: 30))
                            .foregroundStyle(Color.sgYellow)
                        if let tier = deal.dealTier {
                            VintageTerminalPassportStamp(title: "Tier", subtitle: tier.label, tone: tone)
                        }
                    }
                }
            } content: {
                HStack(alignment: .top, spacing: Spacing.md) {
                    CachedAsyncImage(url: deal.imageUrl) {
                        Color.sgSurface
                    }
                    .frame(width: 112, height: 124)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md)
                            .strokeBorder(Color.sgBorder, lineWidth: 1)
                    )

                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        Text(deal.tagline.isEmpty ? "Live route ready to inspect." : deal.tagline)
                            .font(SGFont.body(size: 13))
                            .foregroundStyle(Color.sgWhiteDim)
                            .fixedSize(horizontal: false, vertical: true)

                        HStack(spacing: Spacing.xs) {
                            if !deal.safeVibeTags.isEmpty {
                                VintageTerminalTagCloud(tags: Array(deal.safeVibeTags.prefix(3)), tone: tone)
                            }
                        }
                    }
                }
            } footer: {
                HStack(alignment: .top) {
                    VintageTerminalCaptionBlock(title: "IATA", value: deal.iataCode, tone: tone)
                    Spacer()
                    VintageTerminalCaptionBlock(title: "Duration", value: deal.safeFlightDuration, tone: .ivory, alignment: .trailing)
                    Spacer()
                    VintageTerminalCaptionBlock(title: "Source", value: sourceLabel, tone: .moss, alignment: .trailing)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(deal.destination), \(deal.country), \(deal.priceFormatted)")
        .accessibilityHint("Open deal details")
    }

    private func summaryChip(title: String, value: String, tone: VintageTerminalTone) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased())
                .font(SGFont.bodyBold(size: 9))
                .foregroundStyle(Color.sgMuted)
                .tracking(1.2)
            Text(value)
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(tone.text)
        }
        .padding(.horizontal, Spacing.sm + Spacing.xs)
        .padding(.vertical, Spacing.sm)
        .background(tone.softFill, in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(tone.border, lineWidth: 1)
        )
    }

    private func loadingRow(text: String) -> some View {
        HStack(spacing: Spacing.sm) {
            ProgressView()
                .tint(Color.sgYellow)
            Text(text)
                .font(SGFont.bodyDefault)
                .foregroundStyle(Color.sgMuted)
        }
    }

    private func errorRow(title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(title)
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgWhite)
            Text(detail)
                .font(SGFont.body(size: 12))
                .foregroundStyle(Color.sgMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func scheduleSearch(for rawQuery: String) {
        searchTask?.cancel()

        let normalized = rawQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalized.count >= 2 else {
            remoteResults = []
            isSearching = false
            searchError = nil
            return
        }

        searchTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }

            isSearching = true
            searchError = nil

            do {
                let response: FeedResponse = try await APIClient.shared.fetch(
                    .feed(
                        origin: settingsStore.departureCode,
                        page: 1,
                        vibes: [],
                        search: normalized
                    )
                )
                guard !Task.isCancelled else { return }
                remoteResults = response.destinations
            } catch {
                guard !Task.isCancelled else { return }
                remoteResults = []
                searchError = error.localizedDescription
            }

            isSearching = false
        }
    }

    @MainActor
    private func loadPopularIfNeeded(force: Bool = false) async {
        if !force {
            guard feedStore.allDeals.isEmpty && popularResults.isEmpty else { return }
        }

        isLoadingPopular = true
        popularError = nil

        do {
            let response: FeedResponse = try await APIClient.shared.fetch(
                .feed(origin: settingsStore.departureCode, page: 1, vibes: [], search: nil)
            )
            popularResults = response.destinations
        } catch {
            if popularResults.isEmpty {
                popularResults = []
            }
            popularError = error.localizedDescription
        }

        isLoadingPopular = false
    }
}

#Preview("Search") {
    SearchView()
        .environment(FeedStore())
        .environment(SettingsStore())
        .environment(Router())
}
