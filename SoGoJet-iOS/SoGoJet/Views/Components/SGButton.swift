import SwiftUI

// MARK: - SGButton
//
// The canonical SoGoJet button. Every new CTA should reach for this rather
// than inline `Button { } label: { }` constructions. Tokenized press /
// release animations + haptics keep every interaction feeling like it came
// from the same instrument.

enum SGButtonStyle {
    /// High-emphasis warm yellow on dark. Single per screen.
    case primary
    /// Neutral elevated surface, hairline border. Default choice.
    case secondary
    /// Transparent — nested CTAs, tertiary affordances.
    case ghost
    /// Red tint — destructive confirmation.
    case destructive
}

enum SGButtonSize {
    case compact    // 36pt tall
    case regular    // 48pt tall
    case prominent  // 56pt tall, hero

    var height: CGFloat {
        switch self {
        case .compact:    return 36
        case .regular:    return 48
        case .prominent:  return 56
        }
    }

    var horizontalPadding: CGFloat {
        switch self {
        case .compact:    return Spacing.md
        case .regular:    return Spacing.lg
        case .prominent:  return Spacing.lg + Spacing.xs
        }
    }

    var typography: SGTypography {
        switch self {
        case .compact:    return .bodySmall
        case .regular:    return .section
        case .prominent:  return .cardTitle
        }
    }
}

struct SGButton<Label: View>: View {
    let action: () -> Void
    var style: SGButtonStyle = .primary
    var size: SGButtonSize = .regular
    var isEnabled: Bool = true
    var isLoading: Bool = false
    @ViewBuilder var label: () -> Label

    @State private var isPressed: Bool = false

    var body: some View {
        Button(action: handleTap) {
            HStack(spacing: Spacing.sm) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(foreground)
                }
                label()
                    .sgFont(size.typography)
                    .foregroundStyle(foreground)
            }
            .padding(.horizontal, size.horizontalPadding)
            .frame(minHeight: size.height)
            .frame(maxWidth: fillsWidth ? .infinity : nil)
            .background(background)
            .overlay(borderOverlay)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .sgShadow(shadow)
            .scaleEffect(isPressed ? 0.97 : 1.0)
            .opacity(isEnabled ? 1.0 : 0.5)
            .animation(SGSpring.snappy, value: isPressed)
        }
        .buttonStyle(PressStateButtonStyle(isPressed: $isPressed))
        .disabled(!isEnabled || isLoading)
        .accessibilityAddTraits(.isButton)
    }

    // MARK: Interaction

    private func handleTap() {
        guard isEnabled, !isLoading else { return }
        switch style {
        case .destructive:
            HapticEngine.warning()
        case .primary:
            HapticEngine.medium()
        default:
            HapticEngine.selection()
        }
        action()
    }

    // MARK: Style resolution

    private var fillsWidth: Bool { size == .prominent }

    private var foreground: Color {
        switch style {
        case .primary:      return .sgBg
        case .secondary:    return .sgWhite
        case .ghost:        return .sgWhiteDim
        case .destructive:  return .sgWhite
        }
    }

    @ViewBuilder private var background: some View {
        switch style {
        case .primary:
            Color.sgYellow
        case .secondary:
            Color.sgSurfaceElevated
        case .ghost:
            Color.clear
        case .destructive:
            Color.sgRed
        }
    }

    @ViewBuilder private var borderOverlay: some View {
        switch style {
        case .secondary, .ghost:
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                .strokeBorder(Color.sgBorder, lineWidth: 0.5)
        default:
            EmptyView()
        }
    }

    private var shadow: SGShadow {
        switch style {
        case .primary, .destructive: return .lift
        default: return SGShadow(color: .clear, radius: 0, x: 0, y: 0)
        }
    }
}

/// Prominent variant (bigger, always full width) — thin wrapper.
extension SGButton where Label == Text {
    init(_ title: String,
         style: SGButtonStyle = .primary,
         size: SGButtonSize = .regular,
         isEnabled: Bool = true,
         isLoading: Bool = false,
         action: @escaping () -> Void) {
        self.init(action: action, style: style, size: size, isEnabled: isEnabled, isLoading: isLoading) {
            Text(title)
        }
    }
}

// MARK: - Press state bridge

private struct PressStateButtonStyle: ButtonStyle {
    @Binding var isPressed: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .contentShape(Rectangle())
            .onChange(of: configuration.isPressed) { _, newValue in
                isPressed = newValue
            }
    }
}

// MARK: - Preview

#Preview("SGButton") {
    VStack(spacing: Spacing.md) {
        SGButton("Book Now", style: .primary, size: .prominent) {}
        SGButton("Save Trip", style: .secondary) {}
        SGButton("Cancel", style: .ghost) {}
        SGButton("Delete", style: .destructive, size: .compact) {}
        SGButton("Loading", style: .primary, isLoading: true) {}
        SGButton("Disabled", style: .primary, isEnabled: false) {}
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.sgBg)
}
