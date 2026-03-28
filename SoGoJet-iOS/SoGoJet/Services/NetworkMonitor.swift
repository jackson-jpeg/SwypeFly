import Network
import Observation

@MainActor
@Observable
final class NetworkMonitor {
    private(set) var isConnected = true
    private let monitor = NWPathMonitor()

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let connected = path.status == .satisfied
            Task { @MainActor in
                self?.isConnected = connected
            }
        }
        monitor.start(queue: .main)
    }

    deinit {
        monitor.cancel()
    }
}
