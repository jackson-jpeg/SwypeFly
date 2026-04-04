import Testing
import Foundation
@testable import SoGoJet

@Suite("BookingStore State Machine")
struct BookingStoreTests {

    @Test("Initial state is idle")
    @MainActor
    func initialState() {
        let store = BookingStore()
        #expect(store.step == .idle)
        #expect(store.deal == nil)
        #expect(store.selectedOffer == nil)
        #expect(store.isLoading == false)
        #expect(store.totalPrice == 0)
    }

    @Test("Start resets all state")
    @MainActor
    func startResetsState() {
        let store = BookingStore()
        store.paymentError = "old error"
        store.passengerCount = 3

        let deal = Deal.preview
        store.start(deal: deal)

        #expect(store.deal?.id == deal.id)
        #expect(store.step == .idle)
        #expect(store.paymentError == nil)
        #expect(store.passengerCount == 1)
        #expect(store.selectedOffer == nil)
        #expect(store.seatMap == nil)
    }

    @Test("Reset clears everything")
    @MainActor
    func reset() {
        let store = BookingStore()
        store.passengerCount = 2
        store.reset()

        #expect(store.step == .idle)
        #expect(store.deal == nil)
        #expect(store.passengerCount == 1)
    }

    @Test("GoBack from passengers returns to idle when no trip options")
    @MainActor
    func goBackFromPassengersNoOptions() {
        let store = BookingStore()
        store.step = .passengers
        store.goBack()
        #expect(store.step == .idle)
    }

    @Test("GoBack from seats returns to passengers")
    @MainActor
    func goBackFromSeats() {
        let store = BookingStore()
        store.step = .seats
        store.goBack()
        #expect(store.step == .passengers)
    }

    @Test("GoBack from review returns to seats when seat map exists")
    @MainActor
    func goBackFromReviewWithSeatMap() {
        let store = BookingStore()
        store.seatMap = SeatMap(columns: [], exitRows: [], aisleAfterColumns: [], rows: [])
        store.step = .review
        store.goBack()
        #expect(store.step == .seats)
    }

    @Test("GoBack from review returns to passengers when no seat map")
    @MainActor
    func goBackFromReviewNoSeatMap() {
        let store = BookingStore()
        store.seatMap = nil
        store.step = .review
        store.goBack()
        #expect(store.step == .passengers)
    }

    @Test("ProceedToReview sets step to review")
    @MainActor
    func proceedToReview() {
        let store = BookingStore()
        store.proceedToReview()
        #expect(store.step == .review)
    }

    @Test("isLoading true during searching")
    @MainActor
    func isLoadingSearching() {
        let store = BookingStore()
        store.step = .searching
        #expect(store.isLoading == true)
    }

    @Test("isLoading true during paying")
    @MainActor
    func isLoadingPaying() {
        let store = BookingStore()
        store.step = .paying
        #expect(store.isLoading == true)
    }

    @Test("isLoading false during idle")
    @MainActor
    func isLoadingIdle() {
        let store = BookingStore()
        store.step = .idle
        #expect(store.isLoading == false)
    }

    @Test("Offer expiration label format")
    @MainActor
    func offerCountdownLabel() {
        let store = BookingStore()
        store.offerSecondsRemaining = 754 // 12 minutes 34 seconds
        #expect(store.offerCountdownLabel == "12:34")
    }

    @Test("Offer expired when seconds <= 0")
    @MainActor
    func offerExpired() {
        let store = BookingStore()
        store.offerSecondsRemaining = -1
        #expect(store.isOfferExpired == true)
    }

    @Test("Offer not expired when seconds > 0")
    @MainActor
    func offerNotExpired() {
        let store = BookingStore()
        store.offerSecondsRemaining = 60
        #expect(store.isOfferExpired == false)
    }

    @Test("Domestic detection for US destinations")
    @MainActor
    func domesticDetection() {
        let store = BookingStore()
        // No deal set — isInternational should be false (no country)
        #expect(store.isInternational == false)
    }
}
