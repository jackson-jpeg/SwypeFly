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
    var actionLabel: String?
    var action: (() -> Void)?
}

// MARK: - Toast Manager

@MainActor
@Observable
final class ToastManager {
    var toasts: [ToastItem] = []
    private var dismissalTasks: [UUID: Task<Void, Never>] = [:]

    func show(
        message: String,
        type: ToastType = .info,
        duration: TimeInterval = 2.5,
        actionLabel: String? = nil,
        action: (() -> Void)? = nil
    ) {
        let toast = ToastItem(message: message, type: type, duration: duration, actionLabel: actionLabel, action: action)
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
            toasts.append(toast)
        }

        dismissalTasks[toast.id]?.cancel()
        dismissalTasks[toast.id] = Task { [weak self] in
            let durationNs = UInt64(max(duration, 0) * 1_000_000_000)
            try? await Task.sleep(nanoseconds: durationNs)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                self?.dismiss(id: toast.id)
            }
        }
    }

    func dismiss(id: UUID) {
        dismissalTasks[id]?.cancel()
        dismissalTasks[id] = nil

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
        GeometryReader { geo in
            VStack(spacing: Spacing.sm) {
                ForEach(manager.toasts) { toast in
                    toastRow(toast)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.top, geo.safeAreaInsets.top + Spacing.sm)
            .frame(maxWidth: .infinity, alignment: .top)
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: manager.toasts.map(\.id))
        .allowsHitTesting(!manager.toasts.isEmpty)
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

            if let label = toast.actionLabel, let action = toast.action {
                Button {
                    action()
                    manager.dismiss(id: toast.id)
                } label: {
                    Text(label)
                        .font(SGFont.bodyBold(size: 13))
                        .foregroundStyle(Color.sgYellow)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.sgYellow.opacity(0.15), in: Capsule())
                }
            }
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
        .allowsHitTesting(true)
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
