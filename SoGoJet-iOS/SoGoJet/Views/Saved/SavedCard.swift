import SwiftUI

// MARK: - Saved Card
// Grid card for saved destinations with background image, destination info, and actions.

struct SavedCard: View {
    let deal: Deal
    var onBook: () -> Void = {}
    var onRemove: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // MARK: Image Area
            ZStack(alignment: .topTrailing) {
                CachedAsyncImage(url: deal.imageUrl) {
                    Color.sgSurface
                }
                .frame(height: 80)
                .clipped()
                .overlay(alignment: .bottom) {
                    // Bottom gradient for text legibility
                    LinearGradient(
                        colors: [Color.clear, Color.sgBg.opacity(0.7)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 40)
                    .accessibilityHidden(true)
                }
                .accessibilityLabel("\(deal.destination) photo")

                // Heart remove button
                Button {
                    HapticEngine.medium()
                    onRemove()
                } label: {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.sgRed)
                        .frame(width: 28, height: 28)
                        .background(Color.sgBg.opacity(0.6))
                        .clipShape(Circle())
                }
                .padding(Spacing.xs)
                .accessibilityLabel("Remove \(deal.destination) from saved")
                .accessibilityHint("Unsaves this flight deal")
            }

            // MARK: Info Area
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(deal.destination.uppercased())
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.sgWhite)
                    .lineLimit(1)

                Text(deal.country)
                    .font(SGFont.body(size: 11))
                    .foregroundStyle(Color.sgMuted)
                    .lineLimit(1)

                Text(deal.priceFormatted)
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.sgYellow)

                Button {
                    HapticEngine.medium()
                    onBook()
                } label: {
                    HStack(spacing: Spacing.xs) {
                        Text("Book")
                            .font(SGFont.bodyBold(size: 11))
                        Image(systemName: "arrow.right")
                            .font(.system(size: 9, weight: .bold))
                    }
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.xs)
                    .background(Color.sgYellow)
                    .clipShape(Capsule())
                }
                .accessibilityLabel("Book flight to \(deal.destination)")
            }
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.sm)
        }
        .background(Color.sgCell)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(deal.destination), \(deal.country), \(deal.priceFormatted)")
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
