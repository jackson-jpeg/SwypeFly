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

    /// Render a boarding pass confirmation as a shareable image.
    static func renderBoardingPass(
        origin: String,
        destination: String,
        destinationCity: String,
        airline: String,
        date: String,
        reference: String,
        passenger: String,
        price: Double?
    ) -> UIImage? {
        let view = BoardingPassCardView(
            origin: origin,
            destination: destination,
            destinationCity: destinationCity,
            airline: airline,
            date: date,
            reference: reference,
            passenger: passenger,
            price: price
        )
        .frame(width: 1080, height: 1080)

        let renderer = ImageRenderer(content: view)
        renderer.scale = 3
        renderer.proposedSize = .init(width: 1080, height: 1080)
        return renderer.uiImage
    }
}

// MARK: - Boarding Pass Card View

private struct BoardingPassCardView: View {
    let origin: String
    let destination: String
    let destinationCity: String
    let airline: String
    let date: String
    let reference: String
    let passenger: String
    let price: Double?

    var body: some View {
        ZStack {
            Color(red: 0.039, green: 0.039, blue: 0.039)

            VStack(spacing: 0) {
                Spacer().frame(height: 80)

                // "Just booked" header
                HStack(spacing: 12) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(Color(red: 0.29, green: 0.87, blue: 0.50))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("TRIP BOOKED")
                            .font(.system(size: 24, weight: .heavy, design: .monospaced))
                            .foregroundStyle(.white)
                            .tracking(3)
                        Text("I'm going to \(destinationCity)!")
                            .font(.system(size: 20, weight: .medium))
                            .foregroundStyle(.white.opacity(0.7))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 60)

                Spacer().frame(height: 50)

                // Boarding pass ticket
                VStack(spacing: 0) {
                    // Top section — route
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("FROM")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(.white.opacity(0.5))
                            Text(origin)
                                .font(.system(size: 48, weight: .bold, design: .monospaced))
                                .foregroundStyle(.white)
                        }
                        Spacer()
                        Image(systemName: "airplane")
                            .font(.system(size: 32))
                            .foregroundStyle(Color(red: 0.969, green: 0.910, blue: 0.627))
                        Spacer()
                        VStack(alignment: .trailing, spacing: 4) {
                            Text("TO")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(.white.opacity(0.5))
                            Text(destination)
                                .font(.system(size: 48, weight: .bold, design: .monospaced))
                                .foregroundStyle(.white)
                        }
                    }
                    .padding(.horizontal, 40)
                    .padding(.vertical, 30)
                    .background(Color(red: 0.094, green: 0.094, blue: 0.094))

                    // Perforated line
                    HStack(spacing: 6) {
                        ForEach(0..<40, id: \.self) { _ in
                            Circle()
                                .fill(Color(red: 0.039, green: 0.039, blue: 0.039))
                                .frame(width: 6, height: 6)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, -3)
                    .zIndex(1)

                    // Bottom section — details
                    VStack(spacing: 20) {
                        HStack {
                            detailField("PASSENGER", value: passenger)
                            Spacer()
                            detailField("DATE", value: date)
                        }
                        HStack {
                            detailField("AIRLINE", value: airline)
                            Spacer()
                            detailField("BOOKING REF", value: reference)
                        }
                        if let price, price > 0 {
                            HStack {
                                detailField("TOTAL", value: "$\(Int(price))")
                                Spacer()
                            }
                        }

                        // Barcode
                        HStack(spacing: 1.5) {
                            ForEach(0..<50, id: \.self) { i in
                                Rectangle()
                                    .fill(.white.opacity(i.isMultiple(of: 3) ? 0.4 : 0.8))
                                    .frame(width: CGFloat.random(in: 2...5), height: 40)
                            }
                        }
                        .padding(.top, 10)
                    }
                    .padding(.horizontal, 40)
                    .padding(.vertical, 30)
                    .background(Color(red: 0.078, green: 0.078, blue: 0.078))
                }
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .padding(.horizontal, 50)

                Spacer().frame(height: 50)

                // Branding
                HStack(spacing: 8) {
                    Image(systemName: "airplane")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color(red: 0.969, green: 0.910, blue: 0.627))
                    Text("SOGOJET")
                        .font(.system(size: 18, weight: .heavy, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.4))
                        .tracking(4)
                }

                Spacer()
            }
        }
    }

    private func detailField(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white.opacity(0.4))
            Text(value.uppercased())
                .font(.system(size: 18, weight: .bold, design: .monospaced))
                .foregroundStyle(.white)
        }
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
