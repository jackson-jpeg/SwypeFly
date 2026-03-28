import Foundation
import StoreKit
import UIKit
import SwiftUI

// MARK: - Review Prompter
// Strategically asks for App Store reviews after positive moments.
// Apple limits review prompts to 3 per year, so we gate on:
//   1. User has saved 3+ destinations
//   2. User has used the app on 3+ separate days
//   3. User has completed a booking
// Only prompts once every 90 days maximum.

@MainActor
final class ReviewPrompter {
    static let shared = ReviewPrompter()

    // MARK: UserDefaults Keys

    private enum Keys {
        static let lastPromptDate = "sg_review_last_prompt_date"
        static let appOpenDays = "sg_review_app_open_days"
        static let lastRecordedDay = "sg_review_last_recorded_day"
    }

    // MARK: Configuration

    /// Minimum days between review prompts.
    private let cooldownDays: Int = 90

    /// Number of saves required to trigger a prompt.
    private let saveMilestone: Int = 3

    /// Number of distinct app-open days required.
    private let daysMilestone: Int = 3

    private let defaults = UserDefaults.standard

    private init() {}

    // MARK: - Public API

    /// Call when the user saves a destination. Triggers review prompt at the milestone.
    func recordSave(totalSavedCount: Int) {
        guard totalSavedCount == saveMilestone else { return }
        requestReviewIfEligible()
    }

    /// Call when the user completes a booking. Always a strong positive signal.
    func recordBookingCompleted() {
        requestReviewIfEligible()
    }

    /// Call on app launch to track distinct usage days. Triggers at the milestone.
    func recordAppOpen() {
        let today = calendarDay(from: Date())
        let lastDay = defaults.string(forKey: Keys.lastRecordedDay)

        guard today != lastDay else { return }

        defaults.set(today, forKey: Keys.lastRecordedDay)
        let count = defaults.integer(forKey: Keys.appOpenDays) + 1
        defaults.set(count, forKey: Keys.appOpenDays)

        if count == daysMilestone {
            requestReviewIfEligible()
        }
    }

    // MARK: - Private

    private func requestReviewIfEligible() {
        guard !isInCooldown() else { return }

        defaults.set(Date().timeIntervalSince1970, forKey: Keys.lastPromptDate)

        // Slight delay so the prompt doesn't collide with UI transitions.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            if let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }) {
                AppStore.requestReview(in: scene)
            }
        }
    }

    private func isInCooldown() -> Bool {
        let lastTimestamp = defaults.double(forKey: Keys.lastPromptDate)
        guard lastTimestamp > 0 else { return false }

        let lastDate = Date(timeIntervalSince1970: lastTimestamp)
        let daysSince = Calendar.current.dateComponents([.day], from: lastDate, to: Date()).day ?? 0
        return daysSince < cooldownDays
    }

    /// Returns a stable string like "2026-03-25" for deduplication.
    private func calendarDay(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = .current
        return formatter.string(from: date)
    }
}
