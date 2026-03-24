import SwiftUI

// MARK: - DestinationDetailView
// Full detail page for a deal, presented as a sheet or fullScreenCover.

struct DestinationDetailView: View {
    let deal: Deal
    let allDeals: [Deal]

    @Environment(SavedStore.self) private var savedStore
    @Environment(Router.self) private var router
    @State private var animateTitle = false

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    // MARK: Hero Image
                    heroSection

                    // MARK: Title Block
                    titleBlock
                        .padding(.horizontal, Spacing.md)

                    // MARK: Deal Tier Badge
                    if let tier = deal.dealTier, tier != .fair {
                        tierBadge(tier)
                            .padding(.horizontal, Spacing.md)
                    }

                    // MARK: Price Card
                    priceCard
                        .padding(.horizontal, Spacing.md)

                    // MARK: Quick Facts
                    QuickFactsStrip(deal: deal)

                    // MARK: Trip Details Grid
                    tripDetailsGrid
                        .padding(.horizontal, Spacing.md)

                    // MARK: Description
                    if !deal.description.isEmpty {
                        descriptionSection
                            .padding(.horizontal, Spacing.md)
                    }

                    // MARK: Vibe Tags
                    if !deal.vibeTags.isEmpty {
                        vibeTagsRow
                            .padding(.horizontal, Spacing.md)
                    }

                    // MARK: Itinerary
                    if let itinerary = deal.itinerary, !itinerary.isEmpty {
                        itinerarySection(itinerary)
                            .padding(.horizontal, Spacing.md)
                    }

                    // MARK: Restaurants
                    if let restaurants = deal.restaurants, !restaurants.isEmpty {
                        restaurantSection(restaurants)
                            .padding(.horizontal, Spacing.md)
                    }

                    // MARK: Price Alert CTA
                    PriceAlertCTA(destinationName: deal.destination, price: deal.price)
                        .padding(.horizontal, Spacing.md)

                    // MARK: Similar Deals
                    SimilarDeals(deals: allDeals, currentDealId: deal.id) { tappedDeal in
                        router.showDeal(tappedDeal)
                    }

                    // Bottom spacer for sticky bar
                    Spacer()
                        .frame(height: 100)
                }
            }

            // MARK: Sticky Bottom Bar
            stickyBottomBar
        }
        .background(Color.sgBg)
        .ignoresSafeArea(edges: .top)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                animateTitle = true
            }
        }
    }

    // MARK: - Hero Section

    private var heroSection: some View {
        ZStack(alignment: .topLeading) {
            CachedAsyncImage(url: deal.imageUrl) {
                Color.sgSurface
            }
            .frame(height: 360)
            .clipped()

            // Gradient overlay
            VStack {
                Spacer()
                LinearGradient(
                    colors: [.clear, Color.sgBg.opacity(0.9)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 160)
            }

            // Back button
            Button {
                HapticEngine.light()
                router.dismissSheet()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.sgWhite)
                    .frame(width: 36, height: 36)
                    .background(Color.sgBg.opacity(0.6))
                    .clipShape(Circle())
            }
            .padding(.top, 56)
            .padding(.leading, Spacing.md)
        }
        .frame(height: 360)
    }

    // MARK: - Title Block

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            SplitFlapRow(
                text: deal.destination.uppercased(),
                maxLength: 14,
                size: .lg,
                color: Color.sgWhite,
                animate: animateTitle,
                staggerMs: 35
            )

            Text(deal.country)
                .font(SGFont.bodyBold(size: 15))
                .foregroundStyle(Color.sgMuted)

            if !deal.tagline.isEmpty {
                Text(deal.tagline)
                    .font(SGFont.tagline)
                    .foregroundStyle(Color.sgWhiteDim)
                    .padding(.top, Spacing.xs)
            }
        }
    }

    // MARK: - Deal Tier Badge

    @ViewBuilder
    private func tierBadge(_ tier: DealTier) -> some View {
        HStack(spacing: Spacing.sm) {
            Circle()
                .fill(tier.color)
                .frame(width: 8, height: 8)
            Text(tier.label)
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(tier.color)
            if let pct = deal.savingsPercent {
                Text("\(Int(pct))% off")
                    .font(SGFont.bodySmall)
                    .foregroundStyle(Color.sgMuted)
            }
        }
    }

    // MARK: - Price Card

    private var priceCard: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Round trip from")
                .font(SGFont.bodySmall)
                .foregroundStyle(Color.sgMuted)

            HStack(alignment: .lastTextBaseline, spacing: Spacing.sm) {
                SplitFlapRow(
                    text: deal.priceFormatted,
                    maxLength: 6,
                    size: .lg,
                    color: Color.sgYellow,
                    alignment: .leading,
                    animate: animateTitle,
                    startDelay: 0.3,
                    staggerMs: 50
                )

                if let usual = deal.usualPrice {
                    Text("$\(Int(usual))")
                        .font(SGFont.bodySmall)
                        .foregroundStyle(Color.sgMuted)
                        .strikethrough(color: Color.sgMuted)
                }

                if let pct = deal.savingsPercent, pct > 0 {
                    Text("Save \(Int(pct))%")
                        .font(SGFont.bodyBold(size: 12))
                        .foregroundStyle(Color.sgGreen)
                        .padding(.horizontal, Spacing.sm)
                        .padding(.vertical, Spacing.xs)
                        .background(Color.sgGreen.opacity(0.15))
                        .clipShape(Capsule())
                }
            }
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.sgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
    }

    // MARK: - Trip Details Grid

    private var tripDetailsGrid: some View {
        let items: [(icon: String, label: String, value: String)] = [
            ("airplane.departure", "Depart", deal.departureDate),
            ("airplane.arrival", "Return", deal.returnDate),
            ("clock.fill", "Duration", deal.flightDuration),
            ("ticket.fill", "Flight", deal.airlineName),
        ]

        return LazyVGrid(
            columns: [GridItem(.flexible()), GridItem(.flexible())],
            spacing: Spacing.sm
        ) {
            ForEach(items, id: \.label) { item in
                HStack(spacing: Spacing.sm) {
                    Image(systemName: item.icon)
                        .font(.system(size: 14))
                        .foregroundStyle(Color.sgOrange)
                        .frame(width: 20)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.label)
                            .font(SGFont.caption)
                            .foregroundStyle(Color.sgMuted)
                        Text(item.value)
                            .font(SGFont.bodyBold(size: 13))
                            .foregroundStyle(Color.sgWhite)
                            .lineLimit(1)
                    }
                    Spacer()
                }
                .padding(Spacing.sm + 2)
                .background(Color.sgSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
            }
        }
    }

    // MARK: - Description

    private var descriptionSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("About")
                .font(SGFont.sectionHead)
                .foregroundStyle(Color.sgWhite)
            Text(deal.description)
                .font(SGFont.bodyDefault)
                .foregroundStyle(Color.sgWhiteDim)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Vibe Tags

    private var vibeTagsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.sm) {
                ForEach(deal.vibeTags, id: \.self) { tag in
                    Text(tag)
                        .font(SGFont.bodyBold(size: 12))
                        .foregroundStyle(Color.sgOrange)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.sm)
                        .background(Color.sgOrange.opacity(0.12))
                        .clipShape(Capsule())
                }
            }
        }
    }

    // MARK: - Itinerary

    @ViewBuilder
    private func itinerarySection(_ days: [ItineraryDay]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Itinerary")
                .font(SGFont.sectionHead)
                .foregroundStyle(Color.sgWhite)

            ForEach(days, id: \.day) { day in
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("Day \(day.day)")
                        .font(SGFont.bodyBold(size: 13))
                        .foregroundStyle(Color.sgYellow)
                        .padding(.horizontal, Spacing.sm)
                        .padding(.vertical, Spacing.xs)
                        .background(Color.sgYellow.opacity(0.12))
                        .clipShape(Capsule())

                    ForEach(day.activities, id: \.self) { activity in
                        HStack(alignment: .top, spacing: Spacing.sm) {
                            Circle()
                                .fill(Color.sgMuted)
                                .frame(width: 5, height: 5)
                                .padding(.top, 6)
                            Text(activity)
                                .font(SGFont.bodySmall)
                                .foregroundStyle(Color.sgWhiteDim)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Restaurants

    @ViewBuilder
    private func restaurantSection(_ restaurants: [Restaurant]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Restaurants")
                .font(SGFont.sectionHead)
                .foregroundStyle(Color.sgWhite)

            ForEach(restaurants, id: \.name) { restaurant in
                HStack(spacing: Spacing.md) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(restaurant.name)
                            .font(SGFont.bodyBold(size: 14))
                            .foregroundStyle(Color.sgWhite)
                        Text(restaurant.type)
                            .font(SGFont.bodySmall)
                            .foregroundStyle(Color.sgMuted)
                    }
                    Spacer()
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "star.fill")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.sgYellow)
                        Text(String(format: "%.1f", restaurant.rating))
                            .font(SGFont.bodyBold(size: 13))
                            .foregroundStyle(Color.sgYellow)
                    }
                }
                .padding(Spacing.sm + 2)
                .background(Color.sgSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
            }
        }
    }

    // MARK: - Sticky Bottom Bar

    private var stickyBottomBar: some View {
        HStack(spacing: Spacing.md) {
            // Save button
            Button {
                savedStore.toggle(deal: deal)
            } label: {
                Image(systemName: savedStore.isSaved(id: deal.id) ? "heart.fill" : "heart")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(savedStore.isSaved(id: deal.id) ? Color.sgRed : Color.sgWhite)
                    .frame(width: 44, height: 44)
                    .background(Color.sgSurface)
                    .clipShape(Circle())
            }

            // Share button
            ShareLink(item: deal.affiliateUrl) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Color.sgWhite)
                    .frame(width: 44, height: 44)
                    .background(Color.sgSurface)
                    .clipShape(Circle())
            }

            Spacer()

            // Search Flights CTA
            Button {
                HapticEngine.medium()
                router.startBooking(deal)
            } label: {
                Text("Search Flights")
                    .font(SGFont.bodyBold(size: 16))
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.md)
                    .background(Color.sgYellow)
                    .clipShape(Capsule())
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm + 2)
        .background(
            Color.sgBg
                .shadow(color: .black.opacity(0.4), radius: 12, y: -4)
        )
    }
}

// MARK: - Preview

#Preview {
    DestinationDetailView(
        deal: .preview,
        allDeals: [.preview, .previewNonstop]
    )
    .environment(SavedStore())
    .environment(Router())
}
