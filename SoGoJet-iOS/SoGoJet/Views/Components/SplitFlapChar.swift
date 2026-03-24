import SwiftUI

// MARK: - Size Tokens

enum SplitFlapSize {
    case sm, md, lg

    var fontSize: CGFloat {
        switch self {
        case .sm: 14
        case .md: 20
        case .lg: 28
        }
    }

    var cellWidth: CGFloat {
        switch self {
        case .sm: 20
        case .md: 26
        case .lg: 32
        }
    }

    var cellHeight: CGFloat {
        switch self {
        case .sm: 26
        case .md: 34
        case .lg: 42
        }
    }

    var cornerRadius: CGFloat { 4 }
}

// MARK: - Split Flap Character
// True split-flap: top half flips down to reveal new char, bottom half snaps in place.

struct SplitFlapChar: View {
    let character: Character
    let size: SplitFlapSize
    let color: Color
    var delay: Double = 0

    @State private var currentChar: Character = " "
    @State private var nextChar: Character = " "
    @State private var topAngle: Double = 0    // 0 = flat, -90 = flipped down
    @State private var bottomAngle: Double = 90 // 90 = hidden, 0 = visible
    @State private var isAnimating = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var charFont: Font {
        .system(size: size.fontSize, weight: .bold, design: .monospaced)
    }

    private let gap: CGFloat = 1
    private var halfH: CGFloat { (size.cellHeight - gap) / 2 }

    var body: some View {
        ZStack {
            // Static bottom half — shows CURRENT char (visible behind flipping top)
            flapHalf(char: currentChar, isTop: false, angle: 0)
                .offset(y: halfH / 2 + gap / 2)

            // Static top half — shows NEXT char (revealed when top flips away)
            flapHalf(char: nextChar, isTop: true, angle: 0)
                .offset(y: -(halfH / 2 + gap / 2))

            // Animated top flap — shows CURRENT char, flips down
            flapHalf(char: currentChar, isTop: true, angle: topAngle)
                .offset(y: -(halfH / 2 + gap / 2))

            // Animated bottom flap — shows NEXT char, flips up into place
            flapHalf(char: nextChar, isTop: false, angle: bottomAngle)
                .offset(y: halfH / 2 + gap / 2)
        }
        .frame(width: size.cellWidth, height: size.cellHeight)
        .onAppear {
            currentChar = character
            nextChar = character
        }
        .onChange(of: character) { _, newValue in
            guard newValue != currentChar, !isAnimating else { return }

            if reduceMotion {
                currentChar = newValue
                nextChar = newValue
                return
            }

            nextChar = newValue
            isAnimating = true

            let flipDuration = 0.15

            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                // Phase 1: Top flap peels down (0 → -89)
                withAnimation(.easeIn(duration: flipDuration)) {
                    topAngle = -89
                }

                // Phase 2: Bottom flap falls into place (89 → 0)
                DispatchQueue.main.asyncAfter(deadline: .now() + flipDuration) {
                    // Reset top, update current
                    topAngle = 0
                    currentChar = newValue

                    withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                        bottomAngle = 0
                    }

                    // Reset for next animation
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                        bottomAngle = 89
                        isAnimating = false
                    }
                }
            }
        }
        .accessibilityHidden(true)
    }

    // MARK: - Flap Half

    @ViewBuilder
    private func flapHalf(char: Character, isTop: Bool, angle: Double) -> some View {
        let clampedAngle = min(max(angle, -89), 89)

        Text(String(char))
            .font(charFont)
            .foregroundStyle(color)
            .frame(width: size.cellWidth, height: size.cellHeight)
            // Clip to show only top or bottom half
            .clipShape(
                Rectangle()
                    .offset(y: isTop ? 0 : -halfH - gap)
                    .size(width: size.cellWidth, height: halfH)
            )
            .frame(width: size.cellWidth, height: halfH)
            .background(
                RoundedRectangle(cornerRadius: size.cornerRadius / 2)
                    .fill(Color.sgCell)
            )
            .rotation3DEffect(
                .degrees(clampedAngle),
                axis: (x: 1, y: 0, z: 0),
                anchor: isTop ? .bottom : .top,
                perspective: 0.5
            )
    }
}

// MARK: - Preview

#Preview("Split Flap Char") {
    VStack(spacing: Spacing.md) {
        HStack(spacing: 2) {
            SplitFlapChar(character: "S", size: .lg, color: Color.sgYellow)
            SplitFlapChar(character: "O", size: .lg, color: Color.sgYellow)
            SplitFlapChar(character: "G", size: .lg, color: Color.sgYellow)
            SplitFlapChar(character: "O", size: .lg, color: Color.sgYellow)
        }

        HStack(spacing: 2) {
            SplitFlapChar(character: "$", size: .md, color: Color.sgGreen)
            SplitFlapChar(character: "2", size: .md, color: Color.sgGreen)
            SplitFlapChar(character: "8", size: .md, color: Color.sgGreen)
            SplitFlapChar(character: "7", size: .md, color: Color.sgGreen)
        }
    }
    .padding()
    .background(Color.sgBg)
}
