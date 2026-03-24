import Foundation

// MARK: - Date Formatting Extensions
// Works on ISO 8601 date strings (e.g. "2026-04-15" or "2026-04-15T08:30:00Z").

extension String {
    /// Parse an ISO date string into a Date, or nil if invalid.
    private func parseDate() -> Date? {
        // Try full ISO 8601 first, then date-only.
        let isoFull = ISO8601DateFormatter()
        if let date = isoFull.date(from: self) { return date }

        let dateOnly = DateFormatter()
        dateOnly.dateFormat = "yyyy-MM-dd"
        dateOnly.locale = Locale(identifier: "en_US_POSIX")
        return dateOnly.date(from: self)
    }

    /// Short date format: "Apr 15" or "Apr 15, 2027" (if not current year).
    var shortDate: String {
        guard let date = parseDate() else { return self }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        let currentYear = Calendar.current.component(.year, from: Date())
        let dateYear = Calendar.current.component(.year, from: date)
        formatter.dateFormat = currentYear == dateYear ? "MMM d" : "MMM d, yyyy"
        return formatter.string(from: date)
    }

    /// Board-style time: "08:30" (24h).
    var boardTime: String {
        guard let date = parseDate() else { return self }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    /// Relative label: "Today", "Tomorrow", "In 3 days", "Apr 15".
    var relativeLabel: String {
        guard let date = parseDate() else { return self }
        let calendar = Calendar.current
        let now = Date()

        if calendar.isDateInToday(date) { return "Today" }
        if calendar.isDateInTomorrow(date) { return "Tomorrow" }

        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: date)).day ?? 0
        if days > 0 && days <= 7 { return "In \(days) days" }

        return shortDate
    }
}
