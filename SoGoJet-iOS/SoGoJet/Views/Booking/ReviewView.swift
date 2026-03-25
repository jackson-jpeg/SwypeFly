import SwiftUI

struct ReviewView: View {
    @Environment(BookingStore.self) private var store

    private var offer: TripOption? {
        store.selectedOffer
    }

    var body: some View {
        Group {
            if store.step == .paying {
                payingContent
            } else {
                reviewContent
            }
        }
    }

    private var reviewContent: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                header
                checkoutTicket

                if let discrepancy = store.lastPriceDiscrepancy {
                    discrepancyDeck(discrepancy)
                }

                flightManifest
                travelerManifest
                fareLedger
                confirmationNotes
                actionCluster
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
    }

    private var payingContent: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            VintageTerminalHeroLockup(
                eyebrow: "Payment Desk",
                title: "Issuing Ticket",
                subtitle: "Hold the terminal steady while the carrier confirms the fare and writes the order."
            )
            .padding(.horizontal, Spacing.md)
            .padding(.top, Spacing.lg)

            VintageTravelTicket(tone: .amber) {
                HStack {
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        VintageTerminalSectionLabel(text: "Processing", tone: .amber)
                        Text(totalLabel)
                            .font(SGFont.display(size: 34))
                            .foregroundStyle(Color.sgWhite)
                    }

                    Spacer()

                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(Color.sgYellow)
                        .scaleEffect(1.3)
                }
            } content: {
                Text("The payment intent has been created and we are waiting on the provider to issue the order. Do not close this screen yet.")
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgWhiteDim)
                    .fixedSize(horizontal: false, vertical: true)
            } footer: {
                HStack {
                    VintageTerminalCaptionBlock(title: "Status", value: "Payment in flight", tone: .amber)
                    Spacer()
                    VintageTerminalCaptionBlock(title: "Route", value: routeLabel, tone: .ivory, alignment: .trailing)
                }
            }
            .padding(.horizontal, Spacing.md)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            VintageTerminalCollectionHeader(
                title: "Checkout Ledger",
                subtitle: "This is the last desk before the order is issued. Check the route, traveler, and extras one more time."
            )
            .padding(.top, Spacing.sm)
        }
    }

    private var checkoutTicket: some View {
        VintageTravelTicket(tone: .amber) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    VintageTerminalSectionLabel(text: "Trip Summary", tone: .amber)
                    Text(totalLabel)
                        .font(SGFont.display(size: 34))
                        .foregroundStyle(Color.sgYellow)
                }

                Spacer(minLength: 0)

                VintageTerminalPassportStamp(
                    title: "Cabin",
                    subtitle: cabinLabel,
                    tone: .ivory
                )
            }
        } content: {
            VintageTerminalRouteDisplay(
                originCode: store.searchOrigin ?? offer?.outboundSlice?.origin ?? "ORG",
                originLabel: offer?.outboundSlice?.origin ?? "Departure",
                destinationCode: store.searchDestination ?? offer?.outboundSlice?.destination ?? "DST",
                destinationLabel: store.deal?.destination ?? offer?.outboundSlice?.destination ?? "Destination",
                detail: reviewWindowLabel,
                tone: .amber
            )
        } footer: {
            HStack {
                VintageTerminalCaptionBlock(title: "Travelers", value: "\(store.passengerCount)", tone: .amber)
                Spacer()
                VintageTerminalCaptionBlock(title: "Seat", value: selectedSeatLabel, tone: .moss, alignment: .trailing)
            }
        }
    }

    private func discrepancyDeck(_ discrepancy: PriceDiscrepancy) -> some View {
        VintageTerminalPanel(
            title: "Live Fare Change",
            subtitle: discrepancy.message,
            stamp: "\(discrepancy.percentDiff)%",
            tone: .ember
        ) {
            HStack(spacing: Spacing.sm) {
                VintageTerminalMetricDeck(metrics: [
                    .init(title: "Feed fare", value: "$\(Int(discrepancy.feedPrice.rounded()))", footnote: "Earlier board value", tone: .ivory),
                    .init(title: "Booking fare", value: "$\(Int(discrepancy.bookingPrice.rounded()))", footnote: "Current live rate", tone: .amber),
                ])
            }
        }
    }

    private var flightManifest: some View {
        VintageTerminalManifestCard(
            title: "Flight Manifest",
            subtitle: "Slices and aircraft currently attached to this live offer.",
            tone: .ivory
        ) {
            if let outbound = offer?.outboundSlice {
                flightSliceRow(prefix: "OUT", slice: outbound, date: store.searchDepartureDate)
            }
            if offer?.outboundSlice != nil, offer?.returnSlice != nil {
                manifestDivider
            }
            if let inbound = offer?.returnSlice {
                flightSliceRow(prefix: "RTN", slice: inbound, date: store.searchReturnDate)
            }
            if let offer {
                manifestDivider
                VintageTerminalManifestRow(
                    prefix: "META",
                    title: offer.airline,
                    value: "\(offer.flightNumber)  |  \(offer.duration)",
                    subtitle: offer.stops == 0 ? "Nonstop live fare" : "\(offer.stops) stop live fare",
                    tone: .amber
                )
            }
        }
    }

    private var travelerManifest: some View {
        VintageTerminalManifestCard(
            title: "Traveler Manifest",
            subtitle: "The exact person and extras attached to the order.",
            tone: .moss
        ) {
            VintageTerminalManifestRow(
                prefix: "PAX",
                title: travelerName,
                value: store.passenger.email,
                subtitle: store.passenger.phone,
                tone: .moss
            )
            manifestDivider
            VintageTerminalManifestRow(
                prefix: "DOC",
                title: store.passenger.passportNumber.isEmpty ? "Passport to be added later" : store.passenger.passportNumber,
                value: store.passenger.nationality.isEmpty ? "US" : store.passenger.nationality,
                subtitle: store.passenger.passportExpiry.isEmpty ? "Expiry not captured yet" : "Expires \(store.passenger.passportExpiry.shortDate)",
                tone: .ivory
            )
        }
    }

    private var fareLedger: some View {
        VintageTerminalPanel(
            title: "Fare Ledger",
            subtitle: "What you are about to pay right now.",
            stamp: totalLabel,
            tone: .amber
        ) {
            VStack(spacing: 0) {
                lineItem(label: store.passengerCount > 1 ? "Base fare for \(store.passengerCount) travelers" : "Base fare", amount: offer?.price)
                manifestDivider

                if let seatPrice = selectedSeatPrice {
                    lineItem(label: "Seat \(selectedSeatLabel)", amount: seatPrice)
                    manifestDivider
                }

                lineItem(label: "Taxes and fees", note: "Included in fare")
                manifestDivider
                lineItem(label: "Cabin", note: cabinLabel)
            }
        }
    }

    private var confirmationNotes: some View {
        VintageTerminalPanel(
            title: "Before We Issue",
            subtitle: "A calm final check helps the whole thing feel intentional.",
            stamp: "Ready",
            tone: .ember
        ) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                VintageTerminalChecklistItem(
                    title: "Live provider price is already reflected above",
                    detail: "If the route changed again, the booking store will refresh the fare instead of issuing stale pricing.",
                    tone: .amber
                )
                VintageTerminalChecklistItem(
                    title: "Seat extras are optional",
                    detail: "Skipping seats will not stop the booking. The carrier can still assign them later.",
                    tone: .ivory
                )
                VintageTerminalChecklistItem(
                    title: "You can still step back one screen",
                    detail: "Use the secondary action below if you want to revise the seat or traveler details.",
                    tone: .moss
                )
            }
        }
    }

    private var actionCluster: some View {
        VStack(spacing: Spacing.sm) {
            Button {
                Task {
                    await store.confirmBooking()
                }
            } label: {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 14, weight: .semibold))
                    Text("Pay \(totalLabel)")
                        .font(SGFont.bodyBold(size: 16))
                    Spacer()
                    Text("Secure")
                        .font(SGFont.bodyBold(size: 11))
                }
                .foregroundStyle(Color.sgBg)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.md)
                .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
            }
            .buttonStyle(.plain)
            .disabled(offer == nil)

            VintageTerminalSecondaryButton(
                title: store.seatMap == nil ? "Back to Traveler Details" : "Back to Seat Map",
                subtitle: "Revisit the previous step before payment is issued.",
                icon: "arrow.uturn.backward",
                tone: .ivory,
                fillsWidth: true
            ) {
                store.step = store.seatMap == nil ? .passengers : .seats
            }
        }
    }

    private func flightSliceRow(prefix: String, slice: FlightSlice, date: String?) -> some View {
        VintageTerminalManifestRow(
            prefix: prefix,
            title: "\(slice.origin) to \(slice.destination)",
            value: "\(slice.departureTime.shortDateTime) -> \(slice.arrivalTime.shortTime)",
            subtitle: [date?.shortDate, slice.aircraft, slice.airline].compactMap { $0 }.joined(separator: "  |  "),
            tone: .amber
        )
    }

    private func lineItem(label: String, amount: Double? = nil, note: String? = nil) -> some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            Text(label)
                .font(SGFont.body(size: 13))
                .foregroundStyle(Color.sgWhiteDim)
            Spacer(minLength: 0)
            if let note {
                Text(note)
                    .font(SGFont.bodyBold(size: 12))
                    .foregroundStyle(Color.sgMuted)
            } else if let amount {
                Text("$\(Int(amount.rounded()))")
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgWhite)
            }
        }
        .padding(.vertical, Spacing.sm)
    }

    private var manifestDivider: some View {
        Rectangle()
            .fill(Color.sgBorder.opacity(0.6))
            .frame(height: 1)
    }

    private var totalLabel: String {
        "$\(Int(store.totalPrice.rounded()))"
    }

    private var cabinLabel: String {
        guard let rawValue = offer?.cabinClass,
              let cabin = BookingCabinClass(rawValue: rawValue) else {
            return store.searchCabinClass.displayName
        }
        return cabin.displayName
    }

    private var selectedSeatLabel: String {
        guard let seatId = store.selectedSeatId else { return "Assigned later" }
        return seatId
    }

    private var selectedSeatPrice: Double? {
        guard let seatId = store.selectedSeatId else { return nil }
        return store.seatMap?.rows.flatMap(\.seats).first(where: { $0.id == seatId })?.price
    }

    private var travelerName: String {
        let pieces = [store.passenger.title, store.passenger.firstName, store.passenger.lastName]
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        let combined = pieces.joined(separator: " ")
        return combined.isEmpty ? "Traveler pending" : combined
    }

    private var routeLabel: String {
        "\(store.searchOrigin ?? offer?.outboundSlice?.origin ?? "ORG") - \(store.searchDestination ?? offer?.outboundSlice?.destination ?? "DST")"
    }

    private var reviewWindowLabel: String {
        let departure = (store.searchDepartureDate ?? store.deal?.bestDepartureDate ?? "---").shortDate
        let returnDate = (store.searchReturnDate ?? store.deal?.bestReturnDate ?? "---").shortDate
        return "\(departure) to \(returnDate)"
    }
}

private extension String {
    var shortDateTime: String {
        guard let date = ISO8601DateFormatter().date(from: self) else { return self }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d, h:mm a"
        return formatter.string(from: date)
    }

    var shortTime: String {
        guard let date = ISO8601DateFormatter().date(from: self) else { return self }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }
}

#Preview("Review") {
    let store = BookingStore()
    ReviewView()
        .environment(store)
}
