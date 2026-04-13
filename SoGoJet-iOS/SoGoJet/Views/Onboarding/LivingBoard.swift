import SwiftUI

// MARK: - LivingBoard
//
// A full-screen background of split-flap rows cycling through travel words,
// city codes, and prices. Each row runs on an independent timer (3–7s range)
// so the board never feels synchronized or mechanical. The brand mark sits
// centered above it in an SGCard(.hero) with runway shimmer.
//
// Used on: OnboardingView welcome step, AuthView background.

private let travelWords: [[String]] = [
    ["BCN", "TYO", "DPS", "CDG", "JTR", "NRT", "SYD", "BKK", "LIS", "GRU"],
    ["DISCOVER", "EXPLORE", "WANDER", "ESCAPE", "ARRIVE", "DEPART", "JOURNEY", "ADVENTURE"],
    ["$287", "$412", "$189", "$345", "$519", "$267", "$398", "$221", "$473", "$310"],
    ["BEACH", "CULTURE", "NIGHTLIFE", "ISLAND", "ROMANCE", "NATURE", "FOOD", "HISTORY"],
    ["TOKYO", "PARIS", "BALI", "BARCELONA", "LISBON", "ROME", "MIAMI", "DUBAI"],
    ["YVR", "MIA", "FCO", "LHR", "SIN", "HKG", "MEX", "CPT", "IST", "DEL"],
    ["FLY", "GO", "TAKE OFF", "LAND", "CRUISE", "BOARD", "DEPART", "ARRIVE"],
    ["EUROPE", "ASIA", "AMERICAS", "PACIFIC", "AFRICA", "MIDDLE EAST"],
]

struct LivingBoard: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // Each row gets its own independent cycle interval 3–7s
    @State private var rowWords: [String] = LivingBoard.initialWords()
    @State private var rowAnimated: [Bool] = Array(repeating: false, count: travelWords.count)
    @State private var tasks: [Task<Void, Never>] = []

    var body: some View {
        GeometryReader { geo in
            VStack(alignment: .leading, spacing: 6) {
                ForEach(0..<min(travelWords.count, visibleRowCount(for: geo)), id: \.self) { rowIdx in
                    SplitFlapRow(
                        text: rowWords[rowIdx],
                        maxLength: 10,
                        size: .md,
                        color: rowColor(rowIdx),
                        alignment: .leading,
                        animate: rowAnimated[rowIdx],
                        staggerMs: 30
                    )
                    .opacity(rowOpacity(rowIdx, totalRows: visibleRowCount(for: geo)))
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.lg)
        }
        .onAppear { startCycling() }
        .onDisappear { stopCycling() }
        .accessibilityHidden(true)
    }

    private func visibleRowCount(for geo: GeometryProxy) -> Int {
        // Fit rows into height: each ~36pt + 6pt gap
        let rowHeight: CGFloat = 42
        let count = Int(geo.size.height / rowHeight)
        return min(max(count, 4), travelWords.count)
    }

    private func rowColor(_ idx: Int) -> Color {
        // Row 2 (prices) is yellow; others alternate between white/dim
        switch idx % 3 {
        case 0: return .sgWhite
        case 1: return .sgMuted
        default: return .sgYellow
        }
    }

    private func rowOpacity(_ idx: Int, totalRows: Int) -> Double {
        // Fade near top and bottom
        let topFade = Double(idx) / max(Double(min(2, totalRows - 1)), 1)
        let bottomFade = Double(totalRows - 1 - idx) / max(Double(min(2, totalRows - 1)), 1)
        return min(topFade, bottomFade, 1.0)
    }

    private static func initialWords() -> [String] {
        travelWords.map { $0.first ?? "" }
    }

    private func startCycling() {
        guard !reduceMotion else {
            rowAnimated = Array(repeating: true, count: travelWords.count)
            return
        }

        // Kick off first flip after a short delay
        for rowIdx in 0..<travelWords.count {
            rowAnimated[rowIdx] = true
        }

        // Each row cycles independently
        for rowIdx in 0..<travelWords.count {
            let intervalNs = UInt64((3.0 + Double(rowIdx % 5) * 0.8) * 1_000_000_000)
            let t = Task { @MainActor in
                var wordIdx = 1
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: intervalNs)
                    guard !Task.isCancelled else { break }
                    rowAnimated[rowIdx] = false
                    try? await Task.sleep(nanoseconds: 80_000_000)
                    guard !Task.isCancelled else { break }
                    let words = travelWords[rowIdx]
                    rowWords[rowIdx] = words[wordIdx % words.count]
                    wordIdx += 1
                    rowAnimated[rowIdx] = true
                }
            }
            tasks.append(t)
        }
    }

    private func stopCycling() {
        tasks.forEach { $0.cancel() }
        tasks = []
    }
}

// MARK: - LivingBoardBackground
//
// Convenience wrapper: LivingBoard + gradient overlay so it doesn't visually
// compete with content placed on top.

struct LivingBoardBackground: View {
    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()
            LivingBoard()
                .ignoresSafeArea()
                .opacity(0.18)
            // Radial vignette — clears a centered window for the brand mark
            RadialGradient(
                colors: [Color.sgBg.opacity(0.0), Color.sgBg.opacity(0.85)],
                center: .center,
                startRadius: 80,
                endRadius: 320
            )
            .ignoresSafeArea()
        }
    }
}

#Preview("LivingBoard") {
    ZStack {
        LivingBoardBackground()
        VStack {
            Text("SOGOJET")
                .sgFont(.hero)
                .foregroundStyle(Color.sgYellow)
        }
    }
}
