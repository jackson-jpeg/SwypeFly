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
    var animate: Bool = true
    var delay: Double = 0
    var trigger: Int = 0

    @State private var displayedChar: Character = " "
    @State private var pendingChar: Character?
    @State private var queuedChar: Character?
    @State private var flipPhase: FlipPhase = .idle
    @State private var hasInitialized = false
    @State private var sequenceID = 0
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

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size.cornerRadius)
                .fill(Color.sgCell)

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

        sequenceID += 1
        queuedChar = nil
        pendingChar = character
        displayedChar = " "
        flipPhase = .idle
        startFlip(sequence: sequenceID)
    }

    private func enqueueCharacter(_ newValue: Character) {
        guard newValue != displayedChar || flipPhase != .idle else { return }

        if newValue == " " {
            setStatic(" ")
            return
        }

        if flipPhase == .idle, pendingChar == nil {
            pendingChar = newValue
            sequenceID += 1
            startFlip(sequence: sequenceID)
        } else {
            queuedChar = newValue
        }
    }

    private func startFlip(sequence: Int) {
        guard pendingChar != nil else { return }

        withAnimation(
            .easeIn(duration: 0.12).delay(delay),
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
        startFlip(sequence: sequenceID)
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
