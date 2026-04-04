import Foundation
import Observation

// MARK: - Trip Plan Store
// Manages AI-generated trip plan requests and streamed responses.

@MainActor
@Observable
final class TripPlanStore {
    var planText: String = ""
    var isLoading = false
    var error: String?

    @ObservationIgnored private var activeTask: Task<Void, Never>?

    // MARK: - Generate

    func generate(request: TripPlanRequest) {
        cancel()
        planText = ""
        isLoading = true
        error = nil

        activeTask = Task {
            do {
                let stream = try await APIClient.shared.streamTripPlan(request)
                for try await chunk in stream {
                    if Task.isCancelled { break }
                    planText += chunk
                }
                isLoading = false
            } catch is CancellationError {
                isLoading = false
            } catch {
                self.error = (error as? APIError)?.errorDescription ?? "Failed to generate trip plan. Please try again."
                isLoading = false
            }
        }
    }

    func cancel() {
        activeTask?.cancel()
        activeTask = nil
        isLoading = false
    }

    func reset() {
        cancel()
        planText = ""
        error = nil
    }
}
