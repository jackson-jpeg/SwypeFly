import Foundation
import UIKit
import Observation
import StripePaymentSheet

// MARK: - Hotel Booking State Machine

enum HotelStep: Sendable, Equatable {
    case idle
    case searching
    case results([HotelSearchResult])
    case quoting
    case review(HotelQuote)
    case paying
    case confirmed(HotelBookingConfirmation)
    case failed(message: String)

    static func == (lhs: HotelStep, rhs: HotelStep) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle), (.searching, .searching),
             (.quoting, .quoting), (.paying, .paying):
            return true
        case let (.results(a), .results(b)):
            return a.count == b.count
        case let (.review(a), .review(b)):
            return a.quoteId == b.quoteId
        case let (.confirmed(a), .confirmed(b)):
            return a.bookingId == b.bookingId
        case let (.failed(a), .failed(b)):
            return a == b
        default:
            return false
        }
    }
}

// MARK: - Hotel Store

@MainActor
@Observable
final class HotelStore {
    var step: HotelStep = .idle
    var selectedHotel: HotelSearchResult?
    var selectedRoom: HotelRoom?
    var error: String?
    var paymentSheet: PaymentSheet?
    var paymentError: String?
    private var currentPaymentIntentId: String?
    private var lastSearchResults: [HotelSearchResult] = []

    // Search params
    var checkIn: String = ""
    var checkOut: String = ""
    var guests: Int = 1

    var isLoading: Bool {
        step == .searching || step == .quoting || step == .paying
    }

    @ObservationIgnored private var activeRequestID = UUID()

    // MARK: - Search

    func search(latitude: Double, longitude: Double, checkIn: String, checkOut: String, guests: Int = 1) async {
        let requestID = UUID()
        activeRequestID = requestID
        self.checkIn = checkIn
        self.checkOut = checkOut
        self.guests = guests
        step = .searching
        error = nil

        do {
            let request = HotelSearchRequest(
                latitude: latitude,
                longitude: longitude,
                checkIn: checkIn,
                checkOut: checkOut,
                guests: guests
            )
            let results: [HotelSearchResult] = try await APIClient.shared.fetch(.hotelSearch(request))
            guard activeRequestID == requestID else { return }

            if results.isEmpty {
                step = .failed(message: "No hotels found for these dates.")
            } else {
                lastSearchResults = results
                step = .results(results)
            }
        } catch {
            guard activeRequestID == requestID else { return }
            self.error = (error as? APIError)?.errorDescription ?? "Hotel search failed."
            step = .failed(message: self.error ?? "Something went wrong.")
        }
    }

    // MARK: - Quote

    func getQuote(hotel: HotelSearchResult, room: HotelRoom) async {
        let requestID = UUID()
        activeRequestID = requestID
        selectedHotel = hotel
        selectedRoom = room
        step = .quoting

        do {
            let request = HotelQuoteRequest(
                accommodationId: hotel.accommodationId,
                roomId: room.roomId,
                checkIn: checkIn,
                checkOut: checkOut
            )
            let quote: HotelQuote = try await APIClient.shared.fetch(.hotelQuote(request))
            guard activeRequestID == requestID else { return }
            step = .review(quote)
        } catch {
            guard activeRequestID == requestID else { return }
            self.error = (error as? APIError)?.errorDescription ?? "Failed to get quote."
            step = .failed(message: self.error ?? "Something went wrong.")
        }
    }

    // MARK: - Payment Preparation

    func preparePayment(quote: HotelQuote, email: String) async {
        paymentError = nil

        do {
            let amountInCents = Int((quote.totalAmount * 100).rounded())
            let paymentIntent: PaymentIntentResponse = try await APIClient.shared.fetch(
                .bookingPaymentIntent(
                    offerId: quote.quoteId,
                    amount: max(amountInCents, 1),
                    currency: quote.currency,
                    email: email
                )
            )
            currentPaymentIntentId = paymentIntent.paymentIntentId

            let stripeKey = RemoteConfig.shared.stripePublishableKey
            guard !stripeKey.isEmpty else {
                paymentError = "Payment is temporarily unavailable."
                HapticEngine.error()
                return
            }
            STPAPIClient.shared.publishableKey = stripeKey

            var config = PaymentSheet.Configuration()
            config.merchantDisplayName = "SoGoJet"
            config.allowsDelayedPaymentMethods = false
            config.appearance.colors.primary = .init(red: 0.969, green: 0.910, blue: 0.627, alpha: 1)
            config.appearance.colors.background = .init(red: 0.039, green: 0.039, blue: 0.039, alpha: 1)
            config.appearance.colors.componentBackground = .init(red: 0.094, green: 0.094, blue: 0.094, alpha: 1)
            config.appearance.colors.text = .white
            config.appearance.colors.textSecondary = .init(white: 0.6, alpha: 1)
            config.appearance.cornerRadius = 12

            paymentSheet = PaymentSheet(paymentIntentClientSecret: paymentIntent.clientSecret, configuration: config)
        } catch {
            paymentError = (error as? APIError)?.errorDescription ?? "Payment setup failed."
            HapticEngine.error()
        }
    }

    /// Called after Stripe PaymentSheet completes successfully.
    func completeBookingAfterPayment(quote: HotelQuote, guestName: String, guestEmail: String) async {
        guard let paymentIntentId = currentPaymentIntentId else {
            paymentError = "Payment not prepared."
            return
        }
        await book(quote: quote, guestName: guestName, guestEmail: guestEmail, paymentIntentId: paymentIntentId)
    }

    // MARK: - Book

    func book(quote: HotelQuote, guestName: String, guestEmail: String, paymentIntentId: String) async {
        let requestID = UUID()
        activeRequestID = requestID
        step = .paying

        do {
            let request = HotelBookRequest(
                quoteId: quote.quoteId,
                paymentIntentId: paymentIntentId,
                guestName: guestName,
                guestEmail: guestEmail
            )
            let confirmation: HotelBookingConfirmation = try await APIClient.shared.fetch(.hotelBook(request))
            guard activeRequestID == requestID else { return }
            step = .confirmed(confirmation)
            HapticEngine.success()
        } catch {
            guard activeRequestID == requestID else { return }
            self.error = (error as? APIError)?.errorDescription ?? "Booking failed."
            step = .failed(message: self.error ?? "Something went wrong.")
            HapticEngine.error()
        }
    }

    // MARK: - Reset

    func reset() {
        activeRequestID = UUID()
        step = .idle
        selectedHotel = nil
        selectedRoom = nil
        error = nil
        checkIn = ""
        checkOut = ""
        guests = 1
        lastSearchResults = []
    }

    func goBack() {
        switch step {
        case .review:
            if !lastSearchResults.isEmpty {
                step = .results(lastSearchResults)
            } else if let hotel = selectedHotel {
                step = .results([hotel])
            } else {
                step = .idle
            }
        case .quoting, .paying:
            if !lastSearchResults.isEmpty {
                step = .results(lastSearchResults)
            } else {
                step = .idle
            }
        case .failed:
            if !lastSearchResults.isEmpty {
                step = .results(lastSearchResults)
            } else {
                step = .idle
            }
        case .confirmed:
            // Terminal state — do nothing
            break
        default:
            break
        }
    }
}
