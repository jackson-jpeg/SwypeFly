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
                    title: "Real flight prices",
                    body: "Prices shown are the cheapest round-trip fares we found for each destination. We search hundreds of flights to find you the best deals."
                )

                explainerRow(
                    icon: "arrow.triangle.2.circlepath",
                    title: "Prices update frequently",
                    body: "Airlines change fares constantly. The price you see is based on our most recent search. When you tap to book, we'll confirm the latest fare."
                )

                explainerRow(
                    icon: "airplane.departure",
                    title: "What you see is what you get",
                    body: "We show the same price you'll see at checkout. If the fare changed since we last checked, we'll let you know right away."
                )
            }

            // Visual key
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("PRICE FRESHNESS")
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1)

                HStack(spacing: Spacing.md) {
                    freshnessExample(dot: Color.sgDealAmazing, label: "live fare", note: "< 30 min old")
                    freshnessExample(dot: Color.sgYellow, label: "recent fare", note: "< 1 hour old")
                    freshnessExample(dot: .orange, label: "est. fare", note: "Older data")
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

    private func freshnessExample(dot: Color, label: String, note: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Circle()
                    .fill(dot)
                    .frame(width: 6, height: 6)
                Text(label)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(dot)
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
        .accessibilityHint("Opens explanation of price freshness")
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
