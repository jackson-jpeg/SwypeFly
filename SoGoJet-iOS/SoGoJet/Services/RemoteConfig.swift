import Foundation

// MARK: - Remote Config
// Fetches feature flags, maintenance state, and force-update info from the admin endpoint.
// Safe defaults mean the app works normally if the config can't be reached.

@MainActor
@Observable
final class RemoteConfig {
    static let shared = RemoteConfig()

    var maintenanceMode: Bool = false
    var maintenanceMessage: String = ""
    var minVersion: String = "1.0.0"
    var bookingEnabled: Bool = true
    var forceUpdateUrl: String = ""
    var stripePublishableKey: String = ""
    var clerkPublishableKey: String = ""
    var features: [String: Bool] = [:]

    /// True when the installed app version is older than `minVersion`.
    var requiresUpdate: Bool {
        guard let current = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String else {
            return false
        }
        return Self.compareVersions(current, isOlderThan: minVersion)
    }

    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 10
        self.session = URLSession(configuration: config)
    }

    // MARK: Fetch

    func fetch() async {
        guard let url = URL(string: "https://www.sogojet.com/api/admin/config") else { return }

        do {
            let (data, _) = try await session.data(from: url)
            let response = try JSONDecoder().decode(ConfigResponse.self, from: data)

            maintenanceMode = response.maintenanceMode ?? maintenanceMode
            maintenanceMessage = response.maintenanceMessage ?? maintenanceMessage
            minVersion = response.minVersion ?? minVersion
            bookingEnabled = response.bookingEnabled ?? bookingEnabled
            forceUpdateUrl = response.forceUpdateUrl ?? forceUpdateUrl
            stripePublishableKey = response.stripePublishableKey ?? stripePublishableKey
            clerkPublishableKey = response.clerkPublishableKey ?? clerkPublishableKey
            features = response.features ?? features
        } catch {
            // Silent failure — defaults are safe
        }
    }

    // MARK: Feature Flags

    func isEnabled(_ feature: String) -> Bool {
        features[feature] ?? false
    }

    // MARK: Version Comparison

    /// Returns true when `lhs` is strictly older than `rhs` (semantic version).
    nonisolated static func compareVersions(_ lhs: String, isOlderThan rhs: String) -> Bool {
        let lParts = lhs.split(separator: ".").compactMap { Int($0) }
        let rParts = rhs.split(separator: ".").compactMap { Int($0) }

        for i in 0..<max(lParts.count, rParts.count) {
            let l = i < lParts.count ? lParts[i] : 0
            let r = i < rParts.count ? rParts[i] : 0
            if l < r { return true }
            if l > r { return false }
        }
        return false
    }
}

// MARK: - Response Model

private struct ConfigResponse: Decodable {
    let maintenanceMode: Bool?
    let maintenanceMessage: String?
    let minVersion: String?
    let bookingEnabled: Bool?
    let forceUpdateUrl: String?
    let stripePublishableKey: String?
    let clerkPublishableKey: String?
    let features: [String: Bool]?
}
