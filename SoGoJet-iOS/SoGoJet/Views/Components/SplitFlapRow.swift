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
    var onComplete: (() -> Void)? = nil

    // Padded characters array, always `maxLength` long.
    private var characters: [Character] {
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

        return Array(padded)
    }

    var body: some View {
        HStack(spacing: 1) {
            ForEach(Array(characters.enumerated()), id: \.offset) { index, char in
                SplitFlapChar(
                    character: animate ? char : " ",
                    size: size,
                    color: color,
                    delay: startDelay + Double(index) * (staggerMs / 1000.0)
                )
            }
        }
        .onChange(of: animate) { _, isAnimating in
            guard isAnimating, let onComplete else { return }
            // Fire completion after the last character finishes its full flip.
            let lastCharDelay = startDelay + Double(maxLength - 1) * (staggerMs / 1000.0)
            let flipDuration = 0.30 // two phases of 0.15 each
            let totalDuration = lastCharDelay + flipDuration
            DispatchQueue.main.asyncAfter(deadline: .now() + totalDuration) {
                onComplete()
            }
        }
    }
}

// MARK: - Preview

#Preview("Split Flap Row") {
    struct Demo: View {
        @State private var showText = false
        @State private var destination = "BALI"
        @State private var price = "$249"
        @State private var completed = false

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
                    color: Color.sgYellow,
                    alignment: .trailing,
                    animate: showText,
                    startDelay: 0.3,
                    staggerMs: 50,
                    onComplete: { completed = true }
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

                if completed {
                    Text("Animation complete")
                        .font(SGFont.caption)
                        .foregroundStyle(Color.sgGreen)
                        .transition(.opacity)
                }

                Button {
                    showText = false
                    completed = false
                    destination = destinations.randomElement() ?? "BALI"
                    price = "$\(Int.random(in: 99...999))"
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        showText = true
                    }
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
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    showText = true
                }
            }
        }
    }
    return Demo()
}
