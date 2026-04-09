import Foundation
import UserNotifications
import BackgroundTasks

// MARK: - Fare Drop Monitor
// Checks saved destinations for price drops and notifies the user.
// Uses BGTaskScheduler for periodic background checks.

@MainActor
enum FareDropMonitor {
    static let taskIdentifier = "com.sogojet.fare-drop-check"

    // MARK: - Background Task Registration

    /// Register the background task. Call once at app launch.
    static func registerBackgroundTask() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: taskIdentifier,
            using: nil
        ) { task in
            Task { @MainActor in
                guard let refreshTask = task as? BGAppRefreshTask else {
                    task.setTaskCompleted(success: false)
                    return
                }
                await handleBackgroundCheck(task: refreshTask)
            }
        }
    }

    /// Schedule the next background check (typically after the current one completes).
    static func scheduleNextCheck() {
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        // Check every 4 hours minimum
        request.earliestBeginDate = Date(timeIntervalSinceNow: 4 * 60 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("[FareDropMonitor] Failed to schedule background task: \(error.localizedDescription)")
        }
    }

    // MARK: - Fare Check Logic

    /// Check all saved destinations for price drops. Called from background task or app foreground.
    static func checkForFareDrops(savedDeals: [Deal], origin: String) async -> [FareDrop] {
        var drops: [FareDrop] = []

        for deal in savedDeals {
            guard deal.hasPrice, let oldPrice = deal.displayPrice else { continue }

            // Fetch current price from API
            guard let currentPrice = await fetchCurrentPrice(
                origin: origin,
                destination: deal.iataCode
            ) else { continue }

            let change = currentPrice - oldPrice
            let percentChange = oldPrice > 0 ? (change / oldPrice) * 100 : 0

            // Only alert on drops of > 5%
            if percentChange < -5 {
                drops.append(FareDrop(
                    dealId: deal.id,
                    city: deal.city,
                    country: deal.country,
                    oldPrice: Int(oldPrice),
                    newPrice: Int(currentPrice),
                    dropAmount: Int(abs(change)),
                    dropPercent: Int(abs(percentChange))
                ))
            }
        }

        return drops
    }

    /// Send local notifications for fare drops.
    static func notifyFareDrops(_ drops: [FareDrop]) {
        let center = UNUserNotificationCenter.current()

        for drop in drops.prefix(3) { // Max 3 notifications at once
            let content = UNMutableNotificationContent()
            content.title = "Price Drop: \(drop.city)"
            content.body = "\(drop.city) dropped $\(drop.dropAmount) to $\(drop.newPrice) (\(drop.dropPercent)% off)"
            content.sound = .default
            content.userInfo = ["dealId": drop.dealId]
            content.categoryIdentifier = "FARE_DROP"

            let request = UNNotificationRequest(
                identifier: "fare-drop-\(drop.dealId)",
                content: content,
                trigger: nil // Deliver immediately
            )

            center.add(request)
        }

        SGLogger.notifications.debug("Notified \(drops.count) drops")
    }

    // MARK: - Background Handler

    private static func handleBackgroundCheck(task: BGAppRefreshTask) async {
        // Schedule the next one
        scheduleNextCheck()

        let origin = SharedDefaults.departureCode

        // Load saved deals from UserDefaults
        guard let data = UserDefaults.standard.data(forKey: StorageKeys.Saved.deals),
              let deals = try? JSONDecoder().decode([Deal].self, from: data),
              !deals.isEmpty else {
            task.setTaskCompleted(success: true)
            return
        }

        let workItem = Task {
            let drops = await checkForFareDrops(savedDeals: deals, origin: origin)
            if !drops.isEmpty {
                notifyFareDrops(drops)
            }
            task.setTaskCompleted(success: true)
        }

        task.expirationHandler = {
            workItem.cancel()
            task.setTaskCompleted(success: false)
        }

        await workItem.value
    }

    // MARK: - API

    private static func fetchCurrentPrice(origin: String, destination: String) async -> Double? {
        guard var components = URLComponents(string: "https://www.sogojet.com/api/destination") else { return nil }
        components.queryItems = [
            URLQueryItem(name: "id", value: destination),
            URLQueryItem(name: "origin", value: origin),
        ]
        guard let url = components.url else { return nil }

        var request = URLRequest(url: url)
        request.timeoutInterval = 8

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }

            struct PriceResponse: Codable {
                let flightPrice: Double?
                let livePrice: Double?
            }
            let result = try JSONDecoder().decode(PriceResponse.self, from: data)
            return result.livePrice ?? result.flightPrice
        } catch {
            return nil
        }
    }
}

// MARK: - Fare Drop Model

struct FareDrop: Sendable {
    let dealId: String
    let city: String
    let country: String
    let oldPrice: Int
    let newPrice: Int
    let dropAmount: Int
    let dropPercent: Int
}
