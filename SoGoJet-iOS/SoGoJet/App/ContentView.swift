import SwiftUI

struct ContentView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(SavedStore.self) private var savedStore
    @Environment(Router.self) private var router

    var body: some View {
        if settings.hasOnboarded {
            mainTabView
        } else {
            OnboardingPlaceholderView()
        }
    }

    // MARK: - Tab View

    private var mainTabView: some View {
        @Bindable var router = router
        return TabView(selection: $router.activeTab) {
            feedTab
            savedTab
            settingsTab
        }
        .tint(Color.sgYellow)
    }

    private var feedTab: some View {
        FeedView()
            .tabItem {
                Label(Router.Tab.feed.title, systemImage: Router.Tab.feed.iconName)
            }
            .tag(Router.Tab.feed)
    }

    private var savedTab: some View {
        NavigationStack {
            SavedView()
        }
        .tabItem {
            Label(Router.Tab.saved.title, systemImage: Router.Tab.saved.iconName)
        }
        .tag(Router.Tab.saved)
        .badge(savedBadgeCount)
    }

    private var settingsTab: some View {
        NavigationStack {
            SettingsView()
        }
        .tabItem {
            Label(Router.Tab.settings.title, systemImage: Router.Tab.settings.iconName)
        }
        .tag(Router.Tab.settings)
    }

    private var savedBadgeCount: Int {
        savedStore.count
    }
}

// MARK: - Placeholder Views
// Minimal scaffolds for each tab. Full implementations come in later phases.

private struct OnboardingPlaceholderView: View {
    @Environment(SettingsStore.self) private var settings

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()
            VStack(spacing: Spacing.lg) {
                Image(systemName: "airplane.departure")
                    .font(.system(size: 64))
                    .foregroundStyle(Color.sgYellow)

                Text("SoGoJet")
                    .font(SGFont.heroTitle)
                    .foregroundStyle(Color.sgWhite)

                Text("Swipe. Save. Fly.")
                    .font(SGFont.tagline)
                    .foregroundStyle(Color.sgWhiteDim)

                Button {
                    settings.hasOnboarded = true
                } label: {
                    Text("Get Started")
                        .font(SGFont.bodyBold(size: 17))
                        .foregroundStyle(Color.sgBg)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.md)
                        .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
                }
                .padding(.horizontal, Spacing.xl)
            }
        }
    }
}

private struct FeedPlaceholderView: View {
    @Environment(FeedStore.self) private var feed
    @Environment(SettingsStore.self) private var settings

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()
            if feed.isLoading {
                ProgressView()
                    .tint(Color.sgYellow)
            } else if feed.deals.isEmpty {
                VStack(spacing: Spacing.md) {
                    Image(systemName: "airplane")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.sgMuted)
                    Text("Finding deals...")
                        .font(SGFont.sectionHead)
                        .foregroundStyle(Color.sgWhiteDim)
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: Spacing.md) {
                        ForEach(feed.deals) { deal in
                            dealCard(deal)
                        }
                    }
                    .padding(Spacing.md)
                }
            }
        }
        .navigationTitle("Explore")
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task {
            if feed.deals.isEmpty {
                await feed.fetchDeals(origin: settings.departureCode)
            }
        }
    }

    private func dealCard(_ deal: Deal) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            CachedAsyncImage(url: deal.imageUrl) {
                Color.sgSurface
            }
            .frame(height: 200)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            .overlay(alignment: .bottomLeading) {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text(deal.destination)
                        .font(SGFont.cardTitle)
                        .foregroundStyle(Color.sgWhite)
                    Text(deal.priceFormatted)
                        .font(SGFont.price)
                        .foregroundStyle(Color.sgYellow)
                }
                .padding(Spacing.md)
            }

            Text(deal.tagline)
                .font(SGFont.tagline)
                .foregroundStyle(Color.sgWhiteDim)
                .lineLimit(2)
        }
        .background(Color.sgCell)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .dealAccessibility(
            label: "\(deal.destination), \(deal.priceFormatted)",
            hint: "Tap to view details"
        )
    }
}

// SavedPlaceholderView and SettingsPlaceholderView removed — replaced by SavedView and SettingsView.
