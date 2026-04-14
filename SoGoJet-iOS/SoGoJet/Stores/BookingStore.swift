import Foundation
import UIKit
import Observation
import ActivityKit
import StripePaymentSheet

// MARK: - Booking Step State Machine

enum BookingStep: Sendable, Equatable {
    case idle
    case searching
    case trip(options: [TripOption])
    case passengers
    case seats
    case review
    case paying
    case confirmed(reference: String)
    case failed(message: String)
}

// MARK: - Booking Store

@MainActor
@Observable
final class BookingStore {
    // MARK: State
    var step: BookingStep = .idle
    var deal: Deal?
    var selectedOffer: TripOption?
    var passenger: PassengerData = PassengerData()
    var seatMap: SeatMap?
    var selectedSeatId: String?
    var bookingOrder: BookingOrder?
    var lastPriceDiscrepancy: PriceDiscrepancy?
    var passengerCount: Int = 1
    var searchOrigin: String?
    var searchDestination: String?
    var searchDepartureDate: String?
    var searchReturnDate: String?
    var searchCabinClass: BookingCabinClass = .economy
    var lastSearchSnapshot: BookingSearchSnapshot?
    var lastSearchStartedAt: Date?
    var lastSearchCompletedAt: Date?
    var lastSearchErrorMessage: String?
    private(set) var lastTripOptions: [TripOption] = []
    var paymentError: String?

    // MARK: Confirm-Offer (live price parity)

    /// The cached offer id carried from the feed deal, if any. Passed to confirm-offer
    /// so the server can re-validate against the same cached fare.
    var cachedOfferId: String?

    /// Price the user saw on the feed card when they tapped Book. Used by confirm-offer
    /// to detect drift between feed and live pricing.
    var expectedPrice: Double?

    /// Price-change alert payload surfaced after confirm-offer reports "expired".
    /// When non-nil, the UI should show a "Prices just updated" dialog.
    struct PriceUpdateAlert: Equatable, Sendable {
        let oldPrice: Double?
        let newPrice: Double?
        let newOfferId: String?    // nil → flight no longer available
    }
    var priceUpdateAlert: PriceUpdateAlert?

    // MARK: Offer Expiration

    /// Parsed expiration date of the currently selected offer.
    /// Updated whenever `selectedOffer` changes and has an `expiresAt` value.
    var offerExpirationDate: Date?

    /// Seconds remaining until the current offer expires. Nil if no expiration is known.
    var offerSecondsRemaining: TimeInterval?

    /// Whether this booking is for an international flight (requires passport).
    var isInternational: Bool {
        guard let country = deal?.country else { return false }
        let domesticNames = ["United States", "US", "USA", "U.S.", "U.S.A.",
                             "Puerto Rico", "USVI", "US Virgin Islands",
                             "Guam", "American Samoa"]
        return !domesticNames.contains { country.localizedCaseInsensitiveCompare($0) == .orderedSame }
    }

    /// Whether the current offer has expired.
    var isOfferExpired: Bool {
        guard let remaining = offerSecondsRemaining else { return false }
        return remaining <= 0
    }

    /// Human-readable countdown string, e.g. "12:34".
    var offerCountdownLabel: String? {
        guard let remaining = offerSecondsRemaining else { return nil }
        let clamped = max(remaining, 0)
        let minutes = Int(clamped) / 60
        let seconds = Int(clamped) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    @ObservationIgnored private var expirationTimer: Timer?

    /// Recent booking searches, persisted to UserDefaults.
    private(set) var recentSearches: [RecentSearch] = []

    @ObservationIgnored private var activeSearchRequestID = UUID()
    @ObservationIgnored private var activeOfferRequestID = UUID()
    @ObservationIgnored private var activeCheckoutRequestID = UUID()
    @ObservationIgnored private var liveActivity: Activity<FlightSearchAttributes>?

    /// Callback to push live prices back to the feed after booking search.
    /// Set by the presenting view to update the feed card's price.
    var onLivePriceFound: ((String, Double) -> Void)?

    /// Stripe PaymentSheet for collecting card details.
    /// Set after creating a payment intent, presented by ReviewView.
    var paymentSheet: PaymentSheet?

    /// Client secret for the current payment intent.
    private var currentClientSecret: String?

    /// Payment intent ID returned by the server. Used when creating the Duffel order.
    private var currentPaymentIntentId: String?

    private static var stripePublishableKey: String {
        let remoteKey = RemoteConfig.shared.stripePublishableKey
        if !remoteKey.isEmpty { return remoteKey }
        #if DEBUG
        return "pk_live_51T6cxRLUI2d6YDhKrt7A8IB5xJOyuHYiS81B35aZQ5tkZqFzpgwUCG8ASqobPkg1MEwsHYTlZbpIaqQgYepRd8Jw00jnVCCaZj"
        #else
        return ""
        #endif
    }

    private static let recentSearchesKey = StorageKeys.Booking.recentSearches
    private static let lastPassengerKey = StorageKeys.Booking.lastPassenger
    private static let maxRecentSearches = 8

    // MARK: Derived

    var isLoading: Bool {
        step == .searching || step == .paying
    }

    var totalPrice: Double {
        guard let offer = selectedOffer else { return 0 }
        var total = offer.price
        if let seat = seatMap?.rows.flatMap(\.seats).first(where: { $0.id == selectedSeatId }),
           let seatPrice = seat.price {
            total += seatPrice
        }
        return total
    }

    // MARK: Init

    init() {
        loadRecentSearches()
    }

    deinit {
        expirationTimer?.invalidate()
        expirationTimer = nil
        // Live Activity cleanup must happen synchronously or be fire-and-forget
        if let activity = liveActivity {
            Task { @MainActor in
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }

    // MARK: Actions

    /// Start the booking flow for a deal.
    /// Cleans up any lingering state (including Live Activity) from a previous booking.
    func start(deal: Deal) {
        Analytics.track(.bookingStarted, properties: ["city": deal.city, "dealId": deal.id])
        invalidatePendingRequests()
        stopOfferExpirationTimer()

        // End any lingering Live Activity from a previous booking
        if liveActivity != nil {
            endLiveActivity(bestPrice: nil, offerCount: 0, status: .noResults, message: "New search started")
        }

        self.deal = deal
        cachedOfferId = deal.cachedOfferId
        expectedPrice = deal.displayPrice
        priceUpdateAlert = nil
        step = .idle
        selectedOffer = nil
        offerExpirationDate = nil
        offerSecondsRemaining = nil
        passenger = loadLastPassenger() ?? PassengerData()
        seatMap = nil
        selectedSeatId = nil
        bookingOrder = nil
        lastPriceDiscrepancy = nil
        paymentError = nil
        passengerCount = 1
        searchOrigin = nil
        searchDestination = nil
        searchDepartureDate = nil
        searchReturnDate = nil
        searchCabinClass = .economy
        lastTripOptions = []
        lastSearchSnapshot = nil
        lastSearchStartedAt = nil
        lastSearchCompletedAt = nil
        lastSearchErrorMessage = nil
    }

    /// Search for bookable flights.
    @ObservationIgnored private var isSearchingFlights = false
    func searchFlights(
        origin: String,
        destination: String,
        departureDate: String,
        returnDate: String?,
        cabinClass: BookingCabinClass = .economy
    ) async {
        guard !isSearchingFlights else { return }
        isSearchingFlights = true
        defer { isSearchingFlights = false }
        let requestID = UUID()
        activeSearchRequestID = requestID
        step = .searching
        searchOrigin = origin
        searchDestination = destination
        searchDepartureDate = departureDate
        searchReturnDate = returnDate
        searchCabinClass = cabinClass
        lastSearchStartedAt = Date()
        lastSearchCompletedAt = nil
        lastSearchErrorMessage = nil

        // Start Live Activity on Lock Screen / Dynamic Island
        startLiveActivity(
            origin: origin,
            destination: destination,
            city: deal?.city ?? destination,
            date: departureDate
        )

        do {
            let response: BookingSearchResponse = try await APIClient.shared.fetch(
                .bookingSearch(
                    origin: origin,
                    destination: destination,
                    date: departureDate,
                    returnDate: returnDate,
                    passengers: passengerCount,
                    cabinClass: cabinClass.rawValue,
                    priceHint: deal?.displayPrice,
                    cachedOfferId: deal?.cachedOfferId
                )
            )
            guard activeSearchRequestID == requestID else { return }
            lastPriceDiscrepancy = response.priceDiscrepancy
            let offers = response.offers.sorted { $0.price < $1.price }
            lastSearchSnapshot = BookingSearchSnapshot(
                origin: origin,
                destination: destination,
                departureDate: departureDate,
                returnDate: returnDate,
                cabinClass: cabinClass,
                passengers: passengerCount,
                offerCount: offers.count,
                bestPrice: offers.first?.price,
                searchedAt: Date()
            )
            lastSearchCompletedAt = Date()

            if offers.isEmpty {
                lastSearchErrorMessage = "No live fares were found for this route right now."
                step = .failed(message: "No live fares were found for this route right now.")
                endLiveActivity(bestPrice: nil, offerCount: 0, status: .noResults, message: "No fares available")
            } else {
                lastTripOptions = offers
                step = .trip(options: offers)

                // Push the live price back to the feed so the card updates
                if let best = offers.first, let dealId = deal?.id {
                    onLivePriceFound?(dealId, best.price)
                }

                // Update Live Activity with results
                let best = offers.first
                updateLiveActivity(
                    bestPrice: best.map { Int($0.price) },
                    offerCount: offers.count,
                    airline: best?.airline,
                    status: .found,
                    message: "\(offers.count) fares from $\(Int(best?.price ?? 0))"
                )

                // Record this as a recent search
                recordRecentSearch(
                    origin: origin,
                    destination: destination,
                    destinationCity: deal?.city ?? destination,
                    departureDate: departureDate,
                    returnDate: returnDate,
                    bestPrice: offers.first?.price,
                    offerCount: offers.count
                )
            }
        } catch {
            guard activeSearchRequestID == requestID else { return }
            lastSearchCompletedAt = Date()
            lastSearchErrorMessage = userFacingMessage(for: error)
            step = .failed(message: userFacingMessage(for: error))
            endLiveActivity(bestPrice: nil, offerCount: 0, status: .noResults, message: "Search failed")
        }
    }

    /// Select a flight offer and move to passengers.
    func selectOffer(_ offer: TripOption) {
        selectedOffer = offer
        startOfferExpirationTimer(for: offer)
        step = .passengers
    }

    /// Move to seat selection and fetch seat map.
    @ObservationIgnored private var isFetchingSeats = false
    func proceedToSeats() async {
        guard let offer = selectedOffer else { return }
        guard !isFetchingSeats else { return }
        isFetchingSeats = true
        defer { isFetchingSeats = false }
        saveLastPassenger()
        let requestID = UUID()
        activeOfferRequestID = requestID
        step = .seats

        do {
            let response: BookingOfferResponse = try await APIClient.shared.fetch(
                .bookingOffer(
                    offerId: offer.id,
                    origin: searchOrigin ?? offer.outboundSlice?.origin ?? deal?.nearbyOrigin ?? deal?.iataCode,
                    destination: searchDestination ?? offer.outboundSlice?.destination ?? deal?.iataCode,
                    departureDate: searchDepartureDate,
                    returnDate: searchReturnDate,
                    cabinClass: offer.cabinClass ?? searchCabinClass.rawValue
                )
            )
            guard activeOfferRequestID == requestID else { return }
            selectedOffer = response.offer
            startOfferExpirationTimer(for: response.offer)
            seatMap = response.seatMap
            if response.priceChanged == true,
               let oldPrice = response.oldPrice,
               let newPrice = response.newPrice {
                let percentDiff = oldPrice > 0
                    ? Int(round(((newPrice - oldPrice) / oldPrice) * 100))
                    : 0
                lastPriceDiscrepancy = PriceDiscrepancy(
                    tier: percentDiff >= 50 ? "significant_increase" : "moderate_increase",
                    message: "This fare refreshed while loading seats. You're now seeing the current live price.",
                    feedPrice: oldPrice,
                    bookingPrice: newPrice,
                    percentDiff: percentDiff,
                    feedDatesMatch: nil
                )
            }
        } catch {
            guard activeOfferRequestID == requestID else { return }
            // Seat map optional — proceed without it.
            seatMap = nil
        }
    }

    /// Select a seat. Only allows selecting seats marked as available in the seat map.
    func selectSeat(_ seatId: String) {
        guard let seatMap,
              let seat = seatMap.rows.flatMap(\.seats).first(where: { $0.id == seatId }),
              seat.available else {
            return
        }
        selectedSeatId = seatId
    }

    /// Move to the review step.
    func proceedToReview() {
        step = .review
    }

    /// Step 1: Create Stripe payment intent and prepare the PaymentSheet.
    /// Called when user taps "Pay". After this, ReviewView presents the PaymentSheet.
    @ObservationIgnored private var isPreparingPayment = false
    func preparePayment() async {
        guard let offer = selectedOffer else { return }
        guard !isPreparingPayment else { return }
        isPreparingPayment = true
        defer { isPreparingPayment = false }

        if isOfferExpired {
            paymentError = "This fare has expired. Searching for fresh options now."
            stopOfferExpirationTimer()
            await retryLastSearch()
            return
        }
        if let remaining = offerSecondsRemaining, remaining < 30 {
            paymentError = "This fare is about to expire. Searching for fresh options now."
            stopOfferExpirationTimer()
            await retryLastSearch()
            return
        }

        // Live-price parity gate: re-validate the offer against the backend right before
        // presenting payment. If the fare drifted, surface a "Prices just updated" alert
        // via `priceUpdateAlert` and bail — the UI prompts the user to continue or cancel.
        let confirmed = await confirmOfferBeforePayment(offer)
        if !confirmed { return }

        let requestID = UUID()
        activeCheckoutRequestID = requestID
        paymentError = nil

        do {
            let amountInCents = Int((totalPrice * 100).rounded())
            let paymentIntent: PaymentIntentResponse = try await APIClient.shared.fetch(
                .bookingPaymentIntent(
                    offerId: offer.id,
                    amount: max(amountInCents, 1),
                    currency: offer.currency,
                    email: passenger.email
                )
            )
            guard activeCheckoutRequestID == requestID else { return }
            currentClientSecret = paymentIntent.clientSecret
            currentPaymentIntentId = paymentIntent.paymentIntentId

            // Configure Stripe PaymentSheet
            let stripeKey = Self.stripePublishableKey
            guard !stripeKey.isEmpty else {
                paymentError = "Payment is temporarily unavailable. Please try again later."
                HapticEngine.error()
                return
            }
            STPAPIClient.shared.publishableKey = stripeKey

            guard !paymentIntent.clientSecret.isEmpty else {
                paymentError = "Invalid payment session. Please try again."
                HapticEngine.error()
                return
            }

            var config = PaymentSheet.Configuration()
            config.merchantDisplayName = "SoGoJet"
            config.allowsDelayedPaymentMethods = false
            config.appearance.colors.primary = UIColor(red: 0.969, green: 0.910, blue: 0.627, alpha: 1) // sgYellow
            config.appearance.colors.background = UIColor(red: 0.039, green: 0.039, blue: 0.039, alpha: 1) // sgBg
            config.appearance.colors.componentBackground = UIColor(red: 0.094, green: 0.094, blue: 0.094, alpha: 1) // sgCell
            config.appearance.colors.text = .white
            config.appearance.colors.textSecondary = UIColor(white: 0.6, alpha: 1)
            config.appearance.cornerRadius = 12

            paymentSheet = PaymentSheet(paymentIntentClientSecret: paymentIntent.clientSecret, configuration: config)
        } catch {
            guard activeCheckoutRequestID == requestID else { return }
            paymentError = userFacingMessage(for: error)
            HapticEngine.error()
        }
    }

    /// Step 2: Called after Stripe PaymentSheet completes successfully.
    /// Creates the actual Duffel order (real ticket).
    @ObservationIgnored private var isCompletingBooking = false
    func completeBookingAfterPayment() async {
        guard let offer = selectedOffer,
              let paymentIntentId = currentPaymentIntentId else { return }
        guard !isCompletingBooking else { return }
        isCompletingBooking = true
        defer { isCompletingBooking = false }

        let requestID = activeCheckoutRequestID
        step = .paying
        paymentError = nil

        do {
            let amountInCents = Int((totalPrice * 100).rounded())

            let selectedServices: [CreateOrderSelectedService]? = {
                guard let seatId = selectedSeatId,
                      let seat = seatMap?.rows.flatMap(\.seats).first(where: { $0.id == seatId }),
                      let serviceId = seat.serviceId else {
                    return nil
                }
                return [CreateOrderSelectedService(id: serviceId, quantity: passengerCount)]
            }()

            // Build passenger list — for MVP all passengers use the primary traveler's details
            let passportExpiryISO: String? = {
                guard !passenger.passportExpiry.isEmpty else { return nil }
                // Already ISO (YYYY-MM-DD) — pass through
                if passenger.passportExpiry.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil {
                    return passenger.passportExpiry
                }
                // Attempt to parse common date formats and re-format as ISO
                let fmt = DateFormatter()
                fmt.locale = Locale(identifier: "en_US_POSIX")
                for format in ["MM/dd/yyyy", "dd/MM/yyyy", "yyyy-MM-dd'T'HH:mm:ssZ"] {
                    fmt.dateFormat = format
                    if let date = fmt.date(from: passenger.passportExpiry) {
                        let iso = DateFormatter()
                        iso.dateFormat = "yyyy-MM-dd"
                        iso.locale = Locale(identifier: "en_US_POSIX")
                        return iso.string(from: date)
                    }
                }
                return nil
            }()

            let passengers = (1...passengerCount).map { index in
                CreateOrderPassenger(
                    id: "pax_\(index)",
                    givenName: passenger.firstName,
                    familyName: passenger.lastName,
                    bornOn: passenger.dateOfBirth,
                    gender: passenger.gender.bookingValue,
                    title: DuffelTitle(from: passenger.title),
                    email: passenger.email,
                    phoneNumber: passenger.phone,
                    passportNumber: passenger.passportNumber.isEmpty ? nil : passenger.passportNumber,
                    passportExpiry: passportExpiryISO,
                    nationality: passenger.nationality.isEmpty ? nil : passenger.nationality.uppercased()
                )
            }

            let orderRequest = BookingCreateOrderRequest(
                offerId: offer.id,
                passengers: passengers,
                selectedServices: selectedServices,
                paymentIntentId: paymentIntentId,
                amount: amountInCents,
                currency: offer.currency,
                destinationCity: deal?.destination,
                destinationIata: searchDestination ?? deal?.iataCode ?? offer.outboundSlice?.destination,
                originIata: searchOrigin ?? deal?.nearbyOrigin ?? offer.outboundSlice?.origin,
                departureDate: searchDepartureDate,
                returnDate: searchReturnDate
            )

            let order: BookingOrder = try await APIClient.shared.fetch(
                .bookingCreateOrder(orderRequest)
            )
            guard activeCheckoutRequestID == requestID else { return }
            bookingOrder = order
            currentClientSecret = nil
            currentPaymentIntentId = nil
            step = .confirmed(reference: order.bookingReference)
            HapticEngine.success()
            ReviewPrompter.shared.recordBookingCompleted()
            Analytics.track(.bookingCompleted, properties: [
                "reference": order.bookingReference,
                "destination": searchDestination ?? "",
            ])
        } catch {
            guard activeCheckoutRequestID == requestID else { return }
            if await recoverFromOrderFailure(error) {
                return
            }
            paymentError = userFacingMessage(for: error)
            step = .review
            HapticEngine.error()
        }
    }

    /// Legacy — kept for compatibility. Now split into preparePayment + completeBookingAfterPayment.
    func confirmBooking() async {
        await preparePayment()
    }

    /// Navigate back one step in the booking flow.
    func goBack() {
        switch step {
        case .passengers:
            if lastTripOptions.isEmpty {
                step = .idle
            } else {
                step = .trip(options: lastTripOptions)
            }
            selectedOffer = nil
        case .seats:
            step = .passengers
        case .review:
            step = seatMap == nil ? .passengers : .seats
        case .failed:
            if lastTripOptions.isEmpty {
                step = .idle
            } else {
                step = .trip(options: lastTripOptions)
            }
        default:
            break
        }
    }

    /// Reset the entire flow, ending any running Live Activity.
    func reset() {
        invalidatePendingRequests()
        stopOfferExpirationTimer()

        // End any lingering Live Activity so it doesn't stay on the lock screen
        if liveActivity != nil {
            endLiveActivity(bestPrice: nil, offerCount: 0, status: .noResults, message: "Search cancelled")
        }

        step = .idle
        deal = nil
        cachedOfferId = nil
        expectedPrice = nil
        priceUpdateAlert = nil
        selectedOffer = nil
        offerExpirationDate = nil
        offerSecondsRemaining = nil
        passenger = PassengerData()
        seatMap = nil
        selectedSeatId = nil
        bookingOrder = nil
        lastPriceDiscrepancy = nil
        paymentError = nil
        currentClientSecret = nil
        currentPaymentIntentId = nil
        passengerCount = 1
        searchOrigin = nil
        searchDestination = nil
        searchDepartureDate = nil
        searchReturnDate = nil
        searchCabinClass = .economy
        lastTripOptions = []
        lastSearchSnapshot = nil
        lastSearchStartedAt = nil
        lastSearchCompletedAt = nil
        lastSearchErrorMessage = nil
    }

    // MARK: - Confirm Offer (live-price parity)

    /// Hit POST /api/booking?action=confirm-offer to re-validate the offer before
    /// presenting the payment sheet. Returns true when the offer is still valid and
    /// payment can proceed; false when pricing drifted (caller should bail and let
    /// the UI show the `priceUpdateAlert` dialog).
    private func confirmOfferBeforePayment(_ offer: TripOption) async -> Bool {
        guard let origin = searchOrigin ?? offer.outboundSlice?.origin ?? deal?.nearbyOrigin ?? deal?.iataCode,
              let destination = searchDestination ?? offer.outboundSlice?.destination ?? deal?.iataCode,
              let departureDate = searchDepartureDate else {
            // Not enough context to confirm — proceed optimistically.
            return true
        }

        do {
            let response: ConfirmOfferResponse = try await APIClient.shared.fetch(
                .bookingConfirmOffer(
                    offerId: offer.id,
                    origin: origin,
                    destination: destination,
                    departureDate: departureDate,
                    returnDate: searchReturnDate,
                    cabinClass: offer.cabinClass ?? searchCabinClass.rawValue,
                    expectedPrice: expectedPrice ?? offer.price
                )
            )

            if response.status == "valid" {
                if let refreshed = response.offer {
                    selectedOffer = refreshed
                    startOfferExpirationTimer(for: refreshed)
                }
                return true
            }

            // expired — surface the price update alert and stop.
            priceUpdateAlert = PriceUpdateAlert(
                oldPrice: response.oldPrice ?? expectedPrice ?? offer.price,
                newPrice: response.newPrice ?? response.newOffer?.price,
                newOfferId: response.newOffer?.id
            )
            if let newOffer = response.newOffer {
                // Stash the refreshed offer so `continueAfterPriceUpdate` can swap to it.
                pendingRefreshedOffer = newOffer
            } else {
                pendingRefreshedOffer = nil
            }
            HapticEngine.warning()
            return false
        } catch {
            // Network/decoding error — don't block checkout, proceed optimistically.
            SGLogger.booking.debug("confirm-offer failed, proceeding: \(error)")
            return true
        }
    }

    /// Set by `confirmOfferBeforePayment` when the server returned a refreshed offer.
    /// Applied by `continueAfterPriceUpdate` if the user taps Continue.
    @ObservationIgnored private var pendingRefreshedOffer: TripOption?

    /// User tapped "Continue" on the "Prices just updated" dialog. Swap to the refreshed
    /// offer and resume the payment-preparation flow. No-op if no refreshed offer was
    /// returned (e.g. flight no longer available).
    func continueAfterPriceUpdate() async {
        guard let refreshed = pendingRefreshedOffer else {
            priceUpdateAlert = nil
            return
        }
        selectedOffer = refreshed
        expectedPrice = refreshed.price
        startOfferExpirationTimer(for: refreshed)
        pendingRefreshedOffer = nil
        priceUpdateAlert = nil
        await preparePayment()
    }

    /// User tapped "Cancel" on the price-update dialog. Clear state so the UI can dismiss.
    func dismissPriceUpdateAlert() {
        priceUpdateAlert = nil
        pendingRefreshedOffer = nil
    }

    func retryLastSearch() async {
        guard let searchOrigin,
              let searchDestination,
              let searchDepartureDate else {
            return
        }

        await searchFlights(
            origin: searchOrigin,
            destination: searchDestination,
            departureDate: searchDepartureDate,
            returnDate: searchReturnDate,
            cabinClass: searchCabinClass
        )
    }

    private func recoverFromOrderFailure(_ error: Error) async -> Bool {
        guard case let APIError.httpError(statusCode, body) = error else {
            return false
        }

        guard let data = body.data(using: .utf8),
              let payload = try? JSONDecoder().decode(BookingErrorPayload.self, from: data) else {
            return false
        }

        if statusCode == 409,
           payload.code == "PRICE_CHANGED",
           let newOfferId = payload.newOfferId {
            do {
                let refreshed: BookingOfferResponse = try await APIClient.shared.fetch(
                    .bookingOffer(
                        offerId: newOfferId,
                        origin: searchOrigin,
                        destination: searchDestination,
                        departureDate: searchDepartureDate,
                        returnDate: searchReturnDate,
                        cabinClass: selectedOffer?.cabinClass ?? searchCabinClass.rawValue
                    )
                )
                let oldPrice = payload.oldPrice ?? selectedOffer?.price ?? refreshed.offer.price
                let newPrice = payload.newPrice ?? refreshed.offer.price
                let percentDiff = oldPrice > 0
                    ? Int(round(((newPrice - oldPrice) / oldPrice) * 100))
                    : 0

                selectedOffer = refreshed.offer
                seatMap = refreshed.seatMap
                selectedSeatId = nil
                lastPriceDiscrepancy = PriceDiscrepancy(
                    tier: percentDiff >= 50 ? "significant_increase" : "moderate_increase",
                    message: payload.error,
                    feedPrice: oldPrice,
                    bookingPrice: newPrice,
                    percentDiff: percentDiff,
                    feedDatesMatch: nil
                )
                lastTripOptions = [refreshed.offer]
                step = .trip(options: [refreshed.offer])
                HapticEngine.warning()
                return true
            } catch {
                step = .failed(message: userFacingMessage(for: error))
                return true
            }
        }

        if statusCode == 410 || payload.code == "OFFER_EXPIRED" {
            guard let searchOrigin,
                  let searchDestination,
                  let searchDepartureDate else {
                return false
            }

            await searchFlights(
                origin: searchOrigin,
                destination: searchDestination,
                departureDate: searchDepartureDate,
                returnDate: searchReturnDate,
                cabinClass: searchCabinClass
            )
            if case .trip = step {
                HapticEngine.warning()
            }
            return true
        }

        return false
    }

    private func userFacingMessage(for error: Error) -> String {
        guard case let APIError.httpError(statusCode, body) = error else {
            return error.localizedDescription
        }

        if let data = body.data(using: .utf8),
           let payload = try? JSONDecoder().decode(BookingErrorPayload.self, from: data) {
            if !payload.error.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return payload.error
            }
        }

        switch statusCode {
        case 400:
            return "Your traveler details need another look before we can finish booking."
        case 401:
            return "Sign-in is required to finish this step."
        case 409:
            return "This fare changed while you were booking. We've refreshed the live options."
        case 410:
            return "That fare expired. Searching for a fresh option now."
        case 429:
            return "Too many booking attempts in a short time. Please try again in a moment."
        case 500...599:
            return "The booking service is having trouble right now. Please try again shortly."
        default:
            return error.localizedDescription
        }
    }

    private func invalidatePendingRequests() {
        activeSearchRequestID = UUID()
        activeOfferRequestID = UUID()
        activeCheckoutRequestID = UUID()
    }

    // MARK: - Offer Expiration Timer

    /// Parse the offer's `expiresAt` ISO 8601 string and start a 1-second countdown timer.
    private func startOfferExpirationTimer(for offer: TripOption) {
        stopOfferExpirationTimer()

        guard let expiresAtString = offer.expiresAt else {
            offerExpirationDate = nil
            offerSecondsRemaining = nil
            return
        }

        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = iso.date(from: expiresAtString)
        if date == nil {
            iso.formatOptions = [.withInternetDateTime]
            date = iso.date(from: expiresAtString)
        }
        guard let expirationDate = date else {
            offerExpirationDate = nil
            offerSecondsRemaining = nil
            return
        }

        offerExpirationDate = expirationDate
        offerSecondsRemaining = expirationDate.timeIntervalSinceNow

        expirationTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, let expDate = self.offerExpirationDate else { return }
                self.offerSecondsRemaining = expDate.timeIntervalSinceNow
                if self.isOfferExpired {
                    self.stopOfferExpirationTimer()
                }
            }
        }
    }

    private func stopOfferExpirationTimer() {
        expirationTimer?.invalidate()
        expirationTimer = nil
    }

    // MARK: - Live Activity

    private func startLiveActivity(origin: String, destination: String, city: String, date: String) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let attributes = FlightSearchAttributes(
            origin: origin,
            destination: destination,
            destinationCity: city,
            departureDate: date
        )
        let state = FlightSearchAttributes.ContentState(
            status: .searching,
            bestPrice: nil,
            offerCount: 0,
            airline: nil,
            message: "Searching live fares..."
        )

        do {
            liveActivity = try Activity.request(
                attributes: attributes,
                content: .init(state: state, staleDate: Date().addingTimeInterval(120))
            )
        } catch {
            SGLogger.booking.debug("LiveActivity failed to start: \(error)")
        }
    }

    private func updateLiveActivity(bestPrice: Int?, offerCount: Int, airline: String?, status: FlightSearchAttributes.ContentState.SearchStatus, message: String) {
        guard let activity = liveActivity else { return }
        let state = FlightSearchAttributes.ContentState(
            status: status,
            bestPrice: bestPrice,
            offerCount: offerCount,
            airline: airline,
            message: message
        )
        Task {
            await activity.update(.init(state: state, staleDate: Date().addingTimeInterval(120)))
        }
    }

    private func endLiveActivity(bestPrice: Int?, offerCount: Int, status: FlightSearchAttributes.ContentState.SearchStatus, message: String) {
        guard let activity = liveActivity else { return }
        let state = FlightSearchAttributes.ContentState(
            status: status,
            bestPrice: bestPrice,
            offerCount: offerCount,
            airline: nil,
            message: message
        )
        Task {
            await activity.end(.init(state: state, staleDate: nil), dismissalPolicy: .after(.now + 300))
        }
        liveActivity = nil
    }

    // MARK: - Recent Searches

    private func recordRecentSearch(
        origin: String, destination: String, destinationCity: String,
        departureDate: String, returnDate: String?,
        bestPrice: Double?, offerCount: Int
    ) {
        let search = RecentSearch(
            origin: origin, destination: destination,
            destinationCity: destinationCity, departureDate: departureDate,
            returnDate: returnDate, bestPrice: bestPrice,
            offerCount: offerCount, searchedAt: Date()
        )
        // Remove duplicate routes, keep latest
        recentSearches.removeAll { $0.origin == origin && $0.destination == destination }
        recentSearches.insert(search, at: 0)
        if recentSearches.count > Self.maxRecentSearches {
            recentSearches = Array(recentSearches.prefix(Self.maxRecentSearches))
        }
        saveRecentSearches()
    }

    private func loadRecentSearches() {
        guard let data = UserDefaults.standard.data(forKey: Self.recentSearchesKey),
              let searches = try? JSONDecoder().decode([RecentSearch].self, from: data)
        else { return }
        recentSearches = searches
    }

    private func saveRecentSearches() {
        guard let data = try? JSONEncoder().encode(recentSearches) else { return }
        UserDefaults.standard.set(data, forKey: Self.recentSearchesKey)
    }

    // MARK: - Passenger Data Persistence

    /// Persists non-sensitive passenger fields so returning users don't re-type their info.
    /// Passport number, passport expiry, and nationality are intentionally excluded.
    private func saveLastPassenger() {
        let safe = SavedPassengerData(
            title: passenger.title,
            firstName: passenger.firstName,
            lastName: passenger.lastName,
            email: passenger.email,
            phone: passenger.phone,
            dateOfBirth: passenger.dateOfBirth,
            gender: passenger.gender
        )
        guard let data = try? JSONEncoder().encode(safe) else { return }
        UserDefaults.standard.set(data, forKey: Self.lastPassengerKey)
    }

    /// Restores the last-used passenger data (non-sensitive fields only).
    private func loadLastPassenger() -> PassengerData? {
        guard let data = UserDefaults.standard.data(forKey: Self.lastPassengerKey),
              let saved = try? JSONDecoder().decode(SavedPassengerData.self, from: data)
        else { return nil }

        // Only restore if there is meaningful data (at least a name).
        guard !saved.firstName.isEmpty, !saved.lastName.isEmpty else { return nil }

        return PassengerData(
            title: saved.title,
            firstName: saved.firstName,
            lastName: saved.lastName,
            email: saved.email,
            phone: saved.phone,
            dateOfBirth: saved.dateOfBirth,
            gender: saved.gender
        )
    }
}

/// Non-sensitive subset of passenger data persisted to UserDefaults.
/// Passport numbers and expiry dates are intentionally omitted.
private struct SavedPassengerData: Codable {
    let title: String
    let firstName: String
    let lastName: String
    let email: String
    let phone: String
    let dateOfBirth: String
    let gender: PassengerData.Gender
}

private struct BookingErrorPayload: Decodable {
    let error: String
    let code: String?
    let newOfferId: String?
    let oldPrice: Double?
    let newPrice: Double?
}
