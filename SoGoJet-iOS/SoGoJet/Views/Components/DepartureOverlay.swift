import SwiftUI

// MARK: - DepartureOverlay
//
// Full-screen terminal board overlay for the Phase 3 hero "Departure" moment.
// Mounted as a top-layer ZStack in FeedView; driven by DepartureTransition.
//
// Layout (top → bottom):
//   • PaperTexture grain behind everything
//   • Header row: "DEPARTURE" label left, current time right
//   • Booked row (sgDealAmazing): city + "BOOKED" status + price
//   • 3 rows above booked + 4 rows below: filler rows flap in cascade
//   • RunwayShimmer sweeps across the full board during shimmerPeak phase
//
// Board rows use SplitFlapText(style: .ticker) with staggered startDelay
// based on distance from the booked row. The booked row uses style: .price
// for the price cell and .ticker for city/status.
//
// iPhone SE (320pt) safety: each row is capped at maxLength so cells never
// clip. The board width is constrained to min(geo.size.width, 390).

struct DepartureOverlay: View {

    @ObservedObject var transition: DepartureTransition
    let deal: Deal

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // MARK: - Board row model

    private struct BoardRow: Identifiable {
        let id: Int          // -3…-1 above booked, 0 = booked, 1…4 below
        let city: String
        let status: String
        let price: String
        var isBooked: Bool { id == 0 }
    }

    private var rows: [BoardRow] {
        // Surrounding filler cities — plausible departure board entries
        let fillers: [(String, String, String)] = [
            ("LONDON",    "ON TIME",  "$412"),
            ("DUBAI",     "BOARDING", "$598"),
            ("BANGKOK",   "ON TIME",  "$479"),
            ("BERLIN",    "DELAYED",  "$334"),
            ("SYDNEY",    "ON TIME",  "$891"),
            ("SINGAPORE", "ON TIME",  "$541"),
            ("TORONTO",   "ON TIME",  "$289"),
        ]
        var result: [BoardRow] = []
        let fillerAbove = Array(fillers.prefix(3))
        let fillerBelow = Array(fillers.suffix(4))
        for (i, f) in fillerAbove.enumerated() {
            result.append(BoardRow(id: -(3 - i), city: f.0, status: f.1, price: f.2))
        }
        result.append(BoardRow(
            id: 0,
            city: deal.city.uppercased(),
            status: "BOOKED",
            price: deal.priceFormatted
        ))
        for (i, f) in fillerBelow.enumerated() {
            result.append(BoardRow(id: i + 1, city: f.0, status: f.1, price: f.2))
        }
        return result
    }

    // MARK: - Body

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Deep backdrop
                Color.sgInk.ignoresSafeArea()

                // Grain texture at low intensity
                PaperTexture(intensity: 0.05)
                    .ignoresSafeArea()

                // Board content
                VStack(spacing: 0) {
                    boardHeader
                        .padding(.horizontal, Spacing.md)
                        .padding(.top, geo.safeAreaInsets.top + Spacing.xl)
                        .padding(.bottom, Spacing.sm)

                    Divider()
                        .background(Color.sgHairline)

                    // Board rows
                    VStack(spacing: 0) {
                        ForEach(rows) { row in
                            boardRow(row: row, geo: geo)

                            Divider()
                                .background(Color.sgHairline.opacity(0.6))
                        }
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.top, Spacing.sm)

                    Spacer()
                }
                .frame(maxWidth: min(geo.size.width, 390))
                .frame(maxWidth: .infinity)

                // Shimmer sweep during shimmerPeak phase
                if transition.shimmerActive {
                    RunwayShimmer(
                        duration: 0.5,
                        bandWidth: 0.28,
                        intensity: 0.28,
                        tint: .sgYellow,
                        isActive: true
                    )
                    .ignoresSafeArea()
                    .transition(.opacity)
                }
            }
            .opacity(transition.overlayOpacity)
            .allowsHitTesting(transition.phase != .idle)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Departure board: \(deal.city) saved to your trips")
            .accessibilityAddTraits(.isModal)
        }
    }

    // MARK: - Header

    private var boardHeader: some View {
        HStack(alignment: .center) {
            Text("DEPARTURES")
                .sgFont(.ticker)
                .foregroundStyle(Color.sgYellow)
                .lineLimit(1)

            Spacer()

            Text(currentTimeString)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(Color.sgWhiteDim)
                .lineLimit(1)
        }
    }

    // MARK: - Board Row

    @ViewBuilder
    private func boardRow(row: BoardRow, geo: GeometryReader_Size) -> some View {
        let depth = abs(row.id)   // 0 = booked, 1–4 = adjacent
        // Rows animate in cascade: booked row first, then outward
        let staggerDelay = Double(depth) * 0.04

        HStack(alignment: .center, spacing: Spacing.sm) {
            // City — ticker style. Max 9 chars for SE (320pt) safety.
            SplitFlapText(
                text: row.city,
                style: row.isBooked ? .ticker : .ticker,
                maxLength: 9,
                animate: transition.boardVisible,
                startDelay: staggerDelay,
                hapticOnSettle: depth == 0  // haptic only on booked row
            )
            .foregroundStyle(row.isBooked ? Color.sgDealAmazing : Color.sgWhite)
            .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .onChange(of: transition.boardVisible) { _, active in
                guard active, !row.isBooked else { return }
                // Per surrounding-row haptic — fires once per row as board cascades in
                let ms = Int(staggerDelay * 1000)
                DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(ms)) {
                    HapticEngine.flapSettle(count: 1, staggerMs: 0)
                }
            }

            // Status label — small, mid-width
            Text(row.status)
                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                .foregroundStyle(row.isBooked ? Color.sgDealAmazing : Color.sgWhiteDim)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(width: 56, alignment: .center)
                .opacity(transition.boardVisible ? 1.0 : 0.0)
                .animation(
                    .easeOut(duration: SGDuration.fast).delay(staggerDelay + 0.15),
                    value: transition.boardVisible
                )

            // Price — right-aligned
            SplitFlapText(
                text: row.price,
                style: .price,
                maxLength: 6,
                animate: transition.boardVisible,
                startDelay: staggerDelay + 0.05
            )
            .foregroundStyle(row.isBooked ? Color.sgDealAmazing : Color.sgYellow.opacity(0.7))
            .frame(width: 56, alignment: .trailing)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        }
        .padding(.vertical, 9)
        .background(
            row.isBooked
                ? Color.sgDealAmazing.opacity(0.08)
                : Color.clear
        )
        .overlay(
            // Booked row subtle glow border
            row.isBooked
                ? RoundedRectangle(cornerRadius: 4)
                    .strokeBorder(Color.sgDealAmazing.opacity(0.25), lineWidth: 1)
                : nil
        )
        .scaleEffect(
            (transition.phase == .collapseToBadge && row.isBooked) ? 0.85 : 1.0,
            anchor: .center
        )
        .opacity(
            transition.phase == .collapseToBadge
                ? (row.isBooked ? 1.0 : 0.0)
                : 1.0
        )
        .animation(
            transition.phase == .collapseToBadge
                ? SGSpring.mechanical
                : .easeOut(duration: SGDuration.fast).delay(staggerDelay),
            value: transition.phase
        )
    }

    // MARK: - Helpers

    private var currentTimeString: String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: Date())
    }
}

// MARK: - GeometryReader proxy type alias (avoids long generic in function sigs)
private typealias GeometryReader_Size = GeometryProxy

// MARK: - Preview

#Preview("DepartureOverlay") {
    struct Demo: View {
        @StateObject private var t = DepartureTransition()
        var body: some View {
            ZStack {
                Color.sgBg.ignoresSafeArea()
                DepartureOverlay(transition: t, deal: .preview)
            }
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    t.start(deal: .preview)
                }
            }
        }
    }
    return Demo()
}
