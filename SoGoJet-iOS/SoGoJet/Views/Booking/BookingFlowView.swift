import SwiftUI
import UIKit

struct BookingFlowView: View {
    @Environment(BookingStore.self) private var store
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(Router.self) private var router

    let deal: Deal

    @State private var shareItem: BookingShareItem?

    private var currentDeal: Deal {
        store.deal ?? deal
    }

    private var flowSteps: [String] {
        ["Search", "Traveler", "Seats", "Review", "Issued"]
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
            return "Flight Desk"
        case .passengers:
            return "Traveler Record"
        case .seats:
            return "Cabin Map"
        case .review, .paying:
            return "Final Review"
        case .confirmed:
            return "Issued Ticket"
        }
    }

    private var chromeSubtitle: String {
        switch store.step {
        case .idle, .searching:
            return "Compare live inventory, date windows, and nearby origin markets before booking."
        case .trip:
            return "Choose the live fare that feels right, then move into traveler details."
        case .failed:
            return "The live route needs another scan. Adjust the window or try the search again."
        case .passengers:
            return "Capture the lead traveler exactly as it should appear on the booking record."
        case .seats:
            return "Pick a cabin position or skip ahead if you want the provider to assign it later."
        case .review:
            return "Confirm the route, traveler, seats, and fare ledger before issuing payment."
        case .paying:
            return "Payment is in motion. Keep this terminal open while the order is being issued."
        case .confirmed:
            return "Your booking is archived and ready to share or return to the board."
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
            BookingFlowShareSheet(activityItems: [item.text])
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
                eyebrow: "Booking Flow",
                title: chromeTitle,
                subtitle: chromeSubtitle,
                stamp: currentDeal.iataCode,
                tone: .amber,
                leadingIcon: "xmark",
                leadingAction: {
                    HapticEngine.light()
                    router.dismissFullScreen()
                },
                trailingIcon: nil,
                trailingAction: nil
            )

            VintageTerminalProgressRail(
                steps: flowSteps,
                currentIndex: currentStepIndex,
                tone: .amber
            )
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
        shareItem = BookingShareItem(text: boardingPassShareText)
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
        .environment(Router())
        .environment(ToastManager())
}
