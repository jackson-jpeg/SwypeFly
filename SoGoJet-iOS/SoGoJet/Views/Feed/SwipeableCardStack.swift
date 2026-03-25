import SwiftUI

// MARK: - Swipeable Card Stack
// Tinder-style card deck: right-swipe to save, left-swipe to skip.
// Cards rotate and fly off screen with satisfying physics.
// The top card is fully interactive; cards behind peek through for depth.

struct SwipeableCardStack: View {
    let deals: [Deal]
    let currentIndex: Int
    let isSaved: (String) -> Bool
    var onSave: (Deal) -> Void = { _ in }
    var onSkip: (Deal) -> Void = { _ in }
    var onTap: (Deal) -> Void = { _ in }
    var onVibeFilter: (String) -> Void = { _ in }
    var onAdvance: () -> Void = {}

    /// How many cards peek behind the top card
    private let peekCount = 2

    /// Swipe threshold (points) — cross this to commit the swipe
    private let swipeThreshold: CGFloat = 100

    /// Max rotation during drag (degrees)
    private let maxRotation: Double = 12

    @State private var dragOffset: CGSize = .zero
    @State private var flyAwayOffset: CGSize = .zero
    @State private var isDragging = false
    @State private var isFlying = false
    @State private var flyDirection: SwipeDirection = .none
    @State private var stampOpacity: Double = 0
    @State private var hapticFired = false

    private enum SwipeDirection {
        case left, right, none
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Render the peek cards behind the top card (back to front)
                ForEach(peekCards.reversed(), id: \.offset) { index, deal in
                    let depth = index - currentIndex
                    peekCard(deal: deal, depth: depth, screenSize: geo.size)
                }

                // Top card with drag gesture
                if let topDeal = topDeal, !isFlying {
                    topCard(deal: topDeal, screenSize: geo.size)
                        .zIndex(100)
                }

                // Flying-away card (animating off screen)
                if isFlying, let flyingDeal = flyingDeal {
                    flyingCard(deal: flyingDeal, screenSize: geo.size)
                        .zIndex(200)
                }

                // Empty state when deck is exhausted
                if topDeal == nil && !isFlying {
                    endOfDeck
                }

                // Card counter at bottom
                if !deals.isEmpty {
                    VStack {
                        Spacer()
                        cardCounter
                            .padding(.bottom, 100)
                    }
                    .allowsHitTesting(false)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    // MARK: - Card Counter

    private var cardCounter: some View {
        Text("\(min(currentIndex + 1, deals.count))/\(deals.count)")
            .font(.system(size: 12, weight: .medium, design: .monospaced))
            .foregroundStyle(Color.sgMuted)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color.sgBg.opacity(0.8))
            .clipShape(Capsule())
    }

    // MARK: - End of Deck

    private var endOfDeck: some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: "sparkles")
                .font(.system(size: 48, weight: .light))
                .foregroundStyle(Color.sgYellow.opacity(0.7))

            VStack(spacing: Spacing.xs) {
                Text("All caught up!")
                    .font(SGFont.display(size: 24))
                    .foregroundStyle(Color.sgWhite)

                Text("You've swiped through every deal")
                    .font(SGFont.body(size: 14))
                    .foregroundStyle(Color.sgWhiteDim)
            }
        }
    }

    // MARK: - Top Card (Draggable)

    private func topCard(deal: Deal, screenSize: CGSize) -> some View {
        ZStack {
            DealCard(
                deal: deal,
                isSaved: isSaved(deal.id),
                isFirst: currentIndex == 0,
                animate: true,
                onSave: { onSave(deal) },
                onTap: { onTap(deal) },
                onVibeFilter: onVibeFilter
            )

            // SAVED stamp overlay (right swipe)
            swipeStamp(
                text: "SAVED",
                color: Color.sgDealAmazing,
                icon: "heart.fill",
                alignment: .topLeading,
                opacity: rightSwipeProgress
            )

            // NOPE stamp overlay (left swipe)
            swipeStamp(
                text: "NOPE",
                color: Color.sgRed,
                icon: "xmark",
                alignment: .topTrailing,
                opacity: leftSwipeProgress
            )
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .offset(x: dragOffset.width, y: dragOffset.height * 0.15)
        .rotationEffect(.degrees(dragRotation))
        .scaleEffect(1.0)
        .gesture(dragGesture(screenSize: screenSize))
        .animation(.interactiveSpring(response: 0.3, dampingFraction: 0.7), value: dragOffset)
    }

    // MARK: - Flying Card (Post-Swipe Animation)

    private func flyingCard(deal: Deal, screenSize: CGSize) -> some View {
        DealCard(
            deal: deal,
            isSaved: isSaved(deal.id),
            isFirst: false,
            animate: false
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay {
            if flyDirection == .right {
                swipeStamp(
                    text: "SAVED",
                    color: Color.sgDealAmazing,
                    icon: "heart.fill",
                    alignment: .topLeading,
                    opacity: 1.0
                )
            } else {
                swipeStamp(
                    text: "NOPE",
                    color: Color.sgRed,
                    icon: "xmark",
                    alignment: .topTrailing,
                    opacity: 1.0
                )
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .offset(x: flyAwayOffset.width, y: flyAwayOffset.height)
        .rotationEffect(.degrees(flyDirection == .right ? 15 : -15))
    }

    // MARK: - Peek Cards (Behind Top)

    private func peekCard(deal: Deal, depth: Int, screenSize: CGSize) -> some View {
        let scale = 1.0 - Double(depth) * 0.05
        let yOffset = CGFloat(depth) * 12

        return DealCard(
            deal: deal,
            isSaved: isSaved(deal.id),
            isFirst: false,
            animate: false
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .scaleEffect(scale)
        .offset(y: yOffset)
        .allowsHitTesting(false)
    }

    // MARK: - Stamp Overlay

    private func swipeStamp(
        text: String,
        color: Color,
        icon: String,
        alignment: Alignment,
        opacity: Double
    ) -> some View {
        VStack {
            if alignment == .topLeading || alignment == .topTrailing {
                HStack {
                    if alignment == .topLeading { stampLabel(text: text, color: color, icon: icon) ; Spacer() }
                    if alignment == .topTrailing { Spacer() ; stampLabel(text: text, color: color, icon: icon) }
                }
                .padding(.top, 80)
                .padding(.horizontal, 24)
                Spacer()
            }
        }
        .opacity(opacity)
        .allowsHitTesting(false)
    }

    private func stampLabel(text: String, color: Color, icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 22, weight: .bold))
            Text(text)
                .font(.system(size: 28, weight: .heavy, design: .rounded))
        }
        .foregroundStyle(color)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(color, lineWidth: 3)
        )
        .rotationEffect(.degrees(text == "SAVED" ? -15 : 15))
        .shadow(color: color.opacity(0.4), radius: 4, x: 0, y: 2)
    }

    // MARK: - Gesture

    private func dragGesture(screenSize: CGSize) -> some Gesture {
        DragGesture(minimumDistance: 20)
            .onChanged { value in
                isDragging = true
                dragOffset = value.translation

                // Fire haptic when crossing threshold
                let progress = abs(value.translation.width) / swipeThreshold
                if progress >= 1.0 && !hapticFired {
                    hapticFired = true
                    HapticEngine.medium()
                }
                if progress < 0.8 {
                    hapticFired = false
                }
            }
            .onEnded { value in
                isDragging = false
                hapticFired = false

                let horizontalDistance = value.translation.width
                let velocity = value.predictedEndTranslation.width

                // Commit swipe if past threshold or high velocity
                if horizontalDistance > swipeThreshold || velocity > 500 {
                    commitSwipe(direction: .right, screenSize: screenSize)
                } else if horizontalDistance < -swipeThreshold || velocity < -500 {
                    commitSwipe(direction: .left, screenSize: screenSize)
                } else {
                    // Snap back
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                        dragOffset = .zero
                    }
                }
            }
    }

    private func commitSwipe(direction: SwipeDirection, screenSize: CGSize) {
        guard let deal = topDeal else { return }

        flyDirection = direction
        isFlying = true
        flyAwayOffset = dragOffset

        // Reset drag immediately
        dragOffset = .zero

        // Fire appropriate action
        if direction == .right {
            HapticEngine.success()
            onSave(deal)
        } else {
            HapticEngine.light()
            onSkip(deal)
        }

        // Animate card flying off screen
        let flyX: CGFloat = direction == .right ? screenSize.width * 1.5 : -screenSize.width * 1.5
        let flyY: CGFloat = -50

        withAnimation(.easeIn(duration: 0.35)) {
            flyAwayOffset = CGSize(width: flyX, height: flyY)
        }

        // After fly animation, advance and reset
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            isFlying = false
            flyAwayOffset = .zero
            flyDirection = .none
            onAdvance()
        }
    }

    // MARK: - Computed Values

    private var topDeal: Deal? {
        guard currentIndex < deals.count else { return nil }
        return deals[currentIndex]
    }

    private var flyingDeal: Deal? {
        guard currentIndex < deals.count else { return nil }
        return deals[currentIndex]
    }

    private var peekCards: [(offset: Int, element: Deal)] {
        guard currentIndex < deals.count else { return [] }
        let start = currentIndex + 1
        let end = min(currentIndex + 1 + peekCount, deals.count)
        guard start < end else { return [] }
        return Array(deals[start..<end].enumerated().map { (offset: $0.offset + start, element: $0.element) })
    }

    /// 0...1 progress toward right swipe commit
    private var rightSwipeProgress: Double {
        guard dragOffset.width > 0 else { return 0 }
        return min(Double(dragOffset.width / swipeThreshold), 1.0)
    }

    /// 0...1 progress toward left swipe commit
    private var leftSwipeProgress: Double {
        guard dragOffset.width < 0 else { return 0 }
        return min(Double(-dragOffset.width / swipeThreshold), 1.0)
    }

    /// Card rotation during drag (degrees)
    private var dragRotation: Double {
        let progress = Double(dragOffset.width) / 300.0
        return progress * maxRotation
    }
}

// MARK: - Preview

#Preview("Swipeable Card Stack") {
    SwipeableCardStack(
        deals: [.preview, .previewNonstop, .preview],
        currentIndex: 0,
        isSaved: { _ in false }
    )
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.sgBg)
}
