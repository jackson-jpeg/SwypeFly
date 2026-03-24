import SwiftUI
import Observation

// MARK: - Toast Type

enum ToastType {
    case success
    case error
    case info

    var color: Color {
        switch self {
        case .success: return Color.sgDealAmazing
        case .error:   return Color.sgRed
        case .info:    return Color.sgYellow
        }
    }

    var iconName: String {
        switch self {
        case .success: return "checkmark.circle.fill"
        case .error:   return "exclamationmark.triangle.fill"
        case .info:    return "info.circle.fill"
        }
    }
}

// MARK: - Toast Item

struct ToastItem: Identifiable {
    let id = UUID()
    let message: String
    let type: ToastType
    let duration: TimeInterval
}

// MARK: - Toast Manager

@Observable
final class ToastManager {
    var toasts: [ToastItem] = []

    func show(message: String, type: ToastType = .info, duration: TimeInterval = 2.5) {
        let toast = ToastItem(message: message, type: type, duration: duration)
        toasts.append(toast)

        // Auto-dismiss
        DispatchQueue.main.asyncAfter(deadline: .now() + duration) { [weak self] in
            self?.dismiss(id: toast.id)
        }
    }

    func dismiss(id: UUID) {
        withAnimation(.easeOut(duration: 0.25)) {
            toasts.removeAll { $0.id == id }
        }
    }
}

// MARK: - Toast Overlay

/// Place this as an overlay on the root view to display toasts at the top of the screen.
struct ToastOverlay: View {
    @Environment(ToastManager.self) private var manager

    var body: some View {
        VStack(spacing: Spacing.sm) {
            ForEach(manager.toasts) { toast in
                toastRow(toast)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
            Spacer()
        }
        .padding(.horizontal, Spacing.md)
        .padding(.top, 54) // below status bar
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: manager.toasts.map(\.id))
    }

    // MARK: - Toast Row

    private func toastRow(_ toast: ToastItem) -> some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: toast.type.iconName)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(toast.type.color)

            Text(toast.message)
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgWhite)
                .lineLimit(2)

            Spacer()
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm + Spacing.xs)
        .background(Color.sgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(toast.type.color.opacity(0.3), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.3), radius: 8, y: 4)
        .contentShape(Rectangle())
        .onTapGesture {
            manager.dismiss(id: toast.id)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(toast.type == .error ? "Error" : toast.type == .success ? "Success" : "Info"): \(toast.message)")
        .accessibilityAddTraits(.isButton)
        .accessibilityHint("Tap to dismiss")
    }
}

// MARK: - Preview

#Preview("Toast Overlay") {
    let manager = ToastManager()
    ZStack {
        Color.sgBg.ignoresSafeArea()

        VStack(spacing: Spacing.md) {
            Button("Show Success") { manager.show(message: "Flight saved!", type: .success) }
            Button("Show Error") { manager.show(message: "Failed to load prices", type: .error) }
            Button("Show Info") { manager.show(message: "Prices updated", type: .info) }
        }
        .buttonStyle(.borderedProminent)
    }
    .overlay { ToastOverlay() }
    .environment(manager)
}
