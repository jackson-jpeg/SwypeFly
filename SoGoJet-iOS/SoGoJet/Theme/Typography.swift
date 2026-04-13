import SwiftUI

// MARK: - Typography Roles
//
// A formal scale atop the raw SGFont builders in Fonts.swift. Views in new
// visual work should reach for `Text(...).sgFont(.hero)` rather than
// specifying sizes inline. Roles map to a Bebas / Inter / Playfair voice so
// the voice of the app stays consistent even as layouts change.

enum SGTypography {
    /// 56pt Bebas — editorial hero on large surfaces (onboarding splash,
    /// destination hero). Use sparingly, one per screen.
    case display
    /// 40pt Bebas — primary title on detail views and empty states.
    case hero
    /// 28pt Bebas — prices and ticker marquee rows.
    case ticker
    /// 20pt Bebas — card titles.
    case cardTitle
    /// 18pt Inter SemiBold — section headers.
    case section
    /// 16pt Playfair Italic — editorial accents, quotes, callouts.
    case accent
    /// 15pt Inter Regular — body copy.
    case body
    /// 13pt Inter Regular — secondary body copy.
    case bodySmall
    /// 11pt Inter Regular — captions, timestamps, metadata.
    case caption
    /// 10pt Inter SemiBold tracked — micro badges, tags.
    case micro

    fileprivate var font: Font {
        switch self {
        case .display:   return SGFont.display(size: 56)
        case .hero:      return SGFont.display(size: 40)
        case .ticker:    return SGFont.display(size: 28)
        case .cardTitle: return SGFont.display(size: 20)
        case .section:   return SGFont.bodyBold(size: 18)
        case .accent:    return SGFont.accent(size: 16)
        case .body:      return SGFont.body(size: 15)
        case .bodySmall: return SGFont.body(size: 13)
        case .caption:   return SGFont.body(size: 11)
        case .micro:     return SGFont.bodyBold(size: 10)
        }
    }

    fileprivate var tracking: CGFloat {
        switch self {
        case .display, .hero, .ticker, .cardTitle: return 1.2
        case .micro: return 1.6
        default: return 0
        }
    }

    fileprivate var lineSpacing: CGFloat {
        switch self {
        case .body, .bodySmall, .accent: return 3
        default: return 0
        }
    }
}

extension View {
    /// Apply a typography role. Bakes in kerning and line spacing opinions
    /// so every screen that uses a role reads the same.
    func sgFont(_ role: SGTypography) -> some View {
        self
            .font(role.font)
            .tracking(role.tracking)
            .lineSpacing(role.lineSpacing)
    }
}
