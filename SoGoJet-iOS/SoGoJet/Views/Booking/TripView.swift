import SwiftUI

// MARK: - Trip View
// "Your Trip" screen — first step of the booking flow.
// Shows the selected deal as a hero card with alternative date options,
// triggers Duffel search, and handles price discrepancy scenarios.

struct TripView: View {
    @Environment(BookingStore.self) private var store
    let deal: Deal

    @State private var alternativesExpanded = false
    @State private var showPriceAlert = false
    @State private var priceAlertOption: TripOption?

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            switch store.step {
            case .idle:
                idleContent
            case .searching:
                searchingContent
            case .trip(let options):
                tripContent(options: options)
            case .failed(let message):
                failedContent(message: message)
            default:
                EmptyView()
            }
        }
        .alert("Price Changed", isPresented: $showPriceAlert) {
            Button("Continue Anyway") {
                if let option = priceAlertOption {
                    store.selectOffer(option)
                }
            }
            Button("Back to Deals", role: .cancel) {
                store.reset()
            }
        } message: {
            if let option = priceAlertOption, let feedPrice = deal.displayPrice {
                Text("The live price is $\(Int(option.price)), up from $\(Int(feedPrice)). Prices change frequently — this is the current best rate.")
            }
        }
    }

    // MARK: - Idle (pre-search)

    private var idleContent: some View {
        ScrollView {
            VStack(spacing: Spacing.lg) {
                header
                heroCard
                searchButton
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
    }

    // MARK: - Searching

    private var searchingContent: some View {
        VStack(spacing: Spacing.lg) {
            header
            heroCard

            VStack(spacing: Spacing.md) {
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(Color.sgYellow)
                    .scaleEffect(1.2)

                Text("Searching live prices...")
                    .font(SGFont.bodyDefault)
                    .foregroundStyle(Color.sgMuted)
            }
            .padding(.top, Spacing.lg)

            Spacer()
        }
        .padding(.horizontal, Spacing.md)
    }

    // MARK: - Trip Options

    private func tripContent(options: [TripOption]) -> some View {
        ScrollView {
            VStack(spacing: Spacing.lg) {
                header

                if let best = options.first {
                    // Check price discrepancy
                    if let feedPrice = deal.displayPrice, best.price > feedPrice * 1.5 {
                        DealExpiredView(feedPrice: feedPrice, livePrice: best.price) {
                            store.reset()
                        }
                    } else {
                        bestOfferCard(best)

                        if options.count > 1 {
                            alternativesSection(Array(options.dropFirst()))
                        }

                        continueButton(best)
                    }
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
    }

    // MARK: - Failed

    private func failedContent(message: String) -> some View {
        VStack(spacing: Spacing.lg) {
            Spacer()

            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(Color.sgOrange)

            Text("Search Failed")
                .font(SGFont.cardTitle)
                .foregroundStyle(Color.sgWhite)

            Text(message)
                .font(SGFont.bodyDefault)
                .foregroundStyle(Color.sgMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.lg)

            Button {
                Task {
                    guard let departureDate = deal.bestDepartureDate,
                          let returnDate = deal.bestReturnDate else {
                        return
                    }
                    await store.searchFlights(
                        origin: "JFK",
                        destination: deal.iataCode,
                        departureDate: departureDate,
                        returnDate: returnDate
                    )
                }
            } label: {
                Text("Try Again")
                    .font(SGFont.bodyBold(size: 16))
                    .foregroundStyle(Color.sgBg)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.md)
                    .background(Color.sgYellow)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            }
            .padding(.horizontal, Spacing.lg)

            Spacer()
        }
    }

    // MARK: - Subviews

    private var header: some View {
        HStack {
            SplitFlapRow(
                text: "YOUR TRIP",
                maxLength: 10,
                size: .md,
                color: Color.sgYellow,
                animate: true,
                staggerMs: 40
            )
            Spacer()
        }
        .padding(.top, Spacing.md)
    }

    private var heroCard: some View {
        VStack(spacing: 0) {
            // Destination image
            CachedAsyncImage(url: deal.imageUrl) {
                Color.sgSurface
            }
            .frame(height: 200)
            .clipped()

            // Info overlay
            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        Text(deal.destination)
                            .font(SGFont.cardTitle)
                            .foregroundStyle(Color.sgWhite)

                        Text(deal.country)
                            .font(SGFont.bodyDefault)
                            .foregroundStyle(Color.sgMuted)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        Text("from")
                            .font(SGFont.caption)
                            .foregroundStyle(Color.sgMuted)
                        Text(deal.priceFormatted)
                            .font(SGFont.price)
                            .foregroundStyle(Color.sgYellow)
                        Text("round trip")
                            .font(SGFont.caption)
                            .foregroundStyle(Color.sgMuted)
                    }
                }

                HStack(spacing: Spacing.md) {
                    infoChip(icon: "calendar", text: deal.safeDepartureDate)
                    infoChip(icon: "airplane", text: deal.airlineName)
                    infoChip(icon: "clock", text: deal.safeFlightDuration)
                }
            }
            .padding(Spacing.md)
            .background(Color.sgCell)
        }
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    private func infoChip(icon: String, text: String) -> some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 10))
            Text(text)
                .font(SGFont.bodySmall)
        }
        .foregroundStyle(Color.sgWhiteDim)
    }

    private var searchButton: some View {
        Button {
            Task {
                guard let departureDate = deal.bestDepartureDate,
                      let returnDate = deal.bestReturnDate else {
                    return
                }
                await store.searchFlights(
                    origin: "JFK",
                    destination: deal.iataCode,
                    departureDate: departureDate,
                    returnDate: returnDate
                )
            }
        } label: {
            HStack(spacing: Spacing.sm) {
                Image(systemName: "airplane.departure")
                    .font(.system(size: 14, weight: .semibold))
                Text("Search Live Prices")
                    .font(SGFont.bodyBold(size: 16))
            }
            .foregroundStyle(Color.sgBg)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.md)
            .background(Color.sgYellow)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        }
    }

    private func bestOfferCard(_ offer: TripOption) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack {
                Text("Best Available")
                    .font(SGFont.bodyBold(size: 12))
                    .foregroundStyle(Color.sgGreen)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.xs)
                    .background(Color.sgGreen.opacity(0.15))
                    .clipShape(Capsule())

                Spacer()

                Text("$\(Int(offer.price))")
                    .font(SGFont.price)
                    .foregroundStyle(Color.sgYellow)
            }

            HStack(spacing: Spacing.md) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(offer.airline)
                        .font(SGFont.bodyBold(size: 14))
                        .foregroundStyle(Color.sgWhite)
                    Text(offer.flightNumber)
                        .font(SGFont.bodySmall)
                        .foregroundStyle(Color.sgMuted)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(offer.duration)
                        .font(SGFont.bodyDefault)
                        .foregroundStyle(Color.sgWhiteDim)
                    Text(offer.stops == 0 ? "Nonstop" : "\(offer.stops) stop\(offer.stops > 1 ? "s" : "")")
                        .font(SGFont.bodySmall)
                        .foregroundStyle(offer.stops == 0 ? Color.sgGreen : Color.sgMuted)
                }
            }

            if let cabinClass = offer.cabinClass {
                Text(cabinClass.capitalized)
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgMuted)
            }
        }
        .padding(Spacing.md)
        .background(Color.sgCell)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    private func alternativesSection(_ options: [TripOption]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Button {
                withAnimation(.easeInOut(duration: 0.25)) {
                    alternativesExpanded.toggle()
                }
            } label: {
                HStack {
                    Text("Other Options (\(options.count))")
                        .font(SGFont.sectionHead)
                        .foregroundStyle(Color.sgWhiteDim)

                    Spacer()

                    Image(systemName: alternativesExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.sgMuted)
                }
            }

            if alternativesExpanded {
                ForEach(options.prefix(5)) { option in
                    alternativeRow(option)
                }
            }
        }
    }

    private func alternativeRow(_ option: TripOption) -> some View {
        Button {
            handleOfferSelection(option)
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(option.airline)
                        .font(SGFont.bodyBold(size: 13))
                        .foregroundStyle(Color.sgWhite)
                    Text("\(option.duration) \(option.stops == 0 ? "Nonstop" : "\(option.stops) stop\(option.stops > 1 ? "s" : "")")")
                        .font(SGFont.bodySmall)
                        .foregroundStyle(Color.sgMuted)
                }

                Spacer()

                Text("$\(Int(option.price))")
                    .font(SGFont.bodyBold(size: 16))
                    .foregroundStyle(Color.sgYellow)
            }
            .padding(Spacing.sm + Spacing.xs)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .strokeBorder(Color.sgBorder, lineWidth: 1)
            )
        }
    }

    private func continueButton(_ bestOffer: TripOption) -> some View {
        Button {
            handleOfferSelection(bestOffer)
        } label: {
            Text("Continue to Booking")
                .font(SGFont.bodyBold(size: 16))
                .foregroundStyle(Color.sgBg)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(Color.sgYellow)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        }
        .padding(.top, Spacing.sm)
    }

    // MARK: - Price Discrepancy Handling

    private func handleOfferSelection(_ offer: TripOption) {
        guard let feedPrice = deal.displayPrice else {
            store.selectOffer(offer)
            return
        }

        let increase = (offer.price - feedPrice) / feedPrice

        if increase > 0.15 {
            // 15-50% increase: show alert dialog
            priceAlertOption = offer
            showPriceAlert = true
        } else {
            store.selectOffer(offer)
        }
    }
}

// MARK: - Preview

#Preview("Trip View") {
    TripView(deal: .preview)
        .environment(BookingStore())
}
