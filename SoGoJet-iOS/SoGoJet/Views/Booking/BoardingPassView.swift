import SwiftUI

struct BoardingPassView: View {
    @Environment(BookingStore.self) private var store
    @Environment(SettingsStore.self) private var settingsStore

    var onBackToDeals: () -> Void = {}
    var onShare: () -> Void = {}

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                successHeader
                issuedTicket
                travelerArchive
                travelNotes
                actionCluster
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
    }

    private var successHeader: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                VintageTerminalHeroLockup(
                    eyebrow: "Issued",
                    title: "Boarding Pass",
                    subtitle: "Your trip is booked!"
                )
                VintageTerminalSectionLabel(text: "Booking Confirmed", tone: .moss)
            }

            Spacer(minLength: 0)

            VintageTerminalPassportStamp(
                title: "Status",
                subtitle: bookingStatus,
                tone: .moss
            )
        }
        .padding(.top, Spacing.sm)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Booking confirmed and boarding pass ready")
    }

    private var issuedTicket: some View {
        VintageTravelTicket(tone: .moss) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    VintageTerminalSectionLabel(text: "Booking Reference", tone: .moss)
                    SplitFlapRow(
                        text: bookingReference.uppercased(),
                        maxLength: 8,
                        size: .md,
                        color: Color.sgYellow,
                        alignment: .leading,
                        animate: true,
                        staggerMs: 30
                    )
                }

                Spacer(minLength: 0)

                Text(totalPaidLabel)
                    .font(SGFont.display(size: 34))
                    .foregroundStyle(Color.sgWhite)
            }
        } content: {
            VStack(alignment: .leading, spacing: Spacing.md) {
                VintageTerminalRouteDisplay(
                    originCode: store.searchOrigin ?? settingsStore.departureCode,
                    originLabel: settingsStore.departureCity,
                    destinationCode: store.searchDestination ?? store.deal?.iataCode ?? "DST",
                    destinationLabel: store.deal?.destination ?? "Destination",
                    detail: "\(departureDateLabel) to \(returnDateLabel)",
                    tone: .moss
                )

                barcodeStrip
            }
        } footer: {
            HStack(alignment: .top) {
                VintageTerminalCaptionBlock(title: "Passenger", value: passengerName, tone: .moss)
                Spacer()
                VintageTerminalCaptionBlock(title: "Seat", value: seatLabel, tone: .ivory, alignment: .trailing)
                Spacer()
                VintageTerminalCaptionBlock(title: "Cabin", value: cabinLabel, tone: .amber, alignment: .trailing)
            }
        }
    }

    private var travelerArchive: some View {
        VintageTerminalManifestCard(
            title: "Trip Details",
            subtitle: "Your booking at a glance.",
            tone: .amber
        ) {
            VintageTerminalManifestRow(
                prefix: "PAX",
                title: passengerName,
                value: routeLabel,
                subtitle: bookingReference,
                tone: .amber
            )
            manifestDivider
            VintageTerminalManifestRow(
                prefix: "FLY",
                title: store.selectedOffer?.airline ?? store.deal?.airlineName ?? "Airline TBD",
                value: store.selectedOffer?.flightNumber ?? "Flight number pending",
                subtitle: store.selectedOffer?.duration ?? store.deal?.safeFlightDuration,
                tone: .ivory
            )
            manifestDivider
            VintageTerminalManifestRow(
                prefix: "PAY",
                title: totalPaidLabel,
                value: bookingStatus,
                subtitle: store.bookingOrder?.status.capitalized ?? "Confirmed order",
                tone: .moss
            )
        }
    }

    private var travelNotes: some View {
        VintageTerminalPanel(
            title: "Travel Notes",
            subtitle: "",
            stamp: "Ready",
            tone: .ember
        ) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                VintageTerminalChecklistItem(
                    title: "Keep the booking reference handy",
                    detail: "You may need it again when the airline sends through check-in or schedule updates.",
                    tone: .amber
                )
                VintageTerminalChecklistItem(
                    title: "Seat assignment is already captured",
                    detail: "If the carrier changes the cabin map later, the airline will still own the final seat allocation.",
                    tone: .ivory
                )
                VintageTerminalChecklistItem(
                    title: "Share this trip with one tap",
                    detail: "Send your booking details to a friend or save them for later.",
                    tone: .moss
                )
            }
        }
    }

    private var actionCluster: some View {
        VStack(spacing: Spacing.sm) {
            VintageTerminalActionButton(
                title: "Back to Deals",
                subtitle: "Return to deals",
                icon: "airplane",
                tone: .amber,
                fillsWidth: true
            ) {
                onBackToDeals()
            }

            VintageTerminalSecondaryButton(
                title: "Share Trip",
                subtitle: "Send the confirmed route and booking reference.",
                icon: "square.and.arrow.up",
                tone: .moss,
                fillsWidth: true
            ) {
                HapticEngine.light()
                onShare()
            }
        }
    }

    private var barcodeStrip: some View {
        HStack(spacing: 1) {
            ForEach(0..<44, id: \.self) { index in
                Rectangle()
                    .fill(index.isMultiple(of: 3) ? Color.sgWhite.opacity(0.45) : Color.sgWhite.opacity(0.82))
                    .frame(width: barWidth(for: index), height: 34)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.xs)
        .accessibilityHidden(true)
    }

    private var manifestDivider: some View {
        Rectangle()
            .fill(Color.sgBorder.opacity(0.6))
            .frame(height: 1)
    }

    private var bookingReference: String {
        if case .confirmed(let reference) = store.step {
            return reference
        }
        return store.bookingOrder?.bookingReference ?? "PENDING"
    }

    private var bookingStatus: String {
        (store.bookingOrder?.status ?? "confirmed").replacingOccurrences(of: "_", with: " ").capitalized
    }

    private var passengerName: String {
        if let bookedName = store.bookingOrder?.passengers.first?.name,
           !bookedName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return bookedName
        }

        let pieces = [store.passenger.title, store.passenger.firstName, store.passenger.lastName]
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        let combined = pieces.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        return combined.isEmpty ? "Passenger" : combined
    }

    private var seatLabel: String {
        store.bookingOrder?.passengers.first?.seatDesignator ?? store.selectedSeatId ?? "Assigned later"
    }

    private var cabinLabel: String {
        guard let rawValue = store.selectedOffer?.cabinClass,
              let cabinClass = BookingCabinClass(rawValue: rawValue) else {
            return "Economy"
        }
        return cabinClass.displayName
    }

    private var routeLabel: String {
        let origin = store.searchOrigin ?? settingsStore.departureCode
        let destination = store.searchDestination ?? store.deal?.iataCode ?? "DST"
        return "\(origin) - \(destination)"
    }

    private var departureDateLabel: String {
        formatDate(store.searchDepartureDate ?? store.bookingOrder?.slices.first?.departureTime ?? store.deal?.bestDepartureDate)
    }

    private var returnDateLabel: String {
        formatDate(store.searchReturnDate ?? store.bookingOrder?.slices.dropFirst().first?.departureTime ?? store.deal?.bestReturnDate)
    }

    private var totalPaidLabel: String {
        if let order = store.bookingOrder {
            return currencyAmount(order.totalPaid, currency: order.currency)
        }
        return currencyAmount(store.totalPrice, currency: store.selectedOffer?.currency ?? "USD")
    }

    private func formatDate(_ dateString: String?) -> String {
        guard let dateString else { return "---" }
        let isoFormatter = ISO8601DateFormatter()
        let inputFormatter = DateFormatter()
        inputFormatter.dateFormat = "yyyy-MM-dd"
        inputFormatter.locale = Locale(identifier: "en_US_POSIX")

        let date = isoFormatter.date(from: dateString) ?? inputFormatter.date(from: dateString)
        guard let date else { return dateString }

        let outputFormatter = DateFormatter()
        outputFormatter.locale = Locale(identifier: "en_US")
        outputFormatter.dateFormat = "MMM d"
        return outputFormatter.string(from: date)
    }

    private func currencyAmount(_ amount: Double, currency: String) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "$\(Int(amount.rounded()))"
    }

    private func barWidth(for index: Int) -> CGFloat {
        let widths: [CGFloat] = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3]
        return widths[index % widths.count]
    }
}

#Preview("Boarding Pass") {
    let store = BookingStore()
    BoardingPassView()
        .environment(store)
        .environment(SettingsStore())
}
