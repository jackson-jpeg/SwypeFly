import SwiftUI

// MARK: - AppIconPickerView
//
// Sheet displayed from Settings > App Icon row.
// Three preview tiles; selection calls UIApplication.setAlternateIconName.
// Art assets (PNGs) are TODO — Contents.json stubs exist in Assets.xcassets.

struct AppIconPickerView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var currentIconName: String? = nil   // nil = default

    private struct IconOption: Identifiable {
        let id: String
        let name: String
        let assetName: String?   // nil = system default
        let description: String
        let previewSymbol: String
        let accentColor: Color
    }

    private let options: [IconOption] = [
        IconOption(
            id: "classic",
            name: "Classic",
            assetName: nil,
            description: "The original SoGoJet icon.",
            previewSymbol: "airplane.departure",
            accentColor: .sgYellow
        ),
        IconOption(
            id: "neon",
            name: "Neon",
            assetName: "AppIcon-Neon",
            description: "Warm yellow on near-black. Maximum contrast.",
            previewSymbol: "bolt.fill",
            accentColor: Color(hex: 0xFFD700)
        ),
        IconOption(
            id: "runway",
            name: "Runway",
            assetName: "AppIcon-Runway",
            description: "Solari board aesthetic. Departure grid art.",
            previewSymbol: "rectangle.split.3x1.fill",
            accentColor: Color(hex: 0xE8A849)
        ),
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack(spacing: Spacing.xs) {
                Text("APP ICON")
                    .sgFont(.section)
                    .foregroundStyle(Color.sgYellow)
                    .tracking(2)
                Text("Choose your departure gate aesthetic.")
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgMuted)
            }
            .padding(.vertical, Spacing.lg)

            // Icon tiles
            VStack(spacing: Spacing.md) {
                ForEach(options) { option in
                    iconTile(option)
                }
            }
            .padding(.horizontal, Spacing.md)

            Spacer()

            Text("Artwork for Neon and Runway icons coming soon.")
                .font(SGFont.body(size: 11))
                .foregroundStyle(Color.sgFaint)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.lg)
                .padding(.bottom, Spacing.xl)
        }
        .background(Color.sgSurfaceHigh)
        .onAppear {
            // Detect currently active icon
            currentIconName = UIApplication.shared.alternateIconName
        }
    }

    private func iconTile(_ option: IconOption) -> some View {
        let isSelected = selectedMatches(option)

        return Button {
            selectIcon(option)
        } label: {
            SGCard(elevation: isSelected ? .hero : .lifted) {
                HStack(spacing: Spacing.md) {
                    // Icon preview tile
                    ZStack {
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .fill(Color.sgInk)
                            .frame(width: 60, height: 60)
                        Image(systemName: option.previewSymbol)
                            .font(.system(size: 26, weight: .semibold))
                            .foregroundStyle(option.accentColor)
                    }

                    VStack(alignment: .leading, spacing: 3) {
                        Text(option.name)
                            .font(SGFont.bodyBold(size: 15))
                            .foregroundStyle(Color.sgWhite)
                        Text(option.description)
                            .font(SGFont.body(size: 12))
                            .foregroundStyle(Color.sgMuted)
                            .lineLimit(2)
                    }

                    Spacer(minLength: 0)

                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(Color.sgYellow)
                    }
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
                    .strokeBorder(isSelected ? Color.sgYellow.opacity(0.6) : Color.clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(option.name) icon\(isSelected ? ", currently selected" : "")")
    }

    private func selectedMatches(_ option: IconOption) -> Bool {
        currentIconName == option.assetName
    }

    private func selectIcon(_ option: IconOption) {
        guard !selectedMatches(option) else { return }
        UIApplication.shared.setAlternateIconName(option.assetName) { error in
            if let error {
                // If art not present yet, the OS will reject — graceful no-op
                print("[AppIconPicker] setAlternateIconName failed: \(error.localizedDescription)")
                return
            }
            HapticEngine.success()
            currentIconName = option.assetName
        }
    }
}

#Preview("AppIconPicker") {
    AppIconPickerView()
}
