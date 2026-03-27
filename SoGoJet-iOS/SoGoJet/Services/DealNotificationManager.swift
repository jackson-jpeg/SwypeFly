import Foundation
import UserNotifications

// MARK: - Deal Notification Manager
// Schedules daily "Deal of the Day" local notifications.
// No backend push service needed — runs entirely on-device.

@MainActor
enum DealNotificationManager {

    /// Request notification permission and schedule daily deal notification.
    static func requestAndSchedule(departureCode: String) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { return }
            Task { @MainActor in
                await scheduleDailyDeal(departureCode: departureCode)
            }
        }
    }

    /// Schedule a daily notification at 9 AM with the best deal.
    static func scheduleDailyDeal(departureCode: String) async {
        let center = UNUserNotificationCenter.current()

        // Remove any existing deal notifications
        center.removePendingNotificationRequests(withIdentifiers: ["sogojet-daily-deal"])

        // Fetch the best deal from the API
        guard let deal = await fetchBestDeal(origin: departureCode) else { return }

        let content = UNMutableNotificationContent()
        content.title = "Deal of the Day"
        content.body = "\(deal.city), \(deal.country) from $\(deal.price) — \(deal.tagline)"
        content.sound = .default
        content.userInfo = ["dealId": deal.id]
        content.categoryIdentifier = "DEAL_OF_DAY"

        // Schedule for 9 AM tomorrow
        var dateComponents = DateComponents()
        dateComponents.hour = 9
        dateComponents.minute = 0
        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)

        let request = UNNotificationRequest(
            identifier: "sogojet-daily-deal",
            content: content,
            trigger: trigger
        )

        do {
            try await center.add(request)
            #if DEBUG
            print("[Notifications] Scheduled daily deal: \(deal.city) from $\(deal.price)")
            #endif
        } catch {
            #if DEBUG
            print("[Notifications] Failed to schedule daily deal: \(error.localizedDescription)")
            #endif
        }
    }

    /// Cancel the daily deal notification.
    static func cancelDailyDeal() {
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: ["sogojet-daily-deal"])
    }

    // MARK: - Fetch Best Deal

    private struct MinimalDeal {
        let id: String
        let city: String
        let country: String
        let price: Int
        let tagline: String
    }

    private static func fetchBestDeal(origin: String) async -> MinimalDeal? {
        guard var components = URLComponents(string: "https://www.sogojet.com/api/feed") else { return nil }
        components.queryItems = [
            URLQueryItem(name: "origin", value: origin),
            URLQueryItem(name: "page", value: "1"),
        ]
        guard let url = components.url else { return nil }

        var request = URLRequest(url: url)
        request.timeoutInterval = 10

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }

            struct FeedResponse: Codable {
                let destinations: [FeedDeal]
            }
            struct FeedDeal: Codable {
                let id: String
                let city: String
                let country: String
                let tagline: String
                let flightPrice: Double?
                let livePrice: Double?
            }

            let feed = try JSONDecoder().decode(FeedResponse.self, from: data)
            let best = feed.destinations
                .compactMap { deal -> (FeedDeal, Double)? in
                    let price = deal.livePrice ?? deal.flightPrice
                    guard let p = price, p > 0 else { return nil }
                    return (deal, p)
                }
                .min(by: { $0.1 < $1.1 })

            guard let (deal, price) = best else { return nil }
            return MinimalDeal(
                id: deal.id,
                city: deal.city,
                country: deal.country,
                price: Int(price),
                tagline: deal.tagline
            )
        } catch {
            return nil
        }
    }
}
