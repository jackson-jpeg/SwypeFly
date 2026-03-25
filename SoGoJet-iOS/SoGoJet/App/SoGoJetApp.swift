import SwiftUI

@main
struct SoGoJetApp: App {
    @State private var feedStore = FeedStore()
    @State private var savedStore = SavedStore()
    @State private var settingsStore = SettingsStore()
    @State private var bookingStore = BookingStore()
    @State private var router = Router()
    @State private var toastManager = ToastManager()
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
                .preferredColorScheme(.dark)
                .task {
                    // Preload feed immediately on launch so content is
                    // ready (or loading) by the time the user sees the feed tab.
                    if feedStore.allDeals.isEmpty {
                        await feedStore.fetchDeals(origin: settingsStore.departureCode)
                    }
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
