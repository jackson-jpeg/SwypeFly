import SwiftUI

// MARK: - Design Token Colors
// Matches the dark-mode palette used in the SoGoJet web app.
// Source of truth: CLAUDE.md color table + constants/theme.ts card tokens.

extension Color {
    // MARK: Core Palette
    static let sgBg         = Color(hex: 0x0A0A0A)
    static let sgSurface    = Color(hex: 0x141414)
    static let sgCell       = Color(hex: 0x1A1A1A)
    static let sgBorder     = Color(hex: 0x2A2A2A)

    // MARK: Accent
    static let sgYellow     = Color(hex: 0xF7E8A0)
    static let sgGreen      = Color(hex: 0xA8C4B8)
    static let sgOrange     = Color(hex: 0xE8A849)

    // MARK: Text
    static let sgWhite      = Color(hex: 0xF5F5F5)
    static let sgWhiteDim   = Color(hex: 0xCCCCCC)
    static let sgMuted      = Color(hex: 0x888888)
    static let sgFaint      = Color(hex: 0x555555)

    // MARK: Deal Tiers
    static let sgDealAmazing = Color(hex: 0x4ADE80)
    static let sgDealGreat   = Color(hex: 0xFBBF24)
    static let sgDealGood    = Color(hex: 0x60A5FA)
    static let sgRed         = Color(hex: 0xE85D4A)

    // MARK: Material Depth
    /// True black — used only for the deepest wells (modal backdrops, hero voids).
    static let sgInk             = Color(hex: 0x050505)
    /// 1dp lift over sgBg — default elevated surface under sheets and sticky headers.
    static let sgSurfaceElevated = Color(hex: 0x181818)
    /// 2dp lift — sheet body, floating cards, popover content.
    static let sgSurfaceHigh     = Color(hex: 0x1F1F1F)
    /// Hairline — border between stacked rows on a board, thinner than sgBorder.
    static let sgHairline        = Color(hex: 0x222222)
    /// Warm printed-paper shadow tint — used as a colored shadow on lifted cards.
    static let sgShadowWarm      = Color(hex: 0x100A04)

    // MARK: Card Gradient
    /// Bottom gradient on destination cards: transparent → 85% opaque background.
    static let cardGradient = LinearGradient(
        colors: [
            Color.clear,
            Color(hex: 0x0A0A0A).opacity(0.85)
        ],
        startPoint: .top,
        endPoint: .bottom
    )
}

// MARK: - Hex Initialiser

// MARK: - Shadow Helpers

struct SGShadow {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat

    /// Subtle lift — chips, inline buttons.
    static let lift = SGShadow(color: Color.sgShadowWarm.opacity(0.35), radius: 6, x: 0, y: 2)
    /// Card elevation — feed cards, saved cards.
    static let card = SGShadow(color: Color.sgShadowWarm.opacity(0.45), radius: 14, x: 0, y: 6)
    /// Sheet elevation — bottom sheets, modals.
    static let sheet = SGShadow(color: Color.sgInk.opacity(0.55), radius: 28, x: 0, y: 12)
    /// Hero glow — Departure moment, selected hero elements.
    static let hero = SGShadow(color: Color.sgYellow.opacity(0.25), radius: 32, x: 0, y: 0)
}

extension View {
    /// Apply a tokenized shadow preset.
    func sgShadow(_ preset: SGShadow) -> some View {
        self.shadow(color: preset.color, radius: preset.radius, x: preset.x, y: preset.y)
    }
}

extension Color {
    init(hex: UInt, alpha: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >> 8)  & 0xFF) / 255.0
        let b = Double(hex         & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}
