import SwiftUI

@main
struct SoGoJetApp: App {
    @State private var feedStore = FeedStore()
    @State private var savedStore = SavedStore()
    @State private var settingsStore = SettingsStore()
    @State private var bookingStore = BookingStore()
    @State private var router = Router()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(feedStore)
                .environment(savedStore)
                .environment(settingsStore)
                .environment(bookingStore)
                .environment(router)
                .preferredColorScheme(.dark)
        }
    }
}
