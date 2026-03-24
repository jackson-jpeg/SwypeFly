import SwiftUI

// MARK: - Accessibility Helpers

extension View {
    /// Convenience modifier that sets both an accessibility label and hint on a deal element.
    func dealAccessibility(label: String, hint: String = "") -> some View {
        self
            .accessibilityLabel(Text(label))
            .accessibilityHint(Text(hint))
            .accessibilityAddTraits(.isButton)
    }
}
