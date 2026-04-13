import SwiftUI
import CoreImage
import CoreImage.CIFilterBuiltins

// MARK: - BoardingPass (Animated Confirmation)
//
// Full-screen animated boarding pass overlay. Shown when the booking reaches
// the .confirmed state. Sequence:
//   1. Ticket translates down from -300pt to 0 with SGCurve.pageTurn.
//   2. SplitFlapText cells flap in: flight number then route.
//   3. QR code strokes on via Canvas mask animating 0→1 over SGDuration.slow.
//   4. Haptic: runway() as the ticket arrives → boardingPass() at QR completion.
//   5. "Save to Wallet" + "Done" appear from below.
// Reduce Motion: fade-in + single haptic; no translation or QR stroke-on.

struct BoardingPass: View {
    @Environment(BookingStore.self) private var store
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var onDone: () -> Void = {}
    var onShare: () -> Void = {}

    // MARK: Animation state

    @State private var ticketOffset: CGFloat = -350
    @State private var ticketOpacity: Double = 0
    @State private var qrProgress: Double = 0
    @State private var actionsOpacity: Double = 0
    @State private var flapAnimationID: Int = 0
    @State private var hasAnimated = false

    var body: some View {
        ZStack {
            // Scrim
            Color.sgBg
                .opacity(0.96)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Ticket
                ticketView
                    .offset(y: ticketOffset)
                    .opacity(ticketOpacity)

                Spacer().frame(height: Spacing.lg)

                // CTAs
                actionCluster
                    .opacity(actionsOpacity)
                    .padding(.horizontal, Spacing.lg)
            }
            .padding(.top, Spacing.xl)
        }
        .onAppear {
            guard !hasAnimated else { return }
            hasAnimated = true
            runEntrance()
        }
    }

    // MARK: - Entrance choreography

    private func runEntrance() {
        if reduceMotion {
            // Single fade, single haptic
            withAnimation(.easeOut(duration: SGDuration.base)) {
                ticketOffset = 0
                ticketOpacity = 1
                qrProgress = 1
                actionsOpacity = 1
            }
            HapticEngine.boardingPass()
            return
        }

        // Phase 1: ticket arrives
        withAnimation(SGCurve.pageTurn.respectingReduceMotion()) {
            ticketOffset = 0
            ticketOpacity = 1
        }
        HapticEngine.runway()

        // Phase 2: flap cells
        DispatchQueue.main.asyncAfter(deadline: .now() + SGDuration.slow * 0.4) {
            flapAnimationID += 1
        }

        // Phase 3: QR stroke-on
        DispatchQueue.main.asyncAfter(deadline: .now() + SGDuration.slow * 0.7) {
            withAnimation(.linear(duration: SGDuration.slow)) {
                qrProgress = 1.0
            }
        }

        // Phase 4: boarding pass stamp haptic at QR completion
        DispatchQueue.main.asyncAfter(deadline: .now() + SGDuration.slow * 0.7 + SGDuration.slow) {
            HapticEngine.boardingPass()
        }

        // Phase 5: actions appear
        DispatchQueue.main.asyncAfter(deadline: .now() + SGDuration.slow + SGDuration.base) {
            withAnimation(SGSpring.bouncy.respectingReduceMotion()) {
                actionsOpacity = 1
            }
        }
    }

    // MARK: - Ticket

    private var ticketView: some View {
        VStack(spacing: 0) {
            // Main body
            ticketBody
                .overlay(PaperTexture(intensity: 0.04))

            // Perforation divider
            perforationDivider

            // Stub
            ticketStub
                .overlay(PaperTexture(intensity: 0.04))
        }
        .clipShape(RoundedRectangle(cornerRadius: Radius.xl, style: .continuous))
        .sgShadow(.hero)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.xl, style: .continuous)
                .strokeBorder(Color.sgHairline, lineWidth: 0.5)
        )
        .padding(.horizontal, Spacing.lg)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Boarding pass for \(flightNumberString) from \(originCode) to \(destinationCode)")
    }

    private var ticketBody: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Header row
            HStack(alignment: .top) {
                // Airline / brand
                VStack(alignment: .leading, spacing: 2) {
                    Text("SOGOJET")
                        .font(SGFont.bodyBold(size: 10))
                        .foregroundStyle(Color.sgMuted)
                        .tracking(2)

                    SplitFlapText(
                        text: flightNumberString,
                        style: .ticker,
                        animate: true,
                        startDelay: 0,
                        animationID: flapAnimationID
                    )
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text("BOARDING PASS")
                        .font(SGFont.bodyBold(size: 9))
                        .foregroundStyle(Color.sgYellow)
                        .tracking(1.5)

                    Text(bookingReference)
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color.sgWhiteDim)
                }
            }

            // Route display
            HStack(alignment: .center, spacing: 0) {
                // Origin
                VStack(alignment: .leading, spacing: 4) {
                    SplitFlapText(
                        text: originCode,
                        style: .headline,
                        maxLength: 3,
                        animate: true,
                        startDelay: 0.1,
                        animationID: flapAnimationID
                    )
                    Text(originCity)
                        .font(SGFont.body(size: 11))
                        .foregroundStyle(Color.sgMuted)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Flight path arc
                flightArc

                // Destination
                VStack(alignment: .trailing, spacing: 4) {
                    SplitFlapText(
                        text: destinationCode,
                        style: .headline,
                        maxLength: 3,
                        animate: true,
                        startDelay: 0.2,
                        animationID: flapAnimationID
                    )
                    Text(destinationCity)
                        .font(SGFont.body(size: 11))
                        .foregroundStyle(Color.sgMuted)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
            }

            // QR code with stroke-on animation
            qrCodeSection
        }
        .padding(Spacing.lg)
        .background(Color.sgSurfaceHigh)
    }

    private var flightArc: some View {
        VStack(spacing: 4) {
            Image(systemName: "airplane")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Color.sgYellow)
                .rotationEffect(.degrees(0))
            Text(flightDuration)
                .font(SGFont.body(size: 10))
                .foregroundStyle(Color.sgMuted)
        }
        .frame(width: 60)
    }

    // MARK: - QR Code

    private var qrCodeSection: some View {
        HStack(alignment: .top, spacing: Spacing.lg) {
            // QR with stroke-on canvas mask
            ZStack {
                if let qrImage = generateQRImage(for: bookingReference) {
                    Image(decorative: qrImage, scale: 1.0, orientation: .up)
                        .interpolation(.none)
                        .resizable()
                        .frame(width: 100, height: 100)
                        .colorMultiply(Color.sgWhite)
                        .mask(
                            Canvas { context, size in
                                let progress = qrProgress
                                let rect = CGRect(origin: .zero, size: CGSize(
                                    width: size.width,
                                    height: size.height * progress
                                ))
                                context.fill(Path(rect), with: .color(.white))
                            }
                        )
                        .accessibilityLabel("QR code for booking reference \(bookingReference)")
                } else {
                    RoundedRectangle(cornerRadius: Radius.sm)
                        .fill(Color.sgSurface)
                        .frame(width: 100, height: 100)
                        .runwayShimmer(active: qrProgress < 1)
                }
            }

            // Fare + date info
            VStack(alignment: .leading, spacing: Spacing.sm) {
                infoCell(label: "DATE", value: departureDateLabel)
                infoCell(label: "RETURN", value: returnDateLabel)
                infoCell(label: "TOTAL", value: totalPaidLabel)
            }
        }
    }

    private func infoCell(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(SGFont.bodyBold(size: 9))
                .foregroundStyle(Color.sgMuted)
                .tracking(1)
            Text(value)
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(Color.sgWhite)
        }
    }

    // MARK: - Perforation

    private var perforationDivider: some View {
        ZStack {
            Rectangle()
                .fill(Color.sgBg)
                .frame(height: 1)

            // Perforation teeth: alternating notches
            GeometryReader { geo in
                HStack(spacing: 0) {
                    ForEach(0..<Int(geo.size.width / 8), id: \.self) { i in
                        Circle()
                            .fill(Color.sgBg)
                            .frame(width: 8, height: 8)
                    }
                }
                .frame(maxWidth: .infinity)
                .offset(y: -4)
            }
            .frame(height: 8)
        }
        .background(Color.sgSurfaceElevated)
    }

    // MARK: - Stub

    private var ticketStub: some View {
        HStack(spacing: Spacing.lg) {
            stubCell(label: "SEAT", value: seatLabel)
            stubCell(label: "CABIN", value: cabinLabel)
            stubCell(label: "PAX", value: passengerShortName)

            Spacer()

            // Status stamp
            VStack(spacing: 2) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(Color.sgYellow)
                Text("CONFIRMED")
                    .font(SGFont.bodyBold(size: 8))
                    .foregroundStyle(Color.sgYellow)
                    .tracking(1.2)
            }
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.vertical, Spacing.md)
        .background(Color.sgSurfaceElevated)
    }

    private func stubCell(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(SGFont.bodyBold(size: 8))
                .foregroundStyle(Color.sgMuted)
                .tracking(1)
            SplitFlapText(
                text: value,
                style: .tag,
                maxLength: 8,
                animate: true,
                startDelay: 0.3,
                animationID: flapAnimationID
            )
        }
    }

    // MARK: - Actions

    private var actionCluster: some View {
        VStack(spacing: Spacing.sm) {
            SGButton(action: onShare, style: .secondary, size: .regular) {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "square.and.arrow.up")
                    Text("Save to Wallet / Share")
                }
            }

            SGButton(action: onDone, style: .ghost, size: .compact) {
                Text("Done")
            }
        }
    }

    // MARK: - Computed props from BookingStore

    private var bookingReference: String {
        if case .confirmed(let ref) = store.step { return ref }
        return store.bookingOrder?.bookingReference ?? "PENDING"
    }

    private var flightNumberString: String {
        store.selectedOffer?.flightNumber.isEmpty == false
            ? (store.selectedOffer?.flightNumber ?? "FLIGHT")
            : "FLIGHT"
    }

    private var originCode: String {
        store.searchOrigin ?? settingsStore.departureCode
    }

    private var destinationCode: String {
        store.searchDestination ?? store.deal?.iataCode ?? "DST"
    }

    private var originCity: String {
        settingsStore.departureCity
    }

    private var destinationCity: String {
        store.deal?.destination ?? "Destination"
    }

    private var flightDuration: String {
        store.selectedOffer?.duration ?? store.deal?.safeFlightDuration ?? "—"
    }

    private var seatLabel: String {
        store.bookingOrder?.passengers.first?.seatDesignator ?? store.selectedSeatId ?? "TBD"
    }

    private var cabinLabel: String {
        guard let raw = store.selectedOffer?.cabinClass,
              let cabin = BookingCabinClass(rawValue: raw) else { return "ECO" }
        return String(cabin.displayName.prefix(3)).uppercased()
    }

    private var passengerShortName: String {
        let last = store.passenger.lastName.trimmingCharacters(in: .whitespaces)
        return last.isEmpty ? "PAX" : String(last.prefix(6)).uppercased()
    }

    private var departureDateLabel: String {
        formatDate(store.searchDepartureDate ?? store.deal?.bestDepartureDate)
    }

    private var returnDateLabel: String {
        formatDate(store.searchReturnDate ?? store.deal?.bestReturnDate)
    }

    private var totalPaidLabel: String {
        if let order = store.bookingOrder {
            let fmt = NumberFormatter()
            fmt.numberStyle = .currency
            fmt.currencyCode = order.currency
            fmt.maximumFractionDigits = 0
            return fmt.string(from: NSNumber(value: order.totalPaid)) ?? "$\(Int(order.totalPaid))"
        }
        let amount = store.totalPrice
        if amount > 0 { return "$\(Int(amount))" }
        if let price = store.deal?.displayPrice { return "$\(Int(price))" }
        return "—"
    }

    private func formatDate(_ s: String?) -> String {
        guard let s else { return "—" }
        let iso = ISO8601DateFormatter()
        let ymd = DateFormatter()
        ymd.dateFormat = "yyyy-MM-dd"
        ymd.locale = Locale(identifier: "en_US_POSIX")
        guard let date = iso.date(from: s) ?? ymd.date(from: s) else { return s }
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_US")
        out.dateFormat = "MMM d"
        return out.string(from: date)
    }

    // MARK: - QR generation

    private func generateQRImage(for string: String) -> CGImage? {
        guard !string.isEmpty, string != "PENDING" else { return nil }
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }

        let context = CIContext()
        let scale = 3.0
        let transform = CGAffineTransform(scaleX: scale, y: scale)
        let scaled = output.transformed(by: transform)
        return context.createCGImage(scaled, from: scaled.extent)
    }
}

// MARK: - Preview

#Preview("BoardingPass") {
    let store = BookingStore()
    return BoardingPass(
        onDone: {},
        onShare: {}
    )
    .environment(store)
    .environment(SettingsStore())
    .background(Color.sgBg)
}
