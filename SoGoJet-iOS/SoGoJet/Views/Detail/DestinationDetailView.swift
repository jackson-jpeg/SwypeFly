import SwiftUI
import UIKit
import MapKit

struct DestinationDetailView: View {
    let deal: Deal
    let allDeals: [Deal]

    @Environment(SavedStore.self) private var savedStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(Router.self) private var router
    @Environment(ToastManager.self) private var toastManager
    @Environment(RecentlyViewedStore.self) private var recentlyViewedStore

    @State private var shareItem: DetailShareDealItem?
    @State private var travelers: Int = 1

    private var isSaved: Bool {
        savedStore.isSaved(id: deal.id)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    heroSection
                    flightInfoSection
                    dealHighlightSection
                    vibeTagsSection
                    photoGallerySection
                    miniMapSection
                    travelGuideSection
                    weatherSection
                    tripBudgetSection
                    travelTipsSection
                    itinerarySection
                    restaurantsSection
                    similarDealsSection
                    nearbyDestinationsSection
                }
                .padding(.bottom, 100)
            }
            .coordinateSpace(name: "detailScroll")
            .background(Color.sgBg)

            stickyBottomBar
        }
        .onAppear {
            // Donate Siri shortcut for this destination
            SiriShortcuts.donateDealView(city: deal.city, dealId: deal.id)
            // Track in recently viewed
            recentlyViewedStore.recordView(deal: deal)
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
                            HStack(spacing: 3) {
                                Text("from")
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundStyle(Color.sgWhite.opacity(0.7))
                                PriceInfoButton()
                            }
                        }
                        Text(deal.priceFormatted)
                            .font(SGFont.bodyBold(size: 24))
                            .foregroundStyle(Color.sgWhite)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(deal.tierColor)
                            .clipShape(Capsule())
                        if let localPrice = deal.displayPrice.flatMap({ CurrencyHelper.convertFromUSD(amount: $0) }) {
                            Text(localPrice)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Color.sgWhite.opacity(0.6))
                        }
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
            // Time zone difference
            if let tzDiff = deal.timeZoneDifference {
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.system(size: 12))
                    Text(tzDiff)
                        .font(.system(size: 13, weight: .medium))
                }
                .foregroundStyle(Color.sgMuted)
                .padding(.top, 2)
            }
            // Price freshness indicator
            if let freshnessLabel = deal.priceFreshnessLabel, let freshness = deal.priceFreshness {
                HStack(spacing: 4) {
                    Circle()
                        .fill(freshnessColor(freshness))
                        .frame(width: 6, height: 6)
                    Text(freshnessLabel)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(freshnessColor(freshness))
                }
                .padding(.top, 2)
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

            // Visa requirement indicator
            visaIndicator

            // Watch Price button — saves the deal so FareDropMonitor tracks it
            priceWatchButton
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

    private func freshnessColor(_ freshness: Deal.PriceFreshness) -> Color {
        switch freshness {
        case .fresh: return Color.sgDealAmazing
        case .stale: return Color.sgYellow
        case .old:   return Color.sgRed
        }
    }

    // MARK: - Visa Indicator

    @ViewBuilder
    private var visaIndicator: some View {
        let status = VisaRequirement.status(for: deal.country)
        if status != .unknown {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: status.icon)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(status.color)
                    Text(status.label)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(status.color)
                }
                Text("Check travel.state.gov for current requirements")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.sgMuted.opacity(0.6))
            }
            .padding(.top, 4)
        }
    }

    // MARK: - Price Watch

    @ViewBuilder
    private var priceWatchButton: some View {
        if deal.hasPrice {
            Button {
                HapticEngine.medium()
                if isSaved {
                    // Already watching — remove from saved
                    savedStore.toggle(deal: deal)
                    toastManager.show(
                        message: "Price alert removed for \(deal.city)",
                        type: .info
                    )
                } else {
                    // Save the deal so FareDropMonitor picks it up
                    savedStore.toggle(deal: deal)
                    toastManager.show(
                        message: "Price alert set for \(deal.city)",
                        type: .success
                    )
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: isSaved ? "eye.fill" : "bell.badge")
                        .font(.system(size: 12, weight: .semibold))
                    Text(isSaved ? "Watching" : "Watch Price")
                        .font(SGFont.bodyBold(size: 13))
                }
                .foregroundStyle(isSaved ? Color.sgGreen : Color.sgYellow)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(
                    (isSaved ? Color.sgGreen : Color.sgYellow).opacity(0.12)
                )
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .strokeBorder(
                            (isSaved ? Color.sgGreen : Color.sgYellow).opacity(0.3),
                            lineWidth: 1
                        )
                )
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
            .accessibilityLabel(isSaved ? "Stop watching price for \(deal.city)" : "Watch price for \(deal.city)")
        }
    }

    // MARK: - Photo Gallery

    @ViewBuilder
    private var photoGallerySection: some View {
        // Show gallery only if there are 2+ photos (hero already shows the first)
        if let urls = deal.imageUrls, urls.count >= 2 {
            VStack(alignment: .leading, spacing: 8) {
                Text("PHOTOS")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.5)
                    .padding(.horizontal, 16)
                    .accessibilityAddTraits(.isHeader)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        // Skip the first image (already in hero), show the rest
                        ForEach(Array(urls.dropFirst().prefix(6).enumerated()), id: \.offset) { _, url in
                            CachedAsyncImage(url: url) {
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(Color.sgSurface)
                            }
                            .frame(width: 180, height: 130)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.top, 12)
        }
    }

    // MARK: - Mini Map

    /// Look up the departure airport from the shared airport list.
    private var departureAirport: AirportPicker.Airport? {
        AirportPicker.airports.first { $0.code == settingsStore.departureCode }
    }

    /// Build a map region that fits both origin and destination with padding.
    private func routeRegion(
        origin: CLLocationCoordinate2D,
        destination: CLLocationCoordinate2D
    ) -> MKCoordinateRegion {
        let midLat = (origin.latitude + destination.latitude) / 2
        let midLon = (origin.longitude + destination.longitude) / 2
        let dLat = abs(origin.latitude - destination.latitude)
        let dLon = abs(origin.longitude - destination.longitude)
        // Add 40% padding so pins aren't at the very edge
        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: midLat, longitude: midLon),
            span: MKCoordinateSpan(
                latitudeDelta: max(dLat * 1.4, 0.1),
                longitudeDelta: max(dLon * 1.4, 0.1)
            )
        )
    }

    @ViewBuilder
    private var miniMapSection: some View {
        if let lat = deal.latitude, let lon = deal.longitude {
            let destCoord = CLLocationCoordinate2D(latitude: lat, longitude: lon)
            let originAirport = departureAirport
            let originCoord = originAirport.map {
                CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("LOCATION")
                        .font(SGFont.bodyBold(size: 13))
                        .foregroundStyle(Color.sgMuted)
                        .tracking(1.5)
                        .accessibilityAddTraits(.isHeader)
                    Spacer()
                    // Open in Apple Maps
                    Button {
                        let placemark = MKPlacemark(coordinate: destCoord)
                        let mapItem = MKMapItem(placemark: placemark)
                        mapItem.name = "\(deal.city), \(deal.country)"
                        mapItem.openInMaps(launchOptions: [
                            MKLaunchOptionsMapCenterKey: NSValue(mkCoordinate: destCoord),
                            MKLaunchOptionsMapSpanKey: NSValue(mkCoordinateSpan: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05))
                        ])
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.up.right.square")
                                .font(.system(size: 11))
                            Text("Open in Maps")
                                .font(SGFont.body(size: 11))
                        }
                        .foregroundStyle(Color.sgYellow)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)

                let mapRegion: MKCoordinateRegion = {
                    if let oc = originCoord {
                        return routeRegion(origin: oc, destination: destCoord)
                    }
                    return MKCoordinateRegion(
                        center: destCoord,
                        span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
                    )
                }()

                Map(initialPosition: .region(mapRegion)) {
                    // Destination pin (price badge)
                    Annotation(deal.city, coordinate: destCoord) {
                        VStack(spacing: 2) {
                            VStack(spacing: 0) {
                                if deal.isEstimatedPrice {
                                    Text("from")
                                        .font(.system(size: 7, weight: .medium))
                                        .foregroundStyle(Color.sgBg.opacity(0.7))
                                }
                                Text(deal.priceFormatted)
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundStyle(Color.sgBg)
                            }
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(Color.sgYellow)
                            .clipShape(Capsule())
                            Image(systemName: "arrowtriangle.down.fill")
                                .font(.system(size: 6))
                                .foregroundStyle(Color.sgYellow)
                                .offset(y: -2)
                        }
                    }

                    // Origin pin (departure airport code)
                    if let oc = originCoord, let airport = originAirport {
                        Annotation(airport.city, coordinate: oc) {
                            Text(airport.code)
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundStyle(Color.sgBg)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(Color.sgWhiteDim)
                                .clipShape(Capsule())
                        }

                        // Route line between origin and destination
                        MapPolyline(coordinates: [oc, destCoord])
                            .stroke(Color.sgYellow.opacity(0.7), style: StrokeStyle(
                                lineWidth: 2,
                                dash: [8, 6]
                            ))
                    }
                }
                .mapStyle(.standard(pointsOfInterest: .including([.airport, .beach, .museum, .nationalPark, .restaurant])))
                .frame(height: 200)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 16)
                .allowsHitTesting(true)
            }
            .padding(.top, 12)
        }
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

    // MARK: - Deal Highlight

    @ViewBuilder
    private var dealHighlightSection: some View {
        let hasSavings = deal.savingsLabel != nil
        let hasTier = deal.dealTier != nil && deal.dealTier != .fair
        let isInSeason = deal.isGoodTimeToVisit
        let isNonstop = deal.isNonstop == true

        if hasSavings || hasTier || isInSeason || isNonstop {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    // Deal tier badge
                    if let tier = deal.dealTier, tier != .fair {
                        highlightChip(
                            icon: "sparkles",
                            text: tier.label,
                            color: tier.color
                        )
                    }

                    // Savings badge
                    if let savings = deal.savingsLabel {
                        highlightChip(
                            icon: "tag.fill",
                            text: savings,
                            color: Color.sgDealAmazing
                        )
                    }

                    // Nonstop badge
                    if isNonstop {
                        highlightChip(
                            icon: "arrow.right",
                            text: "Nonstop",
                            color: Color.sgGreen
                        )
                    }

                    // In season badge
                    if isInSeason {
                        highlightChip(
                            icon: "sun.max.fill",
                            text: "In Season",
                            color: Color.sgYellow
                        )
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.top, 4)
        }
    }

    private func highlightChip(icon: String, text: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .semibold))
            Text(text)
                .font(.system(size: 11, weight: .semibold))
        }
        .foregroundStyle(color)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(color.opacity(0.12))
        .clipShape(Capsule())
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

    // MARK: - Weather & Best Time

    @ViewBuilder
    private var weatherSection: some View {
        let hasWeather = deal.averageTemp != nil || (deal.bestMonths != nil && !deal.bestMonths!.isEmpty)
        if hasWeather {
            VStack(alignment: .leading, spacing: 12) {
                Text("WEATHER & BEST TIME")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.5)
                    .accessibilityAddTraits(.isHeader)

                HStack(spacing: 16) {
                    // Temperature card
                    if let temp = deal.averageTemp {
                        VStack(spacing: 6) {
                            Image(systemName: tempIcon(temp))
                                .font(.system(size: 28))
                                .foregroundStyle(tempColor(temp))

                            Text("\(Int(temp))°")
                                .font(.system(size: 28, weight: .bold, design: .monospaced))
                                .foregroundStyle(Color.sgWhite)

                            Text("avg temp")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(Color.sgMuted)
                        }
                        .frame(width: 90, height: 110)
                        .background(Color.sgBg)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .strokeBorder(Color.sgBorder, lineWidth: 1)
                        )
                    }

                    // Best months list
                    if let months = deal.bestMonths, !months.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 4) {
                                Image(systemName: "calendar")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.sgYellow)
                                Text("Best months")
                                    .font(SGFont.bodyBold(size: 12))
                                    .foregroundStyle(Color.sgWhiteDim)
                            }

                            // Month chips
                            let columns = [GridItem(.adaptive(minimum: 50, maximum: 80), spacing: 4)]
                            LazyVGrid(columns: columns, alignment: .leading, spacing: 4) {
                                ForEach(months, id: \.self) { month in
                                    let isCurrent = isCurrentMonth(month)
                                    Text(month)
                                        .font(.system(size: 11, weight: isCurrent ? .bold : .medium))
                                        .foregroundStyle(isCurrent ? Color.sgBg : Color.sgWhiteDim)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(isCurrent ? Color.sgDealAmazing : Color.sgBg)
                                        .clipShape(Capsule())
                                        .overlay(
                                            Capsule().strokeBorder(
                                                isCurrent ? Color.sgDealAmazing : Color.sgBorder,
                                                lineWidth: 1
                                            )
                                        )
                                }
                            }

                            if deal.isGoodTimeToVisit {
                                HStack(spacing: 4) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 11))
                                    Text("Great time to go!")
                                        .font(.system(size: 11, weight: .semibold))
                                }
                                .foregroundStyle(Color.sgDealAmazing)
                                .padding(.top, 2)
                            }
                        }
                    }
                }

                // 12-month seasonality bar chart
                monthSeasonalityBar
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 16)
            .padding(.top, 12)
        }
    }

    private var monthSeasonalityBar: some View {
        let allMonths = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        let labels = ["J","F","M","A","M","J","J","A","S","O","N","D"]
        let bestSet: Set<String> = {
            guard let best = deal.bestMonths else { return [] }
            // Normalize: match both "May" and "May" style
            var set = Set<String>()
            for m in best {
                for full in allMonths {
                    if m.localizedCaseInsensitiveContains(full) || full.localizedCaseInsensitiveContains(m) {
                        set.insert(full)
                    }
                }
            }
            return set
        }()
        let currentMonthIndex = Calendar.current.component(.month, from: Date()) - 1

        return VStack(spacing: 0) {
            // Bars
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(0..<12, id: \.self) { i in
                    let isBest = bestSet.contains(allMonths[i])
                    let isCurrent = i == currentMonthIndex
                    VStack(spacing: 3) {
                        // Marker dot for current month
                        if isCurrent {
                            Circle()
                                .fill(Color.sgWhite)
                                .frame(width: 4, height: 4)
                        } else {
                            Spacer().frame(height: 4)
                        }
                        // Bar
                        RoundedRectangle(cornerRadius: 2)
                            .fill(isBest ? Color.sgYellow : Color.sgBorder)
                            .frame(height: isBest ? 24 : 8)
                        // Label
                        Text(labels[i])
                            .font(.system(size: 8, weight: isBest ? .bold : .regular, design: .monospaced))
                            .foregroundStyle(isBest ? Color.sgYellow : Color.sgMuted)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 40)
        }
        .padding(.top, 8)
    }

    private func tempIcon(_ temp: Double) -> String {
        if temp >= 30 { return "sun.max.fill" }
        if temp >= 20 { return "sun.min.fill" }
        if temp >= 10 { return "cloud.sun.fill" }
        return "snowflake"
    }

    private func tempColor(_ temp: Double) -> Color {
        if temp >= 30 { return Color.sgOrange }
        if temp >= 20 { return Color.sgYellow }
        if temp >= 10 { return Color.sgGreen }
        return Color.sgDealGood
    }

    private func isCurrentMonth(_ month: String) -> Bool {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        let current = formatter.string(from: Date())
        let fullFormatter = DateFormatter()
        fullFormatter.dateFormat = "MMMM"
        let currentFull = fullFormatter.string(from: Date())
        return month.localizedCaseInsensitiveContains(current) ||
               month.localizedCaseInsensitiveContains(currentFull)
    }

    // MARK: - Trip Budget Estimator

    @ViewBuilder
    private var tripBudgetSection: some View {
        let days = deal.tripDays
        let flightCostPP = deal.displayPrice ?? 0
        let hotelNight = deal.hotelPricePerNight ?? deal.liveHotelPrice
        let hasData = flightCostPP > 0 && days > 0

        if hasData {
            let nights = max(days - 1, 1)
            // Flights: per person
            let flightTotal = flightCostPP * Double(travelers)
            // Hotel: shared room for 1-2, double rooms for 3+
            let roomCount = travelers <= 2 ? 1 : Int(ceil(Double(travelers) / 2.0))
            let hotelPerNight = hotelNight ?? 0
            let hotelTotal = hotelPerNight * Double(nights) * Double(roomCount)
            // Daily spend: per person
            let dailySpendPP: Double = estimateDailySpend()
            let dailyTotal = dailySpendPP * Double(days) * Double(travelers)
            let grandTotal = flightTotal + hotelTotal + dailyTotal
            let perPerson = travelers > 1 ? grandTotal / Double(travelers) : 0.0

            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("TRIP BUDGET")
                        .font(SGFont.bodyBold(size: 13))
                        .foregroundStyle(Color.sgMuted)
                        .tracking(1.5)
                        .accessibilityAddTraits(.isHeader)
                    Spacer()
                    Text("\(days)-day trip")
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgYellow)
                }

                // Travelers stepper
                HStack(spacing: 0) {
                    Image(systemName: "person.2")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.sgMuted)
                        .frame(width: 20)
                    Text("Travelers")
                        .font(SGFont.body(size: 13))
                        .foregroundStyle(Color.sgWhite)
                        .padding(.leading, 8)
                    Spacer()
                    HStack(spacing: 0) {
                        Button {
                            if travelers > 1 { travelers -= 1 }
                        } label: {
                            Text("-")
                                .font(.system(size: 16, weight: .bold, design: .monospaced))
                                .foregroundStyle(travelers > 1 ? Color.sgWhite : Color.sgMuted)
                                .frame(width: 32, height: 28)
                                .background(Color.sgBorder.opacity(0.5))
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                        .disabled(travelers <= 1)

                        Text("\(travelers)")
                            .font(.system(size: 14, weight: .semibold, design: .monospaced))
                            .foregroundStyle(Color.sgYellow)
                            .frame(width: 32)

                        Button {
                            if travelers < 6 { travelers += 1 }
                        } label: {
                            Text("+")
                                .font(.system(size: 16, weight: .bold, design: .monospaced))
                                .foregroundStyle(travelers < 6 ? Color.sgWhite : Color.sgMuted)
                                .frame(width: 32, height: 28)
                                .background(Color.sgBorder.opacity(0.5))
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                        .disabled(travelers >= 6)
                    }
                }
                .padding(.bottom, 4)

                // Line items
                VStack(spacing: 8) {
                    budgetRow(
                        icon: "airplane",
                        label: travelers > 1
                            ? "Flights (\(travelers) x $\(Int(flightCostPP)))"
                            : "Flights (round trip)",
                        amount: flightTotal,
                        color: Color.sgWhite,
                        isEstimate: deal.isEstimatedPrice
                    )

                    if hotelPerNight > 0 {
                        budgetRow(
                            icon: "bed.double",
                            label: roomCount > 1
                                ? "Hotel (\(nights) nights x \(roomCount) rooms)"
                                : "Hotel (\(nights) nights x $\(Int(hotelPerNight)))",
                            amount: hotelTotal,
                            color: Color.sgWhite
                        )
                    }

                    budgetRow(
                        icon: "fork.knife",
                        label: travelers > 1
                            ? "Food & activities (\(travelers) x ~$\(Int(dailySpendPP))/day)"
                            : "Food & activities (~$\(Int(dailySpendPP))/day)",
                        amount: dailyTotal,
                        color: Color.sgWhiteDim
                    )

                    Rectangle()
                        .fill(Color.sgBorder)
                        .frame(height: 1)
                        .padding(.vertical, 2)

                    // Grand total
                    HStack {
                        Text("Estimated total")
                            .font(SGFont.bodyBold(size: 15))
                            .foregroundStyle(Color.sgWhite)
                        Spacer()
                        Text("~$\(Int(grandTotal))")
                            .font(.system(size: 22, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.sgYellow)
                    }

                    if travelers > 1 && perPerson > 0 {
                        Text("~$\(Int(perPerson)) per person")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.sgMuted)
                    } else if grandTotal > 0 {
                        Text("~$\(Int(grandTotal / Double(days)))/day per person")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.sgMuted)
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

    private func budgetRow(icon: String, label: String, amount: Double, color: Color, isEstimate: Bool = false) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 13))
                .foregroundStyle(Color.sgMuted)
                .frame(width: 20)
            Text(label)
                .font(SGFont.body(size: 13))
                .foregroundStyle(color)
            Spacer()
            Text(isEstimate ? "~$\(Int(amount))" : "$\(Int(amount))")
                .font(.system(size: 14, weight: .semibold, design: .monospaced))
                .foregroundStyle(color)
        }
    }

    /// Estimate daily spending based on destination region/cost of living.
    private func estimateDailySpend() -> Double {
        let country = deal.country.lowercased()
        // Southeast Asia / budget destinations
        if ["indonesia", "thailand", "vietnam", "cambodia", "philippines", "india", "nepal", "morocco", "egypt"].contains(country) {
            return 40
        }
        // Eastern Europe / Latin America
        if ["mexico", "colombia", "peru", "brazil", "argentina", "czech republic", "hungary", "poland", "turkey", "portugal", "greece"].contains(country) {
            return 60
        }
        // Western Europe / developed Asia
        if ["spain", "italy", "france", "germany", "south korea", "taiwan"].contains(country) {
            return 85
        }
        // Expensive destinations
        if ["japan", "uk", "switzerland", "norway", "iceland", "australia", "singapore", "maldives"].contains(country) {
            return 110
        }
        // US domestic
        if ["usa", "united states"].contains(country) {
            return 75
        }
        // Default moderate estimate
        return 70
    }

    // MARK: - Travel Tips

    private struct TravelTip {
        let icon: String // SF Symbol
        let text: String
    }

    /// Parse flight duration string like "9h 30m" or "12h" into total hours.
    private func flightHours() -> Double? {
        guard let dur = deal.flightDuration else { return nil }
        var hours: Double = 0
        let hPattern = try? NSRegularExpression(pattern: #"(\d+)\s*h"#)
        let mPattern = try? NSRegularExpression(pattern: #"(\d+)\s*m"#)
        let range = NSRange(dur.startIndex..., in: dur)
        if let match = hPattern?.firstMatch(in: dur, range: range),
           let r = Range(match.range(at: 1), in: dur) {
            hours += Double(dur[r]) ?? 0
        }
        if let match = mPattern?.firstMatch(in: dur, range: range),
           let r = Range(match.range(at: 1), in: dur) {
            hours += (Double(dur[r]) ?? 0) / 60.0
        }
        return hours > 0 ? hours : nil
    }

    /// Generate contextual travel tips based on available deal data.
    /// Returns at most 4 relevant tips.
    private func generateTips() -> [TravelTip] {
        var tips: [TravelTip] = []

        // Nonstop flight
        if deal.isNonstop == true {
            tips.append(TravelTip(
                icon: "arrow.right",
                text: "Direct flight available -- no layovers"
            ))
        }

        // Long-haul flight
        if let h = flightHours(), h > 8 {
            tips.append(TravelTip(
                icon: "airplane",
                text: "Long-haul flight -- consider a neck pillow and noise-canceling headphones"
            ))
        }

        // Budget hotels
        let hotelPrice = deal.hotelPricePerNight ?? deal.liveHotelPrice
        if let hp = hotelPrice, hp > 0, hp < 80 {
            tips.append(TravelTip(
                icon: "bed.double",
                text: "Budget-friendly hotels available from $\(Int(hp))/night"
            ))
        }

        // Good time to visit
        if deal.isGoodTimeToVisit {
            tips.append(TravelTip(
                icon: "sun.max",
                text: "You're visiting at the perfect time of year"
            ))
        }

        // Price trending down
        if deal.priceTrend == .down {
            tips.append(TravelTip(
                icon: "arrow.down.right",
                text: "Prices are trending down -- good time to book"
            ))
        }

        // Exceptional deal
        if deal.dealTier == .amazing {
            tips.append(TravelTip(
                icon: "sparkles",
                text: "This is an exceptional deal -- prices this low are rare"
            ))
        }

        // Extended trip
        if deal.tripDays > 7 {
            tips.append(TravelTip(
                icon: "simcard",
                text: "Extended trip -- consider a local SIM card for data"
            ))
        }

        // Short trip
        if deal.tripDays > 0, deal.tripDays <= 3 {
            tips.append(TravelTip(
                icon: "clock",
                text: "Short getaway -- pack light and plan ahead to maximize your time"
            ))
        }

        // Cold destination
        if let temp = deal.averageTemp, temp < 10 {
            tips.append(TravelTip(
                icon: "snowflake",
                text: "Pack warm layers -- average temperatures around \(Int(temp))\u{00B0}"
            ))
        }

        // Hot destination
        if let temp = deal.averageTemp, temp >= 32 {
            tips.append(TravelTip(
                icon: "sun.max.trianglebadge.exclamationmark",
                text: "Hot climate -- stay hydrated and bring sun protection"
            ))
        }

        return Array(tips.prefix(4))
    }

    @ViewBuilder
    private var travelTipsSection: some View {
        let tips = generateTips()
        if !tips.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("TRAVEL TIPS")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.5)
                    .accessibilityAddTraits(.isHeader)

                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(tips.enumerated()), id: \.offset) { _, tip in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: tip.icon)
                                .font(.system(size: 14))
                                .foregroundStyle(Color.sgYellow)
                                .frame(width: 24, height: 24)

                            Text(tip.text)
                                .font(SGFont.body(size: 14))
                                .foregroundStyle(Color.sgWhiteDim)
                                .lineSpacing(2)
                                .fixedSize(horizontal: false, vertical: true)
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
                        Button {
                            openInMaps(restaurant.name, city: deal.city)
                        } label: {
                            HStack(spacing: 12) {
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

                                HStack(spacing: 2) {
                                    Image(systemName: "star.fill")
                                        .font(.system(size: 11))
                                        .foregroundStyle(Color.sgYellow)
                                    Text(String(format: "%.1f", restaurant.rating))
                                        .font(SGFont.bodyBold(size: 13))
                                        .foregroundStyle(Color.sgWhite)
                                }

                                Image(systemName: "arrow.up.right.square")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Color.sgMuted)
                            }
                        }
                        .buttonStyle(.plain)
                        .padding(.vertical, 10)
                        .accessibilityLabel("Open \(restaurant.name) in Maps")

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
            HStack(spacing: 2) {
                if otherDeal.isEstimatedPrice {
                    Text("from")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Color.sgMuted)
                }
                Text(otherDeal.priceFormatted)
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgYellow)
            }
        }
        .frame(width: 140)
        .contentShape(Rectangle())
        .onTapGesture {
            HapticEngine.light()
            router.showDeal(otherDeal)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(otherDeal.city), \(otherDeal.isEstimatedPrice ? "from " : "")\(otherDeal.priceFormatted)")
        .accessibilityHint("View deal details")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Nearby Destinations

    private var nearbyDeals: [(deal: Deal, distanceKm: Int)] {
        guard deal.latitude != nil, deal.longitude != nil else { return [] }
        return allDeals
            .compactMap { other -> (Deal, Int)? in
                guard other.id != deal.id,
                      let km = Deal.distanceKm(from: deal, to: other),
                      km <= 1500, km > 0 else { return nil }
                return (other, Int(km))
            }
            .sorted { $0.1 < $1.1 }
            .prefix(5)
            .map { (deal: $0.0, distanceKm: $0.1) }
    }

    @ViewBuilder
    private var nearbyDestinationsSection: some View {
        let nearby = nearbyDeals
        if !nearby.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("NEARBY DESTINATIONS")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.5)
                    .padding(.horizontal, 16)
                    .accessibilityAddTraits(.isHeader)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(nearby, id: \.deal.id) { item in
                            nearbyCard(item.deal, distanceKm: item.distanceKm)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.top, 16)
        }
    }

    private func nearbyCard(_ otherDeal: Deal, distanceKm: Int) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack(alignment: .topTrailing) {
                CachedAsyncImage(url: otherDeal.imageUrl) {
                    RoundedRectangle(cornerRadius: 8).fill(Color.sgSurface)
                }
                .frame(width: 140, height: 100)
                .clipShape(RoundedRectangle(cornerRadius: 8))

                Text("\(distanceKm)km")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.sgBg)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Color.sgWhite.opacity(0.85))
                    .clipShape(Capsule())
                    .padding(6)
            }

            Text(otherDeal.city)
                .font(SGFont.bodyBold(size: 14))
                .foregroundStyle(Color.sgWhite)
                .lineLimit(1)
            HStack(spacing: 2) {
                if otherDeal.isEstimatedPrice {
                    Text("from")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Color.sgMuted)
                }
                Text(otherDeal.priceFormatted)
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgYellow)
            }
        }
        .frame(width: 140)
        .contentShape(Rectangle())
        .onTapGesture {
            HapticEngine.light()
            router.showDeal(otherDeal)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(otherDeal.city), \(distanceKm) kilometers away, \(otherDeal.isEstimatedPrice ? "from " : "")\(otherDeal.priceFormatted)")
        .accessibilityHint("View deal details")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Sticky Bottom Bar
    private var stickyBottomBar: some View {
        VStack(spacing: 6) {
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

            Button {
                let origin = settingsStore.departureCode
                let dest = deal.iataCode
                let query = "flights+from+\(origin)+to+\(dest)"
                if let url = URL(string: "https://www.google.com/travel/flights?q=\(query)") {
                    UIApplication.shared.open(url)
                }
            } label: {
                Text("Compare prices on Google Flights")
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Compare prices on Google Flights for \(deal.city)")
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
    .environment(RecentlyViewedStore())
}
