import SwiftUI

// MARK: - Saved Card
// Photo-forward grid card — mini version of the feed's DealCard.
// Full-bleed destination photo with bottom gradient overlay for text.
// Supports cascade entrance animation via `cardIndex` + `appeared` flag.

struct SavedCard: View {
    let deal: Deal
    var onTap: () -> Void = {}
    var onBook: () -> Void = {}
    var onRemove: () -> Void = {}
    /// Index in the grid — drives stagger delay for entrance cascade.
    var cardIndex: Int = 0
    /// Set to true after the grid appears to trigger the entrance spring.
    var appeared: Bool = true

    @State private var isVisible = false

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

                        // Departure dates
                        if let dep = deal.bestDepartureDate, let ret = deal.bestReturnDate {
                            Text("\(dep.shortDate) – \(ret.shortDate)")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(Color.sgWhite.opacity(0.55))
                                .lineLimit(1)
                        } else if let dep = deal.bestDepartureDate {
                            Text(dep.shortDate)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(Color.sgWhite.opacity(0.55))
                                .lineLimit(1)
                        }

                        // Nonstop badge
                        if deal.isNonstop == true {
                            Text("Nonstop")
                                .font(.system(size: 10, weight: .bold, design: .default).leading(.tight))
                                .foregroundStyle(Color.sgBg)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 2)
                                .background(Color.sgDealAmazing)
                                .clipShape(Capsule())
                                .accessibilityLabel("Nonstop flight")
                        }

                        // Trip countdown badge
                        if let countdown = deal.countdownLabel {
                            HStack(spacing: 3) {
                                Image(systemName: "clock.fill")
                                    .font(.system(size: 10))
                                Text(countdown)
                                    .font(.system(size: 10, weight: .semibold))
                            }
                            .foregroundStyle(deal.daysUntilDeparture ?? 99 <= 3 ? Color.sgRed : Color.sgYellow)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background((deal.daysUntilDeparture ?? 99 <= 3 ? Color.sgRed : Color.sgYellow).opacity(0.15))
                            .clipShape(Capsule())
                            .accessibilityLabel("Departure \(countdown)")
                        }
                    }

                    Spacer()

                    // Price badge
                    VStack(alignment: .trailing, spacing: 1) {
                        if deal.isEstimatedPrice {
                            Text("from")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(Color.sgWhite.opacity(0.6))
                        }
                        Text(deal.priceFormatted)
                            .font(.system(size: 13, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.sgWhite)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(deal.tierColor)
                            .clipShape(Capsule())
                    }
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
        .onTapGesture {
            HapticEngine.light()
            onTap()
        }
        // Cascade entrance animation
        .opacity(isVisible ? 1 : 0)
        .scaleEffect(isVisible ? 1 : 0.88)
        .offset(y: isVisible ? 0 : 16)
        .onAppear {
            guard appeared else {
                isVisible = true
                return
            }
            let reduceMotion = UIAccessibility.isReduceMotionEnabled
            let delay = reduceMotion ? 0 : SGSpring.cascadeDelay(
                index: cardIndex,
                staggerMs: SGDuration.instant * 1000
            )
            withAnimation(
                reduceMotion
                    ? .easeOut(duration: SGDuration.fast).delay(delay)
                    : SGSpring.silky.delay(delay)
            ) {
                isVisible = true
            }
        }
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
        SavedCard(deal: .preview, cardIndex: 0)
        SavedCard(deal: .previewNonstop, cardIndex: 1)
    }
    .padding(Spacing.md)
    .background(Color.sgBg)
}
