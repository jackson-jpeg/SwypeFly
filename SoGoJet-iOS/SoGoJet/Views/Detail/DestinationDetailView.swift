import SwiftUI
import UIKit
import MapKit

// MARK: - Destination Detail View (thin orchestrator)
//
// Phase 2 visual overhaul:
// - DetailHero: hero image + matchedGeometryEffect wired to "dest-<deal.id>"
// - DetailStickyTicker: collapsing header ticker driven by scroll offset
// - Section cascade reveals (60ms intra-section stagger)
// - DetailGalleryView: paged parallax gallery (via "View Photos" CTA)
// - DetailCompareStrip: saved trips horizontal rail (bottom)
// - DetailPriceExplainerSection: SGSheet sparkline price history
// - Decomposed section files in Views/Detail/Sections/

struct DestinationDetailView: View {
    let deal: Deal
    let allDeals: [Deal]
    /// Hero namespace threaded from FeedView or DepartureBoardView (id: "dest-\(deal.id)")
    var heroNamespace: Namespace.ID? = nil

    @Environment(SavedStore.self) private var savedStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(Router.self) private var router
    @Environment(ToastManager.self) private var toastManager
    @Environment(RecentlyViewedStore.self) private var recentlyViewedStore

    @State private var shareItem: DetailShareDealItem?
    @State private var travelers: Int = 1
    @State private var heartBounce: Bool = false
    @State private var showBudget: Bool = false
    @State private var showTips: Bool = false
    @State private var showPacking: Bool = false
    @State private var showTripPlan: Bool = false
    @State private var showHotelSearch: Bool = false
    @State private var showGallery: Bool = false

    // Scroll offset → collapsing header
    @State private var scrollOffset: CGFloat = 0
    private var collapseProgress: CGFloat {
        // Hero is 320pt tall. Start collapsing after 200pt of scroll.
        let threshold: CGFloat = 200
        let range: CGFloat = 100
        return min(max((scrollOffset.magnitude - threshold) / range, 0), 1.0)
    }

    private var isSaved: Bool { savedStore.isSaved(id: deal.id) }

    var body: some View {
        ZStack(alignment: .top) {
            // Main scroll body
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    // Scroll offset reader anchored to top of scroll
                    Color.clear
                        .frame(height: 0)
                        .readScrollOffset(in: "detailScroll")

                    // Hero
                    DetailHero(
                        deal: deal,
                        namespace: heroNamespace,
                        onDismiss: { router.dismissSheet() }
                    )

                    // "View Photos" CTA
                    if let urls = deal.imageUrls, urls.count >= 2 {
                        HStack {
                            DetailHeroGalleryCTA { showGallery = true }
                            Spacer()
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                    }

                    // Flight info
                    DetailFlightSection(
                        deal: deal,
                        settingsStore: settingsStore,
                        savedStore: savedStore,
                        toastManager: toastManager
                    )

                    // Highlight chips
                    dealHighlightSection
                    // Vibe tags
                    vibeTagsSection

                    // Photo gallery strip (inline, ≥2 images)
                    inlinePhotoGallerySection

                    // Mini map
                    miniMapSection

                    // Travel guide
                    travelGuideSection

                    // Weather
                    DetailWeatherSection(deal: deal, settingsStore: settingsStore)

                    // Price explainer CTA → SGSheet sparkline
                    if deal.hasPrice {
                        DetailPriceExplainerSection(deal: deal)
                    }

                    // Budget
                    tripBudgetSection

                    // Travel tips
                    travelTipsSection

                    // Packing
                    packingListSection

                    // Itinerary
                    DetailItinerarySection(deal: deal)

                    // Restaurants
                    restaurantsSection

                    // Hotels
                    DetailHotelsSection(deal: deal, showHotelSearch: $showHotelSearch)

                    // Similar deals
                    DetailSimilarDealsSection(
                        deal: deal,
                        allDeals: allDeals,
                        namespace: heroNamespace,
                        router: router
                    )

                    // Nearby
                    DetailNearbySection(
                        deal: deal,
                        allDeals: allDeals,
                        settingsStore: settingsStore,
                        namespace: heroNamespace,
                        router: router
                    )
                }
                .padding(.bottom, 120)
            }
            .coordinateSpace(name: "detailScroll")
            .background(Color.sgBg)
            .onPreferenceChange(DetailScrollOffsetKey.self) { value in
                scrollOffset = value
            }

            // Collapsing sticky ticker
            DetailStickyTicker(deal: deal, collapseProgress: collapseProgress)

            // Compare strip sits above the bottom bar
            VStack {
                Spacer()
                VStack(spacing: 0) {
                    DetailCompareStrip(
                        currentDealId: deal.id,
                        savedDeals: savedStore.savedDeals,
                        router: router,
                        namespace: heroNamespace
                    )
                    stickyBottomBar
                }
            }
        }
        .onAppear {
            SiriShortcuts.donateDealView(city: deal.city, dealId: deal.id)
            recentlyViewedStore.recordView(deal: deal)
        }
        .sheet(item: $shareItem) { item in
            DetailShareSheet(activityItems: item.activityItems)
        }
        .sheet(isPresented: $showTripPlan) {
            TripPlanView(city: deal.city, country: deal.country, destinationId: deal.id)
        }
        .sheet(isPresented: $showHotelSearch) {
            HotelSearchView(deal: deal)
        }
        .fullScreenCover(isPresented: $showGallery) {
            if let urls = deal.imageUrls, urls.count >= 2 {
                DetailGalleryView(imageUrls: urls, onDismissRequest: { showGallery = false })
            }
        }
    }

    // MARK: - Inline remaining sections (compact)

    // MARK: Deal Highlight
    @ViewBuilder
    private var dealHighlightSection: some View {
        let hasSavings = deal.savingsLabel != nil
        let hasTier = deal.dealTier != nil && deal.dealTier != .fair
        let isInSeason = deal.isGoodTimeToVisit
        let isNonstop = deal.isNonstop == true
        if hasSavings || hasTier || isInSeason || isNonstop {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    if let tier = deal.dealTier, tier != .fair {
                        highlightChip(icon: "sparkles", text: tier.label, color: tier.color)
                    }
                    if let savings = deal.savingsLabel {
                        highlightChip(icon: "tag.fill", text: savings, color: Color.sgDealAmazing)
                    }
                    if isNonstop {
                        highlightChip(icon: "arrow.right", text: "Nonstop", color: Color.sgGreen)
                    }
                    if isInSeason {
                        highlightChip(icon: "sun.max.fill", text: "In Season", color: Color.sgYellow)
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.top, 4)
        }
    }

    private func highlightChip(icon: String, text: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 10, weight: .semibold))
            Text(text).font(.system(size: 11, weight: .semibold))
        }
        .foregroundStyle(color)
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(color.opacity(0.12))
        .clipShape(Capsule())
    }

    // MARK: Vibe Tags
    @ViewBuilder
    private var vibeTagsSection: some View {
        if !deal.safeVibeTags.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(deal.safeVibeTags, id: \.self) { tag in
                        Text(tag)
                            .font(SGFont.bodyBold(size: 12))
                            .foregroundStyle(Color.sgYellow)
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(Color.sgYellow.opacity(0.12))
                            .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.top, 4)
        }
    }

    // MARK: Inline Photo Gallery (strip)
    @ViewBuilder
    private var inlinePhotoGallerySection: some View {
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
                        ForEach(Array(urls.dropFirst().prefix(6).enumerated()), id: \.offset) { _, url in
                            CachedAsyncImage(url: url) {
                                RoundedRectangle(cornerRadius: 10).fill(Color.sgSurface)
                            }
                            .frame(width: 180, height: 130)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .onTapGesture { showGallery = true }
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.top, 12)
        }
    }

    // MARK: Mini Map
    private var departureAirport: AirportPicker.Airport? {
        AirportPicker.airports.first { $0.code == settingsStore.departureCode }
    }

    private func routeRegion(origin: CLLocationCoordinate2D, destination: CLLocationCoordinate2D) -> MKCoordinateRegion {
        let midLat = (origin.latitude + destination.latitude) / 2
        let midLon = (origin.longitude + destination.longitude) / 2
        let dLat = abs(origin.latitude - destination.latitude)
        let dLon = abs(origin.longitude - destination.longitude)
        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: midLat, longitude: midLon),
            span: MKCoordinateSpan(latitudeDelta: max(dLat * 1.4, 0.1), longitudeDelta: max(dLon * 1.4, 0.1))
        )
    }

    @ViewBuilder
    private var miniMapSection: some View {
        if let lat = deal.latitude, let lon = deal.longitude {
            let destCoord = CLLocationCoordinate2D(latitude: lat, longitude: lon)
            let originAirport = departureAirport
            let originCoord = originAirport.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("LOCATION")
                        .font(SGFont.bodyBold(size: 13))
                        .foregroundStyle(Color.sgMuted)
                        .tracking(1.5)
                        .accessibilityAddTraits(.isHeader)
                    Spacer()
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
                            Image(systemName: "arrow.up.right.square").font(.system(size: 11))
                            Text("Open in Maps").font(SGFont.body(size: 11))
                        }
                        .foregroundStyle(Color.sgYellow)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(String(localized: "detail.open_in_maps"))
                }
                .padding(.horizontal, 16)

                let mapRegion: MKCoordinateRegion = {
                    if let oc = originCoord { return routeRegion(origin: oc, destination: destCoord) }
                    return MKCoordinateRegion(center: destCoord, span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08))
                }()

                Map(initialPosition: .region(mapRegion)) {
                    Annotation(deal.city, coordinate: destCoord) {
                        VStack(spacing: 2) {
                            Text(deal.priceFormatted)
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundStyle(Color.sgBg)
                                .padding(.horizontal, 6).padding(.vertical, 3)
                                .background(Color.sgYellow)
                                .clipShape(Capsule())
                            Image(systemName: "arrowtriangle.down.fill")
                                .font(.system(size: 6))
                                .foregroundStyle(Color.sgYellow)
                                .offset(y: -2)
                        }
                    }
                    if let oc = originCoord, let airport = originAirport {
                        Annotation(airport.city, coordinate: oc) {
                            Text(airport.code)
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundStyle(Color.sgBg)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background(Color.sgWhiteDim)
                                .clipShape(Capsule())
                        }
                        MapPolyline(coordinates: [oc, destCoord])
                            .stroke(Color.sgYellow.opacity(0.7), style: StrokeStyle(lineWidth: 2, dash: [8, 6]))
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

    // MARK: Travel Guide
    @ViewBuilder
    private var travelGuideSection: some View {
        let hasContent = !deal.description.isEmpty || deal.bestMonths != nil || deal.averageTemp != nil
        if hasContent {
            VStack(alignment: .leading, spacing: 12) {
                Text("TRAVEL GUIDE")
                    .font(SGFont.bodyBold(size: 13)).foregroundStyle(Color.sgMuted).tracking(1.5)
                    .accessibilityAddTraits(.isHeader)
                if !deal.description.isEmpty {
                    Text(deal.description)
                        .font(SGFont.body(size: 15)).foregroundStyle(Color.sgWhiteDim).lineSpacing(4)
                }
                if let months = deal.bestMonths, !months.isEmpty {
                    Label {
                        Text("Best months: \(months.joined(separator: ", "))")
                            .font(SGFont.body(size: 14)).foregroundStyle(Color.sgWhiteDim)
                    } icon: { Image(systemName: "sun.max").foregroundStyle(Color.sgYellow) }
                }
                if let temp = deal.averageTemp {
                    Label {
                        Text("Avg temp: \(Deal.formatTemp(temp, metric: settingsStore.usesMetric))")
                            .font(SGFont.body(size: 14)).foregroundStyle(Color.sgWhiteDim)
                    } icon: { Image(systemName: "thermometer.medium").foregroundStyle(Color.sgOrange) }
                }
                HStack(spacing: 16) {
                    Label {
                        Text(Self.languageForCountry(deal.country))
                            .font(SGFont.body(size: 14)).foregroundStyle(Color.sgWhiteDim)
                    } icon: { Text("🗣").font(.system(size: 14)) }
                    Label {
                        Text(Self.currencyForCountry(deal.country))
                            .font(SGFont.body(size: 14)).foregroundStyle(Color.sgWhiteDim)
                    } icon: { Text("💱").font(.system(size: 14)) }
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

    // MARK: Budget
    @ViewBuilder
    private var tripBudgetSection: some View {
        let days = deal.tripDays
        let flightCostPP = deal.displayPrice ?? 0
        let hotelNight = deal.hotelPricePerNight ?? deal.liveHotelPrice
        let hasData = flightCostPP > 0 && days > 0
        if hasData {
            let nights = max(days - 1, 1)
            let flightTotal = flightCostPP * Double(travelers)
            let roomCount = travelers <= 2 ? 1 : Int(ceil(Double(travelers) / 2.0))
            let hotelPerNight = hotelNight ?? 0
            let hotelTotal = hotelPerNight * Double(nights) * Double(roomCount)
            let dailySpendPP: Double = estimateDailySpend()
            let dailyTotal = dailySpendPP * Double(days) * Double(travelers)
            let grandTotal = flightTotal + hotelTotal + dailyTotal
            let perPerson = travelers > 1 ? grandTotal / Double(travelers) : 0.0

            DisclosureGroup(isExpanded: $showBudget) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Spacer()
                        Text("\(days)-day trip").font(SGFont.body(size: 12)).foregroundStyle(Color.sgYellow)
                    }
                    HStack(spacing: 0) {
                        Image(systemName: "person.2").font(.system(size: 13)).foregroundStyle(Color.sgMuted).frame(width: 20)
                        Text("Travelers").font(SGFont.body(size: 13)).foregroundStyle(Color.sgWhite).padding(.leading, 8)
                        Spacer()
                        HStack(spacing: 0) {
                            Button { if travelers > 1 { travelers -= 1 } } label: {
                                Text("-").font(.system(size: 16, weight: .bold, design: .monospaced))
                                    .foregroundStyle(travelers > 1 ? Color.sgWhite : Color.sgMuted)
                                    .frame(width: 32, height: 28).background(Color.sgBorder.opacity(0.5)).clipShape(RoundedRectangle(cornerRadius: 6))
                            }.disabled(travelers <= 1)
                            Text("\(travelers)").font(.system(size: 14, weight: .semibold, design: .monospaced)).foregroundStyle(Color.sgYellow).frame(width: 32)
                            Button { if travelers < 6 { travelers += 1 } } label: {
                                Text("+").font(.system(size: 16, weight: .bold, design: .monospaced))
                                    .foregroundStyle(travelers < 6 ? Color.sgWhite : Color.sgMuted)
                                    .frame(width: 32, height: 28).background(Color.sgBorder.opacity(0.5)).clipShape(RoundedRectangle(cornerRadius: 6))
                            }.disabled(travelers >= 6)
                        }
                    }.padding(.bottom, 4)
                    VStack(spacing: 8) {
                        budgetRow(icon: "airplane", label: travelers > 1 ? "Flights (\(travelers) x $\(Int(flightCostPP)))" : "Flights (round trip)", amount: flightTotal, color: Color.sgWhite, isEstimate: deal.isEstimatedPrice)
                        if hotelPerNight > 0 {
                            budgetRow(icon: "bed.double", label: roomCount > 1 ? "Hotel (\(nights) nights x \(roomCount) rooms)" : "Hotel (\(nights) nights x $\(Int(hotelPerNight)))", amount: hotelTotal, color: Color.sgWhite)
                        }
                        budgetRow(icon: "fork.knife", label: travelers > 1 ? "Food & activities (\(travelers) x ~$\(Int(dailySpendPP))/day)" : "Food & activities (~$\(Int(dailySpendPP))/day)", amount: dailyTotal, color: Color.sgWhiteDim)
                        Rectangle().fill(Color.sgBorder).frame(height: 1).padding(.vertical, 2)
                        HStack {
                            Text("Estimated total").font(SGFont.bodyBold(size: 15)).foregroundStyle(Color.sgWhite)
                            Spacer()
                            Text("~$\(Int(grandTotal))").font(.system(size: 22, weight: .bold, design: .monospaced)).foregroundStyle(Color.sgYellow)
                        }
                        if travelers > 1 && perPerson > 0 {
                            Text("~$\(Int(perPerson)) per person").font(.system(size: 11)).foregroundStyle(Color.sgMuted)
                        } else if grandTotal > 0 {
                            Text("~$\(Int(grandTotal / Double(days)))/day per person").font(.system(size: 11)).foregroundStyle(Color.sgMuted)
                        }
                    }
                }
            } label: {
                Text("TRIP BUDGET").font(SGFont.bodyBold(size: 13)).foregroundStyle(Color.sgMuted).tracking(1.5)
                    .accessibilityAddTraits(.isHeader)
            }
            .tint(Color.sgYellow)
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
            Image(systemName: icon).font(.system(size: 13)).foregroundStyle(Color.sgMuted).frame(width: 20)
            Text(label).font(SGFont.body(size: 13)).foregroundStyle(color)
            Spacer()
            Text(isEstimate ? "~$\(Int(amount))" : "$\(Int(amount))").font(.system(size: 14, weight: .semibold, design: .monospaced)).foregroundStyle(color)
        }
    }

    // MARK: Travel Tips
    private struct TravelTip { let icon: String; let text: String }

    private func flightHours() -> Double? {
        guard let dur = deal.flightDuration else { return nil }
        var hours: Double = 0
        let hPattern = try? NSRegularExpression(pattern: #"(\d+)\s*h"#)
        let mPattern = try? NSRegularExpression(pattern: #"(\d+)\s*m"#)
        let range = NSRange(dur.startIndex..., in: dur)
        if let match = hPattern?.firstMatch(in: dur, range: range), let r = Range(match.range(at: 1), in: dur) { hours += Double(dur[r]) ?? 0 }
        if let match = mPattern?.firstMatch(in: dur, range: range), let r = Range(match.range(at: 1), in: dur) { hours += (Double(dur[r]) ?? 0) / 60.0 }
        return hours > 0 ? hours : nil
    }

    private func generateTips() -> [TravelTip] {
        var tips: [TravelTip] = []
        if deal.isNonstop == true { tips.append(TravelTip(icon: "arrow.right", text: "Direct flight available -- no layovers")) }
        if let h = flightHours(), h > 8 { tips.append(TravelTip(icon: "airplane", text: "Long-haul flight -- consider a neck pillow and noise-canceling headphones")) }
        let hp = deal.hotelPricePerNight ?? deal.liveHotelPrice
        if let p = hp, p > 0, p < 80 { tips.append(TravelTip(icon: "bed.double", text: "Budget-friendly hotels available from $\(Int(p))/night")) }
        if deal.isGoodTimeToVisit { tips.append(TravelTip(icon: "sun.max", text: "You're visiting at the perfect time of year")) }
        if deal.priceTrend == .down { tips.append(TravelTip(icon: "arrow.down.right", text: "Prices are trending down -- good time to book")) }
        if deal.dealTier == .amazing { tips.append(TravelTip(icon: "sparkles", text: "This is an exceptional deal -- prices this low are rare")) }
        if deal.tripDays > 7 { tips.append(TravelTip(icon: "simcard", text: "Extended trip -- consider a local SIM card for data")) }
        if deal.tripDays > 0, deal.tripDays <= 3 { tips.append(TravelTip(icon: "clock", text: "Short getaway -- pack light and plan ahead to maximize your time")) }
        if let temp = deal.averageTemp, temp < 10 { tips.append(TravelTip(icon: "snowflake", text: "Pack warm layers -- average temperatures around \(Deal.formatTemp(temp, metric: settingsStore.usesMetric))")) }
        if let temp = deal.averageTemp, temp >= 32 { tips.append(TravelTip(icon: "sun.max.trianglebadge.exclamationmark", text: "Hot climate -- stay hydrated and bring sun protection")) }
        return Array(tips.prefix(4))
    }

    @ViewBuilder
    private var travelTipsSection: some View {
        let tips = generateTips()
        if !tips.isEmpty {
            DisclosureGroup(isExpanded: $showTips) {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(tips.enumerated()), id: \.offset) { _, tip in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: tip.icon).font(.system(size: 14)).foregroundStyle(Color.sgYellow).frame(width: 24, height: 24)
                            Text(tip.text).font(SGFont.body(size: 14)).foregroundStyle(Color.sgWhiteDim).lineSpacing(2).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            } label: {
                Text("TRAVEL TIPS").font(SGFont.bodyBold(size: 13)).foregroundStyle(Color.sgMuted).tracking(1.5)
                    .accessibilityAddTraits(.isHeader)
            }
            .tint(Color.sgYellow)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 16)
            .padding(.top, 12)
        }
    }

    // MARK: Packing
    private struct PackingItem { let icon: String; let text: String }

    private func generatePackingList() -> [PackingItem] {
        var items: [PackingItem] = []
        let vibes = Set(deal.safeVibeTags.map { $0.lowercased() })
        let temp: Double = deal.averageTemp ?? 22
        let isInternational = deal.country.lowercased() != "usa" && deal.country.lowercased() != "united states"
        items.append(PackingItem(icon: "doc.text", text: "Passport"))
        items.append(PackingItem(icon: "battery.100.bolt", text: "Phone charger"))
        if isInternational { items.append(PackingItem(icon: "bolt.fill", text: "Travel adapter")) }
        if temp >= 28 {
            items.append(PackingItem(icon: "sun.max", text: "Sunscreen"))
            items.append(PackingItem(icon: "eyeglasses", text: "Sunglasses"))
        } else if temp <= 12 {
            items.append(PackingItem(icon: "cloud.snow", text: "Warm jacket"))
            items.append(PackingItem(icon: "hand.raised", text: "Gloves"))
        } else {
            items.append(PackingItem(icon: "tshirt", text: "Light layers"))
        }
        if vibes.contains("beach") { items.append(PackingItem(icon: "figure.pool.swim", text: "Swimsuit")); items.append(PackingItem(icon: "figure.walk", text: "Flip flops")) }
        if vibes.contains("adventure") || vibes.contains("nature") { items.append(PackingItem(icon: "shoe.fill", text: "Hiking shoes")); items.append(PackingItem(icon: "drop.fill", text: "Water bottle")) }
        if vibes.contains("tropical") { items.append(PackingItem(icon: "ant.fill", text: "Insect repellent")); items.append(PackingItem(icon: "cloud.rain", text: "Light rain jacket")) }
        if vibes.contains("culture") || vibes.contains("historic") { items.append(PackingItem(icon: "shoe.fill", text: "Walking shoes")) }
        if vibes.contains("nightlife") || vibes.contains("city") { items.append(PackingItem(icon: "tshirt.fill", text: "Smart outfit")) }
        if flightHours() ?? 0 >= 6 { items.append(PackingItem(icon: "headphones", text: "Headphones")) }
        return Array(items.prefix(8))
    }

    @ViewBuilder
    private var packingListSection: some View {
        let items = generatePackingList()
        if !items.isEmpty {
            DisclosureGroup(isExpanded: $showPacking) {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(items, id: \.text) { item in
                        HStack(spacing: 6) {
                            Image(systemName: item.icon).font(.system(size: 11)).foregroundStyle(Color.sgYellow).frame(width: 16)
                            Text(item.text).font(SGFont.body(size: 12)).foregroundStyle(Color.sgWhiteDim).lineLimit(1)
                            Spacer(minLength: 0)
                        }
                    }
                }
            } label: {
                Text("PACKING ESSENTIALS").font(SGFont.bodyBold(size: 13)).foregroundStyle(Color.sgMuted).tracking(1.5)
                    .accessibilityAddTraits(.isHeader)
            }
            .tint(Color.sgYellow)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 16)
            .padding(.top, 12)
        }
    }

    // MARK: Restaurants
    @ViewBuilder
    private var restaurantsSection: some View {
        if let restaurants = deal.restaurants, !restaurants.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("WHERE TO EAT")
                    .font(SGFont.bodyBold(size: 13)).foregroundStyle(Color.sgMuted).tracking(1.5)
                    .accessibilityAddTraits(.isHeader)
                VStack(spacing: 0) {
                    ForEach(Array(restaurants.enumerated()), id: \.offset) { index, restaurant in
                        Button {
                            let query = "\(restaurant.name), \(deal.city)".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? restaurant.name
                            if let url = URL(string: "maps://?q=\(query)") { UIApplication.shared.open(url) }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "fork.knife").font(.system(size: 14)).foregroundStyle(Color.sgOrange)
                                    .frame(width: 32, height: 32).background(Color.sgOrange.opacity(0.12)).clipShape(Circle())
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(restaurant.name).font(SGFont.bodyBold(size: 14)).foregroundStyle(Color.sgWhite)
                                    Text(restaurant.type).font(SGFont.body(size: 12)).foregroundStyle(Color.sgMuted)
                                }
                                Spacer()
                                HStack(spacing: 2) {
                                    Image(systemName: "star.fill").font(.system(size: 11)).foregroundStyle(Color.sgYellow)
                                    Text(String(format: "%.1f", restaurant.rating)).font(SGFont.bodyBold(size: 13)).foregroundStyle(Color.sgWhite)
                                }
                                Image(systemName: "arrow.up.right.square").font(.system(size: 11)).foregroundStyle(Color.sgMuted)
                            }
                        }
                        .buttonStyle(.plain)
                        .padding(.vertical, 10)
                        .accessibilityLabel("Open \(restaurant.name) in Maps")
                        if index < restaurants.count - 1 { Rectangle().fill(Color.sgBorder).frame(height: 1) }
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

    // MARK: - Sticky Bottom Bar

    private var stickyBottomBar: some View {
        VStack(spacing: 6) {
            HStack(spacing: 12) {
                Button {
                    HapticEngine.medium()
                    heartBounce = true
                    savedStore.toggle(deal: deal)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { heartBounce = false }
                } label: {
                    Image(systemName: isSaved ? "heart.fill" : "heart")
                        .font(.system(size: 20))
                        .foregroundStyle(isSaved ? Color.sgYellow : Color.sgWhite)
                        .frame(width: 48, height: 48)
                        .background(Color.sgSurface)
                        .clipShape(Circle())
                        .scaleEffect(heartBounce ? 1.3 : 1.0)
                        .animation(SGSpring.bouncy.respectingReduceMotion(), value: heartBounce)
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
                    HapticEngine.light()
                    showTripPlan = true
                } label: {
                    Image(systemName: "sparkles")
                        .font(.system(size: 18))
                        .foregroundStyle(Color.sgYellow)
                        .frame(width: 48, height: 48)
                        .background(Color.sgSurface)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Plan a trip to \(deal.city)")

                Button {
                    HapticEngine.medium()
                    router.startBooking(deal)
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "airplane.departure")
                        Text("Search Flights").font(SGFont.bodyBold(size: 16))
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

            HStack(spacing: Spacing.lg) {
                Button {
                    let origin = settingsStore.departureCode
                    let dest = deal.iataCode
                    var targetUrl: URL?
                    if let affiliate = deal.affiliateUrl, !affiliate.isEmpty, let url = URL(string: affiliate) {
                        targetUrl = url
                    } else {
                        let datePart = deal.bestDepartureDate.map { "+on+\($0)" } ?? ""
                        let query = "flights+from+\(origin)+to+\(dest)\(datePart)"
                        targetUrl = URL(string: "https://www.google.com/travel/flights?q=\(query)")
                    }
                    if let url = targetUrl { UIApplication.shared.open(url) }
                } label: {
                    Text("Compare Prices").font(SGFont.body(size: 12)).foregroundStyle(Color.sgMuted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Compare prices for flights to \(deal.city)")

                if deal.latitude != nil && deal.longitude != nil {
                    Button {
                        HapticEngine.light()
                        showHotelSearch = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "building.2").font(.system(size: 10))
                            Text("Find Hotels").font(SGFont.body(size: 12))
                        }
                        .foregroundStyle(Color.sgMuted)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Find hotels in \(deal.city)")
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.sgBg.opacity(0.95).background(.ultraThinMaterial))
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }

    // MARK: - Static Helpers

    private static let languageMap: [String: String] = [
        "Japan": "Japanese", "France": "French", "Spain": "Spanish",
        "Italy": "Italian", "Germany": "German", "Brazil": "Portuguese",
        "China": "Mandarin", "Thailand": "Thai", "Vietnam": "Vietnamese",
        "South Korea": "Korean", "Mexico": "Spanish", "Portugal": "Portuguese",
        "Greece": "Greek", "Turkey": "Turkish", "Egypt": "Arabic",
        "Morocco": "Arabic/French", "India": "Hindi/English",
        "Indonesia": "Bahasa", "Colombia": "Spanish", "Peru": "Spanish",
        "Argentina": "Spanish", "Chile": "Spanish", "Taiwan": "Mandarin",
        "Myanmar": "Burmese", "Cambodia": "Khmer", "Malaysia": "Malay/English",
        "Philippines": "Filipino/English", "Nepal": "Nepali",
        "Jordan": "Arabic", "Lebanon": "Arabic/French", "Oman": "Arabic",
        "UAE": "Arabic/English", "Georgia": "Georgian", "Uzbekistan": "Uzbek",
        "USA": "English", "UK": "English", "United Kingdom": "English",
        "Canada": "English/French", "Australia": "English",
        "New Zealand": "English", "Ireland": "English", "Jamaica": "English",
        "Singapore": "English/Mandarin", "South Africa": "English",
    ]

    private static func languageForCountry(_ country: String) -> String {
        languageMap[country] ?? "English"
    }

    private static let currencyMap: [String: String] = [
        "Japan": "JPY ¥", "France": "EUR €", "UK": "GBP £",
        "United Kingdom": "GBP £", "USA": "USD $", "Thailand": "THB ฿",
        "Mexico": "MXN $", "Brazil": "BRL R$", "India": "INR ₹",
        "China": "CNY ¥", "Australia": "AUD $", "Canada": "CAD $",
        "Colombia": "COP $", "South Korea": "KRW ₩", "Switzerland": "CHF",
        "Sweden": "SEK kr", "Norway": "NOK kr", "Denmark": "DKK kr",
        "Turkey": "TRY ₺", "Egypt": "EGP £", "South Africa": "ZAR R",
        "New Zealand": "NZD $", "Singapore": "SGD $", "Malaysia": "MYR",
        "Indonesia": "IDR", "Vietnam": "VND ₫", "Philippines": "PHP ₱",
        "Morocco": "MAD", "Kenya": "KES", "Tanzania": "TZS",
        "Peru": "PEN", "Chile": "CLP $", "Argentina": "ARS $",
        "Spain": "EUR €", "Italy": "EUR €", "Germany": "EUR €",
        "Portugal": "EUR €", "Greece": "EUR €", "Ireland": "EUR €",
    ]

    private static func currencyForCountry(_ country: String) -> String {
        currencyMap[country] ?? "Local currency"
    }

    private func estimateDailySpend() -> Double {
        let country = deal.country.lowercased()
        if ["indonesia", "thailand", "vietnam", "cambodia", "philippines", "india", "nepal", "morocco", "egypt"].contains(country) { return 40 }
        if ["mexico", "colombia", "peru", "brazil", "argentina", "czech republic", "hungary", "poland", "turkey", "portugal", "greece"].contains(country) { return 60 }
        if ["spain", "italy", "france", "germany", "south korea", "taiwan"].contains(country) { return 85 }
        if ["japan", "uk", "switzerland", "norway", "iceland", "australia", "singapore", "maldives"].contains(country) { return 110 }
        if ["usa", "united states"].contains(country) { return 75 }
        return 70
    }
}

// MARK: - Share Helpers

private struct DetailShareDealItem: Identifiable {
    let id = UUID()
    let deal: Deal
    let cardImage: UIImage?

    var activityItems: [Any] {
        var items: [Any] = []
        if let image = cardImage { items.append(image) }
        items.append(deal.shareText)
        if let url = deal.shareURL { items.append(url) }
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
