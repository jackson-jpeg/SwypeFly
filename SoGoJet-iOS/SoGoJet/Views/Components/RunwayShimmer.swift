import SwiftUI

// MARK: - RunwayShimmer
//
// A warm diagonal light sweep that travels across its container on a loop.
// Used as a loading treatment (skeletons, pending prices) and as the
// centerpiece of the Departure hero moment. Animated via TimelineView so
// it runs on the display link without allocating timers.

struct RunwayShimmer: View {
    /// Total duration for a single sweep across the container.
    var duration: Double = SGDuration.epic
    /// Width of the shimmer band as a fraction of container width.
    var bandWidth: Double = 0.35
    /// Peak opacity of the band.
    var intensity: Double = 0.22
    /// Color of the sweep. Defaults to the SoGoJet yellow accent.
    var tint: Color = .sgYellow
    /// If false, the shimmer freezes at the resting position (useful for
    /// controlled states, e.g. triggered on demand).
    var isActive: Bool = true

    var body: some View {
        GeometryReader { geo in
            TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: !isActive)) { timeline in
                let t = timeline.date.timeIntervalSinceReferenceDate
                let phase = isActive ? (t.truncatingRemainder(dividingBy: duration)) / duration : 0.0
                let totalWidth = geo.size.width * (1.0 + bandWidth * 2)
                let offset = -geo.size.width * bandWidth + totalWidth * phase

                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: tint.opacity(intensity), location: 0.5),
                        .init(color: .clear, location: 1.0)
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .frame(width: geo.size.width * bandWidth, height: geo.size.height * 1.6)
                .rotationEffect(.degrees(18))
                .offset(x: offset - geo.size.width / 2, y: 0)
                .blendMode(.screen)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

// MARK: - View modifier convenience

extension View {
    /// Overlay a RunwayShimmer gated by `active`. Respects Reduce Motion
    /// by falling back to a static tint wash.
    func runwayShimmer(active: Bool = true, tint: Color = .sgYellow, intensity: Double = 0.22) -> some View {
        overlay(
            Group {
                if UIAccessibility.isReduceMotionEnabled {
                    if active {
                        tint.opacity(intensity * 0.4).blendMode(.screen)
                    }
                } else {
                    RunwayShimmer(intensity: intensity, tint: tint, isActive: active)
                }
            }
            .allowsHitTesting(false)
        )
    }
}

#Preview("RunwayShimmer") {
    ZStack {
        Color.sgBg.ignoresSafeArea()
        RoundedRectangle(cornerRadius: Radius.lg)
            .fill(Color.sgSurfaceElevated)
            .frame(width: 300, height: 120)
            .runwayShimmer()
            .overlay(
                Text("LOADING")
                    .sgFont(.ticker)
                    .foregroundStyle(Color.sgWhiteDim)
            )
    }
}
