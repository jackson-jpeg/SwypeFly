import SwiftUI

// MARK: - Size Tokens

enum SplitFlapSize {
    case sm, md, lg

    var fontSize: CGFloat {
        switch self {
        case .sm: return 14
        case .md: return 20
        case .lg: return 28
        }
    }

    var cellWidth: CGFloat {
        switch self {
        case .sm: return 22
        case .md: return 28
        case .lg: return 36
        }
    }

    var cellHeight: CGFloat {
        switch self {
        case .sm: return 28
        case .md: return 36
        case .lg: return 46
        }
    }

    var cornerRadius: CGFloat {
        switch self {
        case .sm: return 2
        case .md: return 3
        case .lg: return 4
        }
    }
}

// MARK: - SplitFlapChar

/// A single-character split-flap cell with a 3D flip animation,
/// replicating the mechanical departure-board aesthetic.
struct SplitFlapChar: View {
    let character: Character
    let size: SplitFlapSize
    var color: Color = Color.sgYellow
    /// External delay before this cell begins flipping.
    var delay: Double = 0

    @State private var displayedChar: Character = " "
    @State private var nextChar: Character = " "
    @State private var topAngle: Double = 0      // top flap rotation (0 → -90)
    @State private var bottomAngle: Double = 90   // bottom flap rotation (90 → 0)
    @State private var phase: FlipPhase = .idle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let flipDuration: Double = 0.15

    private enum FlipPhase {
        case idle
        case topDown   // top half peeling away
        case bottomDown // bottom half falling into place
    }

    // MARK: Font

    private var charFont: Font {
        .system(size: size.fontSize, weight: .bold, design: .monospaced)
    }

    // MARK: Body

    var body: some View {
        ZStack {
            // Background cell
            RoundedRectangle(cornerRadius: size.cornerRadius)
                .fill(Color.sgCell)
                .overlay(
                    RoundedRectangle(cornerRadius: size.cornerRadius)
                        .strokeBorder(Color.sgBorder, lineWidth: 0.5)
                )

            if reduceMotion {
                // Accessibility: simple crossfade
                Text(String(displayedChar))
                    .font(charFont)
                    .foregroundStyle(color)
                    .animation(.easeInOut(duration: 0.2), value: displayedChar)
            } else {
                // Split-flap halves
                VStack(spacing: 1) {
                    halfCell(char: displayedTopChar, isTop: true, angle: topAngle)
                    halfCell(char: displayedBottomChar, isTop: false, angle: bottomAngle)
                }
            }
        }
        .frame(width: size.cellWidth, height: size.cellHeight)
        .onAppear {
            displayedChar = character
            nextChar = character
        }
        .onChange(of: character) { _, newValue in
            guard newValue != displayedChar else { return }
            if reduceMotion {
                displayedChar = newValue
            } else {
                triggerFlip(to: newValue)
            }
        }
    }

    // MARK: Half-Cell

    /// Renders the top or bottom half of the character cell, clipped to its half.
    @ViewBuilder
    private func halfCell(char: Character, isTop: Bool, angle: Double) -> some View {
        let halfHeight = (size.cellHeight - 1) / 2 // account for 1pt gap

        Text(String(char))
            .font(charFont)
            .foregroundStyle(color)
            .frame(width: size.cellWidth, height: size.cellHeight)
            .offset(y: isTop ? halfHeight / 2 : -halfHeight / 2)
            .frame(width: size.cellWidth, height: halfHeight)
            .clipped()
            .background(Color.sgCell)
            .rotation3DEffect(
                .degrees(angle),
                axis: (x: 1, y: 0, z: 0),
                anchor: isTop ? .bottom : .top,
                perspective: 0.4
            )
    }

    // MARK: Displayed Characters Per Phase

    /// During the top-down phase the top half still shows the OLD char
    /// while the bottom already shows the NEW char underneath.
    private var displayedTopChar: Character {
        phase == .idle ? displayedChar : (phase == .topDown ? displayedChar : nextChar)
    }

    private var displayedBottomChar: Character {
        phase == .idle ? displayedChar : nextChar
    }

    // MARK: Flip Logic

    private func triggerFlip(to newChar: Character) {
        nextChar = newChar

        // Reset angles
        topAngle = 0
        bottomAngle = 90
        phase = .topDown

        let totalDelay = delay

        // Phase 1: top half peels down (0 → -90)
        withAnimation(.easeIn(duration: flipDuration).delay(totalDelay)) {
            topAngle = -90
        }

        // Phase 2: after top finishes, bottom half falls into place (90 → 0)
        DispatchQueue.main.asyncAfter(deadline: .now() + totalDelay + flipDuration) {
            phase = .bottomDown
            withAnimation(.easeOut(duration: flipDuration)) {
                bottomAngle = 0
            }
        }

        // Cleanup: commit final state
        DispatchQueue.main.asyncAfter(deadline: .now() + totalDelay + flipDuration * 2) {
            displayedChar = newChar
            phase = .idle
            topAngle = 0
            bottomAngle = 90 // reset for next flip
        }
    }
}

// MARK: - Preview

#Preview("Split Flap Char") {
    struct Demo: View {
        @State private var char: Character = "A"
        private let alphabet: [Character] = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

        var body: some View {
            VStack(spacing: Spacing.lg) {
                Text("Tap to flip")
                    .font(.caption)
                    .foregroundStyle(Color.sgMuted)

                HStack(spacing: Spacing.md) {
                    SplitFlapChar(character: char, size: .sm)
                    SplitFlapChar(character: char, size: .md)
                    SplitFlapChar(character: char, size: .lg)
                }
            }
            .padding()
            .background(Color.sgBg)
            .onTapGesture {
                char = alphabet.randomElement() ?? "X"
            }
        }
    }
    return Demo()
}
