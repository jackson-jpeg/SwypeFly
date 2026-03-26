import SwiftUI

// MARK: - Price Explainer Sheet
// Reusable bottom sheet explaining price transparency.
// Attached via the .priceExplainer() modifier wherever "from" labels appear.

struct PriceExplainerSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Header
            HStack {
                Image(systemName: "info.circle.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(Color.sgYellow)
                Text("About Prices")
                    .font(SGFont.sectionHead)
                    .foregroundStyle(Color.sgWhite)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(Color.sgMuted)
                }
                .accessibilityLabel("Close")
            }

            // Explanation
            VStack(alignment: .leading, spacing: Spacing.md) {
                explainerRow(
                    icon: "tag",
                    title: "\"from\" prices are estimates",
                    body: "Prices shown as \"from $X\" are based on recent searches and fare data. They represent the lowest recently seen fare for this route."
                )

                explainerRow(
                    icon: "arrow.triangle.2.circlepath",
                    title: "Live prices may differ",
                    body: "Airlines update fares constantly. The price you see when booking may be higher or lower than the estimate shown."
                )

                explainerRow(
                    icon: "airplane.departure",
                    title: "Tap to see confirmed prices",
                    body: "Tap \"Search Flights\" to check today's live fares. That price is what you will actually pay."
                )
            }

            // Visual key
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("PRICE LABELS")
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1)

                HStack(spacing: Spacing.md) {
                    labelExample(prefix: "from", price: "$287", note: "Estimate")
                    labelExample(prefix: "live", price: "$312", note: "Confirmed")
                }
            }
            .padding(Spacing.md)
            .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .strokeBorder(Color.sgBorder, lineWidth: 1)
            )

            Spacer()
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.top, Spacing.lg)
        .background(Color.sgBg)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }

    private func explainerRow(icon: String, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.sgYellow)
                .frame(width: 24, alignment: .center)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgWhite)
                Text(body)
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgWhiteDim)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func labelExample(prefix: String, price: String, note: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Text(prefix)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(prefix == "live" ? Color.sgDealAmazing : Color.sgMuted)
                Text(price)
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.sgWhite)
            }
            Text(note)
                .font(.system(size: 10))
                .foregroundStyle(Color.sgFaint)
        }
    }
}

// MARK: - Price Info Button
// Small (i) button that opens the PriceExplainerSheet.

struct PriceInfoButton: View {
    @State private var showSheet = false

    var body: some View {
        Button {
            HapticEngine.light()
            showSheet = true
        } label: {
            Image(systemName: "info.circle")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color.sgMuted.opacity(0.7))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Price info")
        .accessibilityHint("Opens explanation of estimated prices")
        .sheet(isPresented: $showSheet) {
            PriceExplainerSheet()
        }
    }
}

// MARK: - Preview

#Preview("Price Explainer") {
    PriceExplainerSheet()
}

#Preview("Price Info Button") {
    HStack {
        Text("from")
            .font(.system(size: 9, weight: .medium))
            .foregroundStyle(Color.sgMuted)
        Text("$287")
            .font(SGFont.display(size: 22))
            .foregroundStyle(Color.sgYellow)
        PriceInfoButton()
    }
    .padding()
    .background(Color.sgBg)
}
