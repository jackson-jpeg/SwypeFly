import os

// MARK: - SoGoJet Logger
// Structured logging using os.Logger. Compiles to no-ops in release for debug-level messages.

enum SGLogger {
    private static let subsystem = "com.sogojet.app"

    static let api = Logger(subsystem: subsystem, category: "api")
    static let auth = Logger(subsystem: subsystem, category: "auth")
    static let feed = Logger(subsystem: subsystem, category: "feed")
    static let booking = Logger(subsystem: subsystem, category: "booking")
    static let saved = Logger(subsystem: subsystem, category: "saved")
    static let router = Logger(subsystem: subsystem, category: "router")
    static let images = Logger(subsystem: subsystem, category: "images")
    static let notifications = Logger(subsystem: subsystem, category: "notifications")
    static let app = Logger(subsystem: subsystem, category: "app")
}
