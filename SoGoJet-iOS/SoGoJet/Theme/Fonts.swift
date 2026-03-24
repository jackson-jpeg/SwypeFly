import SwiftUI

// MARK: - Typography Tokens
// Custom fonts with system fallbacks for cases where fonts aren't bundled yet.

enum SGFont {
    /// Display / hero text — BebasNeue or system rounded bold.
    static func display(size: CGFloat) -> Font {
        .custom("BebasNeue-Regular", size: size, relativeTo: .largeTitle)
    }

    /// Body text — Inter Regular or system body.
    static func body(size: CGFloat) -> Font {
        .custom("Inter-Regular", size: size, relativeTo: .body)
    }

    /// Bold body text — Inter SemiBold or system semibold body.
    static func bodyBold(size: CGFloat) -> Font {
        .custom("Inter-SemiBold", size: size, relativeTo: .body)
    }

    /// Accent / editorial — Playfair Display Italic or system serif italic.
    static func accent(size: CGFloat) -> Font {
        .custom("PlayfairDisplay-Italic", size: size, relativeTo: .body)
    }

    // MARK: Presets

    static let heroTitle   = display(size: 48)
    static let cardTitle   = display(size: 32)
    static let sectionHead = bodyBold(size: 18)
    static let bodyDefault = body(size: 15)
    static let bodySmall   = body(size: 13)
    static let caption     = body(size: 11)
    static let price       = display(size: 28)
    static let tagline     = accent(size: 16)
}
