import SwiftUI

// MARK: - Notification names

extension Notification.Name {
    /// Fired when the FlightArcBadge lands on the Saved tab bar icon.
    /// ContentView observes this to trigger a brief tab scale bounce.
    static let departureArcLanded = Notification.Name("departureArcLanded")
}

// MARK: - DepartureTransition
//
// State machine driving the Phase 3 hero moment: "The Departure."
// Orchestrates 8 stages over ~1.1s from save-commit to tab-badge-land.
//
// Stage timeline (wall-clock from t=0, Reduce Motion in parens):
//   0.00s  idle → freezing  : overlay appears, card frozen in place
//   0.05s  boardCascade     : 5–8 board rows flap in, staggered 40ms each
//                             haptic: flapSettle per row (not re-firing boardingPass)
//   ~0.38s shimmerPeak      : RunwayShimmer sweeps left→right for 0.5s
//                             haptic: runway() at sweep start
//   0.88s  collapseToBadge  : board rows compress into a yellow glowing badge
//   1.00s  arcToTab         : badge arcs along Bezier flight path → Saved tab icon
//                             Saved tab icon scale-bounces 1.2→1.0 on badge land
//   1.10s  done             : overlay dismissed, save committed to store
//
// Reduce Motion path (250ms total):
//   idle → (flash cross-fade) → done

@MainActor
final class DepartureTransition: ObservableObject {

    // MARK: - State

    enum Phase: Equatable {
        case idle
        case freezing
        case boardCascade
        case shimmerPeak
        case collapseToBadge
        case arcToTab
        case done
    }

    @Published private(set) var phase: Phase = .idle

    /// The deal being saved — set before calling `start()`.
    @Published private(set) var pendingDeal: Deal?

    /// True once the board rows are visible and being animated.
    @Published var boardVisible: Bool = false

    /// True while the shimmer sweep is active.
    @Published var shimmerActive: Bool = false

    /// True while the badge is visible (collapseToBadge + arcToTab).
    @Published var badgeVisible: Bool = false

    /// Normalized progress 0→1 of the badge arc (drives FlightArcBadge).
    @Published var arcProgress: Double = 0

    /// Controls the saved tab icon bounce scale (driven externally in ContentView).
    @Published var tabIconScale: Double = 1.0

    /// Overlay opacity (enter/exit fade wrapper).
    @Published var overlayOpacity: Double = 0

    // MARK: - Private

    private var orchestrationTask: Task<Void, Never>?

    // MARK: - API

    /// Begin the transition for `deal`. If Reduce Motion is on, runs the
    /// fast fallback path instead of the full 8-stage sequence.
    func start(deal: Deal) {
        guard phase == .idle else { return }
        pendingDeal = deal
        phase = .freezing

        if UIAccessibility.isReduceMotionEnabled {
            orchestrationTask = Task { [weak self] in
                await self?.runReducedMotionPath()
            }
        } else {
            orchestrationTask = Task { [weak self] in
                await self?.runFullPath()
            }
        }
    }

    func cancel() {
        orchestrationTask?.cancel()
        orchestrationTask = nil
        reset()
    }

    // MARK: - Full Path (~1.1s)

    private func runFullPath() async {
        // --- freezing → boardCascade ---
        withAnimation(.easeOut(duration: SGDuration.fast)) {
            overlayOpacity = 1.0
        }
        await sleep(ms: 80)
        guard !Task.isCancelled else { return }

        phase = .boardCascade
        boardVisible = true
        // Per-row flapSettle haptics are fired in DepartureOverlay itself
        // (it owns the stagger timing). We just advance state here.
        // Allow the full cascade (7 rows × 40ms stagger + 200ms flap duration) to settle.
        await sleep(ms: 520)
        guard !Task.isCancelled else { return }

        // --- boardCascade → shimmerPeak ---
        phase = .shimmerPeak
        shimmerActive = true
        HapticEngine.runway()       // single runway haptic at shimmer peak — NOT boardingPass
        await sleep(ms: 500)        // shimmer sweep duration
        guard !Task.isCancelled else { return }

        shimmerActive = false

        // --- shimmerPeak → collapseToBadge ---
        phase = .collapseToBadge
        await sleep(ms: 30)
        guard !Task.isCancelled else { return }

        withAnimation(SGSpring.mechanical) {
            boardVisible = false
        }
        await sleep(ms: 80)
        guard !Task.isCancelled else { return }

        badgeVisible = true
        withAnimation(SGSpring.bouncy) {
            // badge appears at board center — arc begins immediately
        }

        // --- collapseToBadge → arcToTab ---
        await sleep(ms: 80)
        guard !Task.isCancelled else { return }

        phase = .arcToTab
        withAnimation(.timingCurve(0.45, 0.05, 0.55, 0.95, duration: 0.38)) {
            arcProgress = 1.0
        }
        await sleep(ms: 380)
        guard !Task.isCancelled else { return }

        // Tab icon bounce on badge land — post notification so ContentView
        // can react via UIKit tab bar without a direct dependency on this object.
        NotificationCenter.default.post(name: .departureArcLanded, object: nil)
        withAnimation(SGSpring.bouncy) {
            tabIconScale = 1.2
        }
        await sleep(ms: 180)
        guard !Task.isCancelled else { return }
        withAnimation(SGSpring.snappy) {
            tabIconScale = 1.0
        }

        // --- arcToTab → done ---
        await sleep(ms: 80)
        guard !Task.isCancelled else { return }

        phase = .done
        withAnimation(.easeOut(duration: SGDuration.fast)) {
            overlayOpacity = 0
            badgeVisible = false
        }
        await sleep(ms: 200)
        reset()
    }

    // MARK: - Reduce Motion Path (~250ms)

    private func runReducedMotionPath() async {
        withAnimation(.easeIn(duration: 0.1)) {
            overlayOpacity = 1.0
        }
        await sleep(ms: 100)
        guard !Task.isCancelled else { return }

        // Single boardingPass haptic confirmation (no cascade, no shimmer)
        // NOTE: boardingPass() was already fired in SwipeableCardStack.commitSwipe().
        // Here we only need the visual flash — skip the haptic to avoid double-fire.
        phase = .done
        withAnimation(.easeOut(duration: 0.15)) {
            overlayOpacity = 0
        }
        await sleep(ms: 150)
        reset()
    }

    // MARK: - Helpers

    private func reset() {
        phase = .idle
        boardVisible = false
        shimmerActive = false
        badgeVisible = false
        arcProgress = 0
        tabIconScale = 1.0
        overlayOpacity = 0
        pendingDeal = nil
        orchestrationTask = nil
    }

    private func sleep(ms: Int) async {
        try? await Task.sleep(nanoseconds: UInt64(ms) * 1_000_000)
    }
}
