import SwiftUI

struct ContentView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(SavedStore.self) private var savedStore
    @Environment(Router.self) private var router
    @Environment(ToastManager.self) private var toastManager

    var body: some View {
        ZStack {
            if settings.hasOnboarded {
                mainTabView
            } else {
                OnboardingView()
            }
        }
        .overlay { ToastOverlay() }
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
