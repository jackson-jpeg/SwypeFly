import SwiftUI

// MARK: - PaperTexture
//
// A procedural grain layer that adds a subtle printed-paper feel to dark
// surfaces. Drawn with a deterministic pseudo-random speckle so it stays
// stable across renders and never animates (unless explicitly shimmered).
//
// Use as an overlay: `.overlay(PaperTexture())` or as a background accent.

struct PaperTexture: View {
    /// 0.0 to 1.0 — grain visibility. Default 0.04 is barely there.
    var intensity: Double = 0.04
    /// Grain dot density (dots per 100pt²). Lower = cleaner.
    var density: Int = 120
    /// Deterministic seed so the texture is stable across renders.
    var seed: UInt64 = 0x50A9E12F

    var body: some View {
        Canvas { context, size in
            let area = Int((size.width * size.height) / 10_000)
            let dotCount = max(12, area * density / 100)
            var rng = SeededRNG(seed: seed)
            let tint = Color.sgWhite.opacity(intensity)
            for _ in 0..<dotCount {
                let x = Double(rng.next() % UInt64(max(1, Int(size.width))))
                let y = Double(rng.next() % UInt64(max(1, Int(size.height))))
                let r = 0.35 + Double(rng.next() % 10) / 20.0
                let rect = CGRect(x: x, y: y, width: r, height: r)
                context.fill(Path(ellipseIn: rect), with: .color(tint))
            }
        }
        .allowsHitTesting(false)
        .drawingGroup()
        .accessibilityHidden(true)
    }
}

// MARK: - Deterministic RNG
// xorshift64* — tiny, fast, stable across runs for a given seed.

private struct SeededRNG {
    var state: UInt64
    init(seed: UInt64) { self.state = seed == 0 ? 0xdeadbeef : seed }
    mutating func next() -> UInt64 {
        state ^= state >> 12
        state ^= state << 25
        state ^= state >> 27
        return state &* 0x2545F4914F6CDD1D
    }
}

#Preview("PaperTexture") {
    ZStack {
        Color.sgSurfaceElevated
        PaperTexture(intensity: 0.08, density: 200)
    }
    .ignoresSafeArea()
}
