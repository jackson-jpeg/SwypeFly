import SwiftUI

// MARK: - Boarding Pass View
// Confirmation screen styled as an airline boarding pass.

struct BoardingPassView: View {
    @Environment(BookingStore.self) private var store

    var onBackToDeals: () -> Void = {}
    var onShare: () -> Void = {}

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            ScrollView {
                VStack(spacing: Spacing.lg) {
                    successHeader
                    boardingPass
                    actionButtons
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.lg)
            }
        }
    }

    // MARK: - Success Header

    private var successHeader: some View {
        VStack(spacing: Spacing.sm) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundStyle(Color.sgGreen)
                .accessibilityHidden(true)

            Text("Booking Confirmed!")
                .font(SGFont.cardTitle)
                .foregroundStyle(Color.sgWhite)
                .accessibilityAddTraits(.isHeader)
        }
        .padding(.top, Spacing.md)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Booking confirmed")
    }

    // MARK: - Boarding Pass Card

    private var boardingPass: some View {
        VStack(spacing: 0) {
            // Header strip
            headerStrip

            // Route section
            routeSection

            // Perforated divider
            perforatedDivider

            // Details grid
            detailsGrid

            // Booking reference
            referenceSection

            // Decorative barcode
            barcodeStrip
        }
        .background(Color.sgCell)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    // MARK: - Header Strip

    private var headerStrip: some View {
        HStack {
            Text("SOGOJET")
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgBg)
                .tracking(2)

            Spacer()

            Text("BOARDING PASS")
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgBg)
                .tracking(1.5)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm + Spacing.xs)
        .background(Color.sgYellow)
    }

    // MARK: - Route Section

    private var routeSection: some View {
        HStack(spacing: Spacing.lg) {
            // Origin
            VStack(spacing: Spacing.xs) {
                Text("JFK")
                    .font(SGFont.display(size: 36))
                    .foregroundStyle(Color.sgWhite)

                Text("New York")
                    .font(SGFont.bodySmall)
                    .foregroundStyle(Color.sgMuted)
            }

            // Arrow with airplane
            VStack(spacing: 2) {
                Image(systemName: "airplane")
                    .font(.system(size: 20))
                    .foregroundStyle(Color.sgYellow)

                // Dashed line
                Rectangle()
                    .fill(Color.sgBorder)
                    .frame(width: 60, height: 1)
            }
            .accessibilityHidden(true)

            // Destination
            VStack(spacing: Spacing.xs) {
                Text(store.deal?.iataCode ?? "---")
                    .font(SGFont.display(size: 36))
                    .foregroundStyle(Color.sgWhite)

                Text(store.deal?.destination ?? "")
                    .font(SGFont.bodySmall)
                    .foregroundStyle(Color.sgMuted)
            }
        }
        .padding(.vertical, Spacing.lg)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Perforated Divider

    // MARK: - Perforated Divider (decorative)

    private var perforatedDivider: some View {
        HStack(spacing: 0) {
            // Left semi-circle cutout
            Circle()
                .fill(Color.sgBg)
                .frame(width: 20, height: 20)
                .offset(x: -10)

            // Dashed line
            GeometryReader { geo in
                Path { path in
                    let dashWidth: CGFloat = 6
                    let gapWidth: CGFloat = 4
                    var x: CGFloat = 0
                    while x < geo.size.width {
                        path.move(to: CGPoint(x: x, y: geo.size.height / 2))
                        path.addLine(to: CGPoint(x: min(x + dashWidth, geo.size.width), y: geo.size.height / 2))
                        x += dashWidth + gapWidth
                    }
                }
                .stroke(Color.sgBorder, lineWidth: 1)
            }
            .frame(height: 20)

            // Right semi-circle cutout
            Circle()
                .fill(Color.sgBg)
                .frame(width: 20, height: 20)
                .offset(x: 10)
        }
        .clipped()
        .accessibilityHidden(true)
    }

    // MARK: - Details Grid

    private var detailsGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
        ], spacing: Spacing.md) {
            detailCell(label: "PASSENGER", value: passengerName)
            detailCell(label: "AIRLINE", value: store.selectedOffer?.airline ?? "---")
            detailCell(label: "DEPART", value: formatDate(store.deal?.departureDate))
            detailCell(label: "RETURN", value: formatDate(store.deal?.returnDate))
        }
        .padding(Spacing.md)
    }

    private func detailCell(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(label)
                .font(SGFont.bodyBold(size: 10))
                .foregroundStyle(Color.sgMuted)
                .tracking(1)

            Text(value)
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgWhite)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Reference Section

    private var referenceSection: some View {
        VStack(spacing: Spacing.xs) {
            Text("BOOKING REFERENCE")
                .font(SGFont.bodyBold(size: 10))
                .foregroundStyle(Color.sgMuted)
                .tracking(1)

            if case .confirmed(let reference) = store.step {
                Text(reference)
                    .font(SGFont.display(size: 32))
                    .foregroundStyle(Color.sgYellow)
                    .tracking(4)
            } else if let ref = store.bookingOrder?.bookingReference {
                Text(ref)
                    .font(SGFont.display(size: 32))
                    .foregroundStyle(Color.sgYellow)
                    .tracking(4)
            }
        }
        .padding(.vertical, Spacing.md)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Barcode Strip

    private var barcodeStrip: some View {
        HStack(spacing: 1) {
            ForEach(0..<40, id: \.self) { i in
                Rectangle()
                    .fill(Color.sgWhite.opacity(i % 3 == 0 ? 0.5 : 0.8))
                    .frame(width: barWidth(for: i), height: 32)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.bottom, Spacing.md)
        .frame(maxWidth: .infinity)
        .accessibilityHidden(true)
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        VStack(spacing: Spacing.md) {
            // Share Trip
            Button {
                HapticEngine.light()
                onShare()
            } label: {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 14))
                    Text("Share Trip")
                        .font(SGFont.bodyBold(size: 15))
                }
                .foregroundStyle(Color.sgGreen)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md)
                        .strokeBorder(Color.sgGreen, lineWidth: 1.5)
                )
            }
            .accessibilityLabel("Share trip details")

            // Back to Deals
            Button {
                store.reset()
                onBackToDeals()
            } label: {
                Text("Back to Deals")
                    .font(SGFont.bodyBold(size: 15))
                    .foregroundStyle(Color.sgBg)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.md)
                    .background(Color.sgYellow)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            }
            .accessibilityLabel("Back to deals")
        }
    }

    // MARK: - Helpers

    private var passengerName: String {
        let name = "\(store.passenger.firstName) \(store.passenger.lastName)".trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? "---" : name
    }

    private func formatDate(_ dateString: String?) -> String {
        guard let dateString else { return "---" }
        // Input: "2026-04-15", output: "Apr 15"
        let inputFormatter = DateFormatter()
        inputFormatter.dateFormat = "yyyy-MM-dd"
        guard let date = inputFormatter.date(from: dateString) else { return dateString }

        let outputFormatter = DateFormatter()
        outputFormatter.dateFormat = "MMM d"
        return outputFormatter.string(from: date)
    }

    private func barWidth(for index: Int) -> CGFloat {
        // Pseudo-random widths for the decorative barcode
        let widths: [CGFloat] = [2, 1, 3, 1, 2, 3, 1, 2, 1, 3]
        return widths[index % widths.count]
    }
}

// MARK: - Preview

#Preview("Boarding Pass") {
    let store = BookingStore()
    BoardingPassView()
        .environment(store)
}
