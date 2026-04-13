import SwiftUI

// MARK: - VibeFilterBar
//
// Horizontal scrolling pill selector for vibe tags. The selected capsule
// glides between pills via matchedGeometryEffect (Linear-style). Fires a
// selection haptic on every change.

struct VibeFilterBar: View {
    let vibes: [String]
    let selected: String?
    var onSelect: (String?) -> Void = { _ in }

    @Namespace private var pillNS
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.xs) {
                // "All" clear pill
                pill(label: "ALL", id: "__all__", isSelected: selected == nil)

                ForEach(vibes, id: \.self) { vibe in
                    pill(label: vibe.uppercased(), id: vibe, isSelected: selected == vibe)
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.xs)
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .accessibilityLabel("Vibe filter")
        .accessibilityHint("Select a travel vibe to filter destinations")
    }

    // MARK: - Pill

    private func pill(label: String, id: String, isSelected: Bool) -> some View {
        let isAll = id == "__all__"
        return Button {
            guard !isSelected else { return }
            HapticEngine.selection()
            if isAll {
                onSelect(nil)
            } else {
                onSelect(id)
            }
        } label: {
            ZStack {
                // Moving background capsule — sits behind the text
                if isSelected {
                    Capsule()
                        .fill(Color.sgYellow)
                        .matchedGeometryEffect(id: "selectedPill", in: pillNS)
                }
                Text(label)
                    .sgFont(.micro)
                    .foregroundStyle(isSelected ? Color.sgBg : Color.sgWhiteDim)
                    .padding(.horizontal, Spacing.sm + 2)
                    .padding(.vertical, Spacing.xs + 1)
                    .background(
                        Group {
                            if isSelected {
                                Color.clear
                            } else {
                                Capsule().fill(Color.sgSurfaceElevated)
                            }
                        }
                    )
                    .overlay(
                        Capsule()
                            .strokeBorder(
                                isSelected
                                    ? Color.clear
                                    : Color.sgHairline,
                                lineWidth: 0.5
                            )
                    )
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isAll ? "All destinations" : label.lowercased())
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
        .animation(
            reduceMotion
                ? .easeOut(duration: SGDuration.fast)
                : SGSpring.snappy,
            value: isSelected
        )
    }
}

// MARK: - Preview

#Preview("VibeFilterBar") {
    struct Demo: View {
        @State private var selected: String? = nil
        let vibes = ["beach", "city", "adventure", "culture", "food", "nature", "ski"]
        var body: some View {
            VStack(spacing: Spacing.lg) {
                VibeFilterBar(vibes: vibes, selected: selected) { v in
                    selected = v
                }
                Text(selected ?? "All")
                    .sgFont(.body)
                    .foregroundStyle(Color.sgWhite)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.sgBg)
        }
    }
    return Demo()
}
