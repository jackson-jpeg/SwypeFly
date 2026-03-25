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
                        searchField
                        statusBar
                        resultsList
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.md)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("Search")
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

    // MARK: - Search Field

    private var searchField: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Color.sgMuted)
                .font(.system(size: 16))

            TextField("Where to?", text: $query)
                .font(SGFont.body(size: 16))
                .foregroundStyle(Color.sgWhite)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .submitLabel(.search)
                .onSubmit {
                    scheduleSearch(for: trimmedQuery)
                }

            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.sgMuted)
                        .font(.system(size: 16))
                }
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 14)
        .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    // MARK: - Status Bar

    @ViewBuilder
    private var statusBar: some View {
        HStack(spacing: Spacing.sm) {
            if trimmedQuery.isEmpty {
                statusChip(
                    label: "From \(settingsStore.departureCode)",
                    icon: "airplane.departure"
                )
                Spacer()
                if isLoadingPopular {
                    ProgressView()
                        .tint(Color.sgYellow)
                        .scaleEffect(0.8)
                }
            } else {
                statusChip(
                    label: "\(combinedResults.count) result\(combinedResults.count == 1 ? "" : "s")",
                    icon: "line.3.horizontal.decrease"
                )
                Spacer()
                if isSearching {
                    ProgressView()
                        .tint(Color.sgYellow)
                        .scaleEffect(0.8)
                }
            }
        }
    }

    private func statusChip(label: String, icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .medium))
            Text(label)
                .font(SGFont.bodyBold(size: 13))
        }
        .foregroundStyle(Color.sgWhiteDim)
    }

    // MARK: - Results

    @ViewBuilder
    private var resultsList: some View {
        if trimmedQuery.isEmpty {
            // Popular section
            if isLoadingPopular && popularDeals.isEmpty {
                loadingRow(text: "Loading popular destinations...")
            } else if let popularError, popularDeals.isEmpty {
                errorRow(title: "Couldn't load popular destinations", detail: popularError)
            } else if !popularDeals.isEmpty {
                sectionHeader("Popular", subtitle: "Top destinations from \(settingsStore.departureCode)")

                LazyVStack(spacing: Spacing.md) {
                    ForEach(popularDeals) { deal in
                        resultCard(for: deal)
                    }
                }
            }
        } else if combinedResults.isEmpty && !isSearching {
            // Empty state
            VStack(spacing: Spacing.md) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 36))
                    .foregroundStyle(Color.sgMuted)
                Text("No results for \"\(trimmedQuery)\"")
                    .font(SGFont.bodyBold(size: 16))
                    .foregroundStyle(Color.sgWhite)
                Text("Try a city, country, airport code, or vibe tag.")
                    .font(SGFont.body(size: 14))
                    .foregroundStyle(Color.sgMuted)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, Spacing.xl)
        } else if !combinedResults.isEmpty {
            if !archiveMatches.isEmpty {
                sectionHeader("Loaded", subtitle: "\(archiveMatches.count) already in app")

                LazyVStack(spacing: Spacing.md) {
                    ForEach(archiveMatches) { deal in
                        resultCard(for: deal)
                    }
                }
            }

            if !liveMatches.isEmpty {
                sectionHeader("More results", subtitle: "\(liveMatches.count) from search")

                LazyVStack(spacing: Spacing.md) {
                    ForEach(liveMatches) { deal in
                        resultCard(for: deal)
                    }
                }
            }
        }

        if let searchError, combinedResults.isEmpty, !trimmedQuery.isEmpty {
            errorRow(title: "Search unavailable", detail: searchError)
        }
    }

    // MARK: - Section Header

    private func sectionHeader(_ title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(SGFont.bodyBold(size: 16))
                .foregroundStyle(Color.sgWhite)
            Text(subtitle)
                .font(SGFont.body(size: 13))
                .foregroundStyle(Color.sgMuted)
        }
        .padding(.top, Spacing.sm)
    }

    // MARK: - Result Card

    private func resultCard(for deal: Deal) -> some View {
        Button {
            HapticEngine.medium()
            router.showDeal(deal)
        } label: {
            HStack(spacing: Spacing.md) {
                CachedAsyncImage(url: deal.imageUrl) {
                    Color.sgSurface
                }
                .frame(width: 80, height: 80)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))

                VStack(alignment: .leading, spacing: 4) {
                    Text(deal.destination)
                        .font(SGFont.bodyBold(size: 17))
                        .foregroundStyle(Color.sgWhite)
                        .lineLimit(1)

                    Text(deal.country)
                        .font(SGFont.body(size: 13))
                        .foregroundStyle(Color.sgMuted)

                    if !deal.tagline.isEmpty {
                        Text(deal.tagline)
                            .font(SGFont.body(size: 12))
                            .foregroundStyle(Color.sgWhiteDim)
                            .lineLimit(2)
                    }

                    if !deal.safeVibeTags.isEmpty {
                        HStack(spacing: 4) {
                            ForEach(deal.safeVibeTags.prefix(3), id: \.self) { tag in
                                Text(tag)
                                    .font(SGFont.body(size: 11))
                                    .foregroundStyle(Color.sgYellow)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Color.sgYellow.opacity(0.12), in: Capsule())
                            }
                        }
                    }
                }

                Spacer(minLength: 0)

                VStack(alignment: .trailing, spacing: 4) {
                    Text(deal.priceFormatted)
                        .font(SGFont.display(size: 22))
                        .foregroundStyle(Color.sgYellow)

                    if let tier = deal.dealTier {
                        Text(tier.label)
                            .font(SGFont.bodyBold(size: 11))
                            .foregroundStyle(Color.sgGreen)
                    }

                    Text(deal.iataCode)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.sgMuted)
                }
            }
            .padding(Spacing.md)
            .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.lg)
                    .strokeBorder(Color.sgBorder, lineWidth: 1)
            )
        }
        .buttonStyle(SearchCardButtonStyle())
        .accessibilityLabel("\(deal.destination), \(deal.country), \(deal.priceFormatted)")
        .accessibilityHint("Open deal details")
    }

    // MARK: - Helpers

    private func loadingRow(text: String) -> some View {
        HStack(spacing: Spacing.sm) {
            ProgressView()
                .tint(Color.sgYellow)
            Text(text)
                .font(SGFont.bodyDefault)
                .foregroundStyle(Color.sgMuted)
        }
        .padding(.top, Spacing.lg)
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
        .padding(.top, Spacing.md)
    }

    // MARK: - Search Logic

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

// MARK: - Search Card Button Style

private struct SearchCardButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

#Preview("Search") {
    SearchView()
        .environment(FeedStore())
        .environment(SettingsStore())
        .environment(Router())
}
