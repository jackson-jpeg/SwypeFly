import Foundation
import Observation

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
    var passengerCount: Int = 1

    // MARK: Derived

    var isLoading: Bool {
        step == .searching || step == .paying
    }

    var totalPrice: Double {
        guard let offer = selectedOffer else { return 0 }
        var total = offer.price * Double(passengerCount)
        if let seat = seatMap?.rows.flatMap(\.seats).first(where: { $0.id == selectedSeatId }),
           let seatPrice = seat.price {
            total += seatPrice * Double(passengerCount)
        }
        return total
    }

    // MARK: Actions

    /// Start the booking flow for a deal.
    func start(deal: Deal) {
        self.deal = deal
        step = .idle
        selectedOffer = nil
        passenger = PassengerData()
        seatMap = nil
        selectedSeatId = nil
        bookingOrder = nil
        passengerCount = 1
    }

    /// Search for bookable flights.
    func searchFlights(origin: String, destination: String, departureDate: String, returnDate: String) async {
        step = .searching

        do {
            let options: [TripOption] = try await APIClient.shared.fetch(
                .bookingSearch(
                    origin: origin,
                    destination: destination,
                    date: departureDate,
                    returnDate: returnDate,
                    passengers: passengerCount
                )
            )
            step = .trip(options: options)
        } catch {
            step = .failed(message: error.localizedDescription)
        }
    }

    /// Select a flight offer and move to passengers.
    func selectOffer(_ offer: TripOption) {
        selectedOffer = offer
        step = .passengers
    }

    /// Move to seat selection and fetch seat map.
    func proceedToSeats() async {
        guard let offerId = selectedOffer?.id else { return }
        step = .seats

        do {
            seatMap = try await APIClient.shared.fetch(.seatMap(offerId: offerId))
        } catch {
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
        step = .paying

        do {
            let order: BookingOrder = try await APIClient.shared.fetch(
                .bookingOrder(id: offer.id)
            )
            bookingOrder = order
            step = .confirmed(reference: order.bookingReference)
            HapticEngine.success()
        } catch {
            step = .failed(message: error.localizedDescription)
            HapticEngine.error()
        }
    }

    /// Reset the entire flow.
    func reset() {
        step = .idle
        deal = nil
        selectedOffer = nil
        passenger = PassengerData()
        seatMap = nil
        selectedSeatId = nil
        bookingOrder = nil
        passengerCount = 1
    }
}
