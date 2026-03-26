import SwiftUI
import UIKit
import CoreSpotlight
import UserNotifications

// MARK: - App Delegate (Quick Actions + Notification Handling)

class SoGoJetAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    /// Stores the shortcut action type when the app is launched from a quick action.
    static var pendingShortcutType: String?

    /// Stores the deal ID from a notification tap when the app is cold-launched.
    static var pendingNotificationDealId: String?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

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

    // MARK: - UNUserNotificationCenterDelegate

    /// Handle notification tap when the app is in the foreground or background.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let dealId = userInfo["dealId"] as? String {
            Self.pendingNotificationDealId = dealId
            // Post notification so the SwiftUI app can pick it up immediately
            NotificationCenter.default.post(
                name: .sogojetNotificationTapped,
                object: nil,
                userInfo: ["dealId": dealId]
            )
        }
        completionHandler()
    }

    /// Show notifications even when app is in the foreground.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }
}

extension Notification.Name {
    static let sogojetNotificationTapped = Notification.Name("sogojetNotificationTapped")
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
    @State private var authStore = AuthStore()
    @State private var recentlyViewedStore = RecentlyViewedStore()
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
                .environment(authStore)
                .environment(recentlyViewedStore)
                .preferredColorScheme(.dark)
                .onAppear {
                    // Wire booking store to push live prices back to feed and saved deals
                    bookingStore.onLivePriceFound = { dealId, livePrice in
                        feedStore.updateLivePrice(dealId: dealId, livePrice: livePrice)
                        savedStore.updatePrice(dealId: dealId, livePrice: livePrice)
                    }
                }
                .task {
                    // Track distinct usage days for review prompt eligibility
                    ReviewPrompter.shared.recordAppOpen()

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

                    // Register background fare drop checks
                    FareDropMonitor.registerBackgroundTask()
                    FareDropMonitor.scheduleNextCheck()

                    // Check for fare drops on saved destinations (foreground)
                    if !savedStore.savedDeals.isEmpty && settingsStore.priceAlertsEnabled {
                        let drops = await FareDropMonitor.checkForFareDrops(
                            savedDeals: savedStore.savedDeals,
                            origin: settingsStore.departureCode
                        )
                        if !drops.isEmpty {
                            FareDropMonitor.notifyFareDrops(drops)
                        }
                    }

                    // Schedule daily deal notification if notifications are enabled
                    if settingsStore.notificationsEnabled {
                        await DealNotificationManager.scheduleDailyDeal(
                            departureCode: settingsStore.departureCode
                        )
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
                    // Resolve any pending deep link once the feed has loaded.
                    // Also checks saved deals and falls back to an API fetch.
                    router.resolvePendingDeepLink(feedStore: feedStore, savedStore: savedStore)
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

                        // Handle notification tap from cold launch
                        if let dealId = SoGoJetAppDelegate.pendingNotificationDealId {
                            SoGoJetAppDelegate.pendingNotificationDealId = nil
                            router.handleNotificationDealId(dealId, feedStore: feedStore, savedStore: savedStore)
                        }
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: .sogojetNotificationTapped)) { notification in
                    if let dealId = notification.userInfo?["dealId"] as? String {
                        SoGoJetAppDelegate.pendingNotificationDealId = nil
                        router.handleNotificationDealId(dealId, feedStore: feedStore, savedStore: savedStore)
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
                .onContinueUserActivity("com.sogojet.search-flights") { _ in
                    router.handleQuickAction("com.sogojet.search")
                }
                .onContinueUserActivity("com.sogojet.view-deal") { activity in
                    if let dealId = activity.userInfo?["dealId"] as? String {
                        if let deal = feedStore.allDeals.first(where: { $0.id == dealId }) {
                            router.showDeal(deal)
                        } else {
                            router.pendingDeepLinkId = dealId
                        }
                    }
                }
        }
    }
}
