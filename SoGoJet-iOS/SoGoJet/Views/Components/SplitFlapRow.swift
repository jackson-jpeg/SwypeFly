import SwiftUI

// MARK: - SplitFlapRow

/// A row of split-flap characters with staggered cascade animation.
/// Used for destination names, prices, flight codes, and departure-board rows.
struct SplitFlapRow: View {
    let text: String
    var maxLength: Int = 12
    var size: SplitFlapSize = .md
    var color: Color = Color.sgYellow
    var alignment: HorizontalAlignment = .leading
    var animate: Bool = true
    var startDelay: Double = 0
    var staggerMs: Double = 40
    var animationID: Int = 0

    @State private var replayTrigger = 0

    private var paddedText: String {
        let padded: String
        let trimmed = String(text.prefix(maxLength))
        let padding = String(repeating: " ", count: max(0, maxLength - trimmed.count))

        switch alignment {
        case .trailing:
            padded = padding + trimmed
        case .center:
            let leftPad = String(repeating: " ", count: max(0, (maxLength - trimmed.count) / 2))
            let rightPad = String(repeating: " ", count: max(0, maxLength - trimmed.count - leftPad.count))
            padded = leftPad + trimmed + rightPad
        default: // .leading
            padded = trimmed + padding
        }

        return padded
    }

    private var characters: [Character] {
        Array(paddedText)
    }

    var body: some View {
        HStack(spacing: 1) {
            ForEach(Array(characters.enumerated()), id: \.offset) { index, char in
                SplitFlapChar(
                    character: char,
                    size: size,
                    color: color,
                    animate: animate,
                    delay: startDelay + Double(index) * (staggerMs / 1000.0),
                    trigger: replayTrigger
                )
            }
        }
        .onChange(of: animate) { _, _ in
            guard animate else { return }
            replayTrigger += 1
        }
        .onChange(of: animationID) { _, _ in
            guard animate else { return }
            replayTrigger += 1
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(text))
    }
}

// MARK: - Preview

#Preview("Split Flap Row") {
    struct Demo: View {
        @State private var showText = false
        @State private var destination = "BALI"
        @State private var price = "$249"
        @State private var revealTask: Task<Void, Never>?

        private let destinations = ["BALI", "TOKYO", "PARIS", "LONDON", "NEW YORK", "REYKJAVIK"]

        var body: some View {
            VStack(spacing: Spacing.md) {
                Text("Split-Flap Row Demo")
                    .font(SGFont.sectionHead)
                    .foregroundStyle(Color.sgWhite)

                // Destination name — large, left-aligned
                SplitFlapRow(
                    text: destination,
                    maxLength: 10,
                    size: .lg,
                    color: Color.sgWhite,
                    animate: showText,
                    staggerMs: 40
                )

                // Price — small, right-aligned
                SplitFlapRow(
                    text: price,
                    maxLength: 6,
                    size: .md,
                    color: Color.sgWhite,
                    alignment: .trailing,
                    animate: showText,
                    startDelay: 0.3,
                    staggerMs: 50
                )

                // Flight code — small
                SplitFlapRow(
                    text: "JFK",
                    maxLength: 3,
                    size: .sm,
                    color: Color.sgMuted,
                    animate: showText,
                    startDelay: 0.6,
                    staggerMs: 60
                )

                Button {
                    showText = false
                    destination = destinations.randomElement() ?? "BALI"
                    price = "$\(Int.random(in: 99...999))"
                    scheduleReveal(after: 0.1)
                } label: {
                    Text("Shuffle")
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgBg)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.sm)
                        .background(Color.sgYellow)
                        .clipShape(Capsule())
                }
                .padding(.top, Spacing.sm)
            }
            .padding(Spacing.lg)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.sgBg)
            .onAppear {
                scheduleReveal(after: 0.3)
            }
            .onDisappear {
                revealTask?.cancel()
            }
        }

        private func scheduleReveal(after delay: TimeInterval) {
            revealTask?.cancel()
            revealTask = Task { @MainActor in
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                guard !Task.isCancelled else { return }
                showText = true
            }
        }
    }
    return Demo()
}
