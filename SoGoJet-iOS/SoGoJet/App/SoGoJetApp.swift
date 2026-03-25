import SwiftUI
import UIKit
import CoreSpotlight

// MARK: - App Delegate (Quick Actions)

class SoGoJetAppDelegate: NSObject, UIApplicationDelegate {
    /// Stores the shortcut action type when the app is launched from a quick action.
    static var pendingShortcutType: String?

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        // Capture quick action on cold launch
        if let shortcut = options.shortcutItem {
            Self.pendingShortcutType = shortcut.type
        }
        let config = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        return config
    }
}

@main
struct SoGoJetApp: App {
    @UIApplicationDelegateAdaptor(SoGoJetAppDelegate.self) var appDelegate
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
                    // Sync departure airport to shared App Group for the widget
                    settingsStore.syncToWidget()

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
                .onContinueUserActivity(CSSearchableItemActionType) { activity in
                    // Handle Spotlight search result tap
                    guard let identifier = activity.userInfo?[CSSearchableItemActivityIdentifier] as? String,
                          identifier.hasPrefix("sogojet-deal-") else { return }
                    let dealId = String(identifier.dropFirst("sogojet-deal-".count))
                    // Try to find in saved deals first, then feed
                    if let deal = savedStore.savedDeals.first(where: { $0.id == dealId }) {
                        router.showDeal(deal)
                    } else if let deal = feedStore.allDeals.first(where: { $0.id == dealId }) {
                        router.showDeal(deal)
                    } else {
                        router.pendingDeepLinkId = dealId
                    }
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

                        // Handle quick action from cold launch
                        if let shortcutType = SoGoJetAppDelegate.pendingShortcutType {
                            SoGoJetAppDelegate.pendingShortcutType = nil
                            router.handleQuickAction(shortcutType)
                        }
                    }
                }
                .onContinueUserActivity("com.sogojet.search") { _ in
                    router.handleQuickAction("com.sogojet.search")
                }
                .onContinueUserActivity("com.sogojet.saved") { _ in
                    router.handleQuickAction("com.sogojet.saved")
                }
                .onContinueUserActivity("com.sogojet.board") { _ in
                    router.handleQuickAction("com.sogojet.board")
                }
        }
    }
}
