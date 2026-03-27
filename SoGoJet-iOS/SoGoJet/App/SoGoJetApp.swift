import SwiftUI
import UIKit
import CoreSpotlight
import UserNotifications
import MetricKit
import StripePaymentSheet
import os

// MARK: - App Delegate (Quick Actions + Notification Handling + Crash Reporting)

private let logger = Logger(subsystem: "com.sogojet.app", category: "diagnostics")

class SoGoJetAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MXMetricManagerSubscriber {
    /// Stores the shortcut action type when the app is launched from a quick action.
    static var pendingShortcutType: String?

    /// Stores the deal ID from a notification tap when the app is cold-launched.
    static var pendingNotificationDealId: String?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self

        // Subscribe to MetricKit for crash diagnostics
        MXMetricManager.shared.add(self)

        // Style unselected tab bar items to match dark terminal theme
        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithOpaqueBackground()
        tabAppearance.backgroundColor = UIColor(Color.sgBg)

        // Unselected items: muted color
        let normalAttrs: [NSAttributedString.Key: Any] = [.foregroundColor: UIColor(Color.sgMuted)]
        tabAppearance.stackedLayoutAppearance.normal.iconColor = UIColor(Color.sgMuted)
        tabAppearance.stackedLayoutAppearance.normal.titleTextAttributes = normalAttrs
        // Selected items: yellow accent
        let selectedAttrs: [NSAttributedString.Key: Any] = [.foregroundColor: UIColor(Color.sgYellow)]
        tabAppearance.stackedLayoutAppearance.selected.iconColor = UIColor(Color.sgYellow)
        tabAppearance.stackedLayoutAppearance.selected.titleTextAttributes = selectedAttrs
        // Badge styling: yellow background to match accent
        tabAppearance.stackedLayoutAppearance.normal.badgeBackgroundColor = UIColor(Color.sgYellow)
        tabAppearance.stackedLayoutAppearance.normal.badgeTextAttributes = [.foregroundColor: UIColor.black]
        tabAppearance.stackedLayoutAppearance.selected.badgeBackgroundColor = UIColor(Color.sgYellow)
        tabAppearance.stackedLayoutAppearance.selected.badgeTextAttributes = [.foregroundColor: UIColor.black]

        UITabBar.appearance().standardAppearance = tabAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabAppearance

        // Style navigation bar for consistent dark theme across all screens
        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithOpaqueBackground()
        navAppearance.backgroundColor = UIColor(Color.sgBg)
        navAppearance.titleTextAttributes = [.foregroundColor: UIColor(Color.sgWhite)]
        navAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor(Color.sgWhite)]
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
        UINavigationBar.appearance().compactAppearance = navAppearance
        UINavigationBar.appearance().tintColor = UIColor(Color.sgYellow)

        return true
    }

    // MARK: - MetricKit (Crash Reporting)

    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            logger.info("[MetricKit] Metric payload received: \(payload.jsonRepresentation().count) bytes")
        }
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            logger.error("[MetricKit] Diagnostic (crash/hang): \(String(data: payload.jsonRepresentation(), encoding: .utf8) ?? "unreadable")")
        }
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

    // MARK: - Quick Actions (Warm Launch)

    /// Handle quick action when the app is already running (warm launch).
    /// For cold launch, the shortcut is captured in configurationForConnecting above.
    func application(
        _ application: UIApplication,
        performActionFor shortcutItem: UIApplicationShortcutItem,
        completionHandler: @escaping (Bool) -> Void
    ) {
        Self.pendingShortcutType = shortcutItem.type
        // Post notification so the SwiftUI lifecycle picks it up
        NotificationCenter.default.post(
            name: .sogojetQuickActionTriggered,
            object: nil,
            userInfo: ["type": shortcutItem.type]
        )
        completionHandler(true)
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
    static let sogojetQuickActionTriggered = Notification.Name("sogojetQuickActionTriggered")
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

                    // Set actual screen pixel size and scale for image downsampling.
                    // The scale is used when creating UIImage from CGImage so SwiftUI
                    // renders at native Retina sharpness instead of blurry 1x.
                    let scenes = UIApplication.shared.connectedScenes
                    if let windowScene = scenes.compactMap({ $0 as? UIWindowScene }).first {
                        let screen = windowScene.screen
                        let pixelSize = max(screen.bounds.width, screen.bounds.height) * screen.scale
                        await ImageCache.shared.updateMaxPixelSize(pixelSize, scale: screen.scale)
                    }

                    // Trim disk image cache so we aren't always at capacity
                    await ImageCache.shared.trimDiskCacheOnStartup()

                    // Preload feed immediately on launch so content is
                    // ready (or loading) by the time the user sees the feed tab.
                    if feedStore.allDeals.isEmpty {
                        await feedStore.fetchDeals(origin: settingsStore.departureCode)
                    }

                    // Merge saved deals from server (if authenticated)
                    savedStore.syncFromServer()

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
                    // Handle sogojet:// OAuth callbacks as a fallback.
                    // ASWebAuthenticationSession normally intercepts these, but
                    // if the system delivers the URL to the app instead (e.g. the
                    // session was deallocated), we log it and let it pass through.
                    if url.scheme == "sogojet" && url.host == "oauth-callback" {
                        #if DEBUG
                        print("[App] Received OAuth callback URL (fallback): \(url)")
                        #endif
                        return
                    }

                    // Handle sogojet:// custom scheme deep links
                    // (e.g. sogojet://destination/{id} from widgets, sogojet://search, etc.)
                    if url.scheme == "sogojet" {
                        router.handleCustomSchemeURL(url, feedStore: feedStore)
                        return
                    }

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
                .onReceive(NotificationCenter.default.publisher(for: .sogojetQuickActionTriggered)) { notification in
                    if let type = notification.userInfo?["type"] as? String {
                        SoGoJetAppDelegate.pendingShortcutType = nil
                        router.handleQuickAction(type)
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: APIClient.sessionExpired)) { _ in
                    authStore.signOut()
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
