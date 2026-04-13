import SwiftUI

// MARK: - SGSheet
//
// A tokenized presentation modifier atop iOS 18's `.sheet` with the
// SoGoJet material hierarchy pre-wired: elevated surface, paper-grain
// backdrop, grabber styling, and dismissal haptic. The built-in pan-down
// dismissal is delegated to SwiftUI (pre-iOS 16.4 `presentationDragIndicator`
// + native gesture).

enum SGSheetDetent {
    case medium
    case large
    case fraction(CGFloat)

    fileprivate var presentation: PresentationDetent {
        switch self {
        case .medium: return .medium
        case .large: return .large
        case .fraction(let f): return .fraction(f)
        }
    }
}

struct SGSheetConfiguration {
    var detents: [SGSheetDetent] = [.large]
    var showsGrabber: Bool = true
    var cornerRadius: CGFloat = Radius.xl
    var dismissHaptic: Bool = true
}

extension View {
    /// Present a SoGoJet-styled sheet.
    func sgSheet<Content: View>(
        isPresented: Binding<Bool>,
        configuration: SGSheetConfiguration = SGSheetConfiguration(),
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        self.sheet(isPresented: isPresented) {
            SGSheetContainer(configuration: configuration, isPresented: isPresented, content: content)
        }
    }

    /// Present a SoGoJet-styled sheet bound to an optional item.
    func sgSheet<Item: Identifiable, Content: View>(
        item: Binding<Item?>,
        configuration: SGSheetConfiguration = SGSheetConfiguration(),
        @ViewBuilder content: @escaping (Item) -> Content
    ) -> some View {
        self.sheet(item: item) { value in
            SGSheetContainer(
                configuration: configuration,
                isPresented: Binding(
                    get: { item.wrappedValue != nil },
                    set: { if !$0 { item.wrappedValue = nil } }
                )
            ) {
                content(value)
            }
        }
    }
}

// MARK: - Container

private struct SGSheetContainer<Content: View>: View {
    let configuration: SGSheetConfiguration
    @Binding var isPresented: Bool
    @ViewBuilder let content: () -> Content

    var body: some View {
        ZStack {
            Color.sgSurfaceHigh.ignoresSafeArea()
            PaperTexture(intensity: 0.035)
                .ignoresSafeArea()
            content()
        }
        .presentationDetents(Set(configuration.detents.map { $0.presentation }))
        .presentationDragIndicator(configuration.showsGrabber ? .visible : .hidden)
        .presentationCornerRadius(configuration.cornerRadius)
        .presentationBackground(Color.sgSurfaceHigh)
        .onDisappear {
            if configuration.dismissHaptic {
                HapticEngine.selection()
            }
        }
    }
}

#Preview("SGSheet") {
    struct Demo: View {
        @State private var show = false
        var body: some View {
            ZStack {
                Color.sgBg.ignoresSafeArea()
                SGButton("Present Sheet") { show = true }
            }
            .sgSheet(isPresented: $show,
                     configuration: SGSheetConfiguration(detents: [.medium, .large])) {
                VStack(spacing: Spacing.md) {
                    Text("FILTERS")
                        .sgFont(.hero)
                        .foregroundStyle(Color.sgYellow)
                    Text("Vibe · Price · Dates")
                        .sgFont(.body)
                        .foregroundStyle(Color.sgWhiteDim)
                    Spacer()
                }
                .padding(Spacing.lg)
            }
        }
    }
    return Demo()
}
