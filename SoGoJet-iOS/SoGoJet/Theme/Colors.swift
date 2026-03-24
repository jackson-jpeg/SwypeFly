import SwiftUI

// MARK: - Design Token Colors
// Matches the dark-mode palette used in the SoGoJet web app.
// Source of truth: CLAUDE.md color table + constants/theme.ts card tokens.

extension Color {
    // MARK: Core Palette
    static let sgBg         = Color(hex: 0x0A0806)
    static let sgSurface    = Color(hex: 0x151210)
    static let sgCell       = Color(hex: 0x1A1510)
    static let sgBorder     = Color(hex: 0x2A231A)

    // MARK: Accent
    static let sgYellow     = Color(hex: 0xF7E8A0)
    static let sgGreen      = Color(hex: 0xA8C4B8)
    static let sgOrange     = Color(hex: 0xE8A849)

    // MARK: Text
    static let sgWhite      = Color(hex: 0xFFF8F0)
    static let sgWhiteDim   = Color(hex: 0xD4C8B8)
    static let sgMuted      = Color(hex: 0x8B7D6B)
    static let sgFaint      = Color(hex: 0x5A4F42)

    // MARK: Deal Tiers
    static let sgDealAmazing = Color(hex: 0x4ADE80)
    static let sgDealGreat   = Color(hex: 0xFBBF24)
    static let sgDealGood    = Color(hex: 0x60A5FA)
    static let sgRed         = Color(hex: 0xE85D4A)

    // MARK: Card Gradient
    /// Bottom gradient on destination cards: transparent → 85% opaque background.
    static let cardGradient = LinearGradient(
        colors: [
            Color.clear,
            Color(hex: 0x0A0806).opacity(0.85)
        ],
        startPoint: .top,
        endPoint: .bottom
    )
}

// MARK: - Hex Initialiser

extension Color {
    init(hex: UInt, alpha: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >> 8)  & 0xFF) / 255.0
        let b = Double(hex         & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}
