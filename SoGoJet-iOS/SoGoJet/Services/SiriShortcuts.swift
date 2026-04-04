import Foundation
import Intents

// MARK: - Siri Shortcuts
// Donates user activities so Siri can suggest them and shortcuts can trigger them.

@MainActor
enum SiriShortcuts {

    /// Donate "Search Flights" activity after the user searches.
    static func donateSearch(origin: String, destination: String? = nil) {
        let activity = NSUserActivity(activityType: ActivityTypes.searchFlights)
        if let destination {
            activity.title = "Search flights to \(destination)"
        } else {
            activity.title = "Search flights from \(origin)"
        }
        activity.isEligibleForSearch = true
        activity.isEligibleForPrediction = true
        activity.suggestedInvocationPhrase = "Find cheap flights"
        activity.userInfo = ["origin": origin]
        if let destination {
            activity.userInfo?["destination"] = destination
        }
        activity.becomeCurrent()
    }

    /// Donate "Check Saved Deals" activity.
    static func donateSaved(count: Int) {
        let activity = NSUserActivity(activityType: ActivityTypes.saved)
        activity.title = "Check \(count) saved flight deals"
        activity.isEligibleForSearch = true
        activity.isEligibleForPrediction = true
        activity.suggestedInvocationPhrase = "Show my saved flights"
        activity.becomeCurrent()
    }

    /// Donate "View Deal" activity for a specific destination.
    static func donateDealView(city: String, dealId: String) {
        let activity = NSUserActivity(activityType: ActivityTypes.viewDeal)
        activity.title = "View flight deals to \(city)"
        activity.isEligibleForSearch = true
        activity.isEligibleForPrediction = true
        activity.suggestedInvocationPhrase = "Flights to \(city)"
        activity.userInfo = ["dealId": dealId, "city": city]
        activity.becomeCurrent()
    }
}
