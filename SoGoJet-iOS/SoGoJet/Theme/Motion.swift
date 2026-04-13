import SwiftUI

// MARK: - Motion Tokens
//
// The authoritative timing / easing vocabulary for SoGoJet. Every animation
// in new visual work should resolve through one of these presets so the app
// feels like a single instrument — not thirty different ones.
//
// Durations are thought of as "how long does this take to read?" — not
// "how smooth do I want it." Springs encode personality; curves encode
// physicality (mechanical flap, runway lights, paper pages).

// MARK: Durations

enum SGDuration {
    /// 80ms — reactive feedback barely perceived as motion (chip press, tick).
    static let instant: Double = 0.08
    /// 180ms — micro-interactions (button release, filter chip glide).
    static let fast: Double = 0.18
    /// 300ms — default UI transition (card enter, section reveal).
    static let base: Double = 0.30
    /// 520ms — emphasized motion (hero scale, sheet present).
    static let slow: Double = 0.52
    /// 900ms — cinematic sequences (departure shimmer sweep).
    static let epic: Double = 0.90
}

// MARK: Springs

enum SGSpring {
    /// Crisp, decisive — UI controls, chip selection.
    static let snappy: Animation = .spring(response: 0.28, dampingFraction: 0.82)

    /// Playful bounce — save pulse, success beats.
    static let bouncy: Animation = .spring(response: 0.45, dampingFraction: 0.68)

    /// Silky momentum — scroll settles, hero transitions.
    static let silky: Animation = .spring(response: 0.60, dampingFraction: 0.88)

    /// Mechanical snap — split-flap settle, switch toggles.
    static let mechanical: Animation = .spring(response: 0.22, dampingFraction: 0.95)

    /// Heavy, deliberate — sheet dismissal, destructive confirm.
    static let deliberate: Animation = .spring(response: 0.55, dampingFraction: 0.92)
}

// MARK: Curves

enum SGCurve {
    /// Custom cubic tuned for the split-flap mechanical feel — fast start,
    /// hard stop (like a real Solari flap hitting its rest).
    static let terminal: Animation = .timingCurve(0.22, 0.9, 0.3, 1.0, duration: SGDuration.base)

    /// Ease-in-out quad for runway light sweeps and shimmer.
    static let runway: Animation = .timingCurve(0.45, 0.05, 0.55, 0.95, duration: SGDuration.slow)

    /// Page-turn easing — asymmetric, mimics paper weight.
    static let pageTurn: Animation = .timingCurve(0.32, 0.04, 0.15, 0.98, duration: SGDuration.slow)

    /// Cinematic ease-out for hero entrances.
    static let heroEntrance: Animation = .timingCurve(0.16, 1.0, 0.3, 1.0, duration: SGDuration.slow)
}

// MARK: Accessibility helpers

extension Animation {
    /// Returns this animation unless Reduce Motion is enabled, in which case
    /// it collapses to a quick opacity-grade fade. Use on any *decorative*
    /// motion — never on motion that conveys information.
    func respectingReduceMotion() -> Animation {
        UIAccessibility.isReduceMotionEnabled ? .easeOut(duration: SGDuration.fast) : self
    }
}

// MARK: Convenience builders

extension SGSpring {
    /// A cascading delay helper — feed an index and a stagger in ms.
    static func cascadeDelay(index: Int, staggerMs: Double = 40) -> Double {
        Double(index) * (staggerMs / 1000.0)
    }
}
