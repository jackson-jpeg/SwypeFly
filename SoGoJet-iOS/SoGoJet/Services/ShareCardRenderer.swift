import SwiftUI
import UIKit

// MARK: - Share Card Renderer
// Renders a beautiful shareable image card from a Deal, sized for social media.
// Uses SwiftUI's ImageRenderer (iOS 16+) to convert a SwiftUI view to UIImage.

@MainActor
enum ShareCardRenderer {

    enum CardSize {
        case story      // 1080x1920 (Instagram Stories, TikTok)
        case square     // 1080x1080 (Instagram feed, Twitter)

        var width: CGFloat { 1080 }
        var height: CGFloat {
            switch self {
            case .story:  return 1920
            case .square: return 1080
            }
        }
    }

    /// Render a deal into a shareable UIImage.
    /// Loads the destination photo from cache for the blurred background.
    static func render(deal: Deal, size: CardSize = .story) async -> UIImage? {
        // Try to load the background photo from cache
        let bgImage: UIImage? = await {
            guard let urlString = deal.imageUrl else { return nil }
            return await ImageCache.shared.image(for: urlString)
        }()

        let view = ShareCardView(deal: deal, backgroundImage: bgImage, cardSize: size)
            .frame(width: size.width, height: size.height)

        let renderer = ImageRenderer(content: view)
        renderer.scale = 3  // Retina quality
        renderer.proposedSize = .init(width: size.width, height: size.height)

        return renderer.uiImage
    }
}

// MARK: - Share Card View

struct ShareCardView: View {
    let deal: Deal
    let backgroundImage: UIImage?
    let cardSize: ShareCardRenderer.CardSize

    private var isStory: Bool { cardSize == .story }

    var body: some View {
        ZStack {
            // Layer 1: Background
            backgroundLayer

            // Layer 2: Gradient overlays for text legibility
            gradientOverlay

            // Layer 3: Content
            contentLayer
        }
        .frame(width: cardSize.width, height: cardSize.height)
        .clipped()
    }

    // MARK: - Background

    @ViewBuilder
    private var backgroundLayer: some View {
        if let bgImage = backgroundImage {
            Image(uiImage: bgImage)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: cardSize.width, height: cardSize.height)
                .blur(radius: 30)
                .scaleEffect(1.2) // Prevent blur edge artifacts
                .clipped()
        } else {
            // Gradient fallback when no photo is available
            LinearGradient(
                colors: [
                    Color(hex: 0x1A1A2E),
                    Color(hex: 0x16213E),
                    Color(hex: 0x0F3460),
                    Color(hex: 0x0A0A0A)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private var gradientOverlay: some View {
        ZStack {
            // Top darken for branding area
            LinearGradient(
                colors: [
                    Color.black.opacity(0.7),
                    Color.black.opacity(0.3),
                    Color.clear
                ],
                startPoint: .top,
                endPoint: .center
            )

            // Bottom darken for branding footer
            LinearGradient(
                colors: [
                    Color.clear,
                    Color.black.opacity(0.4),
                    Color.black.opacity(0.85)
                ],
                startPoint: .center,
                endPoint: .bottom
            )

            // Overall darken for text legibility
            Color.black.opacity(0.35)
        }
    }

    // MARK: - Content

    private var contentLayer: some View {
        VStack(spacing: 0) {
            // Top spacer
            Spacer()
                .frame(height: isStory ? 200 : 80)

            // Destination photo (unblurred, cropped)
            if let bgImage = backgroundImage {
                photoCard(bgImage)
            }

            Spacer()
                .frame(height: isStory ? 60 : 36)

            // City name
            Text(deal.city.uppercased())
                .font(.system(size: isStory ? 72 : 56, weight: .bold, design: .monospaced))
                .foregroundStyle(.white)
                .tracking(4)
                .lineLimit(2)
                .minimumScaleFactor(0.6)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 48)

            // Country
            Text(deal.country.uppercased())
                .font(.system(size: isStory ? 24 : 20, weight: .medium, design: .monospaced))
                .foregroundStyle(.white.opacity(0.6))
                .tracking(6)
                .padding(.top, 8)

            Spacer()
                .frame(height: isStory ? 40 : 24)

            // Price badge
            priceBadge

            Spacer()
                .frame(height: isStory ? 28 : 18)

            // Flight info line
            flightInfoLine

            Spacer()
                .frame(height: isStory ? 24 : 16)

            // Vibe tags
            vibeTagsRow

            // Deal tier badge
            if let tier = deal.dealTier, tier == .amazing || tier == .great {
                dealTierBadge(tier)
                    .padding(.top, isStory ? 24 : 16)
            }

            Spacer()

            // Branding footer
            brandingFooter
                .padding(.bottom, isStory ? 80 : 48)
        }
    }

    // MARK: - Photo Card

    private func photoCard(_ image: UIImage) -> some View {
        Image(uiImage: image)
            .resizable()
            .aspectRatio(contentMode: .fill)
            .frame(width: cardSize.width - 120, height: isStory ? 480 : 360)
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .overlay(
                RoundedRectangle(cornerRadius: 24)
                    .strokeBorder(.white.opacity(0.15), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.5), radius: 30, y: 15)
    }

    // MARK: - Price Badge

    private var priceBadge: some View {
        HStack(spacing: 6) {
            if deal.hasPrice {
                Text(deal.priceFormatted)
                    .font(.system(size: isStory ? 44 : 36, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color(hex: 0x0A0A0A))
            } else {
                Text("Check price")
                    .font(.system(size: isStory ? 28 : 24, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color(hex: 0x0A0A0A))
            }
        }
        .padding(.horizontal, 36)
        .padding(.vertical, 14)
        .background(
            Capsule()
                .fill(
                    LinearGradient(
                        colors: [Color(hex: 0xF7E8A0), Color(hex: 0xE8A849)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
        )
        .shadow(color: Color(hex: 0xF7E8A0).opacity(0.3), radius: 20, y: 4)
    }

    // MARK: - Flight Info

    private var flightInfoLine: some View {
        HStack(spacing: 12) {
            let parts = buildFlightParts()
            ForEach(Array(parts.enumerated()), id: \.offset) { index, part in
                if index > 0 {
                    Circle()
                        .fill(.white.opacity(0.4))
                        .frame(width: 4, height: 4)
                }
                Text(part)
                    .font(.system(size: isStory ? 20 : 17, weight: .medium, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.75))
            }
        }
    }

    private func buildFlightParts() -> [String] {
        var parts: [String] = []
        if deal.airlineName != "\u{2014}" { parts.append(deal.airlineName) }
        if let d = deal.flightDuration, !d.isEmpty { parts.append(d) }
        let s = deal.stopsLabel
        if !s.isEmpty { parts.append(s) }
        if parts.isEmpty { parts.append("Roundtrip flight") }
        return parts
    }

    // MARK: - Vibe Tags

    @ViewBuilder
    private var vibeTagsRow: some View {
        let tags = Array(deal.safeVibeTags.prefix(4))
        if !tags.isEmpty {
            HStack(spacing: 10) {
                ForEach(tags, id: \.self) { tag in
                    Text(tag.uppercased())
                        .font(.system(size: isStory ? 14 : 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color(hex: 0xF7E8A0))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(
                            Capsule()
                                .fill(Color(hex: 0xF7E8A0).opacity(0.15))
                        )
                        .overlay(
                            Capsule()
                                .strokeBorder(Color(hex: 0xF7E8A0).opacity(0.3), lineWidth: 1)
                        )
                }
            }
        }
    }

    // MARK: - Deal Tier Badge

    private func dealTierBadge(_ tier: DealTier) -> some View {
        HStack(spacing: 8) {
            Image(systemName: tier.iconName)
                .font(.system(size: isStory ? 18 : 15, weight: .bold))
            Text(tier.label.uppercased())
                .font(.system(size: isStory ? 16 : 14, weight: .bold, design: .monospaced))
        }
        .foregroundStyle(tier.color)
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .background(
            Capsule()
                .fill(tier.color.opacity(0.15))
        )
        .overlay(
            Capsule()
                .strokeBorder(tier.color.opacity(0.4), lineWidth: 1)
        )
    }

    // MARK: - Branding Footer

    private var brandingFooter: some View {
        VStack(spacing: 12) {
            // Divider line
            Rectangle()
                .fill(.white.opacity(0.15))
                .frame(width: 200, height: 1)

            HStack(spacing: 10) {
                // Airplane icon
                Image(systemName: "airplane")
                    .font(.system(size: isStory ? 18 : 15, weight: .semibold))
                    .foregroundStyle(Color(hex: 0xF7E8A0))

                // SOGOJET in split-flap style cells
                HStack(spacing: 3) {
                    ForEach(Array("SOGOJET".enumerated()), id: \.offset) { _, char in
                        Text(String(char))
                            .font(.system(size: isStory ? 20 : 17, weight: .bold, design: .monospaced))
                            .foregroundStyle(.white)
                            .frame(width: isStory ? 30 : 25, height: isStory ? 36 : 30)
                            .background(
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(Color(hex: 0x1A1A1A))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 4)
                                    .strokeBorder(.white.opacity(0.1), lineWidth: 0.5)
                            )
                            .overlay(
                                // Split-flap divider line
                                Rectangle()
                                    .fill(.black.opacity(0.4))
                                    .frame(height: 1)
                            )
                    }
                }
            }

            Text("Found on SoGoJet")
                .font(.system(size: isStory ? 14 : 12, weight: .medium))
                .foregroundStyle(.white.opacity(0.4))
        }
    }
}

// MARK: - Preview

#Preview("Share Card - Story") {
    ShareCardView(deal: .preview, backgroundImage: nil, cardSize: .story)
        .frame(width: 360, height: 640)
        .scaleEffect(360.0 / 1080.0)
        .frame(width: 360, height: 640)
}

#Preview("Share Card - Square") {
    ShareCardView(deal: .preview, backgroundImage: nil, cardSize: .square)
        .frame(width: 360, height: 360)
        .scaleEffect(360.0 / 1080.0)
        .frame(width: 360, height: 360)
}
