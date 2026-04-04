import Foundation
import Observation

// MARK: - Alert Store
// Manages price alert CRUD operations.

@MainActor
@Observable
final class AlertStore {
    var alerts: [PriceAlert] = []
    var isLoading = false
    var error: String?

    // MARK: - List

    func fetchAlerts() async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let response: PriceAlertListResponse = try await APIClient.shared.fetch(.alertList)
            alerts = response.alerts
        } catch let apiError as APIError {
            if case .httpError(let code, _) = apiError, code == 401 {
                alerts = []
                return
            }
            error = apiError.errorDescription
        } catch {
            self.error = "Failed to load alerts"
        }
    }

    // MARK: - Delete

    func deleteAlert(id: String) async -> Bool {
        do {
            let _: PriceAlertDeleteResponse = try await APIClient.shared.fetch(.alertDelete(id: id))
            alerts.removeAll { $0.id == id }
            return true
        } catch {
            self.error = "Failed to delete alert"
            return false
        }
    }

    var activeAlerts: [PriceAlert] {
        alerts.filter(\.isActive)
    }

    var triggeredAlerts: [PriceAlert] {
        alerts.filter { !$0.isActive && $0.triggeredAt != nil }
    }
}
