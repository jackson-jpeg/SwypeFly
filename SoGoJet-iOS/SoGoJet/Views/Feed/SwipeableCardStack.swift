import SwiftUI

// MARK: - Swipeable Card Stack
// Tinder-style card deck: right-swipe to save, left-swipe to skip.
// Cards rotate and fly off screen with satisfying physics.
// Back cards breathe in/out as the top card is dragged.

struct SwipeableCardStack: View {
    let deals: [Deal]
    let currentIndex: Int
    let isSaved: (String) -> Bool
    var onSave: (Deal) -> Void = { _ in }
    var onSkip: (Deal) -> Void = { _ in }
    var onTap: (Deal) -> Void = { _ in }
    var onBook: (Deal) -> Void = { _ in }
    var onVibeFilter: (String) -> Void = { _ in }
    var onAdvance: () -> Void = {}
    var onLoadMore: () -> Void = {}
    var onStartOver: () -> Void = {}

    /// How many cards peek behind the top card
    private let peekCount = 2

    /// Swipe threshold (points) — cross this to commit the swipe
    private let swipeThreshold: CGFloat = 130

    /// Max rotation during drag (degrees)
    private let maxRotation: Double = 12

    @State private var dragOffset: CGSize = .zero
    @State private var flyAwayOffset: CGSize = .zero
    @State private var isDragging = false
    @State private var isFlying = false
    @State private var flyDirection: SwipeDirection = .none
    @State private var hapticFired = false
    @State private var cardEntrance = false
    @State private var swipeTask: Task<Void, Never>?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum SwipeDirection {
        case left, right, none
    }

    // MARK: - Drag Progress Helpers

    /// 0...1 progress toward right swipe commit
    private var rightSwipeProgress: Double {
        guard dragOffset.width > 0 else { return 0 }
        let dragWidth = Double(dragOffset.width)
        let deadZone = Double(swipeThreshold) * 0.3
        return min(max(0, (dragWidth - deadZone) / (Double(swipeThreshold) * 0.7)), 1.0)
    }

    /// 0...1 progress toward left swipe commit
    private var leftSwipeProgress: Double {
        guard dragOffset.width < 0 else { return 0 }
        let dragWidth = Double(-dragOffset.width)
        let deadZone = Double(swipeThreshold) * 0.3
        return min(max(0, (dragWidth - deadZone) / (Double(swipeThreshold) * 0.7)), 1.0)
    }

    /// Card rotation during drag (degrees)
    private var dragRotation: Double {
        let progress = Double(dragOffset.width) / 300.0
        return progress * maxRotation
    }

    /// Normalized drag magnitude 0...1 for back-card breathing
    private var dragMagnitude: Double {
        let w = abs(dragOffset.width)
        return min(Double(w) / Double(swipeThreshold), 1.0)
    }

    // MARK: - Body

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Render peek cards back → front so lower indices sit behind
                ForEach(peekCards.reversed(), id: \.offset) { index, deal in
                    let depth = index - currentIndex
                    peekCard(deal: deal, depth: depth)
                        .accessibilityHidden(true)
                }

                // Top card with drag gesture
                if let topDeal = topDeal, !isFlying {
                    topCard(deal: topDeal, screenSize: geo.size)
                        .scaleEffect(cardEntrance ? 0.95 : 1.0)
                        .offset(y: cardEntrance ? 12 : 0)
                        .opacity(cardEntrance ? 0.0 : 1.0)
                        .animation(
                            reduceMotion
                                ? .easeOut(duration: SGDuration.fast)
                                : SGSpring.silky,
                            value: cardEntrance
                        )
                        .onAppear {
                            if cardEntrance {
                                withAnimation(
                                    reduceMotion
                                        ? .easeOut(duration: SGDuration.fast)
                                        : SGSpring.silky
                                ) {
                                    cardEntrance = false
                                }
                            }
                        }
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("\(topDeal.city), \(topDeal.country). \(topDeal.cardPriceLabel)")
                        .accessibilityHint("Swipe right to save, swipe left to skip, or double tap to view details")
                        .accessibilityAction(named: "Save") {
                            HapticEngine.success()
                            onSave(topDeal)
                            onAdvance()
                        }
                        .accessibilityAction(named: "Skip") {
                            HapticEngine.light()
                            onSkip(topDeal)
                            onAdvance()
                        }
                        .accessibilityAction(named: "View Details") {
                            onTap(topDeal)
                        }
                        .zIndex(100)
                }

                // Flying-away card (animating off screen)
                if isFlying, let flyingDeal = flyingDeal {
                    flyingCard(deal: flyingDeal, screenSize: geo.size)
                        .accessibilityHidden(true)
                        .zIndex(200)
                }

                // Empty state when deck is exhausted
                if topDeal == nil && !isFlying {
                    endOfDeck
                        .zIndex(50)
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
            // Prefetch images when index changes
            .onChange(of: currentIndex) { _, newIndex in
                prefetchUpcoming(from: newIndex)
            }
            .onAppear {
                prefetchUpcoming(from: currentIndex)
            }
        }
    }

    // MARK: - Image Prefetch

    private func prefetchUpcoming(from index: Int) {
        for offset in 1...2 {
            let i = index + offset
            guard i < deals.count, let url = deals[i].imageUrl else { continue }
            Task {
                await ImageCache.shared.prefetch(url)
            }
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
        SGCard(elevation: .hero) {
            VStack(spacing: Spacing.lg) {
                // END OF LINE headline — flap in on appear
                EndOfLineFlapper()

                VStack(spacing: Spacing.xs) {
                    Text("No more flights right now.")
                        .sgFont(.body)
                        .foregroundStyle(Color.sgWhiteDim)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: Spacing.sm) {
                    SGButton("Load More Deals", style: .primary) {
                        HapticEngine.medium()
                        onLoadMore()
                    }

                    SGButton("Start Over", style: .ghost) {
                        HapticEngine.light()
                        onStartOver()
                    }
                }
                .padding(.top, Spacing.xs)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.xl)
        }
        .padding(.horizontal, Spacing.lg)
        .accessibilityElement(children: .contain)
    }

    // MARK: - Top Card (Draggable)

    private func topCard(deal: Deal, screenSize: CGSize) -> some View {
        ZStack {
            DealCard(
                deal: deal,
                isSaved: isSaved(deal.id),
                isFirst: currentIndex == 0,
                animate: true,
                animationTrigger: currentIndex,
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
        // Directional color overlays — visual feedback during drag
        .overlay(
            Color.green.opacity(rightSwipeProgress * 0.3)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .allowsHitTesting(false)
        )
        .overlay(
            Color.red.opacity(leftSwipeProgress * 0.15)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .allowsHitTesting(false)
        )
        .offset(x: dragOffset.width, y: dragOffset.height * 0.15)
        .rotationEffect(.degrees(dragRotation))
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
    //
    // depth=1: scale 0.94, yOffset 8pt (tokens from plan)
    // depth=2: scale 0.88, yOffset 14pt
    // As drag progresses, back cards breathe toward the top card:
    //   scale nudges up by dragMagnitude * 0.03, yOffset shrinks proportionally.

    private func peekCard(deal: Deal, depth: Int) -> some View {
        let baseScale = depth == 1 ? 0.94 : 0.88
        let baseYOffset: CGFloat = depth == 1 ? 8 : 14
        let dimAlpha = 0.0 + Double(depth) * 0.18   // tint dim overlay per depth

        // Breathing: back cards inch forward as the top card is dragged
        let breathScale = baseScale + (reduceMotion ? 0 : dragMagnitude * 0.03)
        let breathOffset = baseYOffset * CGFloat(1.0 - (reduceMotion ? 0 : dragMagnitude * 0.5))

        return DealCard(
            deal: deal,
            isSaved: isSaved(deal.id),
            isFirst: false,
            animate: false
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
        // Dim tint overlay per depth level
        .overlay(
            Color.sgBg.opacity(dimAlpha)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .allowsHitTesting(false)
        )
        .scaleEffect(breathScale)
        .offset(y: breathOffset)
        .allowsHitTesting(false)
        .animation(SGSpring.silky, value: dragMagnitude)
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
                    // Snap back with haptic feedback
                    HapticEngine.light()
                    withAnimation(SGSpring.silky) {
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
            HapticEngine.boardingPass()
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

        // Cancel any previous swipe task to avoid pileup during rapid swiping
        swipeTask?.cancel()

        // After fly animation, advance and reset
        swipeTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 350_000_000) // 0.35s
            guard !Task.isCancelled else { return }

            // Set entrance state before advancing so new card starts at peek scale
            cardEntrance = true
            isFlying = false
            flyAwayOffset = .zero
            flyDirection = .none
            onAdvance()

            // Animate the new top card from peek state to full size
            try? await Task.sleep(nanoseconds: 50_000_000) // 0.05s
            guard !Task.isCancelled else { return }

            withAnimation(reduceMotion ? .easeOut(duration: SGDuration.fast) : SGSpring.silky) {
                cardEntrance = false
            }

            // Subtle "landing" haptic as the new card reaches full size
            try? await Task.sleep(nanoseconds: 300_000_000) // 0.3s
            guard !Task.isCancelled else { return }
            HapticEngine.light()
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
}

// MARK: - End Of Line Flapper
// Isolated view so the SplitFlapText animation fires on appear.

private struct EndOfLineFlapper: View {
    @State private var animate = false

    var body: some View {
        SplitFlapText(
            text: "END OF LINE",
            style: .headline,
            maxLength: 11,
            animate: animate,
            startDelay: 0.1,
            hapticOnSettle: true
        )
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                animate = true
            }
        }
        .accessibilityLabel("End of line — no more flight deals")
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
