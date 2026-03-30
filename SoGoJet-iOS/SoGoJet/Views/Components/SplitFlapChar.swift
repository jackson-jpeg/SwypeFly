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

// MARK: - Scramble Config
// Monochrome palette — white flashes on dark cells during the scramble phase.

private let scrambleColors: [Color] = [
    Color(hex: 0xF5F5F5),  // white
    Color(hex: 0xCCCCCC),  // light grey
    Color(hex: 0x888888),  // mid grey
    Color(hex: 0xF5F5F5),  // white
    Color(hex: 0x555555),  // dark grey
    Color(hex: 0xCCCCCC),  // light grey
]

private let scrambleCharset: [Character] = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$.-!?")

// MARK: - Split Flap Character
// Two-phase animation: scramble (rapid random chars with color flashes) → mechanical flip to target.

struct SplitFlapChar: View {
    let character: Character
    let size: SplitFlapSize
    let color: Color
    var animate: Bool = true
    var delay: Double = 0
    var trigger: Int = 0

    @State private var displayedChar: Character = " "
    @State private var pendingChar: Character?
    @State private var queuedChar: Character?
    @State private var flipPhase: FlipPhase = .idle
    @State private var hasInitialized = false
    @State private var sequenceID = 0

    // Scramble state
    @State private var scrambleChar: Character = " "
    @State private var scrambleColor: Color = .clear
    @State private var isScrambling = false
    @State private var scrambleTask: Task<Void, Never>?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    enum FlipPhase {
        case idle
        case topFolding
        case bottomLanding
    }

    private var charFont: Font {
        .system(size: size.fontSize, weight: .bold, design: .monospaced)
    }

    private let gap: CGFloat = 1
    // Exact +/-90deg creates a singular projection matrix in SwiftUI.
    // Staying just under the limit preserves the visual while avoiding log spam.
    private let maximumFoldAngle: Double = 89.6
    private var halfH: CGFloat { (size.cellHeight - gap) / 2 }
    private var incomingChar: Character { pendingChar ?? displayedChar }
    private var topAngle: Double { flipPhase == .topFolding ? -maximumFoldAngle : 0 }
    private var bottomAngle: Double { flipPhase == .bottomLanding ? 0 : maximumFoldAngle }
    private var topBackgroundChar: Character { flipPhase == .idle ? displayedChar : incomingChar }
    private var bottomBackgroundChar: Character { flipPhase == .idle ? displayedChar : displayedChar }

    /// The character to show in the cell — scramble char during scramble, otherwise displayed char.
    private var visibleChar: Character {
        isScrambling ? scrambleChar : displayedChar
    }

    /// Background tint — flash color during scramble, clear otherwise.
    private var cellBackground: Color {
        isScrambling ? scrambleColor : Color.sgCell
    }

    /// Text color — black on white/light scramble backgrounds for contrast, otherwise the prop color.
    private var visibleTextColor: Color {
        isScrambling ? Color(hex: 0x0A0A0A) : color
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size.cornerRadius)
                .fill(cellBackground)

            if isScrambling {
                // Scramble mode: single flat character, no split halves
                Text(String(scrambleChar))
                    .font(charFont)
                    .foregroundStyle(visibleTextColor)
            } else {
                // Normal split-flap mode
                flapHalf(char: bottomBackgroundChar, isTop: false, angle: 0)
                    .offset(y: halfH / 2 + gap / 2)

                flapHalf(char: topBackgroundChar, isTop: true, angle: 0)
                    .offset(y: -(halfH / 2 + gap / 2))

                flapHalf(char: displayedChar, isTop: true, angle: topAngle)
                    .offset(y: -(halfH / 2 + gap / 2))

                flapHalf(char: incomingChar, isTop: false, angle: bottomAngle)
                    .offset(y: halfH / 2 + gap / 2)

                Rectangle()
                    .fill(Color.sgBorder.opacity(0.8))
                    .frame(height: 0.5)
            }
        }
        .frame(width: size.cellWidth, height: size.cellHeight)
        .dynamicTypeSize(.large) // Lock split-flap cells — pixel-precise sizing must not scale
        .onAppear {
            guard !hasInitialized else { return }
            hasInitialized = true
            initializeCharacter()
        }
        .onChange(of: character) { _, newValue in
            guard hasInitialized else { return }

            if !animate || reduceMotion {
                setStatic(newValue)
            } else {
                enqueueCharacter(newValue)
            }
        }
        .onChange(of: animate) { _, shouldAnimate in
            guard hasInitialized else { return }

            if shouldAnimate && !reduceMotion {
                replayCurrentCharacter()
            } else {
                setStatic(character)
            }
        }
        .onChange(of: trigger) { _, _ in
            guard hasInitialized, animate, !reduceMotion else { return }
            replayCurrentCharacter()
        }
        .onDisappear {
            scrambleTask?.cancel()
        }
        .accessibilityHidden(true)
    }

    // MARK: - Flap Half

    @ViewBuilder
    private func flapHalf(char: Character, isTop: Bool, angle: Double) -> some View {
        ZStack {
            Rectangle()
                .fill(Color.sgCell)

            Text(String(char))
                .font(charFont)
                .foregroundStyle(color)
                .offset(y: isTop ? halfH / 2 : -halfH / 2)
        }
        .frame(width: size.cellWidth, height: halfH)
        .clipped()
        .rotation3DEffect(
            .degrees(angle),
            axis: (x: 1, y: 0, z: 0),
            anchor: isTop ? .bottom : .top,
            perspective: 0.3
        )
        .allowsHitTesting(false)
    }

    private func initializeCharacter() {
        if !animate || reduceMotion {
            setStatic(character)
        } else {
            replayCurrentCharacter()
        }
    }

    private func setStatic(_ newValue: Character) {
        scrambleTask?.cancel()
        isScrambling = false
        sequenceID += 1
        displayedChar = newValue
        pendingChar = nil
        queuedChar = nil
        flipPhase = .idle
    }

    private func replayCurrentCharacter() {
        guard character != " " else {
            setStatic(" ")
            return
        }

        scrambleTask?.cancel()
        sequenceID += 1
        queuedChar = nil
        pendingChar = character
        displayedChar = " "
        flipPhase = .idle
        startScrambleThenFlip(sequence: sequenceID)
    }

    private func enqueueCharacter(_ newValue: Character) {
        guard newValue != displayedChar || flipPhase != .idle || isScrambling else { return }

        if newValue == " " {
            setStatic(" ")
            return
        }

        if flipPhase == .idle, pendingChar == nil, !isScrambling {
            pendingChar = newValue
            sequenceID += 1
            startScrambleThenFlip(sequence: sequenceID)
        } else {
            queuedChar = newValue
        }
    }

    // MARK: - Scramble → Flip

    /// Scramble phase: rapid random characters with color flashes, then transition to mechanical flip.
    private func startScrambleThenFlip(sequence: Int) {
        guard pendingChar != nil else { return }

        let iterationCount = Int.random(in: 8...12)
        let intervalNs: UInt64 = 55_000_000 // 55ms per iteration

        scrambleTask?.cancel()
        scrambleTask = Task { @MainActor in
            // Wait for stagger delay
            if delay > 0 {
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                guard !Task.isCancelled, sequence == sequenceID else { return }
            }

            isScrambling = true

            for i in 0..<iterationCount {
                guard !Task.isCancelled, sequence == sequenceID else {
                    isScrambling = false
                    return
                }

                scrambleChar = scrambleCharset.randomElement() ?? "X"
                scrambleColor = scrambleColors[i % scrambleColors.count]

                try? await Task.sleep(nanoseconds: intervalNs)
            }

            guard !Task.isCancelled, sequence == sequenceID else {
                isScrambling = false
                return
            }

            // End scramble, begin mechanical flip
            isScrambling = false
            startFlip(sequence: sequence)
        }
    }

    private func startFlip(sequence: Int) {
        guard pendingChar != nil else { return }

        withAnimation(
            .easeIn(duration: 0.12),
            completionCriteria: .logicallyComplete
        ) {
            guard sequence == sequenceID else { return }
            flipPhase = .topFolding
        } completion: {
            guard sequence == sequenceID else { return }

            withAnimation(
                .spring(response: 0.15, dampingFraction: 0.7),
                completionCriteria: .logicallyComplete
            ) {
                guard sequence == sequenceID else { return }
                flipPhase = .bottomLanding
            } completion: {
                finishFlip(sequence: sequence)
            }
        }
    }

    private func finishFlip(sequence: Int) {
        guard sequence == sequenceID else { return }

        displayedChar = pendingChar ?? displayedChar
        pendingChar = nil
        flipPhase = .idle

        guard let queuedChar, queuedChar != displayedChar else {
            self.queuedChar = nil
            return
        }

        self.queuedChar = nil
        pendingChar = queuedChar
        sequenceID += 1
        startScrambleThenFlip(sequence: sequenceID)
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
