import SwiftUI

// MARK: - Booking Detail View
// Shows full details of a past or upcoming booking from history.

struct BookingDetailView: View {
    let booking: BookingHistoryItem

    @Environment(\.dismiss) private var dismiss
    @State private var copiedReference = false
    @State private var showFlightStatus = false
    @State private var copyResetTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    routeHeader

                    if booking.isUpcoming {
                        flightStatusButton
                    }

                    bookingReferenceCard
                    flightDetailsSection
                    passengersSection
                    paymentSection
                    supportSection
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.lg)
            }
            .background(Color.sgBg)
            .navigationTitle("Booking Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Color.sgYellow)
                }
            }
        }
    }

    // MARK: - Flight Status Button

    private var flightStatusButton: some View {
        Button {
            showFlightStatus = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "antenna.radiowaves.left.and.right")
                    .font(.system(size: 14, weight: .semibold))
                Text("Check Flight Status")
                    .font(SGFont.bodyBold(size: 14))
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(Color.sgBg)
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 12)
            .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(String(localized: "booking.check_flight_status", defaultValue: "Check flight status"))
        .sheet(isPresented: $showFlightStatus) {
            FlightStatusView(booking: booking)
        }
    }

    // MARK: - Route Header

    private var routeHeader: some View {
        VStack(spacing: Spacing.sm) {
            HStack(spacing: Spacing.md) {
                VStack(spacing: 2) {
                    Text(booking.originIata)
                        .font(.system(size: 28, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color.sgWhite)
                }

                VStack(spacing: 4) {
                    Image(systemName: "airplane")
                        .font(.system(size: 16))
                        .foregroundStyle(Color.sgYellow)
                    if !booking.airline.isEmpty {
                        Text(booking.airline)
                            .font(SGFont.body(size: 10))
                            .foregroundStyle(Color.sgMuted)
                    }
                }

                VStack(spacing: 2) {
                    Text(booking.destinationIata)
                        .font(.system(size: 28, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color.sgYellow)
                    Text(booking.destinationCity)
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                }
            }

            // Status badge
            let info = booking.statusInfo
            let color: Color = {
                switch info.color {
                case "green": return Color.sgGreen
                case "red": return Color.sgRed
                case "yellow": return Color.sgYellow
                default: return Color.sgMuted
                }
            }()

            Text(info.label)
                .font(SGFont.bodyBold(size: 12))
                .foregroundStyle(color)
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: Radius.md))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.md)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(booking.originIata) to \(booking.destinationIata), \(booking.destinationCity), \(booking.statusInfo.label)")
    }

    // MARK: - Booking Reference

    private var bookingReferenceCard: some View {
        VStack(spacing: Spacing.sm) {
            Text("BOOKING REFERENCE")
                .font(SGFont.bodyBold(size: 10))
                .foregroundStyle(Color.sgMuted)
                .tracking(1.5)

            Text(booking.bookingReference.isEmpty ? "Pending" : booking.bookingReference)
                .font(.system(size: 32, weight: .bold, design: .monospaced))
                .foregroundStyle(Color.sgWhite)
                .textSelection(.enabled)
                .accessibilityLabel(String(localized: "boarding.reference_value", defaultValue: "Booking reference \(booking.bookingReference.isEmpty ? "pending" : booking.bookingReference)"))

            if !booking.bookingReference.isEmpty {
                Button {
                    UIPasteboard.general.string = booking.bookingReference
                    copiedReference = true
                    HapticEngine.success()
                    copyResetTask?.cancel()
                    copyResetTask = Task {
                        try? await Task.sleep(for: .seconds(2))
                        guard !Task.isCancelled else { return }
                        copiedReference = false
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: copiedReference ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 11))
                        Text(copiedReference ? "Copied!" : "Copy")
                            .font(SGFont.bodyBold(size: 12))
                    }
                    .foregroundStyle(Color.sgYellow)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(copiedReference ? String(localized: "booking.reference_copied", defaultValue: "Copied booking reference") : String(localized: "booking.copy_reference", defaultValue: "Copy booking reference"))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.lg)
        .background(Color.sgWhite.opacity(0.04), in: RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    // MARK: - Flight Details

    private var flightDetailsSection: some View {
        detailSection("Flight Details") {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                detailRow(icon: "calendar", label: "Departure", value: booking.formattedDepartureDate)

                if let returnDate = booking.formattedReturnDate {
                    detailRow(icon: "calendar.badge.clock", label: "Return", value: returnDate)
                }

                if !booking.airline.isEmpty {
                    detailRow(icon: "airplane", label: "Airline", value: booking.airline)
                }

                detailRow(icon: "person.2", label: "Passengers", value: "\(booking.passengerCount)")
            }
        }
    }

    // MARK: - Passengers

    private var passengersSection: some View {
        Group {
            if !booking.passengers.isEmpty {
                detailSection("Passengers") {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        ForEach(Array(booking.passengers.enumerated()), id: \.offset) { _, pax in
                            HStack(spacing: 8) {
                                Image(systemName: "person.fill")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.sgYellow)
                                    .frame(width: 20)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text("\(pax.givenName) \(pax.familyName)")
                                        .font(SGFont.bodyBold(size: 14))
                                        .foregroundStyle(Color.sgWhite)
                                    Text(pax.email)
                                        .font(SGFont.body(size: 12))
                                        .foregroundStyle(Color.sgMuted)
                                }
                            }
                            .accessibilityElement(children: .combine)
                            .accessibilityLabel("Passenger: \(pax.givenName) \(pax.familyName), \(pax.email)")
                        }
                    }
                }
            }
        }
    }

    // MARK: - Payment

    private var paymentSection: some View {
        detailSection("Payment") {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack {
                    Text("Total Paid")
                        .font(SGFont.body(size: 14))
                        .foregroundStyle(Color.sgMuted)
                    Spacer()
                    Text(booking.formattedPrice)
                        .font(SGFont.bodyBold(size: 18))
                        .foregroundStyle(Color.sgGreen)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Total paid: \(booking.formattedPrice)")
            }
        }
    }

    // MARK: - Support

    private var supportSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Button {
                if let url = URL(string: "mailto:hello@sogojet.com?subject=Booking%20\(booking.bookingReference)") {
                    UIApplication.shared.open(url)
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "envelope")
                        .font(.system(size: 14))
                    Text("Contact Support")
                        .font(SGFont.bodyBold(size: 14))
                }
                .foregroundStyle(Color.sgYellow)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.sgYellow.opacity(0.12), in: RoundedRectangle(cornerRadius: Radius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md)
                        .strokeBorder(Color.sgYellow.opacity(0.28), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel(String(localized: "booking.contact_support", defaultValue: "Contact support about booking \(booking.bookingReference)"))
        }
    }

    // MARK: - Helpers

    private func detailSection<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title.uppercased())
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgMuted)
                .tracking(1.2)

            VStack(alignment: .leading, spacing: Spacing.sm) {
                content()
            }
            .padding(Spacing.md)
            .background(Color.sgWhite.opacity(0.04), in: RoundedRectangle(cornerRadius: Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.lg)
                    .strokeBorder(Color.sgBorder, lineWidth: 1)
            )
        }
    }

    private func detailRow(icon: String, label: String, value: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(Color.sgMuted)
                .frame(width: 20)
            Text(label)
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgMuted)
            Spacer()
            Text(value)
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgWhite)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(value)")
    }
}
