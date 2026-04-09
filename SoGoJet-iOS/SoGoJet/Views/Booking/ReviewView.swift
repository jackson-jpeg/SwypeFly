import SwiftUI
import LocalAuthentication
import AuthenticationServices
import StripePaymentSheet

struct ReviewView: View {
    @Environment(BookingStore.self) private var store
    @Environment(AuthStore.self) private var auth

    @State private var showSignInSheet = false
    @State private var isPreparingPayment = false
    /// When true, automatically proceed to payment after sign-in completes.
    @State private var proceedAfterSignIn = false

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
        .sheet(isPresented: $showSignInSheet) {
            BookingSignInSheet()
        }
        .onChange(of: auth.isAuthenticated) { _, isAuth in
            if isAuth, proceedAfterSignIn {
                proceedAfterSignIn = false
                showSignInSheet = false
                // Small delay to let the sheet dismiss before starting biometric auth
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(400))
                    authenticateAndPay()
                }
            }
        }
    }

    private var reviewContent: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                header
                offerExpirationBanner
                checkoutTicket

                if let paymentError = store.paymentError {
                    paymentErrorBanner(paymentError)
                }

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
                eyebrow: String(localized: "review.title"),
                title: String(localized: "review.confirming_booking"),
                subtitle: String(localized: "review.confirming_subtitle")
            )
            .padding(.horizontal, Spacing.md)
            .padding(.top, Spacing.lg)

            VintageTravelTicket(tone: .amber) {
                HStack {
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        VintageTerminalSectionLabel(text: String(localized: "review.processing"), tone: .amber)
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
                Text(String(localized: "review.payment_processing_warning"))
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgWhiteDim)
                    .fixedSize(horizontal: false, vertical: true)
            } footer: {
                HStack {
                    VintageTerminalCaptionBlock(title: "Status", value: String(localized: "review.status_processing"), tone: .amber)
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
                title: String(localized: "review.order_summary"),
                subtitle: String(localized: "review.order_summary.subtitle")
            )
            .padding(.top, Spacing.sm)
        }
    }

    private var checkoutTicket: some View {
        VintageTravelTicket(tone: .amber) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    VintageTerminalSectionLabel(text: String(localized: "review.trip_summary"), tone: .amber)
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

    private func paymentErrorBanner(_ message: String) -> some View {
        VStack(spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.sgOrange)
                Text(String(localized: "review.payment_failed"))
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgOrange)
                Spacer()
            }
            Text(message)
                .font(SGFont.bodyDefault)
                .foregroundStyle(Color.sgMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(String(localized: "review.card_not_charged"))
                .font(SGFont.caption)
                .foregroundStyle(Color.sgFaint)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.md)
        .background(Color.sgOrange.opacity(0.1), in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(Color.sgOrange.opacity(0.3), lineWidth: 1)
        )
    }

    private func discrepancyDeck(_ discrepancy: PriceDiscrepancy) -> some View {
        VintageTerminalPanel(
            title: String(localized: "review.live_fare_change"),
            subtitle: discrepancy.message,
            stamp: "\(discrepancy.percentDiff)%",
            tone: .ember
        ) {
            HStack(spacing: Spacing.sm) {
                VintageTerminalMetricDeck(metrics: [
                    .init(title: String(localized: "review.feed_fare"), value: "$\(Int(discrepancy.feedPrice.rounded()))", footnote: String(localized: "review.original_price"), tone: .ivory),
                    .init(title: String(localized: "review.booking_fare"), value: "$\(Int(discrepancy.bookingPrice.rounded()))", footnote: String(localized: "review.current_live_rate"), tone: .amber),
                ])
            }
        }
    }

    private var flightManifest: some View {
        VintageTerminalManifestCard(
            title: String(localized: "review.flight_details"),
            subtitle: String(localized: "review.flight_details.subtitle"),
            tone: .ivory
        ) {
            if let outbound = offer?.outboundSlice {
                sliceManifestSection(prefix: "OUT", slice: outbound, date: store.searchDepartureDate)
            }
            if offer?.outboundSlice != nil, offer?.returnSlice != nil {
                manifestDivider
            }
            if let inbound = offer?.returnSlice {
                sliceManifestSection(prefix: "RTN", slice: inbound, date: store.searchReturnDate)
            }
            if let offer {
                manifestDivider
                VintageTerminalManifestRow(
                    prefix: "FLT",
                    title: offer.airline,
                    value: "\(offer.flightNumber)  |  \(offer.duration)",
                    subtitle: offer.stops == 0 ? String(localized: "review.nonstop") : String(format: String(localized: "review.stops"), offer.stops),
                    tone: .amber
                )
            }

            // Baggage info
            if let baggageList = offer?.baggageIncluded, !baggageList.isEmpty {
                manifestDivider
                baggageInfoRow(baggageList)
            }

            // Meal info
            if let meal = offer?.mealInfo {
                manifestDivider
                mealInfoRow(meal)
            }

            // Booking conditions
            if let conditions = offer?.conditions {
                manifestDivider
                conditionsInfoRow(conditions)
            }
        }
    }

    /// Show per-segment breakdown for a slice, or fall back to the simple row.
    @ViewBuilder
    private func sliceManifestSection(prefix: String, slice: FlightSlice, date: String?) -> some View {
        if let segments = slice.segments, segments.count > 1 {
            // Multi-segment: show each segment with layover info
            ForEach(Array(segments.enumerated()), id: \.element.id) { index, segment in
                if index > 0 {
                    // Layover indicator between segments
                    let prevSegment = segments[index - 1]
                    let layoverText = computeLayover(
                        arriving: prevSegment.arrivalTime,
                        departing: segment.departureTime,
                        cityName: prevSegment.destinationCityName.isEmpty ? prevSegment.destination : prevSegment.destinationCityName
                    )
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "clock")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Color.sgOrange)
                        Text(layoverText)
                            .font(SGFont.body(size: 11))
                            .foregroundStyle(Color.sgOrange)
                        Spacer()
                    }
                    .padding(.vertical, Spacing.xs)
                }

                VintageTerminalManifestRow(
                    prefix: index == 0 ? prefix : "LEG",
                    title: "\(segment.origin) to \(segment.destination)",
                    value: "\(segment.departureTime.shortDateTime) \u{2192} \(segment.arrivalTime.shortTime)",
                    subtitle: [date?.shortDate, Optional(segment.aircraft), Optional(segment.airline)].compactMap { (str: String?) -> String? in
                        guard let s = str, !s.isEmpty else { return nil }
                        return s
                    }.joined(separator: "  |  "),
                    tone: .amber
                )
            }
        } else {
            // Single segment or no segment data — use existing simple row
            flightSliceRow(prefix: prefix, slice: slice, date: date)

            // Show aircraft from segment if available
            if let segments = slice.segments, let seg = segments.first, !seg.aircraft.isEmpty {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "airplane")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.sgMuted)
                    Text(seg.aircraft)
                        .font(SGFont.body(size: 11))
                        .foregroundStyle(Color.sgMuted)
                    Spacer()
                }
                .padding(.vertical, Spacing.xs)
            }
        }
    }

    private func baggageInfoRow(_ baggageList: [BaggageInfo]) -> some View {
        let carryOn = baggageList.filter { $0.type == "carry_on" }
        let checked = baggageList.filter { $0.type == "checked" }
        let hasChecked = checked.contains { $0.quantity > 0 }

        let description: String = {
            if hasChecked {
                let total = checked.reduce(0) { $0 + $1.quantity }
                return "Includes \(total) checked bag\(total > 1 ? "s" : "")"
            }
            return "No checked baggage included"
        }()

        let subtitle: String? = {
            let carryOnCount = carryOn.reduce(0) { $0 + $1.quantity }
            return carryOnCount > 0 ? "\(carryOnCount) cabin bag\(carryOnCount > 1 ? "s" : "") included" : nil
        }()

        return VintageTerminalManifestRow(
            prefix: "BAG",
            title: hasChecked ? String(localized: "review.checked_baggage") : String(localized: "review.carry_on_only"),
            value: description,
            subtitle: subtitle,
            tone: hasChecked ? .moss : .ivory
        )
    }

    private func mealInfoRow(_ meal: MealInfo) -> some View {
        let displayName: String = {
            if let name = meal.name, !name.isEmpty { return name }
            switch meal.rank?.lowercased() {
            case "meal": return String(localized: "review.meal_included")
            case "snack", "refreshment": return String(localized: "review.refreshments")
            default: return String(localized: "review.no_meal")
            }
        }()
        let rankLower = meal.rank?.lowercased()
        let hasMeal = rankLower != nil && rankLower != "none" && rankLower != ""

        return VintageTerminalManifestRow(
            prefix: "MEAL",
            title: String(localized: "review.meal_service"),
            value: displayName,
            tone: hasMeal ? .moss : .ivory
        )
    }

    private func conditionsInfoRow(_ conditions: BookingConditions) -> some View {
        let refundText: String = {
            if conditions.refundable == true {
                if let penalty = conditions.refundPenalty, !penalty.isEmpty {
                    return "Refundable (\(penalty) fee)"
                }
                return String(localized: "review.fully_refundable")
            }
            return String(localized: "review.non_refundable")
        }()
        let changeText: String? = {
            guard let changeable = conditions.changeable else { return nil }
            if changeable {
                if let penalty = conditions.changePenalty, !penalty.isEmpty {
                    return "Changeable (\(penalty) fee)"
                }
                return String(localized: "review.free_changes")
            }
            return String(localized: "review.no_changes")
        }()

        return VintageTerminalManifestRow(
            prefix: "COND",
            title: String(localized: "review.booking_conditions"),
            value: refundText,
            subtitle: changeText,
            tone: conditions.refundable == true ? .moss : .ember
        )
    }

    /// Compute layover duration between two ISO time strings.
    private func computeLayover(arriving: String, departing: String, cityName: String) -> String {
        let isoFmt = ISO8601DateFormatter()
        let noTzFmt = DateFormatter()
        noTzFmt.locale = Locale(identifier: "en_US_POSIX")
        noTzFmt.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"

        let arrDate = isoFmt.date(from: arriving) ?? noTzFmt.date(from: arriving)
        let depDate = isoFmt.date(from: departing) ?? noTzFmt.date(from: departing)

        guard let arr = arrDate, let dep = depDate else {
            return "Layover in \(cityName)"
        }

        let minutes = Int(dep.timeIntervalSince(arr) / 60)
        let hours = minutes / 60
        let mins = minutes % 60

        if hours > 0 && mins > 0 {
            return "\(hours)h \(mins)m layover in \(cityName)"
        } else if hours > 0 {
            return "\(hours)h layover in \(cityName)"
        } else {
            return "\(mins)m layover in \(cityName)"
        }
    }

    private var travelerManifest: some View {
        VintageTerminalManifestCard(
            title: String(localized: "review.passenger"),
            subtitle: String(localized: "review.passenger.subtitle"),
            tone: .moss
        ) {
            VintageTerminalManifestRow(
                prefix: "Name",
                title: travelerName,
                value: store.passenger.email,
                subtitle: store.passenger.phone,
                tone: .moss
            )
            manifestDivider
            VintageTerminalManifestRow(
                prefix: "ID",
                title: store.passenger.passportNumber.isEmpty ? String(localized: "review.passport_pending") : store.passenger.passportNumber,
                value: store.passenger.nationality.isEmpty ? "US" : store.passenger.nationality,
                subtitle: store.passenger.passportExpiry.isEmpty ? String(localized: "review.expiry_pending") : "Expires \(store.passenger.passportExpiry.shortDate)",
                tone: .ivory
            )
        }
    }

    private var fareLedger: some View {
        VintageTerminalPanel(
            title: String(localized: "review.price_breakdown"),
            subtitle: String(localized: "review.price_breakdown.subtitle"),
            stamp: totalLabel,
            tone: .amber
        ) {
            VStack(spacing: 0) {
                lineItem(label: store.passengerCount > 1 ? String(format: String(localized: "review.base_fare_multiple"), store.passengerCount) : String(localized: "review.base_fare"), amount: offer?.price)
                manifestDivider

                if let seatPrice = selectedSeatPrice {
                    lineItem(label: "Seat \(selectedSeatLabel)", amount: seatPrice)
                    manifestDivider
                }

                lineItem(label: String(localized: "review.taxes_fees"), note: String(localized: "review.taxes_included"))
                manifestDivider
                lineItem(label: String(localized: "review.cabin"), note: cabinLabel)
            }
        }
    }

    private var confirmationNotes: some View {
        VintageTerminalPanel(
            title: String(localized: "review.before_you_pay"),
            subtitle: "",
            stamp: "Ready",
            tone: .ember
        ) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                VintageTerminalChecklistItem(
                    title: String(localized: "review.note_price"),
                    detail: String(localized: "review.note_price_detail"),
                    tone: .amber
                )
                VintageTerminalChecklistItem(
                    title: String(localized: "review.note_seats"),
                    detail: String(localized: "review.note_seats_detail"),
                    tone: .ivory
                )
                VintageTerminalChecklistItem(
                    title: String(localized: "review.note_back"),
                    detail: String(localized: "review.note_back_detail"),
                    tone: .moss
                )
            }
        }
    }

    /// Authenticate with Face ID / Touch ID / passcode before confirming payment.
    private func handlePaymentResult(_ result: PaymentSheetResult) {
        switch result {
        case .completed:
            HapticEngine.success()
            store.step = .paying
            Task {
                await store.completeBookingAfterPayment()
            }
        case .canceled:
            // User dismissed the payment sheet — no action needed
            break
        case .failed(let error):
            HapticEngine.error()
            store.paymentError = userFacingPaymentMessage(for: error)
        }
    }

    /// Convert Stripe / payment errors into user-friendly messages.
    private func userFacingPaymentMessage(for error: Error) -> String {
        let message = error.localizedDescription.lowercased()

        // Card declined (Stripe surfaces these as localized strings)
        if message.contains("declined") || message.contains("insufficient funds")
            || message.contains("do not honor") {
            return "Your card was declined. Please check your card details or try a different payment method."
        }

        // Authentication required (3D Secure, etc.)
        if message.contains("authentication") || message.contains("3d secure") {
            return "Additional card verification is required. Please try again and complete the verification step."
        }

        // Expired card
        if message.contains("expired") {
            return "Your card appears to be expired. Please use a different card."
        }

        // Network / connectivity
        if message.contains("network") || message.contains("internet")
            || message.contains("connection") || error is URLError {
            return "A network error occurred during payment. Your card was not charged. Please check your connection and try again."
        }

        // Generic server error
        if message.contains("server") || message.contains("500") || message.contains("unavailable") {
            return "The payment service is temporarily unavailable. Your card was not charged. Please try again in a moment."
        }

        // Fallback — still reassure the user
        return "Payment could not be completed. Your card was not charged. Please try again or use a different payment method."
    }

    private func authenticateAndPay() {
        // Check remote config — admin can disable bookings without an app update
        guard RemoteConfig.shared.bookingEnabled else {
            store.paymentError = String(localized: "review.booking_unavailable")
            return
        }

        // Guest users can sign in right here — no need to leave the booking flow
        guard auth.isAuthenticated else {
            proceedAfterSignIn = true
            showSignInSheet = true
            return
        }

        // Biometric / passcode verification before payment
        let context = LAContext()
        var authError: NSError?

        if context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &authError) {
            context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: String(localized: "review.verify_identity")
            ) { success, _ in
                Task { @MainActor in
                    if success {
                        self.startPaymentPreparation()
                    }
                    // User canceled or failed — don't proceed (no error shown, they can retry)
                }
            }
        } else {
            // Device has no biometrics or passcode — proceed directly
            startPaymentPreparation()
        }
    }

    private func startPaymentPreparation() {
        isPreparingPayment = true
        Task {
            await store.preparePayment()
            isPreparingPayment = false
        }
    }

    @ViewBuilder
    private var offerExpirationBanner: some View {
        if store.isOfferExpired {
            // Expired state
            VStack(spacing: Spacing.sm) {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "clock.badge.xmark")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.sgRed)
                    Text(String(localized: "review.offer_expired_title"))
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgRed)
                    Spacer()
                }
                Text(String(localized: "review.offer_expired_message"))
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Button {
                    Task { await store.retryLastSearch() }
                } label: {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 12, weight: .semibold))
                        Text(String(localized: "review.search_again"))
                            .font(SGFont.bodyBold(size: 13))
                    }
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.sgOrange, in: RoundedRectangle(cornerRadius: Radius.sm))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Search for flights again")
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(Spacing.md)
            .background(Color.sgRed.opacity(0.1), in: RoundedRectangle(cornerRadius: Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .strokeBorder(Color.sgRed.opacity(0.3), lineWidth: 1)
            )
        } else if let countdown = store.offerCountdownLabel {
            // Active countdown
            let isUrgent = (store.offerSecondsRemaining ?? .infinity) <= 300
            let accentColor = isUrgent ? Color.sgRed : Color.sgYellow

            HStack(spacing: Spacing.sm) {
                Image(systemName: "clock")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(accentColor)
                Text(String(localized: "review.offer_expires_in"))
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgWhiteDim)
                Text(countdown)
                    .font(SGFont.bodyBold(size: 15))
                    .foregroundStyle(accentColor)
                    .monospacedDigit()
                    .contentTransition(.numericText())
                Spacer()
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm)
            .background(accentColor.opacity(0.08), in: RoundedRectangle(cornerRadius: Radius.sm))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .strokeBorder(accentColor.opacity(0.25), lineWidth: 1)
            )
        }
    }

    private var actionCluster: some View {
        VStack(spacing: Spacing.sm) {
            if store.isOfferExpired {
                Button {
                    Task { await store.retryLastSearch() }
                } label: {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 14, weight: .semibold))
                        Text(String(localized: "review.search_fresh"))
                            .font(SGFont.bodyBold(size: 16))
                        Spacer()
                    }
                    .foregroundStyle(Color.sgBg)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.md)
                    .background(Color.sgOrange, in: RoundedRectangle(cornerRadius: Radius.md))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Search for flights again")
            } else if store.step == .paying {
                HStack(spacing: Spacing.sm) {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(Color.sgYellow)
                    Text(String(localized: "review.processing_booking"))
                        .font(SGFont.bodyBold(size: 16))
                    Spacer()
                }
                .foregroundStyle(Color.sgBg)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.md)
                .background(Color.sgYellow.opacity(0.5), in: RoundedRectangle(cornerRadius: Radius.md))
            } else if isPreparingPayment {
                HStack(spacing: Spacing.sm) {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(Color.sgYellow)
                    Text(String(localized: "review.preparing_payment"))
                        .font(SGFont.bodyBold(size: 16))
                    Spacer()
                }
                .foregroundStyle(Color.sgBg)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.md)
                .background(Color.sgYellow.opacity(0.3), in: RoundedRectangle(cornerRadius: Radius.md))
            } else if let paymentSheet = store.paymentSheet {
                // Stripe PaymentSheet button — card collection happens here
                PaymentSheet.PaymentButton(paymentSheet: paymentSheet, onCompletion: handlePaymentResult) {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "creditcard")
                            .font(.system(size: 14, weight: .semibold))
                        Text("Pay \(totalLabel)")
                            .font(SGFont.bodyBold(size: 16))
                        Spacer()
                        Image(systemName: "lock.fill")
                            .font(.system(size: 11, weight: .semibold))
                        Text(String(localized: "review.secure"))
                            .font(SGFont.bodyBold(size: 11))
                    }
                    .foregroundStyle(Color.sgBg)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.md)
                    .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Pay \(totalLabel) for flight to \(store.deal?.destination ?? "destination")")
                .accessibilityHint("Opens secure payment form")
                .disabled(offer == nil || store.isOfferExpired)
            } else {
                // No payment sheet yet — show button to prepare payment
                Button {
                    authenticateAndPay()
                } label: {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "creditcard")
                            .font(.system(size: 14, weight: .semibold))
                        Text("Pay \(totalLabel)")
                            .font(SGFont.bodyBold(size: 16))
                        Spacer()
                        Image(systemName: "lock.fill")
                            .font(.system(size: 11, weight: .semibold))
                        Text(String(localized: "review.secure"))
                            .font(SGFont.bodyBold(size: 11))
                    }
                    .foregroundStyle(Color.sgBg)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.md)
                    .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Pay \(totalLabel) for flight to \(store.deal?.destination ?? "destination")")
                .accessibilityHint("Verifies your identity, then opens secure payment")
                .disabled(offer == nil || store.isOfferExpired)
            }

            VintageTerminalSecondaryButton(
                title: store.seatMap == nil ? String(localized: "review.back_to_traveler") : String(localized: "review.back_to_seats"),
                subtitle: String(localized: "review.back_subtitle"),
                icon: "arrow.uturn.backward",
                tone: .ivory,
                fillsWidth: true
            ) {
                store.goBack()
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
        guard let seatId = store.selectedSeatId else { return String(localized: "review.assigned_later") }
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
        return combined.isEmpty ? "Passenger" : combined
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

// MARK: - Inline Sign-In Sheet (shown during booking)

/// Compact sign-in sheet that lets guests authenticate without leaving the booking flow.
/// All progress (passenger details, seat selection, etc.) is preserved.
private struct BookingSignInSheet: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            // Drag handle
            Capsule()
                .fill(Color.sgBorder)
                .frame(width: 36, height: 5)
                .padding(.top, Spacing.md)

            VStack(spacing: Spacing.sm) {
                Image(systemName: "person.badge.shield.checkmark.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(Color.sgYellow)
                    .padding(.top, Spacing.lg)

                Text(String(localized: "auth.sign_in_to_pay"))
                    .font(SGFont.display(size: 24))
                    .foregroundStyle(Color.sgWhite)

                Text(String(localized: "auth.sign_in_to_pay.subtitle"))
                    .font(SGFont.body(size: 14))
                    .foregroundStyle(Color.sgWhiteDim)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
            }
            .padding(.horizontal, Spacing.lg)

            Spacer().frame(height: Spacing.xl)

            VStack(spacing: 12) {
                // Sign in with Apple
                SignInWithAppleButton(.signIn) { request in
                    request.requestedScopes = [.fullName, .email]
                } onCompletion: { result in
                    switch result {
                    case .success(let authorization):
                        if let credential = authorization.credential as? ASAuthorizationAppleIDCredential {
                            auth.handleAppleCredential(credential)
                        }
                    case .failure(let error):
                        if (error as? ASAuthorizationError)?.code != .canceled {
                            auth.authError = String(localized: "auth.sign_in_failed")
                        }
                    }
                }
                .signInWithAppleButtonStyle(.white)
                .frame(height: 52)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .disabled(auth.isLoading)

                // Sign in with Google
                Button {
                    HapticEngine.light()
                    auth.signInWithGoogle()
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "g.circle.fill")
                            .font(.system(size: 20))
                        Text(String(localized: "auth.continue_google"))
                            .font(SGFont.bodyBold(size: 16))
                    }
                    .foregroundStyle(Color.sgBg)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                .disabled(auth.isLoading)
                .accessibilityLabel("Sign in with Google")

                // Loading indicator
                if auth.isLoading {
                    ProgressView()
                        .tint(Color.sgYellow)
                        .padding(.top, 8)
                }

                // Error message
                if let error = auth.authError {
                    Text(error)
                        .font(SGFont.body(size: 13))
                        .foregroundStyle(Color.sgRed)
                        .multilineTextAlignment(.center)
                        .padding(.top, 4)
                }
            }
            .padding(.horizontal, 32)

            Spacer()

            // Dismiss
            Button {
                dismiss()
            } label: {
                Text(String(localized: "auth.not_now"))
                    .font(SGFont.bodyBold(size: 15))
                    .foregroundStyle(Color.sgMuted)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss sign in and go back")
            .padding(.horizontal, 32)
            .padding(.bottom, Spacing.lg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.sgBg)
        .presentationDetents([.medium])
        .presentationDragIndicator(.hidden)
        .interactiveDismissDisabled(auth.isLoading)
    }
}

#Preview("Review") {
    let store = BookingStore()
    ReviewView()
        .environment(store)
}
