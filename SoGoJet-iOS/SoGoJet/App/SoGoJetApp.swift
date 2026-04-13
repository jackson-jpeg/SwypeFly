import SwiftUI
import UIKit
import CoreSpotlight
import UserNotifications
import MetricKit
import StripePaymentSheet
import ClerkKit
import os

// MARK: - App Delegate (Quick Actions + Notification Handling + Crash Reporting)

private let logger = Logger(subsystem: "com.sogojet.app", category: "diagnostics")

class SoGoJetAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MXMetricManagerSubscriber {
    /// Stores the shortcut action type when the app is launched from a quick action.
    nonisolated(unsafe) static var pendingShortcutType: String?

    /// Stores the deal ID from a notification tap when the app is cold-launched.
    nonisolated(unsafe) static var pendingNotificationDealId: String?

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

    nonisolated func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            logger.info("[MetricKit] Metric payload received: \(payload.jsonRepresentation().count) bytes")
        }
    }

    nonisolated func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            let data = payload.jsonRepresentation()
            logger.error("[MetricKit] Diagnostic (crash/hang): \(String(data: data, encoding: .utf8) ?? "unreadable")")

            // Forward diagnostic payload to backend for real-time crash tracking
            let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
            let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "unknown"
            let osVersion = ProcessInfo.processInfo.operatingSystemVersionString
            var sysInfo = utsname()
            uname(&sysInfo)
            var machineCopy = sysInfo.machine
            let machineSize = MemoryLayout.size(ofValue: machineCopy)
            let deviceModel: String = withUnsafePointer(to: &machineCopy) { ptr in
                ptr.withMemoryRebound(to: UInt8.self, capacity: machineSize) { buf in
                    // Find null terminator to avoid reading past the string
                    let len: Int = (0..<machineSize).first(where: { buf[$0] == 0 }) ?? machineSize
                    return String(bytes: UnsafeBufferPointer(start: buf, count: len), encoding: .utf8) ?? "unknown"
                }
            }
            let wrapped = DiagnosticReport(
                type: "metrickit_diagnostic",
                appVersion: appVersion,
                buildNumber: buildNumber,
                osVersion: osVersion,
                deviceModel: deviceModel,
                payload: data
            )
            if let reportData = try? JSONEncoder().encode(wrapped) {
                Task {
                    let _: EmptyResponse? = try? await APIClient.shared.fetch(.diagnosticsReport(reportData), retries: 1)
                }
            }
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
    nonisolated func userNotificationCenter(
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
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }
}

/// Wraps a MetricKit diagnostic payload with device/app context for the backend.
private struct DiagnosticReport: Encodable {
    let type: String
    let appVersion: String
    let buildNumber: String
    let osVersion: String
    let deviceModel: String
    let payload: Data

    enum CodingKeys: String, CodingKey {
        case type, appVersion, buildNumber, osVersion, deviceModel, payload
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(type, forKey: .type)
        try container.encode(appVersion, forKey: .appVersion)
        try container.encode(buildNumber, forKey: .buildNumber)
        try container.encode(osVersion, forKey: .osVersion)
        try container.encode(deviceModel, forKey: .deviceModel)
        // Encode payload as base64 string since it's raw JSON bytes
        try container.encode(payload.base64EncodedString(), forKey: .payload)
    }
}

extension Notification.Name {
    static let sogojetNotificationTapped = Notification.Name("sogojetNotificationTapped")
    static let sogojetQuickActionTriggered = Notification.Name("sogojetQuickActionTriggered")
    static let sogojetSyncFailed = Notification.Name("sogojetSyncFailed")
}

@main
struct SoGoJetApp: App {
    @UIApplicationDelegateAdaptor(SoGoJetAppDelegate.self) var appDelegate
    init() {
        // Configure Clerk SDK for OAuth (Google, TikTok).
        Clerk.configure(publishableKey: "pk_live_Y2xlcmsuc29nb2pldC5jb20k")
    }

    @State private var feedStore = FeedStore()
    @State private var savedStore = SavedStore()
    @State private var settingsStore = SettingsStore()
    @State private var bookingStore = BookingStore()
    @State private var router = Router()
    @State private var toastManager = ToastManager()
    @State private var networkMonitor = NetworkMonitor()
    @State private var authStore = AuthStore()
    @State private var recentlyViewedStore = RecentlyViewedStore()
    @State private var bookingHistoryStore = BookingHistoryStore()
    @State private var travelerStore = TravelerStore()
    @State private var tripPlanStore = TripPlanStore()
    @State private var hotelStore = HotelStore()
    @State private var alertStore = AlertStore()
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
                .environment(bookingHistoryStore)
                .environment(travelerStore)
                .environment(tripPlanStore)
                .environment(hotelStore)
                .environment(alertStore)
                .preferredColorScheme(.dark)
                .onAppear {
                    // Wire booking store to push live prices back to feed and saved deals
                    bookingStore.onLivePriceFound = { dealId, livePrice in
                        feedStore.updateLivePrice(dealId: dealId, livePrice: livePrice)
                        savedStore.updatePrice(dealId: dealId, livePrice: livePrice)
                    }
                }
                .task {
                    // Clerk 1.x: configure() handles initialization — no separate load needed

                    // Fetch remote config (maintenance mode, feature flags, min version)
                    await RemoteConfig.shared.fetch()

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
                        SGLogger.app.debug("Received OAuth callback URL (fallback): \(url)")
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
                            await feedStore.flushPendingSwipes()
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
                    toastManager.show(message: String(localized: "session.expired"), type: .info, duration: 4)
                }
                .onReceive(NotificationCenter.default.publisher(for: .sogojetSyncFailed)) { _ in
                    toastManager.show(message: String(localized: "sync.failed"), type: .info, duration: 3)
                }
                .onContinueUserActivity(ActivityTypes.search) { _ in
                    router.handleQuickAction(ActivityTypes.search)
                }
                .onContinueUserActivity(ActivityTypes.saved) { _ in
                    router.handleQuickAction(ActivityTypes.saved)
                }
                .onContinueUserActivity(ActivityTypes.board) { _ in
                    router.handleQuickAction(ActivityTypes.board)
                }
                .onContinueUserActivity(ActivityTypes.searchFlights) { _ in
                    router.handleQuickAction(ActivityTypes.search)
                }
                .onContinueUserActivity(ActivityTypes.viewDeal) { activity in
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
