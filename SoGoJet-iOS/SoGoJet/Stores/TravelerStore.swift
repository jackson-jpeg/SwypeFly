import Foundation
import Observation

// MARK: - Traveler Store
// Manages saved traveler profiles for faster booking.

@MainActor
@Observable
final class TravelerStore {
    var travelers: [SavedTraveler] = []
    var isLoading = false
    var error: String?

    var primaryTraveler: SavedTraveler? {
        travelers.first(where: \.isPrimary)
    }

    // MARK: - CRUD

    func fetchTravelers() async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let response: TravelerListResponse = try await APIClient.shared.fetch(.travelerList)
            travelers = response.travelers
        } catch let apiError as APIError {
            if case .httpError(let code, _) = apiError, code == 401 {
                travelers = []
                return
            }
            error = apiError.errorDescription
        } catch {
            self.error = "Failed to load travelers"
        }
    }

    func createTraveler(_ request: TravelerCreateRequest) async -> SavedTraveler? {
        do {
            let response: TravelerSingleResponse = try await APIClient.shared.fetch(.travelerCreate(request))
            travelers.append(response.traveler)
            return response.traveler
        } catch {
            self.error = "Failed to save traveler"
            return nil
        }
    }

    func updateTraveler(id: String, _ request: TravelerCreateRequest) async -> SavedTraveler? {
        do {
            let response: TravelerSingleResponse = try await APIClient.shared.fetch(.travelerUpdate(id: id, request))
            if let idx = travelers.firstIndex(where: { $0.id == id }) {
                travelers[idx] = response.traveler
            }
            return response.traveler
        } catch {
            self.error = "Failed to update traveler"
            return nil
        }
    }

    func deleteTraveler(id: String) async -> Bool {
        do {
            let _: EmptyResponse = try await APIClient.shared.fetch(.travelerDelete(id: id))
            travelers.removeAll { $0.id == id }
            return true
        } catch {
            self.error = "Failed to delete traveler"
            return false
        }
    }
}
