import UIKit

// MARK: - Haptic Engine
//
// Wrapper around UIKit haptic feedback generators plus *pattern* sequences
// that give the app its vintage-terminal character. Patterns are scheduled
// on the main queue with precise delays so they don't block animation work.

enum HapticEngine {
    // MARK: Primitives

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

    // MARK: Patterns
    //
    // Compound sequences keyed to named moments. All dispatch on the main
    // queue so callers can fire-and-forget from any view.

    /// Boarding-pass stamp — heavy thud → warm success chord. Fired on save
    /// commit and at the peak of the Departure hero moment.
    static func boardingPass() {
        heavy()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) { light() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { success() }
    }

    /// Split-flap cascade — `count` selection ticks, each offset by
    /// `staggerMs`, evoking individual flaps settling into place.
    static func flapSettle(count: Int, staggerMs: Double = 40) {
        let clamped = max(1, min(count, 24))
        for i in 0..<clamped {
            let delay = Double(i) * (staggerMs / 1000.0)
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { selection() }
        }
    }

    /// Ascending runway lights — light → medium → heavy, 80ms apart. Used
    /// during the Departure hero sweep.
    static func runway() {
        light()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) { medium() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) { heavy() }
    }

    /// Descending warning — heavy → medium → error. Fired when an action
    /// is rejected mid-gesture (invalid filter, empty result).
    static func runwayReject() {
        heavy()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) { medium() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.20) { error() }
    }
}
