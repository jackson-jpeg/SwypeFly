import SwiftUI

struct ContentView: View {
    @Environment(FeedStore.self) private var feedStore
    @Environment(SettingsStore.self) private var settings
    @Environment(SavedStore.self) private var savedStore
    @Environment(BookingStore.self) private var bookingStore
    @Environment(Router.self) private var router
    @Environment(ToastManager.self) private var toastManager
    @Environment(NetworkMonitor.self) private var network
    @Environment(AuthStore.self) private var auth
    @Environment(RecentlyViewedStore.self) private var recentlyViewedStore

    var body: some View {
        ZStack {
            if !settings.hasOnboarded {
                // New users: onboarding first, no auth gate
                OnboardingView()
            } else {
                mainTabView
            }
        }
        .overlay(alignment: .top) {
            offlineBanner
                .animation(.easeInOut(duration: 0.3), value: network.isConnected)
        }
        .overlay { ToastOverlay() }
    }

    // MARK: - Offline Banner

    @ViewBuilder
    private var offlineBanner: some View {
        if !network.isConnected {
            HStack(spacing: 6) {
                Image(systemName: "wifi.slash")
                    .font(.caption)
                Text("No internet connection")
                    .font(.caption.weight(.medium))
            }
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(Color.orange.opacity(0.9))
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    // MARK: - Tab View

    private var mainTabView: some View {
        @Bindable var router = router
        let tabBinding = Binding<Router.Tab>(
            get: { router.activeTab },
            set: { newTab in
                if newTab != router.activeTab {
                    HapticEngine.selection()
                }
                router.tabSelected(newTab)
            }
        )
        return TabView(selection: tabBinding) {
            feedTab
            savedTab
            settingsTab
        }
        .tint(Color.sgYellow)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge) // Cap scaling app-wide for layout safety
        .toolbarBackground(.visible, for: .tabBar)
        .toolbarBackground(Color.sgBg, for: .tabBar)
        .sheet(item: $router.activeSheet, onDismiss: {
            router.handleSheetDismissed()
        }) { sheet in
            sheetContent(for: sheet)
                .overlay { ToastOverlay() }
        }
        .fullScreenCover(item: $router.fullScreenDestination, onDismiss: {
            router.handleFullScreenDismissed()
        }) { destination in
            fullScreenContent(for: destination)
        }
    }

    private var feedTab: some View {
        Group {
            if settings.preferredView == "list" {
                DepartureBoardView()
            } else {
                FeedView()
            }
        }
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

    @ViewBuilder
    private func sheetContent(for sheet: Router.Sheet) -> some View {
        switch sheet {
        case .dealDetail(let deal):
            DestinationDetailView(deal: deal, allDeals: feedStore.allDeals)
                .environment(savedStore)
                .environment(settings)
                .environment(router)
                .environment(toastManager)
                .environment(recentlyViewedStore)
                .presentationDetents([.large])
                .presentationDragIndicator(.hidden)
                .presentationBackground(Color.sgBg)
                .presentationCornerRadius(20)
        case .search:
            SearchView()
                .environment(feedStore)
                .environment(savedStore)
                .environment(settings)
                .environment(router)
                .environment(toastManager)
                .environment(recentlyViewedStore)
                .presentationDetents([.large])
                .presentationDragIndicator(.hidden)
                .presentationBackground(Color.sgBg)
                .presentationCornerRadius(20)
        case .departurePicker:
            NavigationStack {
                AirportPicker(selectedCode: departureCodeBinding)
            }
            .environment(settings)
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .presentationBackground(Color.sgBg)
        case .filters:
            FilterSheet()
                .environment(feedStore)
                .environment(settings)
        }
    }

    @ViewBuilder
    private func fullScreenContent(for destination: Router.FullScreenDestination) -> some View {
        switch destination {
        case .booking(let deal):
            BookingFlowView(deal: deal)
                .environment(bookingStore)
                .environment(settings)
                .environment(savedStore)
                .environment(router)
                .environment(toastManager)
                .environment(auth)
                .environment(network)
        case .onboarding:
            OnboardingView()
                .environment(settings)
        }
    }

    private var departureCodeBinding: Binding<String> {
        Binding(
            get: { settings.departureCode },
            set: { newCode in
                if let airport = AirportPicker.airports.first(where: { $0.code == newCode }) {
                    settings.setDeparture(code: newCode, city: airport.city)
                } else {
                    settings.departureCode = newCode
                }
            }
        )
    }
}
