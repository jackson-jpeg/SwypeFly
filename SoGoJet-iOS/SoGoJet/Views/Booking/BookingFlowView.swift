import SwiftUI
import UIKit

struct BookingFlowView: View {
    @Environment(BookingStore.self) private var store
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(SavedStore.self) private var savedStore
    @Environment(Router.self) private var router
    @Environment(AuthStore.self) private var auth
    @Environment(NetworkMonitor.self) private var network

    let deal: Deal

    @State private var shareItem: BookingShareItem?
    @State private var showSignInPrompt = false

    private var currentDeal: Deal {
        store.deal ?? deal
    }

    /// Simplified step name for onChange tracking (avoids associated-value comparison).
    private var bookingStepName: String {
        switch store.step {
        case .idle: return "idle"
        case .searching: return "searching"
        case .trip: return "trip"
        case .passengers: return "passengers"
        case .seats: return "seats"
        case .review: return "review"
        case .paying: return "paying"
        case .confirmed: return "confirmed"
        case .failed: return "failed"
        }
    }

    private var flowSteps: [String] {
        [
            String(localized: "booking.step.search"),
            String(localized: "booking.step.traveler"),
            String(localized: "booking.step.seats"),
            String(localized: "booking.step.review"),
            String(localized: "booking.step.confirmed"),
        ]
    }

    private var currentStepIndex: Int {
        switch store.step {
        case .idle, .searching, .trip, .failed:
            return 0
        case .passengers:
            return 1
        case .seats:
            return 2
        case .review, .paying:
            return 3
        case .confirmed:
            return 4
        }
    }

    private var chromeTitle: String {
        switch store.step {
        case .idle, .searching, .trip, .failed:
            return String(localized: "booking.your_trip")
        case .passengers:
            return String(localized: "booking.passenger_details")
        case .seats:
            return String(localized: "booking.cabin_map")
        case .review, .paying:
            return String(localized: "booking.final_review")
        case .confirmed:
            return String(localized: "booking.confirmed")
        }
    }

    private var chromeSubtitle: String {
        switch store.step {
        case .idle, .searching:
            return String(localized: "booking.searching_subtitle")
        case .trip:
            return String(localized: "booking.trip_subtitle")
        case .failed:
            return String(localized: "booking.failed_subtitle")
        case .passengers:
            return String(localized: "booking.passengers_subtitle")
        case .seats:
            return String(localized: "booking.seats_subtitle")
        case .review:
            return String(localized: "booking.review_subtitle")
        case .paying:
            return String(localized: "booking.paying_subtitle")
        case .confirmed:
            return String(localized: "booking.confirmed_subtitle")
        }
    }

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            currentStepView
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            flowChrome
        }
        .sheet(item: $shareItem) { item in
            BookingFlowShareSheet(activityItems: item.activityItems)
        }
        .overlay { ToastOverlay() }
        .onAppear {
            if store.deal?.id != deal.id {
                store.start(deal: deal)
            }
        }
        .onDisappear {
            if router.fullScreenDestination == nil {
                store.reset()
            }
        }
        .onChange(of: bookingStepName) { _, newStep in
            // Auto-save the deal when booking is confirmed
            if newStep == "confirmed" {
                if !savedStore.isSaved(id: currentDeal.id) {
                    savedStore.add(deal: currentDeal)
                }
            }
        }
        .alert(String(localized: "booking.sign_in_required"), isPresented: $showSignInPrompt) {
            Button(String(localized: "common.sign_in")) {
                router.dismissFullScreen()
                // Let the user sign in from the main app
            }
            .accessibilityLabel("Sign in to complete booking")
            Button(String(localized: "booking.continue_browsing"), role: .cancel) {}
                .accessibilityLabel("Dismiss and continue browsing flights")
        } message: {
            Text(String(localized: "booking.sign_in_message"))
        }
    }

    @ViewBuilder
    private var currentStepView: some View {
        switch store.step {
        case .idle, .searching, .trip, .failed:
            TripView(deal: currentDeal)
        case .passengers:
            PassengerForm()
        case .seats:
            SeatMapView()
        case .review, .paying:
            ReviewView()
        case .confirmed:
            BoardingPassView(onBackToDeals: {
                store.reset()
                router.dismissFullScreen()
            }, onShare: {
                shareBoardingPass()
            })
        }
    }

    private var flowChrome: some View {
        VStack(spacing: Spacing.sm) {
            VintageTerminalTopBar(
                eyebrow: String(localized: "booking.title"),
                title: chromeTitle,
                subtitle: chromeSubtitle,
                stamp: currentDeal.iataCode,
                tone: .amber,
                leadingIcon: "xmark",
                leadingAction: {
                    HapticEngine.light()
                    router.dismissFullScreen()
                },
                trailingIcon: savedStore.isSaved(id: currentDeal.id) ? "heart.fill" : "heart",
                trailingAction: {
                    HapticEngine.medium()
                    savedStore.toggle(deal: currentDeal)
                }
            )

            VintageTerminalProgressRail(
                steps: flowSteps,
                currentIndex: currentStepIndex,
                tone: .amber
            )
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Booking progress: step \(currentStepIndex + 1) of \(flowSteps.count)")
        }
        .padding(.horizontal, Spacing.md)
        .padding(.top, Spacing.sm)
        .padding(.bottom, Spacing.sm)
        .background(Color.sgBg.opacity(0.82))
        .background(.ultraThinMaterial)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.sgBorder.opacity(0.5))
                .frame(height: 1)
        }
    }

    private func shareBoardingPass() {
        HapticEngine.medium()

        // Generate a beautiful boarding pass card image
        let origin = store.searchOrigin ?? settingsStore.departureCode
        let destination = store.searchDestination ?? currentDeal.iataCode
        let airline = store.selectedOffer?.airline ?? currentDeal.airlineName
        let date = (store.searchDepartureDate ?? currentDeal.bestDepartureDate ?? "").shortDate
        let reference: String = {
            if case .confirmed(let ref) = store.step { return ref }
            return store.bookingOrder?.bookingReference ?? "PENDING"
        }()
        let passenger = [store.passenger.title, store.passenger.firstName, store.passenger.lastName]
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .joined(separator: " ")

        let image = ShareCardRenderer.renderBoardingPass(
            origin: origin,
            destination: destination,
            destinationCity: currentDeal.destination,
            airline: airline,
            date: date,
            reference: reference,
            passenger: passenger.isEmpty ? "Traveler" : passenger,
            price: store.totalPrice > 0 ? store.totalPrice : currentDeal.displayPrice
        )

        shareItem = BookingShareItem(text: boardingPassShareText, cardImage: image)
    }

    private var boardingPassShareText: String {
        let origin = store.searchOrigin ?? settingsStore.departureCode
        let destination = store.searchDestination ?? currentDeal.iataCode
        let destinationName = currentDeal.destination
        let departure = (store.searchDepartureDate ?? currentDeal.bestDepartureDate ?? currentDeal.safeDepartureDate).shortDate
        let returnDate = (store.searchReturnDate ?? currentDeal.bestReturnDate ?? currentDeal.safeReturnDate).shortDate
        let travelerName = [store.passenger.title, store.passenger.firstName, store.passenger.lastName]
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .joined(separator: " ")
        let reference: String = {
            if case .confirmed(let bookingReference) = store.step {
                return bookingReference
            }
            return store.bookingOrder?.bookingReference ?? "Pending"
        }()

        return [
            "SoGoJet booking confirmed",
            "\(origin) to \(destinationName) (\(destination))",
            "Travel window: \(departure) to \(returnDate)",
            travelerName.isEmpty ? nil : "Traveler: \(travelerName)",
            "Reference: \(reference)",
        ]
        .compactMap { $0 }
        .joined(separator: "\n")
    }
}

private struct BookingShareItem: Identifiable {
    let id = UUID()
    let text: String
    let cardImage: UIImage?

    var activityItems: [Any] {
        var items: [Any] = []
        if let image = cardImage {
            items.append(image)
        }
        items.append(text)
        return items
    }
}

private struct BookingFlowShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview("Booking Flow") {
    BookingFlowView(deal: .preview)
        .environment(BookingStore())
        .environment(SettingsStore())
        .environment(SavedStore())
        .environment(Router())
        .environment(ToastManager())
        .environment(AuthStore())
        .environment(NetworkMonitor())
}
