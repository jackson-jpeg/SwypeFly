import SwiftUI

// MARK: - Saved Card
// Photo-forward grid card — mini version of the feed's DealCard.
// Full-bleed destination photo with bottom gradient overlay for text.

struct SavedCard: View {
    let deal: Deal
    var onTap: () -> Void = {}
    var onBook: () -> Void = {}
    var onRemove: () -> Void = {}

    @State private var isPressed = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            // Full-bleed photo
            CachedAsyncImage(url: deal.imageUrl) {
                fallbackBackground
            }
            .frame(maxWidth: .infinity, minHeight: 200, maxHeight: 220)
            .clipped()

            // Bottom gradient for text legibility
            VStack {
                Spacer()
                LinearGradient(
                    colors: [.clear, Color(hex: 0x0A0A0A, alpha: 0.8)],
                    startPoint: .init(x: 0.5, y: 0),
                    endPoint: .init(x: 0.5, y: 1)
                )
                .frame(height: 110)
            }

            // Bottom content: city, country, price, book button
            VStack {
                Spacer()

                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(deal.city.uppercased())
                            .font(.system(size: 16, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.sgWhite)
                            .lineLimit(1)

                        Text(deal.country.uppercased())
                            .font(SGFont.bodySmall)
                            .foregroundStyle(Color.sgWhite.opacity(0.8))
                            .lineLimit(1)
                    }

                    Spacer()

                    // Price badge
                    Text(deal.priceFormatted)
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color.sgWhite)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(deal.tierColor)
                        .clipShape(Capsule())
                }
                .padding(.bottom, 6)

                // Compact book button
                Button {
                    HapticEngine.medium()
                    onBook()
                } label: {
                    HStack(spacing: Spacing.xs) {
                        Text("Book")
                            .font(SGFont.bodyBold(size: 12))
                        Image(systemName: "arrow.right")
                            .font(.system(size: 10, weight: .bold))
                    }
                    .foregroundStyle(Color.sgBg)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color.sgYellow)
                    .clipShape(Capsule())
                }
                .accessibilityLabel("Book flight to \(deal.destination)")
            }
            .padding(.horizontal, 10)
            .padding(.bottom, 10)

            // Heart remove button (top-right)
            Button {
                HapticEngine.medium()
                onRemove()
            } label: {
                Image(systemName: "heart.fill")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.sgRed)
                    .frame(width: 28, height: 28)
                    .background(Color.black.opacity(0.4))
                    .clipShape(Circle())
            }
            .padding(8)
            .accessibilityLabel("Remove \(deal.destination) from saved")
            .accessibilityHint("Unsaves this flight deal")
        }
        .frame(minHeight: 200, maxHeight: 220)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .contentShape(RoundedRectangle(cornerRadius: Radius.md))
        .scaleEffect(isPressed ? 0.97 : 1.0)
        .opacity(isPressed ? 0.7 : 1.0)
        .animation(.easeOut(duration: 0.15), value: isPressed)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !isPressed { isPressed = true }
                }
                .onEnded { value in
                    isPressed = false
                    // Only fire tap if finger stayed within card bounds
                    let size = CGSize(width: 220, height: 220)
                    if abs(value.translation.width) < size.width / 2 &&
                       abs(value.translation.height) < size.height / 2 {
                        HapticEngine.light()
                        onTap()
                    }
                }
        )
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge) // Cap scaling — tight grid cards
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(deal.destination), \(deal.country), \(deal.priceFormatted)")
        .accessibilityHint("Tap to view details")
    }

    // MARK: - Fallback

    private var fallbackBackground: some View {
        Rectangle()
            .fill(Color.sgSurface)
            .overlay {
                Text(deal.city.uppercased())
                    .font(SGFont.display(size: 28))
                    .foregroundStyle(Color.sgMuted.opacity(0.3))
            }
    }
}

// MARK: - Preview

#Preview("Saved Card") {
    LazyVGrid(columns: [
        GridItem(.flexible(), spacing: Spacing.sm),
        GridItem(.flexible(), spacing: Spacing.sm),
    ], spacing: Spacing.sm) {
        SavedCard(deal: .preview)
        SavedCard(deal: .previewNonstop)
    }
    .padding(Spacing.md)
    .background(Color.sgBg)
}
