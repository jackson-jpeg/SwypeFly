import SwiftUI

@main
struct SoGoJetApp: App {
    @State private var feedStore = FeedStore()
    @State private var savedStore = SavedStore()
    @State private var settingsStore = SettingsStore()
    @State private var bookingStore = BookingStore()
    @State private var router = Router()
    @State private var toastManager = ToastManager()
    @State private var networkMonitor = NetworkMonitor()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(feedStore)
                .environment(savedStore)
                .environment(settingsStore)
                .environment(bookingStore)
                .environment(router)
                .environment(toastManager)
                .environment(networkMonitor)
                .preferredColorScheme(.dark)
                .task {
                    // Set actual screen pixel size for image downsampling
                    let scenes = UIApplication.shared.connectedScenes
                    if let windowScene = scenes.compactMap({ $0 as? UIWindowScene }).first {
                        let screen = windowScene.screen
                        let pixelSize = max(screen.bounds.width, screen.bounds.height) * screen.scale
                        await ImageCache.shared.updateMaxPixelSize(pixelSize)
                    }

                    // Trim disk image cache so we aren't always at capacity
                    await ImageCache.shared.trimDiskCacheOnStartup()

                    // Preload feed immediately on launch so content is
                    // ready (or loading) by the time the user sees the feed tab.
                    if feedStore.allDeals.isEmpty {
                        await feedStore.fetchDeals(origin: settingsStore.departureCode)
                    }
                }
                .onOpenURL { url in
                    router.handleDeepLink(url, feedStore: feedStore)
                }
                .onChange(of: feedStore.allDeals.count) { _, _ in
                    // Resolve any pending deep link once the feed has loaded
                    router.resolvePendingDeepLink(feedStore: feedStore)
                }
                .onChange(of: scenePhase) { oldPhase, newPhase in
                    if oldPhase != .active && newPhase == .active {
                        Task {
                            await feedStore.refreshIfStale(origin: settingsStore.departureCode)
                        }
                    }
                }
        }
    }
}
