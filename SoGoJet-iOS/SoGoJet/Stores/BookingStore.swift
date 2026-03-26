import Foundation
import Observation
import ActivityKit

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

    /// Recent booking searches, persisted to UserDefaults.
    private(set) var recentSearches: [RecentSearch] = []

    @ObservationIgnored private var activeSearchRequestID = UUID()
    @ObservationIgnored private var activeOfferRequestID = UUID()
    @ObservationIgnored private var activeCheckoutRequestID = UUID()
    @ObservationIgnored private var liveActivity: Activity<FlightSearchAttributes>?

    private static let recentSearchesKey = "SGRecentSearches"
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

    // MARK: Actions

    /// Start the booking flow for a deal.
    func start(deal: Deal) {
        invalidatePendingRequests()
        self.deal = deal
        step = .idle
        selectedOffer = nil
        passenger = PassengerData()
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
    func searchFlights(
        origin: String,
        destination: String,
        departureDate: String,
        returnDate: String?,
        cabinClass: BookingCabinClass = .economy
    ) async {
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
                    priceHint: deal?.displayPrice
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
        step = .passengers
    }

    /// Move to seat selection and fetch seat map.
    func proceedToSeats() async {
        guard let offer = selectedOffer else { return }
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
                    percentDiff: percentDiff
                )
            }
        } catch {
            guard activeOfferRequestID == requestID else { return }
            // Seat map optional — proceed without it.
            seatMap = nil
        }
    }

    /// Select a seat.
    func selectSeat(_ seatId: String) {
        selectedSeatId = seatId
        HapticEngine.selection()
    }

    /// Move to the review step.
    func proceedToReview() {
        step = .review
    }

    /// Confirm and place the booking.
    func confirmBooking() async {
        guard let offer = selectedOffer else { return }
        let requestID = UUID()
        activeCheckoutRequestID = requestID
        step = .paying
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

            let selectedServices: [CreateOrderSelectedService]? = {
                guard let seatId = selectedSeatId,
                      let seat = seatMap?.rows.flatMap(\.seats).first(where: { $0.id == seatId }),
                      let serviceId = seat.serviceId else {
                    return nil
                }
                return [CreateOrderSelectedService(id: serviceId, quantity: passengerCount)]
            }()

            let orderRequest = BookingCreateOrderRequest(
                offerId: offer.id,
                passengers: [CreateOrderPassenger(
                    id: "pax_1",
                    givenName: passenger.firstName,
                    familyName: passenger.lastName,
                    bornOn: passenger.dateOfBirth,
                    gender: passenger.gender.bookingValue,
                    title: passenger.title.lowercased(),
                    email: passenger.email,
                    phoneNumber: passenger.phone
                )],
                selectedServices: selectedServices,
                paymentIntentId: paymentIntent.paymentIntentId,
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
            step = .confirmed(reference: order.bookingReference)
            HapticEngine.success()
            ReviewPrompter.shared.recordBookingCompleted()
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

    /// Reset the entire flow.
    func reset() {
        invalidatePendingRequests()
        step = .idle
        deal = nil
        selectedOffer = nil
        passenger = PassengerData()
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
                    percentDiff: percentDiff
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
            #if DEBUG
            print("[LiveActivity] Failed to start: \(error)")
            #endif
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
}

private struct BookingErrorPayload: Decodable {
    let error: String
    let code: String?
    let newOfferId: String?
    let oldPrice: Double?
    let newPrice: Double?
}
