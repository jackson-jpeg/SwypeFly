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
                    .accessibilityHidden(true)
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
                    title: "\"Seen at\" prices are historical",
                    body: "Prices labeled \"seen at $X\" are based on recent fare data — the lowest price spotted for this route. They show what the fare was, not what it is right now."
                )

                explainerRow(
                    icon: "arrow.triangle.2.circlepath",
                    title: "Live prices may be higher or lower",
                    body: "Airlines update fares constantly. When you search, you'll see today's actual prices. Sometimes they're lower — we'll celebrate that with you."
                )

                explainerRow(
                    icon: "airplane.departure",
                    title: "Search to see real prices",
                    body: "Tap \"Search Flights\" to check live fares. That's the price you'll actually pay — no surprises."
                )
            }

            // Visual key
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("PRICE LABELS")
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1)

                HStack(spacing: Spacing.md) {
                    labelExample(prefix: "seen at", price: "$287", note: "Historical")
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
                .accessibilityHidden(true)

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
