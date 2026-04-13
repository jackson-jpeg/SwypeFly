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
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: Spacing.xl) {
                    welcomeHeader
                    dealPreview
                    airportSelection
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Spacing.md)
                .padding(.top, Spacing.xl)
                .padding(.bottom, 160) // space for sticky buttons
            }
            .scrollDismissesKeyboard(.interactively)

            // Sticky bottom — sign in options + start button
            VStack(spacing: 10) {
                // Optional sign-in buttons (compact row)
                signInOptions
                    .padding(.horizontal, Spacing.md)

                getStartedButton
                    .padding(.horizontal, Spacing.md)
            }
            .padding(.bottom, Spacing.md)
            .background(
                Color.sgBg.opacity(0.95)
                    .background(.ultraThinMaterial)
                    .ignoresSafeArea(edges: .bottom)
            )
        }
        .background(Color.sgBg)
        .navigationTitle("")
        .navigationBarHidden(true)
        .onAppear {
            startCycling()
        }
        .onDisappear {
            stopCycling()
        }
        .task {
            // Fetch curated top deals (sorted by deal_score) instead of
            // whatever the generic feed returns first.
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
                // Fall back to feed deals if top-deals fails
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
                // If still no valid deals, fallbackShowcases will be used automatically
            }
        }
    }

    // MARK: - Welcome Header

    private var welcomeHeader: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            SplitFlapRow(
                text: "SOGOJET",
                maxLength: 7,
                size: .lg,
                color: Color.sgWhite,
                alignment: .leading,
                animate: animateFlap,
                staggerMs: 50
            )

            Text(String(localized: "auth.tagline"))
                .font(SGFont.body(size: 17))
                .foregroundStyle(Color.sgWhiteDim)
                .lineSpacing(4)
        }
        .padding(.top, Spacing.lg)
    }

    // MARK: - Deal Preview

    private var dealPreview: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text(liveShowcases != nil ? String(localized: "onboarding.live_deals") : String(localized: "onboarding.sample_deals"))
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgMuted)
                .tracking(1.4)

            VStack(alignment: .leading, spacing: Spacing.md) {
                SplitFlapRow(
                    text: currentShowcase.city,
                    maxLength: 12,
                    size: .md,
                    color: Color.sgWhite,
                    alignment: .leading,
                    animate: animateFlap,
                    staggerMs: 34
                )

                HStack(spacing: Spacing.sm) {
                    SplitFlapRow(
                        text: currentShowcase.price,
                        maxLength: 6,
                        size: .md,
                        color: Color.sgWhite,
                        alignment: .leading,
                        animate: animateFlap,
                        startDelay: 0.12,
                        staggerMs: 50
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
            .padding(Spacing.md)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.lg)
                    .strokeBorder(Color.sgBorder, lineWidth: 1)
            )
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
            .overlay(
                Capsule().strokeBorder(Color.sgBorder, lineWidth: 1)
            )
    }

    // MARK: - Airport Selection

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
                HStack(alignment: .center, spacing: Spacing.md) {
                    SplitFlapRow(
                        text: settings.departureCode.isEmpty ? "---" : settings.departureCode,
                        maxLength: 3,
                        size: .lg,
                        color: Color.sgYellow,
                        alignment: .leading,
                        animate: true,
                        staggerMs: 28
                    )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(settings.departureCity.isEmpty ? "Choose departure airport" : settings.departureCity)
                            .font(SGFont.bodyBold(size: 15))
                            .foregroundStyle(Color.sgWhite)
                            .lineLimit(1)
                        Text(settings.departureCode.isEmpty ? "Tap to select" : "Tap to change")
                            .font(SGFont.body(size: 11))
                            .foregroundStyle(Color.sgMuted)
                    }

                    Spacer(minLength: 0)

                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.sgFaint)
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.md)
                .background(Color.sgSurfaceElevated)
                .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
                        .strokeBorder(Color.sgHairline, lineWidth: 0.5)
                )
                .sgShadow(.lift)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Departure airport: \(settings.departureCity.isEmpty ? "not selected" : settings.departureCity)")
            .accessibilityHint("Opens airport picker")
        }
        .sheet(isPresented: $isPickingAirport) {
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
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .presentationBackground(Color.sgBg)
        }
    }

    // MARK: - Sign In Options

    private var signInOptions: some View {
        VStack(spacing: 8) {
            if !auth.isAuthenticated {
                Text(String(localized: "onboarding.sign_in_subtitle"))
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)

                HStack(spacing: 8) {
                    // Apple
                    Button {
                        auth.signInWithApple()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "apple.logo")
                                .font(.system(size: 13))
                            Text("Apple")
                                .font(SGFont.bodyBold(size: 13))
                        }
                        .foregroundStyle(Color.sgBg)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(Color.sgWhite)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                    .disabled(auth.isLoading)
                    .accessibilityLabel("Sign in with Apple")

                    // Google
                    Button {
                        auth.signInWithGoogle()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "g.circle.fill")
                                .font(.system(size: 13))
                            Text("Google")
                                .font(SGFont.bodyBold(size: 13))
                        }
                        .foregroundStyle(Color.sgBg)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(Color.sgWhite)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                    .disabled(auth.isLoading)
                    .accessibilityLabel("Sign in with Google")

                    // TikTok
                    Button {
                        auth.signInWithTikTok()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "play.rectangle.fill")
                                .font(.system(size: 11))
                            Text("TikTok")
                                .font(SGFont.bodyBold(size: 13))
                        }
                        .foregroundStyle(Color.sgWhite)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(Color.sgSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .strokeBorder(Color.sgBorder, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(auth.isLoading)
                    .accessibilityLabel("Sign in with TikTok")
                }

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

    // MARK: - CTA

    private var getStartedButton: some View {
        VStack(spacing: 6) {
            if settings.departureCode.isEmpty {
                Text(String(localized: "onboarding.select_departure"))
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgOrange)
            }

            Button {
                HapticEngine.success()
                settings.hasOnboarded = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "airplane.departure")
                    Text(String(localized: "onboarding.start_exploring"))
                        .font(SGFont.bodyBold(size: 17))
                }
                .foregroundStyle(Color.sgBg)
                .frame(maxWidth: .infinity)
                .frame(height: 54)
                .background(settings.departureCode.isEmpty ? Color.sgYellow.opacity(0.4) : Color.sgYellow)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .disabled(settings.departureCode.isEmpty)
            .accessibilityLabel("Finish onboarding and start exploring deals")
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

/// Matches the JSON returned by GET /api/top-deals?origin=XXX&limit=N
/// Fields differ from the feed's Deal model (e.g. `iata` not `iataCode`,
/// `price` not `flightPrice`), so we decode into a lightweight struct.
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
