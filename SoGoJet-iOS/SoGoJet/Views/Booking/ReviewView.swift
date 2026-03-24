import SwiftUI

// MARK: - Review View
// Booking review showing line-item breakdown and payment trigger.

struct ReviewView: View {
    @Environment(BookingStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            if store.step == .paying {
                payingContent
            } else {
                reviewContent
            }
        }
    }

    // MARK: - Review Content

    private var reviewContent: some View {
        ScrollView {
            VStack(spacing: Spacing.lg) {
                header
                flightSummary
                lineItems
                totalSection
                payButton
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
    }

    // MARK: - Paying

    private var payingContent: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()

            ProgressView()
                .progressViewStyle(.circular)
                .tint(Color.sgYellow)
                .scaleEffect(1.5)

            Text("Processing payment...")
                .font(SGFont.bodyDefault)
                .foregroundStyle(Color.sgMuted)

            Text("Do not close this screen")
                .font(SGFont.bodySmall)
                .foregroundStyle(Color.sgFaint)

            Spacer()
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            SplitFlapRow(
                text: "REVIEW",
                maxLength: 8,
                size: .md,
                color: Color.sgYellow,
                animate: true,
                staggerMs: 40
            )
            Spacer()
        }
        .padding(.top, Spacing.md)
    }

    // MARK: - Flight Summary

    private var flightSummary: some View {
        Group {
            if let offer = store.selectedOffer {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    HStack {
                        Text(offer.airline)
                            .font(SGFont.bodyBold(size: 14))
                            .foregroundStyle(Color.sgWhite)

                        Spacer()

                        Text(offer.flightNumber)
                            .font(SGFont.bodySmall)
                            .foregroundStyle(Color.sgMuted)
                    }

                    HStack(spacing: Spacing.md) {
                        Text(offer.departureTime)
                            .font(SGFont.bodyDefault)
                            .foregroundStyle(Color.sgWhiteDim)

                        Image(systemName: "arrow.right")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.sgFaint)

                        Text(offer.arrivalTime)
                            .font(SGFont.bodyDefault)
                            .foregroundStyle(Color.sgWhiteDim)

                        Spacer()

                        Text(offer.duration)
                            .font(SGFont.bodySmall)
                            .foregroundStyle(Color.sgMuted)
                    }

                    if store.passengerCount > 1 {
                        Text("\(store.passengerCount) passengers")
                            .font(SGFont.bodySmall)
                            .foregroundStyle(Color.sgMuted)
                    }
                }
                .padding(Spacing.md)
                .background(Color.sgCell)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md)
                        .strokeBorder(Color.sgBorder, lineWidth: 1)
                )
            }
        }
    }

    // MARK: - Line Items

    private var lineItems: some View {
        VStack(spacing: 0) {
            if let offer = store.selectedOffer {
                // Base fare
                lineItem(
                    label: store.passengerCount > 1
                        ? "Base fare x \(store.passengerCount)"
                        : "Base fare",
                    amount: offer.price * Double(store.passengerCount)
                )

                Divider().overlay(Color.sgBorder)

                // Seat (if selected)
                if let seatId = store.selectedSeatId,
                   let seat = store.seatMap?.rows.flatMap(\.seats).first(where: { $0.id == seatId }),
                   let seatPrice = seat.price {
                    lineItem(
                        label: store.passengerCount > 1
                            ? "Seat \(seat.label) x \(store.passengerCount)"
                            : "Seat \(seat.label)",
                        amount: seatPrice * Double(store.passengerCount)
                    )

                    Divider().overlay(Color.sgBorder)
                }

                // Taxes (estimated as included in base)
                lineItem(label: "Taxes & fees", amount: 0, note: "Included")
            }
        }
        .background(Color.sgCell)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    private func lineItem(label: String, amount: Double, note: String? = nil) -> some View {
        HStack {
            Text(label)
                .font(SGFont.bodyDefault)
                .foregroundStyle(Color.sgWhiteDim)

            Spacer()

            if let note {
                Text(note)
                    .font(SGFont.bodySmall)
                    .foregroundStyle(Color.sgMuted)
            } else {
                Text("$\(Int(amount))")
                    .font(SGFont.bodyBold(size: 15))
                    .foregroundStyle(Color.sgWhite)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm + Spacing.xs)
    }

    // MARK: - Total

    private var totalSection: some View {
        HStack {
            Text("Total")
                .font(SGFont.sectionHead)
                .foregroundStyle(Color.sgWhite)

            Spacer()

            Text("$\(Int(store.totalPrice))")
                .font(SGFont.display(size: 36))
                .foregroundStyle(Color.sgYellow)
        }
        .padding(Spacing.md)
        .background(Color.sgCell)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(Color.sgYellow.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Pay Button

    private var payButton: some View {
        Button {
            Task {
                await store.confirmBooking()
            }
        } label: {
            HStack(spacing: Spacing.sm) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 14))
                Text("Pay $\(Int(store.totalPrice))")
                    .font(SGFont.bodyBold(size: 16))
            }
            .foregroundStyle(Color.sgBg)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.md)
            .background(Color.sgYellow)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        }
    }
}

// MARK: - Preview

#Preview("Review") {
    let store = BookingStore()
    ReviewView()
        .environment(store)
}
