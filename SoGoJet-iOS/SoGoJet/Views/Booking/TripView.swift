import SwiftUI

// MARK: - Trip View
// Flight search screen for a destination.
// Lets the user tune dates/cabin class, view price info, and then search live fares.

struct TripView: View {
    @Environment(BookingStore.self) private var store
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(Router.self) private var router
    @Environment(ToastManager.self) private var toastManager
    @Environment(NetworkMonitor.self) private var network

    let deal: Deal

    @State private var alternativesExpanded = false
    @State private var showPriceAlert = false
    @State private var showEmailSignup = false
    @State private var priceAlertOption: TripOption?
    @State private var departureDate = Date()
    @State private var returnDate = Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
    @State private var selectedOriginCode = ""
    @State private var selectedCabinClass: BookingCabinClass = .economy
    @State private var marketIntel: DestinationMarketResponse?
    @State private var monthlyIntel: DestinationMonthlyResponse?
    @State private var isLoadingMarketIntel = false
    @State private var marketIntelError: String?
    @State private var switchingSimilarDestinationID: String?
    @State private var seededRouteKey = ""
    @State private var autoSearchedRouteKey = ""
    @State private var flexibleDates = false
    @State private var activeDateChip: DateSuggestionChip?

    private var effectiveOriginCode: String {
        selectedOriginCode.isEmpty ? settingsStore.departureCode : selectedOriginCode
    }

    private var effectiveOriginAirport: AirportPicker.Airport? {
        AirportPicker.airports.first(where: { $0.code == effectiveOriginCode })
    }

    private var originSubtitle: String {
        effectiveOriginAirport?.city ?? settingsStore.departureCity
    }

    private var usingAlternateOrigin: Bool {
        effectiveOriginCode.caseInsensitiveCompare(settingsStore.departureCode) != .orderedSame
    }

    private var routeKey: String {
        "\(effectiveOriginCode)-\(deal.id)"
    }

    private var activeSearchKey: String {
        "\(routeKey)-\(departureDateString)-\(returnDateString)-\(selectedCabinClass.rawValue)"
    }

    private var recommendedSearchWindow: (departure: Date, returnDate: Date) {
        let calendar = Calendar.current

        if let departureString = deal.bestDepartureDate,
           let departureDate = departureString.parsedISODate {
            if let returnString = deal.bestReturnDate,
               let returnDate = returnString.parsedISODate {
                return (departureDate, returnDate)
            }

            let fallbackReturn = calendar.date(
                byAdding: .day,
                value: max(deal.tripDays, 7),
                to: departureDate
            ) ?? departureDate
            return (departureDate, fallbackReturn)
        }

        let departure = calendar.date(byAdding: .day, value: 42, to: Date()) ?? Date()
        let fallbackReturn = calendar.date(
            byAdding: .day,
            value: max(deal.tripDays, 7),
            to: departure
        ) ?? departure
        return (departure, fallbackReturn)
    }

    private var fallbackSearchWindow: (departure: Date, returnDate: Date) {
        if let storedDeparture = store.searchDepartureDate?.parsedISODate,
           let storedReturn = store.searchReturnDate?.parsedISODate {
            return (storedDeparture, storedReturn)
        }

        return recommendedSearchWindow
    }

    private var departureDateString: String {
        Self.searchDateFormatter.string(from: departureDate)
    }

    private var returnDateString: String {
        Self.searchDateFormatter.string(from: returnDate)
    }

    private var tripLengthDays: Int {
        let days = Calendar.current.dateComponents([.day], from: departureDate, to: returnDate).day ?? 0
        return max(days, 1)
    }

    private var tripLengthOptions: [Int] {
        Array(Set([3, 5, 7, 10, 14, tripLengthDays]))
            .filter { $0 >= 2 }
            .sorted()
    }

    private var departureMonthKey: String {
        Self.monthKeyFormatter.string(from: departureDate)
    }

    private var isUsingRecommendedWindow: Bool {
        let recommended = recommendedSearchWindow
        return Calendar.current.isDate(departureDate, inSameDayAs: recommended.departure)
            && Calendar.current.isDate(returnDate, inSameDayAs: recommended.returnDate)
    }

    private var routeSummary: String {
        "\(effectiveOriginCode) to \(deal.iataCode)"
    }

    private var currentFarePrice: Double? {
        deal.displayPrice
    }

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            switch store.step {
            case .idle:
                shoppingContent(isSearching: false)
            case .searching:
                shoppingContent(isSearching: true)
            case .trip(let options):
                tripContent(options: options)
            case .failed(let message):
                failedContent(message: message)
            default:
                EmptyView()
            }
        }
        .task(id: routeKey) {
            seedSearchControlsIfNeeded(force: true, preferredOrigin: effectiveOriginCode)
            // Run market intel and auto-search in parallel so the flight search
            // starts immediately instead of waiting for market intel API calls.
            async let intel: Void = loadMarketIntel()
            async let search: Void = autoSearchIfNeeded()
            _ = await (intel, search)
        }
        .onChange(of: departureDate) { _, newValue in
            let minimumReturn = Calendar.current.date(byAdding: .day, value: 1, to: newValue) ?? newValue
            if returnDate < minimumReturn {
                returnDate = minimumReturn
            }
        }
        .onChange(of: selectedCabinClass) { oldValue, newValue in
            guard oldValue != newValue else { return }
            // Only auto-re-search if we've already performed at least one search
            guard !autoSearchedRouteKey.isEmpty else { return }
            toastManager.show(
                message: "Searching \(newValue.displayName) class...",
                type: .info,
                duration: 2.0
            )
            performSearch()
        }
        .alert("Price Changed", isPresented: $showPriceAlert) {
            Button("Continue Anyway") {
                if let option = priceAlertOption {
                    store.selectOffer(option)
                }
            }
            Button("Email Me Deals") {
                presentEmailAlertSignup()
            }
            Button("Back to Deals", role: .cancel) {
                store.reset()
                router.dismissFullScreen()
            }
        } message: {
            if let discrepancy = store.lastPriceDiscrepancy {
                Text(discrepancy.message)
            } else if let option = priceAlertOption, let feedPrice = deal.displayPrice {
                Text("The live price is $\(Int(option.price)), up from $\(Int(feedPrice)). Prices change frequently — this is the current best rate.")
            }
        }
        .sheet(isPresented: $showEmailSignup) {
            PriceAlertSignupSheet(destinationName: deal.destination, price: deal.displayPrice)
        }
    }

    // MARK: - Search

    private func shoppingContent(isSearching: Bool) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: Spacing.lg) {
                header
                heroCard
                searchConsole
                searchMissionControlCard
                fareIntelSection

                if isSearching {
                    searchingCard
                } else {
                    searchButton
                }

                // Recent searches from previous booking sessions
                if !store.recentSearches.isEmpty && !isSearching {
                    recentSearchesSection
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
    }

    private var searchConsole: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Search Flights")
                        .font(SGFont.sectionHead)
                        .foregroundStyle(Color.sgWhite)
                    Text("Set your travel dates and preferences.")
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                }

                Spacer()

                Text(selectedCabinClass.displayName.uppercased())
                    .font(SGFont.bodyBold(size: 11))
                    .foregroundStyle(Color.sgYellow)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.xs)
                    .background(Color.sgYellow.opacity(0.12), in: Capsule())
            }

            HStack(spacing: Spacing.sm) {
                routeBadge(title: "From", code: effectiveOriginCode, subtitle: originSubtitle)
                routeArrow
                routeBadge(title: "To", code: deal.iataCode, subtitle: deal.destination)
            }

            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("Trip Window")
                    .font(SGFont.bodyBold(size: 12))
                    .foregroundStyle(Color.sgMuted)
                    .textCase(.uppercase)
                    .tracking(1)

                smartDateChips

                HStack(spacing: Spacing.sm) {
                    dateControl(
                        title: "Depart",
                        subtitle: departureDateString.shortDate,
                        selection: $departureDate,
                        range: Date()...
                    )

                    dateControl(
                        title: "Return",
                        subtitle: returnDateString.shortDate,
                        selection: $returnDate,
                        range: departureDate...
                    )
                }

                HStack(spacing: Spacing.sm) {
                    statChip(label: "Stay", value: "\(tripLengthDays) days", color: Color.sgWhiteDim)
                    statChip(label: "Route", value: routeSummary, color: Color.sgWhiteDim)
                    if usingAlternateOrigin {
                        statChip(label: "Market", value: "Nearby \(effectiveOriginCode)", color: Color.sgYellow)
                    }
                    if deal.bestDepartureDate == nil || deal.bestReturnDate == nil {
                        statChip(label: "Mode", value: "Flexible seed", color: Color.sgOrange)
                    }
                }
            }

            quickSearchControls

            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("Cabin")
                    .font(SGFont.bodyBold(size: 12))
                    .foregroundStyle(Color.sgMuted)
                    .textCase(.uppercase)
                    .tracking(1)

                HStack(spacing: Spacing.xs) {
                    ForEach(BookingCabinClass.allCases, id: \.self) { cabinClass in
                        cabinChip(for: cabinClass)
                    }
                }
            }

            if usingAlternateOrigin {
                Button {
                    selectOrigin(settingsStore.departureCode)
                } label: {
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "arrow.uturn.backward.circle")
                        Text("Switch Back to \(settingsStore.departureCode)")
                    }
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgWhiteDim)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.sgSurface, in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(Spacing.md)
        .background(Color.sgCell, in: RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    // MARK: - Smart Date Suggestions

    private enum DateSuggestionChip: Hashable {
        case cheapest
        case thisWeekend
        case nextWeekend
        case seasonal(String)
        case flexible
    }

    private var availableDateChips: [DateSuggestionChip] {
        var chips: [DateSuggestionChip] = []

        // "Cheapest" — only if the deal has cheapest date data
        if deal.cheapestDate != nil, deal.cheapestDate?.parsedISODate != nil {
            chips.append(.cheapest)
        }

        // "This Weekend" — only if today is Mon-Thu (still time to book)
        let weekday = Calendar.current.component(.weekday, from: Date())
        if weekday >= 2 && weekday <= 5 {
            chips.append(.thisWeekend)
        }

        // "Next Weekend" — always relevant
        chips.append(.nextWeekend)

        // Seasonal — based on bestMonths. Pick the next upcoming best month.
        if let seasonLabel = nextSeasonalSuggestion {
            chips.append(.seasonal(seasonLabel))
        }

        // "Flexible" — always available as a toggle
        chips.append(.flexible)

        // Cap at 4 chips max (excluding flexible toggle)
        let nonFlexible = chips.filter { if case .flexible = $0 { return false } else { return true } }
        let capped = Array(nonFlexible.prefix(3))
        return capped + [.flexible]
    }

    /// Determines the next seasonal suggestion based on the deal's bestMonths.
    /// Returns a label like "Spring" or "Jun" if a best month is upcoming.
    private var nextSeasonalSuggestion: String? {
        guard let months = deal.bestMonths, !months.isEmpty else { return nil }

        let calendar = Calendar.current
        let currentMonth = calendar.component(.month, from: Date())

        let monthMap: [String: Int] = [
            "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
            "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
            "january": 1, "february": 2, "march": 3, "april": 4, "june": 6,
            "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12
        ]

        let shortNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

        // Find the nearest upcoming best month
        var bestMonthNumbers: [Int] = months.compactMap { monthMap[$0.lowercased()] }
        bestMonthNumbers.sort()

        // Find next upcoming month (wrap around year)
        let upcoming = bestMonthNumbers.first(where: { $0 >= currentMonth })
            ?? bestMonthNumbers.first

        guard let targetMonth = upcoming, targetMonth > 0 && targetMonth <= 12 else { return nil }

        // Don't show if the current month IS a best month (user is already in season)
        if targetMonth == currentMonth { return nil }

        // Map seasonal ranges to labels
        if [6, 7, 8].contains(targetMonth) && Set(bestMonthNumbers).isSuperset(of: [6, 7, 8]) {
            return "Summer"
        }
        if [3, 4].contains(targetMonth) && Set(bestMonthNumbers).intersection([3, 4]).count >= 1 {
            return "Spring"
        }

        return shortNames[targetMonth]
    }

    private var smartDateChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.xs) {
                ForEach(availableDateChips, id: \.self) { chip in
                    dateSuggestionButton(for: chip)
                }
            }
        }
    }

    private func dateSuggestionButton(for chip: DateSuggestionChip) -> some View {
        let isActive: Bool = {
            if case .flexible = chip { return flexibleDates }
            return activeDateChip == chip
        }()

        let title: String = {
            switch chip {
            case .cheapest: return "Cheapest"
            case .thisWeekend: return "This Wknd"
            case .nextWeekend: return "Next Wknd"
            case .seasonal(let label): return label
            case .flexible: return "Flexible"
            }
        }()

        let subtitle: String = {
            switch chip {
            case .cheapest:
                if let dateStr = deal.cheapestDate, let date = dateStr.parsedISODate {
                    let fmt = DateFormatter()
                    fmt.dateFormat = "MMM d"
                    return fmt.string(from: date)
                }
                return "best price"
            case .thisWeekend:
                return thisWeekendLabel
            case .nextWeekend:
                return nextWeekendLabel
            case .seasonal:
                return "best time"
            case .flexible:
                return "+/- 3 days"
            }
        }()

        let icon: String = {
            switch chip {
            case .cheapest: return "tag"
            case .thisWeekend: return "calendar"
            case .nextWeekend: return "calendar.badge.clock"
            case .seasonal: return "sun.max"
            case .flexible: return "arrow.left.and.right"
            }
        }()

        return Button {
            applyDateSuggestion(chip)
        } label: {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .semibold))
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(SGFont.bodyBold(size: 11))
                    Text(subtitle.uppercased())
                        .font(SGFont.bodyBold(size: 8))
                        .tracking(0.5)
                        .opacity(0.7)
                }
            }
            .foregroundStyle(isActive ? Color.sgBg : Color.sgWhite)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, 6)
            .background(
                isActive ? Color.sgYellow : Color.sgSurface,
                in: Capsule()
            )
            .overlay(
                Capsule()
                    .strokeBorder(isActive ? Color.sgYellow : Color.sgBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var thisWeekendLabel: String {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        guard let friday = calendar.nextDate(
            after: today,
            matching: DateComponents(weekday: 6),
            matchingPolicy: .nextTimePreservingSmallerComponents
        ) else { return "Fri-Sun" }
        let fmt = DateFormatter()
        fmt.dateFormat = "MMM d"
        return fmt.string(from: friday)
    }

    private var nextWeekendLabel: String {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        guard let thisFriday = calendar.nextDate(
            after: today,
            matching: DateComponents(weekday: 6),
            matchingPolicy: .nextTimePreservingSmallerComponents
        ) else { return "Fri-Sun" }
        let nextFriday = calendar.date(byAdding: .weekOfYear, value: 1, to: thisFriday) ?? thisFriday
        let fmt = DateFormatter()
        fmt.dateFormat = "MMM d"
        return fmt.string(from: nextFriday)
    }

    private func applyDateSuggestion(_ chip: DateSuggestionChip) {
        let calendar = Calendar.current

        switch chip {
        case .cheapest:
            guard let depStr = deal.cheapestDate, let dep = depStr.parsedISODate else { return }
            let ret: Date
            if let retStr = deal.cheapestReturnDate, let retDate = retStr.parsedISODate {
                ret = retDate
            } else {
                ret = calendar.date(byAdding: .day, value: max(deal.tripDays, 7), to: dep) ?? dep
            }
            departureDate = calendar.startOfDay(for: dep)
            returnDate = calendar.startOfDay(for: ret)
            activeDateChip = chip

        case .thisWeekend:
            let today = calendar.startOfDay(for: Date())
            guard let friday = calendar.nextDate(
                after: today,
                matching: DateComponents(weekday: 6),
                matchingPolicy: .nextTimePreservingSmallerComponents
            ) else { return }
            let sunday = calendar.date(byAdding: .day, value: 2, to: friday) ?? friday
            departureDate = friday
            returnDate = sunday
            activeDateChip = chip

        case .nextWeekend:
            let today = calendar.startOfDay(for: Date())
            guard let thisFriday = calendar.nextDate(
                after: today,
                matching: DateComponents(weekday: 6),
                matchingPolicy: .nextTimePreservingSmallerComponents
            ) else { return }
            let nextFriday = calendar.date(byAdding: .weekOfYear, value: 1, to: thisFriday) ?? thisFriday
            let nextSunday = calendar.date(byAdding: .day, value: 2, to: nextFriday) ?? nextFriday
            departureDate = nextFriday
            returnDate = nextSunday
            activeDateChip = chip

        case .seasonal(let label):
            let targetMonth = seasonalTargetMonth(for: label)
            guard targetMonth > 0 else { return }
            let year = calendar.component(.year, from: Date())
            let currentMonth = calendar.component(.month, from: Date())
            let targetYear = targetMonth <= currentMonth ? year + 1 : year
            var components = DateComponents()
            components.year = targetYear
            components.month = targetMonth
            components.day = 15
            guard let dep = calendar.date(from: components) else { return }
            let ret = calendar.date(byAdding: .day, value: max(deal.tripDays, 7), to: dep) ?? dep
            departureDate = dep
            returnDate = ret
            activeDateChip = chip

        case .flexible:
            flexibleDates.toggle()
            if flexibleDates {
                // Widen the window by shifting departure 3 days earlier and return 3 days later
                let today = calendar.startOfDay(for: Date())
                let newDep = calendar.date(byAdding: .day, value: -3, to: departureDate) ?? departureDate
                departureDate = max(newDep, today)
                returnDate = calendar.date(byAdding: .day, value: 3, to: returnDate) ?? returnDate
            }
            // No activeDateChip change for flexible — it uses its own toggle
        }

        HapticEngine.selection()
        performSearch()
    }

    private func seasonalTargetMonth(for label: String) -> Int {
        let seasonMap: [String: Int] = [
            "Spring": 4, "Summer": 7,
            "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
            "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
        ]
        return seasonMap[label] ?? 0
    }

    private var quickSearchControls: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Options")
                .font(SGFont.bodyBold(size: 12))
                .foregroundStyle(Color.sgMuted)
                .textCase(.uppercase)
                .tracking(1)

            HStack(spacing: Spacing.xs) {
                routeExperimentChip(
                    title: "Earlier",
                    subtitle: "-7d",
                    isActive: false
                ) {
                    shiftTrip(by: -7)
                }

                routeExperimentChip(
                    title: "Later",
                    subtitle: "+7d",
                    isActive: false
                ) {
                    shiftTrip(by: 7)
                }

                routeExperimentChip(
                    title: "Weekend",
                    subtitle: "reset",
                    isActive: false
                ) {
                    applyNextWeekend()
                }

                routeExperimentChip(
                    title: "Recommended",
                    subtitle: "deal seed",
                    isActive: isUsingRecommendedWindow
                ) {
                    applyDealRecommendedWindow()
                }

                if let cheapestMonth = monthlyIntel?.cheapestMonth {
                    routeExperimentChip(
                        title: "Cheapest",
                        subtitle: cheapestMonth.monthDisplayShort,
                        isActive: cheapestMonth == departureMonthKey
                    ) {
                        if let month = monthlyIntel?.months.first(where: { $0.month == cheapestMonth }) {
                            applyMonthlySuggestion(month)
                        }
                    }
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.xs) {
                    ForEach(tripLengthOptions, id: \.self) { option in
                        routeExperimentChip(
                            title: "\(option) days",
                            subtitle: "stay",
                            isActive: option == tripLengthDays
                        ) {
                            applyTripLength(option)
                        }
                    }
                }
            }
        }
    }

    private func routeExperimentChip(
        title: String,
        subtitle: String,
        isActive: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(SGFont.bodyBold(size: 12))
                    .foregroundStyle(isActive ? Color.sgBg : Color.sgWhite)
                Text(subtitle.uppercased())
                    .font(SGFont.bodyBold(size: 9))
                    .foregroundStyle(isActive ? Color.sgBg.opacity(0.75) : Color.sgMuted)
                    .tracking(1)
            }
            .frame(minWidth: 72, alignment: .leading)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.sm)
            .background(
                isActive ? Color.sgYellow : Color.sgSurface,
                in: RoundedRectangle(cornerRadius: Radius.sm)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .strokeBorder(isActive ? Color.sgYellow : Color.sgBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func routeBadge(title: String, code: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased())
                .font(SGFont.bodyBold(size: 10))
                .foregroundStyle(Color.sgMuted)
                .tracking(1)

            Text(code)
                .font(SGFont.display(size: 30))
                .foregroundStyle(Color.sgWhite)

            Text(subtitle)
                .font(SGFont.body(size: 12))
                .foregroundStyle(Color.sgMuted)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.sm)
        .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.md))
    }

    private var routeArrow: some View {
        VStack(spacing: 4) {
            Image(systemName: "airplane")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.sgYellow)
            Text(deal.safeFlightDuration)
                .font(SGFont.caption)
                .foregroundStyle(Color.sgMuted)
        }
        .frame(width: 44)
    }

    private func dateControl(
        title: String,
        subtitle: String,
        selection: Binding<Date>,
        range: PartialRangeFrom<Date>
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(title.uppercased())
                .font(SGFont.bodyBold(size: 10))
                .foregroundStyle(Color.sgMuted)
                .tracking(1)

            DatePicker(
                "",
                selection: selection,
                in: range,
                displayedComponents: .date
            )
            .datePickerStyle(.compact)
            .labelsHidden()
            .tint(Color.sgYellow)
            .colorScheme(.dark)

            Text(subtitle)
                .font(SGFont.body(size: 12))
                .foregroundStyle(Color.sgWhiteDim)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.sm)
        .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    private func statChip(label: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(SGFont.bodyBold(size: 9))
                .foregroundStyle(Color.sgMuted)
                .tracking(1)

            Text(value)
                .font(SGFont.bodyBold(size: 12))
                .foregroundStyle(color)
                .lineLimit(1)
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.sm)
        .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.sm))
    }

    private func cabinChip(for cabinClass: BookingCabinClass) -> some View {
        let isSelected = selectedCabinClass == cabinClass

        return Button {
            HapticEngine.selection()
            selectedCabinClass = cabinClass
        } label: {
            Text(cabinClass.displayName)
                .font(SGFont.bodyBold(size: 12))
                .foregroundStyle(isSelected ? Color.sgBg : Color.sgWhiteDim)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.sm)
                .background(isSelected ? Color.sgYellow : Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.sm))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.sm)
                        .strokeBorder(isSelected ? Color.sgYellow : Color.sgBorder, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    private var searchButton: some View {
        Button {
            performSearch()
        } label: {
            HStack(spacing: Spacing.sm) {
                Image(systemName: "airplane.departure")
                    .font(.system(size: 14, weight: .semibold))
                Text("Search Live Prices")
                    .font(SGFont.bodyBold(size: 16))
                Spacer()
                Text("\(departureDateString.shortDate) to \(returnDateString.shortDate)")
                    .font(SGFont.body(size: 12))
            }
            .foregroundStyle(Color.sgBg)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.md)
            .padding(.horizontal, Spacing.md)
            .background(Color.sgYellow)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        }
    }

    // MARK: - Recent Searches

    private var recentSearchesSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("RECENT SEARCHES")
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgMuted)
                .tracking(1.4)

            VStack(spacing: 0) {
                ForEach(Array(store.recentSearches.prefix(4).enumerated()), id: \.element.id) { index, search in
                    Button {
                        HapticEngine.light()
                        applyRecentSearch(search)
                    } label: {
                        HStack(spacing: Spacing.sm) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(search.origin) → \(search.destinationCity)")
                                    .font(SGFont.bodyBold(size: 14))
                                    .foregroundStyle(Color.sgWhite)
                                Text("\(search.departureDate.shortDate) · \(search.offerCount) fares found")
                                    .font(SGFont.body(size: 12))
                                    .foregroundStyle(Color.sgMuted)
                            }
                            Spacer()
                            if let price = search.bestPrice, price > 0 {
                                Text("$\(Int(price))")
                                    .font(SGFont.bodyBold(size: 15))
                                    .foregroundStyle(Color.sgYellow)
                            }
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Color.sgMuted)
                        }
                        .padding(.vertical, 10)
                    }
                    .buttonStyle(.plain)

                    if index < min(store.recentSearches.count, 4) - 1 {
                        Rectangle()
                            .fill(Color.sgBorder)
                            .frame(height: 1)
                    }
                }
            }
            .padding(Spacing.md)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .strokeBorder(Color.sgBorder, lineWidth: 1)
            )
        }
    }

    private func applyRecentSearch(_ search: RecentSearch) {
        // Re-run the search with the same dates
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withFullDate]
        let ymd = DateFormatter()
        ymd.dateFormat = "yyyy-MM-dd"

        if let depDate = fmt.date(from: search.departureDate) ?? ymd.date(from: search.departureDate) {
            departureDate = depDate
        }
        if let ret = search.returnDate,
           let retDate = fmt.date(from: ret) ?? ymd.date(from: ret) {
            returnDate = retDate
        }
        performSearch()
    }

    private var missionControlTitle: String {
        switch store.step {
        case .searching:
            return "Searching..."
        case .trip(let options):
            let count = options.count
            return count == 1 ? "1 Fare Found" : "\(count) Fares Found"
        case .failed:
            return "No Fares Found"
        default:
            if store.lastSearchSnapshot != nil {
                return "Search Complete"
            }
            return "Flight Search"
        }
    }

    private var missionControlSubtitle: String {
        switch store.step {
        case .searching:
            return "Scanning live fares for this route."
        case .trip:
            return "Live fares ready. Pick one to continue."
        case .failed:
            return "Try different dates or check back later."
        default:
            if store.lastSearchSnapshot != nil {
                return "Previous results shown below."
            }
            return "Tap search to find live fares."
        }
    }

    private var searchMissionControlCard: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(missionControlTitle)
                        .font(SGFont.sectionHead)
                        .foregroundStyle(Color.sgWhite)
                    Text(missionControlSubtitle)
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                }

                Spacer()

                statusPill(
                    title: searchStatusTitle,
                    color: searchStatusColor,
                    filled: store.step == .searching
                )
            }

            HStack(spacing: Spacing.sm) {
                statChip(label: "Route", value: routeSummary, color: Color.sgWhite)
                statChip(label: "Cabin", value: selectedCabinClass.displayName, color: Color.sgYellow)
            }

            if let snapshot = store.lastSearchSnapshot {
                HStack(spacing: Spacing.sm) {
                    missionMetric(
                        title: "Best Live Fare",
                        value: snapshot.bestPrice.map { "$\(Int($0))" } ?? "—",
                        color: Color.sgYellow
                    )
                    missionMetric(
                        title: "Offers",
                        value: "\(snapshot.offerCount)",
                        color: Color.sgWhite
                    )
                    missionMetric(
                        title: "Updated",
                        value: snapshot.searchedAt.relativeSearchLabel,
                        color: Color.sgWhiteDim
                    )
                }

                if let bestPrice = snapshot.bestPrice,
                   let feedPrice = deal.displayPrice {
                    let delta = Int(bestPrice - feedPrice)
                    Text(
                        delta == 0
                            ? "Live fare is matching the feed price."
                            : (delta > 0
                                ? "Live fare is currently $\(delta) above the feed price."
                                : "Live fare is currently $\(abs(delta)) below the feed price.")
                    )
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(delta > 0 ? Color.sgOrange : (delta < 0 ? Color.sgGreen : Color.sgMuted))
                }
            } else if store.step == .searching {
                Text("Finding available flights...")
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            } else if store.step == .idle && store.lastSearchStartedAt == nil {
                Text("Preparing to search live fares...")
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            } else {
                Text("No flights found. Try different dates or options above.")
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            }

            if let lastSearchError = store.lastSearchErrorMessage,
               !lastSearchError.isEmpty {
                Text(lastSearchError)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            }

            HStack(spacing: Spacing.sm) {
                Button {
                    performSearch()
                } label: {
                    Label("Refresh Live Search", systemImage: "arrow.clockwise")
                        .font(SGFont.bodyBold(size: 13))
                        .foregroundStyle(Color.sgBg)
                        .padding(.horizontal, Spacing.sm)
                        .padding(.vertical, Spacing.sm)
                        .background(Color.sgYellow, in: Capsule())
                }
                .buttonStyle(.plain)

                if store.lastSearchSnapshot != nil {
                    Button {
                        applyDealRecommendedWindow()
                    } label: {
                        Label("Reset Route Window", systemImage: "calendar.badge.clock")
                            .font(SGFont.bodyBold(size: 13))
                            .foregroundStyle(Color.sgWhiteDim)
                            .padding(.horizontal, Spacing.sm)
                            .padding(.vertical, Spacing.sm)
                            .background(
                                Capsule()
                                    .strokeBorder(Color.sgBorder, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(Spacing.md)
        .background(Color.sgCell, in: RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    private func missionMetric(title: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(SGFont.bodyBold(size: 9))
                .foregroundStyle(Color.sgMuted)
                .tracking(1)
            Text(value)
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(color)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.sm)
        .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.sm))
    }

    private func statusPill(title: String, color: Color, filled: Bool) -> some View {
        Text(title.uppercased())
            .font(SGFont.bodyBold(size: 10))
            .foregroundStyle(filled ? Color.sgBg : color)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.xs)
            .background(color.opacity(filled ? 1 : 0.15), in: Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(color.opacity(0.35), lineWidth: filled ? 0 : 1)
            )
    }

    private var searchStatusTitle: String {
        switch store.step {
        case .searching:
            return "Scanning Live Fares"
        case .trip:
            return "Live Results Ready"
        case .failed:
            return "Needs Another Pass"
        case .paying:
            return "Checkout Locked"
        default:
            if store.lastSearchSnapshot != nil {
                return "Search Primed"
            }
            return "Awaiting Search"
        }
    }

    private var searchStatusColor: Color {
        switch store.step {
        case .searching:
            return Color.sgYellow
        case .trip:
            return Color.sgGreen
        case .failed:
            return Color.sgOrange
        case .paying:
            return Color.sgWhiteDim
        default:
            return store.lastSearchSnapshot == nil ? Color.sgWhiteDim : Color.sgYellow
        }
    }

    private var searchingCard: some View {
        VStack(spacing: Spacing.md) {
            ProgressView()
                .progressViewStyle(.circular)
                .tint(Color.sgYellow)
                .scaleEffect(1.15)

            Text("Searching \(selectedCabinClass.displayName.lowercased()) fares...")
                .font(SGFont.bodyBold(size: 15))
                .foregroundStyle(Color.sgWhite)

            Text("\(departureDateString.shortDate) to \(returnDateString.shortDate) · \(routeSummary)")
                .font(SGFont.body(size: 12))
                .foregroundStyle(Color.sgMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.lg)
        .background(Color.sgCell, in: RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    // MARK: - Price Info

    @ViewBuilder
    private var fareIntelSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Price Info")
                        .font(SGFont.sectionHead)
                        .foregroundStyle(Color.sgWhite)
                    Text("Price context for this route.")
                        .font(SGFont.body(size: 12))
                        .foregroundStyle(Color.sgMuted)
                }

                Spacer()

                if isLoadingMarketIntel {
                    ProgressView()
                        .tint(Color.sgYellow)
                }
            }

            if let monthlyIntel {
                monthlyIntelCard(monthlyIntel)
            }

            if let marketIntel, !marketIntel.otherPrices.isEmpty {
                alternativeOriginsCard(marketIntel.otherPrices)
            }

            if let marketIntel, !marketIntel.similarDestinations.isEmpty {
                similarEscapesCard(marketIntel.similarDestinations)
            }

            if !isLoadingMarketIntel,
               monthlyIntel == nil,
               (marketIntel?.otherPrices.isEmpty ?? true),
               (marketIntel?.similarDestinations.isEmpty ?? true) {
                intelEmptyState
            }

            if let marketIntelError {
                Text(marketIntelError)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            }
        }
    }

    private func monthlyIntelCard(_ intel: DestinationMonthlyResponse) -> some View {
        let deltaText: String? = {
            guard let cheapestPrice = intel.cheapestPrice,
                  let currentFarePrice else { return nil }

            let delta = Int(abs(currentFarePrice - cheapestPrice))
            if currentFarePrice > cheapestPrice {
                return "$\(delta) above the monthly low"
            }
            if cheapestPrice > currentFarePrice {
                return "$\(delta) below the monthly low"
            }
            return "At the monthly low"
        }()

        return VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack {
                Label("Best Month", systemImage: "calendar")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgWhite)

                Spacer()

                if let cheapestPrice = intel.cheapestPrice {
                    Text("$\(Int(cheapestPrice))")
                        .font(SGFont.display(size: 28))
                        .foregroundStyle(Color.sgYellow)
                }
            }

            Text(intel.cheapestMonth?.monthDisplayName ?? "No monthly trend yet")
                .font(SGFont.body(size: 13))
                .foregroundStyle(Color.sgWhiteDim)

            if let deltaText {
                Text(deltaText)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            }

            if !intel.months.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.sm) {
                        ForEach(intel.months.prefix(6), id: \.month) { month in
                            Button {
                                applyMonthlySuggestion(month)
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(month.month.monthDisplayName)
                                        .font(SGFont.bodyBold(size: 12))
                                        .foregroundStyle(month.month == departureMonthKey ? Color.sgBg : Color.sgWhiteDim)
                                    Text("$\(Int(month.price))")
                                        .font(SGFont.bodyBold(size: 13))
                                        .foregroundStyle(month.month == departureMonthKey ? Color.sgBg : Color.sgYellow)
                                }
                                .padding(.horizontal, Spacing.sm)
                                .padding(.vertical, Spacing.sm)
                                .background(
                                    month.month == departureMonthKey ? Color.sgYellow : Color.sgSurface,
                                    in: RoundedRectangle(cornerRadius: Radius.sm)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radius.sm)
                                        .strokeBorder(
                                            month.month == departureMonthKey ? Color.sgYellow : Color.sgBorder,
                                            lineWidth: 1
                                        )
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Text("Tap a month to search new dates.")
                    .font(SGFont.body(size: 11))
                    .foregroundStyle(Color.sgMuted)
            }
        }
        .padding(Spacing.md)
        .background(Color.sgCell, in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    private func alternativeOriginsCard(_ prices: [AlternativeOriginPrice]) -> some View {
        let alternatives = prices
            .filter { $0.origin.caseInsensitiveCompare(settingsStore.departureCode) != .orderedSame }
            .sorted { $0.price < $1.price }
            .prefix(3)

        return VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack {
                Text("Nearby Market Scan")
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgWhite)

                Spacer()

                if usingAlternateOrigin {
                    Text("Searching \(effectiveOriginCode)")
                        .font(SGFont.bodyBold(size: 11))
                        .foregroundStyle(Color.sgYellow)
                }
            }

            ForEach(Array(alternatives.enumerated()), id: \.offset) { _, option in
                Button {
                    selectOrigin(option.origin)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: Spacing.xs) {
                                Text(option.origin)
                                    .font(SGFont.bodyBold(size: 13))
                                    .foregroundStyle(Color.sgYellow)

                                if option.origin.caseInsensitiveCompare(effectiveOriginCode) == .orderedSame {
                                    Text("ACTIVE")
                                        .font(SGFont.bodyBold(size: 9))
                                        .foregroundStyle(Color.sgBg)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 3)
                                        .background(Color.sgYellow, in: Capsule())
                                }
                            }

                            Text(option.source.uppercased())
                                .font(SGFont.body(size: 11))
                                .foregroundStyle(Color.sgMuted)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 2) {
                            Text("$\(Int(option.price))")
                                .font(SGFont.bodyBold(size: 14))
                                .foregroundStyle(Color.sgWhite)

                            if let currentFarePrice {
                                let gap = Int(currentFarePrice - option.price)
                                Text(gap > 0 ? "$\(gap) cheaper than \(settingsStore.departureCode)" : "Tap to search flights")
                                    .font(SGFont.body(size: 11))
                                    .foregroundStyle(gap > 0 ? Color.sgGreen : Color.sgMuted)
                            } else {
                                Text("Tap to search flights")
                                    .font(SGFont.body(size: 11))
                                    .foregroundStyle(Color.sgMuted)
                            }
                        }
                    }
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.sm))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.sm)
                            .strokeBorder(
                                option.origin.caseInsensitiveCompare(effectiveOriginCode) == .orderedSame ? Color.sgYellow.opacity(0.45) : Color.sgBorder,
                                lineWidth: 1
                            )
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(Spacing.md)
        .background(Color.sgCell, in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    private func similarEscapesCard(_ destinations: [SimilarDestinationDeal]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Similar Escapes")
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(Color.sgWhite)

            ForEach(destinations.prefix(3)) { destination in
                Button {
                    openSimilarDestination(destination)
                } label: {
                    HStack(spacing: Spacing.sm) {
                        CachedAsyncImage(url: destination.imageUrl)
                            .frame(width: 56, height: 44)
                            .clipShape(RoundedRectangle(cornerRadius: Radius.sm))

                        VStack(alignment: .leading, spacing: 2) {
                            Text(destination.city)
                                .font(SGFont.bodyBold(size: 13))
                                .foregroundStyle(Color.sgWhite)
                            Text("From $\(Int(destination.flightPrice))")
                                .font(SGFont.body(size: 12))
                                .foregroundStyle(Color.sgMuted)
                        }

                        Spacer()

                        if switchingSimilarDestinationID == destination.id {
                            ProgressView()
                                .tint(Color.sgYellow)
                        } else {
                            Image(systemName: "arrow.right.circle.fill")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(Color.sgYellow)
                        }
                    }
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.sm))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.sm)
                            .strokeBorder(Color.sgBorder, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .disabled(switchingSimilarDestinationID != nil)
            }
        }
        .padding(Spacing.md)
        .background(Color.sgCell, in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    private var intelEmptyState: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text("More info loading...")
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(Color.sgWhiteDim)
            Text("We'll still search the live booking engine using your selected dates.")
                .font(SGFont.body(size: 12))
                .foregroundStyle(Color.sgMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.md)
        .background(Color.sgCell, in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    // MARK: - Results

    private func tripContent(options: [TripOption]) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: Spacing.lg) {
                header
                searchSummaryCard
                searchMissionControlCard

                if let best = options.first {
                    if let discrepancy = store.lastPriceDiscrepancy {
                        priceDiscrepancyBanner(discrepancy)
                    }

                    bestOfferCard(best)

                    if options.count > 1 {
                        alternativesSection(Array(options.dropFirst()))
                    }

                    continueButton(best)
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
    }

    private var searchSummaryCard: some View {
        HStack(spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Live Search")
                    .font(SGFont.bodyBold(size: 12))
                    .foregroundStyle(Color.sgMuted)
                Text("\(departureDateString.shortDate) to \(returnDateString.shortDate)")
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgWhite)
                Text(routeSummary)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(selectedCabinClass.displayName)
                    .font(SGFont.bodyBold(size: 12))
                    .foregroundStyle(Color.sgYellow)
                Text("\(tripLengthDays) days")
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            }
        }
        .padding(Spacing.md)
        .background(Color.sgCell, in: RoundedRectangle(cornerRadius: Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .strokeBorder(Color.sgBorder, lineWidth: 1)
        )
    }

    private func bestOfferCard(_ offer: TripOption) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
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

            if let outbound = offer.outboundSlice {
                flightSliceRow(
                    title: "Outbound",
                    slice: outbound,
                    accent: Color.sgYellow
                )
            }

            if let inbound = offer.returnSlice {
                flightSliceRow(
                    title: "Return",
                    slice: inbound,
                    accent: Color.sgGreen
                )
            }

            HStack(spacing: Spacing.md) {
                statChip(label: "Cabin", value: displayCabinName(offer.cabinClass), color: Color.sgWhite)
                statChip(label: "Stops", value: offer.stops == 0 ? "Nonstop" : "\(offer.stops)", color: offer.stops == 0 ? Color.sgGreen : Color.sgWhite)
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

    private func flightSliceRow(title: String, slice: FlightSlice, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack {
                Text(title.uppercased())
                    .font(SGFont.bodyBold(size: 10))
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1)

                Spacer()

                Text(slice.airline)
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgWhiteDim)
            }

            HStack(alignment: .center, spacing: Spacing.md) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(slice.origin)
                        .font(SGFont.display(size: 28))
                        .foregroundStyle(Color.sgWhite)
                    Text(slice.departureTime.boardTime)
                        .font(SGFont.bodyBold(size: 13))
                        .foregroundStyle(accent)
                }

                VStack(spacing: 2) {
                    Image(systemName: "airplane")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(accent)
                    Text(slice.duration)
                        .font(SGFont.body(size: 11))
                        .foregroundStyle(Color.sgMuted)
                }
                .frame(maxWidth: .infinity)

                VStack(alignment: .trailing, spacing: 2) {
                    Text(slice.destination)
                        .font(SGFont.display(size: 28))
                        .foregroundStyle(Color.sgWhite)
                    Text(slice.arrivalTime.boardTime)
                        .font(SGFont.bodyBold(size: 13))
                        .foregroundStyle(accent)
                }
            }
        }
        .padding(Spacing.sm)
        .background(Color.sgSurface, in: RoundedRectangle(cornerRadius: Radius.sm))
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
            .buttonStyle(.plain)

            if alternativesExpanded {
                ForEach(options.prefix(6)) { option in
                    alternativeRow(option)
                }
            }
        }
    }

    private func alternativeRow(_ option: TripOption) -> some View {
        Button {
            handleOfferSelection(option)
        } label: {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                HStack {
                    Text(option.airline)
                        .font(SGFont.bodyBold(size: 13))
                        .foregroundStyle(Color.sgWhite)
                    Spacer()
                    Text("$\(Int(option.price))")
                        .font(SGFont.bodyBold(size: 16))
                        .foregroundStyle(Color.sgYellow)
                }

                Text("\(option.departureTime) · \(option.duration) · \(displayCabinName(option.cabinClass))")
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            }
            .padding(Spacing.sm + Spacing.xs)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .strokeBorder(Color.sgBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func continueButton(_ bestOffer: TripOption) -> some View {
        Button {
            handleOfferSelection(bestOffer)
        } label: {
            HStack {
                Text("Continue to Booking")
                    .font(SGFont.bodyBold(size: 16))
                Spacer()
                Text("$\(Int(bestOffer.price))")
                    .font(SGFont.bodyBold(size: 15))
            }
            .foregroundStyle(Color.sgBg)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.md)
            .padding(.horizontal, Spacing.md)
            .background(Color.sgYellow)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        }
        .padding(.top, Spacing.sm)
    }

    // MARK: - Failed

    private func failedContent(message: String) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: Spacing.lg) {
                header
                heroCard
                searchConsole
                searchMissionControlCard

                VStack(spacing: Spacing.md) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 42))
                        .foregroundStyle(Color.sgOrange)

                    Text("Search Failed")
                        .font(SGFont.cardTitle)
                        .foregroundStyle(Color.sgWhite)

                    Text(message)
                        .font(SGFont.bodyDefault)
                        .foregroundStyle(Color.sgMuted)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.lg)

                searchButton
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
    }

    // MARK: - Shared UI

    private var header: some View {
        HStack {
            SplitFlapRow(
                text: "YOUR TRIP",
                maxLength: 10,
                size: .md,
                color: Color.sgWhite,
                animate: true,
                staggerMs: 40
            )
            Spacer()
        }
        .padding(.top, Spacing.md)
    }

    private var heroCard: some View {
        VStack(spacing: 0) {
            CachedAsyncImage(url: deal.imageUrl) {
                Color.sgSurface
            }
            .frame(height: 200)
            .clipped()

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
                    infoChip(icon: "calendar", text: departureDateString.shortDate)
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

    private func priceDiscrepancyBanner(_ discrepancy: PriceDiscrepancy) -> some View {
        let toneColor: Color = switch discrepancy.tier {
        case "cheaper":
            Color.sgGreen
        case "similar":
            Color.sgWhiteDim
        case "moderate_increase":
            Color.sgOrange
        case "significant_increase", "deal_expired":
            Color.sgRed
        default:
            Color.sgYellow
        }

        let iconName: String = switch discrepancy.tier {
        case "cheaper":
            "arrow.down.circle.fill"
        case "similar":
            "equal.circle.fill"
        case "moderate_increase":
            "arrow.up.circle.fill"
        case "significant_increase", "deal_expired":
            "exclamationmark.triangle.fill"
        default:
            "info.circle.fill"
        }

        return HStack(alignment: .top, spacing: Spacing.sm) {
            Image(systemName: iconName)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(toneColor)

            VStack(alignment: .leading, spacing: 4) {
                Text(discrepancy.message)
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgWhite)

                Text("Feed: $\(Int(discrepancy.feedPrice)) · Live: $\(Int(discrepancy.bookingPrice))")
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
            }

            Spacer(minLength: 0)
        }
        .padding(Spacing.sm)
        .background(Color.sgCell, in: RoundedRectangle(cornerRadius: Radius.sm))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.sm)
                .strokeBorder(toneColor.opacity(0.35), lineWidth: 1)
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

    // MARK: - Actions

    private func performSearch() {
        guard network.isConnected else {
            toastManager.show(
                message: "No internet connection. Connect to Wi-Fi or cellular data and try again.",
                type: .error
            )
            return
        }
        Task {
            await store.searchFlights(
                origin: effectiveOriginCode,
                destination: deal.iataCode,
                departureDate: departureDateString,
                returnDate: returnDateString,
                cabinClass: selectedCabinClass
            )
            autoSearchedRouteKey = activeSearchKey
        }
    }

    private func handleOfferSelection(_ offer: TripOption) {
        if let discrepancy = store.lastPriceDiscrepancy {
            switch discrepancy.tier {
            case "moderate_increase", "significant_increase", "deal_expired":
                priceAlertOption = offer
                showPriceAlert = true
                return
            default:
                break
            }
        }

        guard let feedPrice = deal.displayPrice else {
            store.selectOffer(offer)
            return
        }

        let increase = (offer.price - feedPrice) / feedPrice
        if increase > 0.15 {
            priceAlertOption = offer
            showPriceAlert = true
        } else {
            store.selectOffer(offer)
        }
    }

    private func presentEmailAlertSignup() {
        if settingsStore.priceAlertsEnabled && !settingsStore.alertEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            HapticEngine.light()
            toastManager.show(
                message: "Deal emails are already enabled for this device.",
                type: .success
            )
        } else {
            HapticEngine.medium()
            showEmailSignup = true
        }
    }

    @MainActor
    private func loadMarketIntel() async {
        isLoadingMarketIntel = true
        marketIntelError = nil

        async let detailTask: DestinationMarketResponse? = try? await APIClient.shared.fetch(
            .destination(id: deal.id, origin: effectiveOriginCode)
        )
        async let monthlyTask: DestinationMonthlyResponse? = try? await APIClient.shared.fetch(
            .destinationMonthly(origin: effectiveOriginCode, destination: deal.iataCode)
        )

        let (detail, monthly) = await (detailTask, monthlyTask)
        marketIntel = detail
        monthlyIntel = monthly

        if detail == nil && monthly == nil {
            marketIntelError = "Loading price info..."
        }

        isLoadingMarketIntel = false
    }

    @MainActor
    private func autoSearchIfNeeded() async {
        guard network.isConnected else { return }
        guard autoSearchedRouteKey != activeSearchKey else { return }

        let existingSearchMatches =
            store.searchOrigin == effectiveOriginCode
            && store.searchDestination == deal.iataCode
            && store.searchDepartureDate == departureDateString
            && store.searchReturnDate == returnDateString
            && store.searchCabinClass == selectedCabinClass

        guard store.step == .idle || !existingSearchMatches else {
            autoSearchedRouteKey = activeSearchKey
            return
        }

        await store.searchFlights(
            origin: effectiveOriginCode,
            destination: deal.iataCode,
            departureDate: departureDateString,
            returnDate: returnDateString,
            cabinClass: selectedCabinClass
        )
        autoSearchedRouteKey = activeSearchKey
    }

    private func seedSearchControlsIfNeeded(force: Bool, preferredOrigin: String? = nil) {
        guard force || seededRouteKey != routeKey else { return }

        let window = fallbackSearchWindow
        departureDate = window.departure
        returnDate = max(
            Calendar.current.date(byAdding: .day, value: 1, to: departureDate) ?? departureDate,
            window.returnDate
        )
        selectedOriginCode = preferredOrigin ?? store.searchOrigin ?? settingsStore.departureCode
        selectedCabinClass = store.searchCabinClass
        seededRouteKey = routeKey
    }

    private func selectOrigin(_ code: String) {
        guard !code.isEmpty else { return }
        HapticEngine.selection()
        selectedOriginCode = code
    }

    private func shiftTrip(by days: Int) {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let currentDeparture = calendar.startOfDay(for: departureDate)
        let proposedDeparture = calendar.date(byAdding: .day, value: days, to: currentDeparture) ?? currentDeparture
        let normalizedDeparture = max(proposedDeparture, today)

        departureDate = normalizedDeparture
        returnDate = calendar.date(byAdding: .day, value: tripLengthDays, to: normalizedDeparture) ?? normalizedDeparture
        HapticEngine.selection()
        performSearch()
    }

    private func applyTripLength(_ days: Int) {
        let calendar = Calendar.current
        let normalizedDeparture = calendar.startOfDay(for: departureDate)
        returnDate = calendar.date(byAdding: .day, value: max(days, 1), to: normalizedDeparture) ?? normalizedDeparture
        HapticEngine.selection()
        performSearch()
    }

    private func applyNextWeekend() {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        let friday = calendar.nextDate(
            after: start,
            matching: DateComponents(weekday: 6),
            matchingPolicy: .nextTimePreservingSmallerComponents
        ) ?? start

        departureDate = friday
        returnDate = calendar.date(byAdding: .day, value: tripLengthDays, to: friday) ?? friday
        HapticEngine.selection()
        performSearch()
    }

    private func applyDealRecommendedWindow() {
        let window = recommendedSearchWindow
        let calendar = Calendar.current

        departureDate = calendar.startOfDay(for: window.departure)
        returnDate = max(
            calendar.date(byAdding: .day, value: 1, to: departureDate) ?? departureDate,
            calendar.startOfDay(for: window.returnDate)
        )
        HapticEngine.selection()
        performSearch()
    }

    private func applyMonthlySuggestion(_ month: MonthlyFare) {
        guard let seededDeparture = Self.monthDateFormatter.date(from: "\(month.month)-10") else { return }

        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let normalizedDeparture = max(calendar.startOfDay(for: seededDeparture), today)

        departureDate = normalizedDeparture
        returnDate = calendar.date(byAdding: .day, value: tripLengthDays, to: normalizedDeparture) ?? normalizedDeparture
        HapticEngine.selection()
        performSearch()
    }

    private func openSimilarDestination(_ suggestion: SimilarDestinationDeal) {
        Task { @MainActor in
            guard switchingSimilarDestinationID == nil else { return }

            HapticEngine.selection()
            switchingSimilarDestinationID = suggestion.id

            let preservedOrigin = effectiveOriginCode
            let preservedDeparture = departureDateString
            let preservedReturn = returnDateString
            let preservedCabin = selectedCabinClass

            defer {
                switchingSimilarDestinationID = nil
            }

            do {
                let nextDeal: Deal = try await APIClient.shared.fetch(
                    .destination(id: suggestion.id, origin: preservedOrigin)
                )

                alternativesExpanded = false
                showPriceAlert = false
                priceAlertOption = nil
                marketIntel = nil
                monthlyIntel = nil
                marketIntelError = nil
                autoSearchedRouteKey = ""
                seededRouteKey = ""

                store.start(deal: nextDeal)
                store.searchOrigin = preservedOrigin
                store.searchDepartureDate = preservedDeparture
                store.searchReturnDate = preservedReturn
                store.searchCabinClass = preservedCabin
            } catch {
                toastManager.show(
                    message: "Couldn't load \(suggestion.city) right now.",
                    type: .error
                )
            }
        }
    }

    private func displayCabinName(_ cabinClass: String?) -> String {
        guard let cabinClass, let mapped = BookingCabinClass(rawValue: cabinClass) else {
            return selectedCabinClass.displayName
        }
        return mapped.displayName
    }

    private static let searchDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let monthKeyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM"
        return formatter
    }()

    private static let monthDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

private extension String {
    var parsedISODate: Date? {
        let isoFormatter = ISO8601DateFormatter()
        if let isoDate = isoFormatter.date(from: self) {
            return isoDate
        }

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: self)
    }

    var monthDisplayName: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM"
        guard let date = formatter.date(from: self) else { return self }

        let output = DateFormatter()
        output.locale = Locale(identifier: "en_US")
        output.dateFormat = "MMM yyyy"
        return output.string(from: date)
    }

    var monthDisplayShort: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM"
        guard let date = formatter.date(from: self) else { return self }

        let output = DateFormatter()
        output.locale = Locale(identifier: "en_US")
        output.dateFormat = "MMM"
        return output.string(from: date)
    }
}

private extension Date {
    var relativeSearchLabel: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: self, relativeTo: Date())
    }
}

// MARK: - Preview

#Preview("Trip View") {
    TripView(deal: .preview)
        .environment(BookingStore())
        .environment(SettingsStore())
        .environment(Router())
        .environment(ToastManager())
}
