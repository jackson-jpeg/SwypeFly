import UIKit

// MARK: - Haptic Engine
// Thin wrapper around UIKit haptic feedback generators.

enum HapticEngine {
    /// Light tap — card appearance, minor interactions.
    static func light() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.prepare()
        generator.impactOccurred()
    }

    /// Medium tap — button presses, swipe threshold crossed.
    static func medium() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.prepare()
        generator.impactOccurred()
    }

    /// Heavy tap — destructive actions, major state changes.
    static func heavy() {
        let generator = UIImpactFeedbackGenerator(style: .heavy)
        generator.prepare()
        generator.impactOccurred()
    }

    /// Success notification — save confirmed, booking complete.
    static func success() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.success)
    }

    /// Warning notification — price increased, action may fail.
    static func warning() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.warning)
    }

    /// Error notification — request failed, validation error.
    static func error() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.error)
    }

    /// Selection tick — scrolling through options, picker changes.
    static func selection() {
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
    }

    /// Tier-appropriate haptic — stronger feedback for better deals.
    static func forTier(_ tier: DealTier?) {
        switch tier {
        case .amazing:
            success()
        case .great:
            medium()
        case .good:
            light()
        case .fair, .none:
            selection()
        }
    }
}
