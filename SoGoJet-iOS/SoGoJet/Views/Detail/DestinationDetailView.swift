import SwiftUI
import UIKit

struct DestinationDetailView: View {
    let deal: Deal
    let allDeals: [Deal]

    @Environment(SavedStore.self) private var savedStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(Router.self) private var router

    @State private var shareItem: DetailShareDealItem?

    private var isSaved: Bool {
        savedStore.isSaved(id: deal.id)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    heroSection
                    flightInfoSection
                    vibeTagsSection
                    travelGuideSection
                    itinerarySection
                    restaurantsSection
                    similarDealsSection
                }
                .padding(.bottom, 100)
            }
            .coordinateSpace(name: "detailScroll")
            .background(Color.sgBg)

            stickyBottomBar
        }
        .sheet(item: $shareItem) { item in
            DetailShareSheet(activityItems: item.activityItems)
        }
    }

    // MARK: - Hero Section (Parallax)
    private let parallaxFactor: CGFloat = 0.35

    private var heroSection: some View {
        GeometryReader { geo in
            let scrollY = geo.frame(in: .named("detailScroll")).minY
            let isPullingDown = scrollY > 0

            ZStack(alignment: .bottomLeading) {
                CachedAsyncImage(url: deal.imageUrl) {
                    Rectangle().fill(Color.sgSurface)
                }
                .frame(
                    width: geo.size.width,
                    height: isPullingDown ? 320 + scrollY : 320
                )
                .offset(y: isPullingDown ? -scrollY : -scrollY * parallaxFactor)
                .clipped()

                LinearGradient(
                    colors: [.clear, Color(hex: 0x0A0A0A, alpha: 0.8)],
                    startPoint: .center,
                    endPoint: .bottom
                )

                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(deal.city.uppercased())
                            .font(SGFont.display(size: 36))
                            .foregroundStyle(Color.sgWhite)
                            .minimumScaleFactor(0.7)
                            .lineLimit(2)
                        if !deal.country.isEmpty {
                            Text(deal.country)
                                .font(SGFont.body(size: 15))
                                .foregroundStyle(Color.sgWhite.opacity(0.7))
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        if deal.isEstimatedPrice {
                            Text("from")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(Color.sgWhite.opacity(0.7))
                        }
                        Text(deal.priceFormatted)
                            .font(SGFont.bodyBold(size: 24))
                            .foregroundStyle(Color.sgWhite)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(deal.tierColor)
                            .clipShape(Capsule())
                    }
                }
                .padding(16)
            }
        }
        .frame(height: 320)
        .clipped()
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge) // Cap scaling — hero overlay text
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(deal.city), \(deal.country), \(deal.priceFormatted)")
        .accessibilityAddTraits(.isHeader)
    }

    // MARK: - Flight Info
    @ViewBuilder
    private var flightInfoSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            let flightLine = buildFlightLine()
            if !flightLine.isEmpty {
                Text(flightLine)
                    .font(SGFont.body(size: 15))
                    .foregroundStyle(Color.sgWhite)
            }
            let dateLine = buildDateLine()
            if !dateLine.isEmpty {
                Text(dateLine)
                    .font(SGFont.body(size: 15))
                    .foregroundStyle(Color.sgMuted)
            }
            // Price transparency disclaimer for estimated prices
            if deal.isEstimatedPrice {
                HStack(spacing: 4) {
                    Image(systemName: "info.circle")
                        .font(.system(size: 11))
                    Text("Price shown is an estimate. Live prices are confirmed when you search flights.")
                        .font(.system(size: 11))
                }
                .foregroundStyle(Color.sgMuted.opacity(0.7))
                .padding(.top, 2)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Flight info: \(buildFlightLine()). \(buildDateLine())")
    }

    private func buildFlightLine() -> String {
        var parts: [String] = []
        if deal.airlineName != "\u{2014}" { parts.append(deal.airlineName) }
        if let d = deal.flightDuration, !d.isEmpty { parts.append(d) }
        let s = deal.stopsLabel
        if !s.isEmpty { parts.append(s) }
        return parts.joined(separator: " \u{00B7} ")
    }

    private func buildDateLine() -> String {
        var parts: [String] = []
        if let dep = deal.bestDepartureDate, let ret = deal.bestReturnDate {
            parts.append("\(dep.shortDate) \u{2013} \(ret.shortDate)")
        } else if let dep = deal.bestDepartureDate {
            parts.append(dep.shortDate)
        }
        if deal.tripDays > 0 { parts.append("\(deal.tripDays) days") }
        return parts.joined(separator: " \u{00B7} ")
    }

    // MARK: - Travel Guide
    @ViewBuilder
    private var travelGuideSection: some View {
        let hasContent = !deal.description.isEmpty || deal.bestMonths != nil || deal.averageTemp != nil
        if hasContent {
            VStack(alignment: .leading, spacing: 12) {
                Text("TRAVEL GUIDE")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.5)
                    .accessibilityAddTraits(.isHeader)

                if !deal.description.isEmpty {
                    Text(deal.description)
                        .font(SGFont.body(size: 15))
                        .foregroundStyle(Color.sgWhiteDim)
                        .lineSpacing(4)
                }

                if let months = deal.bestMonths, !months.isEmpty {
                    Label {
                        Text("Best months: \(months.joined(separator: ", "))")
                            .font(SGFont.body(size: 14))
                            .foregroundStyle(Color.sgWhiteDim)
                    } icon: {
                        Image(systemName: "sun.max")
                            .foregroundStyle(Color.sgYellow)
                    }
                }

                if let temp = deal.averageTemp {
                    Label {
                        Text("Avg temp: \(Int(temp))\u{00B0}")
                            .font(SGFont.body(size: 14))
                            .foregroundStyle(Color.sgWhiteDim)
                    } icon: {
                        Image(systemName: "thermometer.medium")
                            .foregroundStyle(Color.sgOrange)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 16)
            .padding(.top, 8)
        }
    }

    // MARK: - Vibe Tags

    @ViewBuilder
    private var vibeTagsSection: some View {
        if !deal.safeVibeTags.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(deal.safeVibeTags, id: \.self) { tag in
                        Text(tag)
                            .font(SGFont.bodyBold(size: 12))
                            .foregroundStyle(Color.sgYellow)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.sgYellow.opacity(0.12))
                            .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.top, 4)
        }
    }

    // MARK: - Itinerary

    /// The itinerary trimmed to match the trip duration.
    /// If the trip is 5 days, show 5 days. If 7, show 7.
    /// Falls back to showing all available days.
    private var matchedItinerary: [ItineraryDay] {
        guard let itinerary = deal.itinerary, !itinerary.isEmpty else { return [] }
        let tripLength = deal.tripDays
        if tripLength > 0 {
            return Array(itinerary.prefix(tripLength))
        }
        return itinerary
    }

    @ViewBuilder
    private var itinerarySection: some View {
        if !matchedItinerary.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(deal.tripDays > 0 ? "\(deal.tripDays)-DAY ITINERARY" : "THINGS TO DO")
                        .font(SGFont.bodyBold(size: 13))
                        .foregroundStyle(Color.sgMuted)
                        .tracking(1.5)
                        .accessibilityAddTraits(.isHeader)
                    Spacer()
                    if deal.tripDays > 0 {
                        Text("\(deal.tripDays) days")
                            .font(SGFont.body(size: 12))
                            .foregroundStyle(Color.sgYellow)
                    }
                }

                VStack(alignment: .leading, spacing: 16) {
                    ForEach(Array(matchedItinerary.enumerated()), id: \.offset) { _, day in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 8) {
                                Text("Day \(day.day)")
                                    .font(SGFont.bodyBold(size: 14))
                                    .foregroundStyle(Color.sgYellow)
                                    .frame(width: 48, alignment: .leading)

                                Rectangle()
                                    .fill(Color.sgBorder)
                                    .frame(height: 1)
                            }

                            ForEach(day.activities, id: \.self) { activity in
                                // Tappable — opens in Apple Maps search
                                Button {
                                    openInMaps(activity, city: deal.city)
                                } label: {
                                    HStack(alignment: .top, spacing: 8) {
                                        Image(systemName: "mappin.circle.fill")
                                            .font(.system(size: 14))
                                            .foregroundStyle(Color.sgGreen)
                                            .frame(width: 20)
                                        Text(activity)
                                            .font(SGFont.body(size: 14))
                                            .foregroundStyle(Color.sgWhiteDim)
                                            .lineSpacing(2)
                                            .multilineTextAlignment(.leading)
                                        Spacer(minLength: 0)
                                        Image(systemName: "arrow.up.right.square")
                                            .font(.system(size: 11))
                                            .foregroundStyle(Color.sgMuted)
                                    }
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Open \(activity) in Maps")
                            }
                        }
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 16)
            .padding(.top, 12)
        }
    }

    /// Open a place in Apple Maps by searching for it in the destination city.
    private func openInMaps(_ place: String, city: String) {
        let query = "\(place), \(city)".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? place
        if let url = URL(string: "maps://?q=\(query)") {
            UIApplication.shared.open(url)
        }
    }

    // MARK: - Restaurants

    @ViewBuilder
    private var restaurantsSection: some View {
        if let restaurants = deal.restaurants, !restaurants.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("WHERE TO EAT")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.5)
                    .accessibilityAddTraits(.isHeader)

                VStack(spacing: 0) {
                    ForEach(Array(restaurants.enumerated()), id: \.offset) { index, restaurant in
                        HStack(spacing: 12) {
                            // Restaurant icon
                            Image(systemName: "fork.knife")
                                .font(.system(size: 14))
                                .foregroundStyle(Color.sgOrange)
                                .frame(width: 32, height: 32)
                                .background(Color.sgOrange.opacity(0.12))
                                .clipShape(Circle())

                            VStack(alignment: .leading, spacing: 2) {
                                Text(restaurant.name)
                                    .font(SGFont.bodyBold(size: 14))
                                    .foregroundStyle(Color.sgWhite)
                                Text(restaurant.type)
                                    .font(SGFont.body(size: 12))
                                    .foregroundStyle(Color.sgMuted)
                            }

                            Spacer()

                            // Star rating
                            HStack(spacing: 2) {
                                Image(systemName: "star.fill")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Color.sgYellow)
                                Text(String(format: "%.1f", restaurant.rating))
                                    .font(SGFont.bodyBold(size: 13))
                                    .foregroundStyle(Color.sgWhite)
                            }
                        }
                        .padding(.vertical, 10)

                        if index < restaurants.count - 1 {
                            Rectangle()
                                .fill(Color.sgBorder)
                                .frame(height: 1)
                        }
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 16)
            .padding(.top, 12)
        }
    }

    // MARK: - Similar Deals
    @ViewBuilder
    private var similarDealsSection: some View {
        let similar = Array(allDeals.filter { $0.id != deal.id }.prefix(8))
        if !similar.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("SIMILAR DESTINATIONS")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.5)
                    .padding(.horizontal, 16)
                    .accessibilityAddTraits(.isHeader)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(similar, id: \.id) { otherDeal in
                            similarCard(otherDeal)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.top, 16)
        }
    }

    private func similarCard(_ otherDeal: Deal) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            CachedAsyncImage(url: otherDeal.imageUrl) {
                RoundedRectangle(cornerRadius: 8).fill(Color.sgSurface)
            }
            .frame(width: 140, height: 100)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            Text(otherDeal.city)
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgWhite)
                .lineLimit(1)
            Text(otherDeal.priceFormatted)
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(Color.sgYellow)
        }
        .frame(width: 140)
        .contentShape(Rectangle())
        .onTapGesture {
            HapticEngine.light()
            router.showDeal(otherDeal)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(otherDeal.city), \(otherDeal.priceFormatted)")
        .accessibilityHint("View deal details")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Sticky Bottom Bar
    private var stickyBottomBar: some View {
        HStack(spacing: 12) {
            Button {
                HapticEngine.medium()
                savedStore.toggle(deal: deal)
            } label: {
                Image(systemName: isSaved ? "heart.fill" : "heart")
                    .font(.system(size: 20))
                    .foregroundStyle(isSaved ? Color.sgYellow : Color.sgWhite)
                    .frame(width: 48, height: 48)
                    .background(Color.sgSurface)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isSaved ? "Remove from saved" : "Save \(deal.city)")

            Button {
                HapticEngine.light()
                Task {
                    let image = await ShareCardRenderer.render(deal: deal, size: .story)
                    shareItem = DetailShareDealItem(deal: deal, cardImage: image)
                }
            } label: {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 18))
                    .foregroundStyle(Color.sgWhite)
                    .frame(width: 48, height: 48)
                    .background(Color.sgSurface)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Share \(deal.city)")

            Button {
                HapticEngine.medium()
                router.startBooking(deal)
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "airplane.departure")
                    Text("Search Flights")
                        .font(SGFont.bodyBold(size: 16))
                }
                .foregroundStyle(Color.sgBg)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Color.sgYellow)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Search flights to \(deal.city)")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            Color.sgBg.opacity(0.95)
                .background(.ultraThinMaterial)
        )
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge) // Cap scaling — sticky bar layout
    }
}

// MARK: - Share Helpers

private struct DetailShareDealItem: Identifiable {
    let id = UUID()
    let deal: Deal
    let cardImage: UIImage?

    var activityItems: [Any] {
        var items: [Any] = []
        if let image = cardImage {
            items.append(image)
        }
        items.append(deal.shareText)
        if let url = deal.shareURL {
            items.append(url)
        }
        return items
    }
}

private struct DetailShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    DestinationDetailView(
        deal: .preview,
        allDeals: [.preview, .previewNonstop]
    )
    .environment(SavedStore())
    .environment(SettingsStore())
    .environment(Router())
    .environment(ToastManager())
}
