import SwiftUI

// MARK: - Departure Board View
// Airport-style departure board showing 5 deal rows at a time with swipe-up navigation.
// Tapping the active (top) row opens deal detail; tapping other rows makes them active.

struct DepartureBoardView: View {
    @Environment(FeedStore.self) private var feedStore
    @Environment(Router.self) private var router

    @State private var boardIndex: Int = 0
    @State private var animateRows: Bool = false
    @State private var dragOffset: CGFloat = 0

    private let visibleCount = 5

    // MARK: Derived

    private var visibleDeals: [Deal] {
        guard !feedStore.deals.isEmpty else { return [] }
        let start = min(boardIndex, feedStore.deals.count)
        let end = min(start + visibleCount, feedStore.deals.count)
        guard start < end else { return [] }
        return Array(feedStore.deals[start..<end])
    }

    private var activeDeal: Deal? {
        visibleDeals.first
    }

    private var canAdvance: Bool {
        boardIndex + 1 < feedStore.deals.count
    }

    // MARK: Body

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            if feedStore.isLoading && feedStore.deals.isEmpty {
                loadingState
            } else if feedStore.deals.isEmpty {
                emptyState
            } else {
                VStack(spacing: 0) {
                    boardSection
                    if let deal = activeDeal {
                        detailStrip(for: deal)
                    }
                    Spacer()
                    actionButtons
                }
                .padding(.top, Spacing.lg)
            }
        }
    }

    // MARK: - Board Section

    private var boardSection: some View {
        VStack(spacing: 2) {
            ForEach(Array(visibleDeals.enumerated()), id: \.element.id) { index, deal in
                DepartureRow(
                    deal: deal,
                    isActive: index == 0,
                    animate: animateRows,
                    onAnimationComplete: index == 0 ? { } : nil
                )
                .contentShape(Rectangle())
                .onTapGesture {
                    handleRowTap(index: index, deal: deal)
                }
            }

            // Pad remaining slots with placeholder rows if fewer than 5
            if visibleDeals.count < visibleCount {
                ForEach(0..<(visibleCount - visibleDeals.count), id: \.self) { _ in
                    placeholderRow
                }
            }
        }
        .padding(.horizontal, Spacing.sm)
        .offset(y: dragOffset)
        .gesture(swipeGesture)
        .onAppear {
            triggerAnimation()
        }
    }

    // MARK: - Detail Strip

    private func detailStrip(for deal: Deal) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.sm) {
                // Dates pill
                pill(text: deal.departureDate, icon: "calendar")

                // Duration pill
                pill(text: "\(deal.tripDays)d", icon: "clock")

                // Nonstop badge
                if deal.isNonstop == true {
                    pill(text: "Nonstop", icon: "arrow.right", color: Color.sgGreen)
                }

                // Deal tier pill
                if let tier = deal.dealTier {
                    pill(text: tier.label, icon: tier.iconName, color: tier.color)
                }

                // Vibe tags (limit 2)
                ForEach(deal.vibeTags.prefix(2), id: \.self) { tag in
                    pill(text: tag, icon: nil)
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm)
        }
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: Spacing.md) {
            // NEXT FLIGHT — outline button
            Button {
                advanceBoard()
            } label: {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "chevron.up")
                    Text("NEXT FLIGHT")
                }
                .font(SGFont.bodyBold(size: 15))
                .foregroundStyle(Color.sgYellow)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: Radius.md)
                        .strokeBorder(Color.sgYellow, lineWidth: 1.5)
                )
            }
            .disabled(!canAdvance)
            .opacity(canAdvance ? 1.0 : 0.4)

            // BOOK IT — green fill button
            Button {
                if let deal = activeDeal {
                    HapticEngine.medium()
                    router.startBooking(deal)
                }
            } label: {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "airplane.departure")
                    Text("BOOK IT")
                }
                .font(SGFont.bodyBold(size: 15))
                .foregroundStyle(Color.sgBg)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(Color.sgGreen, in: RoundedRectangle(cornerRadius: Radius.md))
            }
            .disabled(activeDeal == nil)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.bottom, Spacing.lg)
    }

    // MARK: - Loading State

    private var loadingState: some View {
        VStack(spacing: 2) {
            ForEach(0..<visibleCount, id: \.self) { _ in
                shimmerRow
            }
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.top, Spacing.xl)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        ZStack {
            VStack(spacing: 2) {
                ForEach(0..<visibleCount, id: \.self) { _ in
                    placeholderRow
                }
            }
            .padding(.horizontal, Spacing.sm)

            VStack(spacing: Spacing.md) {
                Image(systemName: "airplane")
                    .font(.system(size: 36))
                    .foregroundStyle(Color.sgMuted)
                Text("No flights")
                    .font(SGFont.sectionHead)
                    .foregroundStyle(Color.sgWhiteDim)
            }
            .padding(Spacing.lg)
            .background(Color.sgBg.opacity(0.85), in: RoundedRectangle(cornerRadius: Radius.md))
        }
    }

    // MARK: - Placeholder Row

    private var placeholderRow: some View {
        HStack(spacing: Spacing.sm) {
            ForEach(0..<5, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 2)
                    .strokeBorder(Color.sgFaint.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    .frame(height: 28)
            }
        }
        .padding(.vertical, Spacing.xs)
        .padding(.horizontal, Spacing.sm)
        .opacity(0.4)
    }

    // MARK: - Shimmer Row

    private var shimmerRow: some View {
        HStack(spacing: Spacing.sm) {
            ForEach(0..<5, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.sgCell)
                    .frame(height: 28)
                    .overlay(
                        RoundedRectangle(cornerRadius: 2)
                            .fill(
                                LinearGradient(
                                    colors: [Color.clear, Color.sgFaint.opacity(0.3), Color.clear],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                    )
            }
        }
        .padding(.vertical, Spacing.xs)
        .padding(.horizontal, Spacing.sm)
    }

    // MARK: - Pill Helper

    private func pill(text: String, icon: String?, color: Color = Color.sgWhiteDim) -> some View {
        HStack(spacing: Spacing.xs) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 10))
            }
            Text(text)
                .font(SGFont.caption)
        }
        .foregroundStyle(color)
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.xs)
        .background(
            Capsule()
                .fill(color.opacity(0.12))
        )
    }

    // MARK: - Gestures & Actions

    private var swipeGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                dragOffset = min(0, value.translation.height)
            }
            .onEnded { value in
                withAnimation(.easeOut(duration: 0.2)) {
                    dragOffset = 0
                }
                if value.translation.height < -50 {
                    advanceBoard()
                }
            }
    }

    private func advanceBoard() {
        guard canAdvance else { return }
        HapticEngine.light()
        animateRows = false

        boardIndex += 1

        // Prefetch more when nearing end
        if boardIndex >= feedStore.deals.count - 3 {
            Task { await feedStore.fetchMore() }
        }

        triggerAnimation()
    }

    private func handleRowTap(index: Int, deal: Deal) {
        if index == 0 {
            // Active row: open detail
            HapticEngine.medium()
            router.showDeal(deal)
        } else {
            // Other rows: make active by advancing board
            HapticEngine.light()
            animateRows = false
            boardIndex += index

            // Prefetch more when nearing end
            if boardIndex >= feedStore.deals.count - 3 {
                Task { await feedStore.fetchMore() }
            }

            triggerAnimation()
        }
    }

    private func triggerAnimation() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            animateRows = true
        }
    }
}

// MARK: - Preview

#Preview("Departure Board") {
    DepartureBoardView()
        .environment(FeedStore())
        .environment(Router())
}
