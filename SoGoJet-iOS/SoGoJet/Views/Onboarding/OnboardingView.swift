import SwiftUI

// MARK: - Onboarding View

struct OnboardingView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(FeedStore.self) private var feedStore
    @Environment(AuthStore.self) private var auth
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var currentDestinationIndex = 0
    @State private var animateFlap = false
    @State private var cyclingTask: Task<Void, Never>?
    @State private var liveShowcases: [OnboardingShowcase]?
    @State private var isPickingAirport = false
    @State private var showPermissionBriefing = false

    private static let fallbackShowcases: [OnboardingShowcase] = [
        .init(code: "BCN", city: "BARCELONA", country: "Spain", price: "$287", vibe: "Culture"),
        .init(code: "HND", city: "TOKYO", country: "Japan", price: "$412", vibe: "Nightlife"),
        .init(code: "DPS", city: "BALI", country: "Indonesia", price: "$389", vibe: "Beach"),
        .init(code: "CDG", city: "PARIS", country: "France", price: "$310", vibe: "Romance"),
        .init(code: "JTR", city: "SANTORINI", country: "Greece", price: "$345", vibe: "Island"),
    ]

    private var showcases: [OnboardingShowcase] {
        liveShowcases ?? Self.fallbackShowcases
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            // Living Board background
            LivingBoardBackground()

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.xl) {
                    welcomeHeader
                    dealPreview
                    airportSelection
                    // Spacer for sticky button area
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Spacing.md)
                .padding(.top, Spacing.xl)
                .padding(.bottom, 200)
            }
            .scrollDismissesKeyboard(.interactively)

            // Sticky bottom — sign in options + start button
            VStack(spacing: 10) {
                signInOptions
                    .padding(.horizontal, Spacing.md)

                getStartedButton
                    .padding(.horizontal, Spacing.md)
            }
            .padding(.bottom, Spacing.md)
            .background(
                Color.sgBg.opacity(0.92)
                    .background(.ultraThinMaterial)
                    .ignoresSafeArea(edges: .bottom)
            )
        }
        .background(Color.sgBg)
        .navigationTitle("")
        .navigationBarHidden(true)
        .onAppear { startCycling() }
        .onDisappear { stopCycling() }
        .task {
            do {
                let response: TopDealsResponse = try await APIClient.shared.fetch(
                    .topDeals(origin: settings.departureCode, limit: 5)
                )
                let validDeals = response.deals.filter { !$0.city.isEmpty && $0.city.lowercased() != "unknown" && $0.price > 0 }
                if !validDeals.isEmpty {
                    liveShowcases = validDeals.map { deal in
                        OnboardingShowcase(
                            code: deal.iata,
                            city: deal.city.uppercased(),
                            country: deal.country,
                            price: deal.price > 0 ? "$\(Int(deal.price))" : "Check price",
                            vibe: deal.dealTier.capitalized
                        )
                    }
                }
            } catch {
                await feedStore.fetchDeals(origin: settings.departureCode)
                let fallbackDeals = feedStore.deals
                    .filter { !$0.city.isEmpty && $0.city.lowercased() != "unknown" && $0.displayPrice ?? 0 > 0 }
                    .prefix(5)
                if !fallbackDeals.isEmpty {
                    liveShowcases = fallbackDeals.map { deal in
                        OnboardingShowcase(
                            code: deal.iataCode,
                            city: deal.city.uppercased(),
                            country: deal.country,
                            price: deal.priceFormatted,
                            vibe: deal.safeVibeTags.first ?? "Travel"
                        )
                    }
                }
            }
        }
        // Airport picker sheet — migrated to sgSheet
        .sgSheet(isPresented: $isPickingAirport, configuration: SGSheetConfiguration(detents: [.large])) {
            NavigationStack {
                AirportPicker(
                    selectedCode: Binding(
                        get: { settings.departureCode },
                        set: { code in
                            updateDeparture(code: code)
                            isPickingAirport = false
                        }
                    ),
                    dismissOnSelection: true
                )
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Done") { isPickingAirport = false }
                            .foregroundStyle(Color.sgYellow)
                    }
                }
            }
        }
        // Permission briefing sheet
        .sgSheet(isPresented: $showPermissionBriefing, configuration: SGSheetConfiguration(detents: [.medium])) {
            PermissionBriefingSheet()
        }
    }

    // MARK: - Welcome Header

    private var welcomeHeader: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // Brand mark in elevated card with shimmer
            SGCard(elevation: .hero, shimmer: !reduceMotion) {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    SplitFlapText(
                        text: "SOGOJET",
                        style: .headline,
                        maxLength: 7,
                        animate: animateFlap,
                        hapticOnSettle: true
                    )

                    Text(String(localized: "auth.tagline"))
                        .font(SGFont.accent(size: 15))
                        .foregroundStyle(Color.sgWhiteDim)
                        .lineSpacing(4)
                }
            }
            .padding(.top, Spacing.lg)
        }
    }

    // MARK: - Deal Preview

    private var dealPreview: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(liveShowcases != nil ? String(localized: "onboarding.live_deals") : String(localized: "onboarding.sample_deals"))
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgMuted)
                .tracking(1.4)

            SGCard(elevation: .lifted) {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    SplitFlapText(
                        text: currentShowcase.city,
                        style: .ticker,
                        maxLength: 12,
                        animate: animateFlap
                    )

                    HStack(spacing: Spacing.sm) {
                        SplitFlapText(
                            text: currentShowcase.price,
                            style: .price,
                            maxLength: 6,
                            animate: animateFlap,
                            startDelay: 0.12
                        )

                        Text(String(format: String(localized: "onboarding.from_airport"), settings.departureCode))
                            .font(SGFont.body(size: 13))
                            .foregroundStyle(Color.sgMuted)
                    }

                    HStack(spacing: Spacing.sm) {
                        dealChip(currentShowcase.code, color: Color.sgYellow)
                        dealChip(currentShowcase.country, color: Color.sgWhiteDim)
                        dealChip(currentShowcase.vibe, color: Color.sgGreen)
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Deal board showing \(currentShowcase.city) for \(currentShowcase.price) from \(settings.departureCode)")
    }

    private func dealChip(_ text: String, color: Color) -> some View {
        Text(text)
            .font(SGFont.bodyBold(size: 11))
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color.sgBg)
            .clipShape(Capsule())
            .overlay(Capsule().strokeBorder(Color.sgBorder, lineWidth: 1))
    }

    // MARK: - Airport Selection (compact tap-to-open row)

    private var airportSelection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(String(localized: "onboarding.where_fly_from"))
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgMuted)
                .tracking(1.4)

            Button {
                HapticEngine.selection()
                isPickingAirport = true
            } label: {
                SGCard(elevation: .lifted) {
                    HStack(alignment: .center, spacing: Spacing.md) {
                        // IATA flap — headline size
                        SplitFlapText(
                            text: settings.departureCode.isEmpty ? "---" : settings.departureCode,
                            style: .headline,
                            maxLength: 3,
                            animate: true
                        )

                        VStack(alignment: .leading, spacing: 4) {
                            Text(settings.departureCity.isEmpty ? "Choose departure airport" : settings.departureCity)
                                .font(SGFont.bodyBold(size: 15))
                                .foregroundStyle(Color.sgWhite)
                                .lineLimit(1)

                            // "TAP TO CHANGE" affordance using tag-style flap
                            SplitFlapText(
                                text: settings.departureCode.isEmpty ? "TAP TO SELECT" : "TAP TO CHANGE",
                                style: .tag,
                                maxLength: 14,
                                animate: true
                            )
                        }

                        Spacer(minLength: 0)
                    }
                }
                .sgShadow(.lift)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Departure airport: \(settings.departureCity.isEmpty ? "not selected" : settings.departureCity)")
            .accessibilityHint("Opens airport picker")
        }
    }

    // MARK: - Sign In Options (SGButton variants)

    private var signInOptions: some View {
        VStack(spacing: 8) {
            if !auth.isAuthenticated {
                Text(String(localized: "onboarding.sign_in_subtitle"))
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)

                // Apple — secondary full-width
                SGButton(
                    action: { auth.signInWithApple() },
                    style: .secondary,
                    size: .regular,
                    isEnabled: !auth.isLoading
                ) {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "apple.logo")
                            .font(.system(size: 14, weight: .semibold))
                        Text("Continue with Apple")
                    }
                    .frame(maxWidth: .infinity)
                }
                .accessibilityLabel("Sign in with Apple")

                // Google — secondary full-width
                SGButton(
                    action: { auth.signInWithGoogle() },
                    style: .secondary,
                    size: .regular,
                    isEnabled: !auth.isLoading
                ) {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "g.circle.fill")
                            .font(.system(size: 14))
                        Text("Continue with Google")
                    }
                    .frame(maxWidth: .infinity)
                }
                .accessibilityLabel("Sign in with Google")

                // TikTok — ghost
                SGButton(
                    action: { auth.signInWithTikTok() },
                    style: .ghost,
                    size: .regular,
                    isEnabled: !auth.isLoading
                ) {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "play.rectangle.fill")
                            .font(.system(size: 13))
                        Text("Continue with TikTok")
                    }
                    .frame(maxWidth: .infinity)
                }
                .accessibilityLabel("Sign in with TikTok")

                if auth.isLoading {
                    ProgressView()
                        .tint(Color.sgYellow)
                        .scaleEffect(0.8)
                }

                if let error = auth.authError {
                    Text(error)
                        .font(SGFont.body(size: 11))
                        .foregroundStyle(Color.sgRed)
                }
            }
        }
    }

    // MARK: - CTA (SGButton primary prominent)

    private var getStartedButton: some View {
        VStack(spacing: 6) {
            if settings.departureCode.isEmpty {
                Text(String(localized: "onboarding.select_departure"))
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgOrange)
            }

            SGButton(
                action: {
                    // Show permission briefing before completing onboarding
                    showPermissionBriefing = true
                },
                style: .primary,
                size: .prominent,
                isEnabled: !settings.departureCode.isEmpty
            ) {
                HStack(spacing: 8) {
                    Image(systemName: "airplane.departure")
                    Text(String(localized: "onboarding.start_exploring"))
                }
                .frame(maxWidth: .infinity)
            }
            .accessibilityLabel("Finish onboarding and start exploring deals")
            // Complete onboarding once briefing is dismissed
            .onChange(of: showPermissionBriefing) { _, showing in
                if !showing && !settings.departureCode.isEmpty {
                    HapticEngine.success()
                    settings.hasOnboarded = true
                }
            }
        }
    }

    // MARK: - Cycling

    private var currentShowcase: OnboardingShowcase {
        showcases[currentDestinationIndex]
    }

    private func updateDeparture(code: String) {
        if let airport = AirportPicker.airports.first(where: { $0.code == code }) {
            settings.setDeparture(code: airport.code, city: airport.city)
        } else {
            settings.departureCode = code
        }
    }

    private func startCycling() {
        stopCycling()

        cyclingTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 280_000_000)
            guard !Task.isCancelled else { return }
            animateFlap = true

            guard !reduceMotion else { return }

            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 2_700_000_000)
                guard !Task.isCancelled else { break }
                animateFlap = false

                try? await Task.sleep(nanoseconds: 120_000_000)
                guard !Task.isCancelled else { break }
                currentDestinationIndex = (currentDestinationIndex + 1) % showcases.count
                animateFlap = true
            }
        }
    }

    private func stopCycling() {
        cyclingTask?.cancel()
        cyclingTask = nil
    }
}

private struct OnboardingShowcase {
    let code: String
    let city: String
    let country: String
    let price: String
    let vibe: String
}

// MARK: - Top Deals API Response

struct TopDealsResponse: Codable, Sendable {
    let deals: [TopDeal]
    let total: Int?
    let generatedAt: String?
}

struct TopDeal: Codable, Sendable {
    let id: String
    let city: String
    let country: String
    let iata: String
    let origin: String
    let price: Double
    let dealScore: Double
    let dealTier: String
    let savingsPercent: Double?
    let usualPrice: Double?
    let isNonstop: Bool?
    let airline: String?
    let departureDate: String?
    let returnDate: String?
    let tripDays: Int?
}

// MARK: - Preview

#Preview("Onboarding") {
    OnboardingView()
        .environment(SettingsStore())
        .environment(AuthStore())
        .environment(FeedStore())
}
