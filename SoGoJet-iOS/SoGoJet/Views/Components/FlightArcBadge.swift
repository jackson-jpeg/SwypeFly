import SwiftUI

// MARK: - FlightArcBadge
//
// A glowing yellow badge that travels along a quadratic Bezier arc from a
// source CGPoint to a destination CGPoint. Used during the DepartureTransition
// arcToTab phase to deliver the saved-deal badge to the Saved tab bar icon.
//
// Arc math:
//   P(t) = (1−t)²·start + 2(1−t)t·control + t²·end
//   where `control` is biased 120pt above the midpoint of start→end so the
//   arc reads as a natural parabolic flight path.
//
// The `progress` binding is driven by DepartureTransition (0→1 over 380ms).
//
// Layout safety: if either start or end is .zero (frame not yet measured),
// the badge stays invisible — no crash, no layout thrash.

struct FlightArcBadge: View {

    /// Normalized arc position 0 (origin) → 1 (destination).
    var progress: Double
    /// Where the arc starts — typically the board's booked-row center.
    var startPoint: CGPoint
    /// Where the arc ends — the Saved tab icon center.
    var endPoint: CGPoint
    /// Visibility gate: only render when the parent says so.
    var isVisible: Bool

    private var controlPoint: CGPoint {
        let mid = CGPoint(
            x: (startPoint.x + endPoint.x) / 2,
            y: (startPoint.y + endPoint.y) / 2
        )
        // Bias control point 120pt above the midpoint for parabolic arc
        return CGPoint(x: mid.x, y: mid.y - 120)
    }

    private var currentPosition: CGPoint {
        quadBezier(t: CGFloat(progress), p0: startPoint, p1: controlPoint, p2: endPoint)
    }

    var body: some View {
        Group {
            if isVisible && startPoint != .zero && endPoint != .zero {
                ZStack {
                    // Glow halo
                    Circle()
                        .fill(Color.sgYellow.opacity(0.2))
                        .frame(width: 36, height: 36)
                        .blur(radius: 8)

                    // Badge circle
                    Circle()
                        .fill(Color.sgYellow)
                        .frame(width: 20, height: 20)
                        .sgShadow(.hero)

                    // Plane icon
                    Image(systemName: "airplane")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.sgInk)
                        .rotationEffect(arcRotation)
                }
                .position(currentPosition)
                .scaleEffect(badgeScale)
                .animation(SGSpring.bouncy, value: isVisible)
            }
        }
        .accessibilityHidden(true)
    }

    // MARK: - Helpers

    /// Rotate the plane icon to follow the arc tangent angle.
    private var arcRotation: Angle {
        // Approximate tangent at current t by comparing nearby positions
        let dt: CGFloat = 0.01
        let ahead = quadBezier(
            t: CGFloat(min(progress + Double(dt), 1.0)),
            p0: startPoint, p1: controlPoint, p2: endPoint
        )
        let dx = ahead.x - currentPosition.x
        let dy = ahead.y - currentPosition.y
        let angle = atan2(dy, dx)
        return .radians(Double(angle))
    }

    /// Badge scale: pops in at start, shrinks to "land" at destination.
    private var badgeScale: Double {
        let t = progress
        if t < 0.15 {
            // Scale up from 0.3 → 1.0 at takeoff
            return 0.3 + (t / 0.15) * 0.7
        } else if t > 0.80 {
            // Shrink 1.0 → 0.5 on approach
            return 1.0 - ((t - 0.80) / 0.20) * 0.5
        }
        return 1.0
    }

    /// Quadratic Bezier interpolation.
    private func quadBezier(t: CGFloat, p0: CGPoint, p1: CGPoint, p2: CGPoint) -> CGPoint {
        let mt = 1.0 - t
        let x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x
        let y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
        return CGPoint(x: x, y: y)
    }
}

// MARK: - SavedTabIconFrameKey
//
// PreferenceKey that lets ContentView's savedTab tabItem report its frame
// up to the ancestor that hosts FlightArcBadge. The tab bar item uses
// `background(GeometryReader { ... })` to capture its center point.
//
// Because tab bar items are UIKit-managed, we can only approximate the
// frame via the safe-area bottom region. The key provides a fallback
// center calculation if the tab bar frame isn't reported by the time
// the arc fires (TODO: see wiring notes in ContentView).

struct SavedTabIconFrameKey: PreferenceKey {
    static let defaultValue: CGPoint = .zero
    static func reduce(value: inout CGPoint, nextValue: () -> CGPoint) {
        let next = nextValue()
        if next != .zero { value = next }
    }
}

// MARK: - Preview

#Preview("FlightArcBadge") {
    struct Demo: View {
        @State private var progress: Double = 0
        var body: some View {
            ZStack {
                Color.sgBg.ignoresSafeArea()
                FlightArcBadge(
                    progress: progress,
                    startPoint: CGPoint(x: 195, y: 380),
                    endPoint: CGPoint(x: 130, y: 780),
                    isVisible: true
                )
            }
            .onAppear {
                withAnimation(.timingCurve(0.45, 0.05, 0.55, 0.95, duration: 1.2)) {
                    progress = 1.0
                }
            }
        }
    }
    return Demo()
}
