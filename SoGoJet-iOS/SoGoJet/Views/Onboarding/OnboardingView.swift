import SwiftUI

// MARK: - Onboarding View
// First-run boarding hall that introduces the product as a vintage travel object.

struct OnboardingView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var currentDestinationIndex = 0
    @State private var animateFlap = false
    @State private var cyclingTask: Task<Void, Never>?

    private let showcases: [OnboardingShowcase] = [
        .init(code: "BCN", city: "BARCELONA", country: "Spain", price: "$287", note: "Late-spring departures with warm nights and architecture-heavy days.", vibe: "Culture"),
        .init(code: "HND", city: "TOKYO", country: "Japan", price: "$412", note: "City lights, ramen counters, and clean rail connections from the airport.", vibe: "Nightlife"),
        .init(code: "DPS", city: "BALI", country: "Indonesia", price: "$389", note: "Resort energy, beach resets, and better shoulder-season value.", vibe: "Beach"),
        .init(code: "CDG", city: "PARIS", country: "France", price: "$310", note: "Museum mornings, wine bars, and a classic long-weekend reward trip.", vibe: "Romance"),
        .init(code: "JTR", city: "SANTORINI", country: "Greece", price: "$345", note: "Blue-water views and sunset ferry energy at a surprisingly humane fare.", vibe: "Island"),
    ]

    var body: some View {
        VintageTerminalScreen(headerSpacing: Spacing.md) {
            headerSection
        } content: {
            VStack(alignment: .leading, spacing: Spacing.md) {
                departureHallHero
                boardingSummary
                promiseDeck
                airportSelectionDeck
                firstTripNotes
                ctaCluster
            }
        }
        .navigationTitle("")
        .navigationBarHidden(true)
        .onAppear {
            startCycling()
        }
        .onDisappear {
            stopCycling()
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            VintageTerminalHeroLockup(
                eyebrow: "First Call",
                title: "Welcome to SoGoJet",
                subtitle: "A feed for people who still romanticize departure boards, paper tickets, and the moment a fare finally looks right.",
                accent: .amber
            )

            Spacer(minLength: 0)

            VintageTerminalPassportStamp(
                title: "Origin",
                subtitle: settings.departureCode,
                tone: .ember
            )
        }
        .padding(.top, Spacing.sm)
    }

    // MARK: - Hero

    private var departureHallHero: some View {
        VintageTerminalPanel(
            title: "Live Deal Board",
            subtitle: "The split-flap is the signature gesture in the app, so onboarding starts by showing it like a departure hall centerpiece.",
            stamp: currentShowcase.vibe,
            tone: .amber
        ) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                ZStack(alignment: .topTrailing) {
                    VintageTerminalInsetPanel(tone: .amber) {
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            SplitFlapRow(
                                text: currentShowcase.city,
                                maxLength: 12,
                                size: .lg,
                                color: Color.sgWhite,
                                alignment: .leading,
                                animate: animateFlap,
                                staggerMs: 34
                            )

                            SplitFlapRow(
                                text: currentShowcase.price,
                                maxLength: 6,
                                size: .md,
                                color: Color.sgYellow,
                                alignment: .leading,
                                animate: animateFlap,
                                startDelay: 0.12,
                                staggerMs: 50
                            )

                            Text(currentShowcase.note)
                                .font(SGFont.body(size: 12))
                                .foregroundStyle(Color.sgWhiteDim)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    VintageTerminalOrbitDecoration()
                        .frame(width: 160, height: 160)
                        .opacity(0.55)
                        .offset(x: 18, y: -18)
                        .allowsHitTesting(false)
                }

                HStack(spacing: Spacing.sm) {
                    VintageTerminalStatusChip(
                        title: currentShowcase.code,
                        subtitle: currentShowcase.country,
                        tone: .ivory
                    )
                    VintageTerminalStatusChip(
                        title: settings.departureCode,
                        subtitle: settings.departureCity,
                        tone: .amber
                    )
                    VintageTerminalStatusChip(
                        title: currentShowcase.vibe,
                        subtitle: "Mood tag",
                        tone: .moss
                    )
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Deal board showing \(currentShowcase.city) for \(currentShowcase.price) from \(settings.departureCode)")
    }

    // MARK: - Boarding Summary

    private var boardingSummary: some View {
        VintageTerminalBoardingSummary(
            originCode: settings.departureCode,
            destinationCode: currentShowcase.code,
            fare: currentShowcase.price,
            detail: "From \(settings.departureCity) to \(currentShowcase.city.capitalized), with search, save, and booking all living in the same travel-language UI.",
            tone: .amber
        )
    }

    // MARK: - Promise Deck

    private var promiseDeck: some View {
        VintageTerminalPanel(
            title: "What you get",
            subtitle: "The first-run pitch, expressed like an airline lounge operations board instead of a generic checklist.",
            stamp: "Benefits",
            tone: .ivory
        ) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                VintageTerminalMetricDeck(metrics: [
                    VintageTerminalMetric(
                        title: "Search",
                        value: "Live",
                        footnote: "Booking searches reprice against the current market instead of relying on static feed math.",
                        tone: .amber
                    ),
                    VintageTerminalMetric(
                        title: "Save",
                        value: "Archive",
                        footnote: "Saved routes become boarding stubs you can revisit without losing the vibe of the app.",
                        tone: .ember
                    ),
                    VintageTerminalMetric(
                        title: "Board",
                        value: "Vintage",
                        footnote: "Terminal mode leans into the tactile split-flap aesthetic you asked for.",
                        tone: .ivory
                    ),
                    VintageTerminalMetric(
                        title: "Book",
                        value: "Fast",
                        footnote: "Detail, search, booking, and seat selection are now wired as a single flow.",
                        tone: .moss
                    ),
                ])

                VintageTerminalDividerLabel(text: "Why it feels different", tone: .amber)

                VStack(alignment: .leading, spacing: Spacing.sm) {
                    VintageTerminalChecklistItem(
                        title: "The split-flap is the signature motion",
                        detail: "We use it when a route changes, not on every idle card, so it still feels special and mechanical.",
                        tone: .amber
                    )
                    VintageTerminalChecklistItem(
                        title: "The palette stays warm and terminal-like",
                        detail: "This app should feel like old travel hardware lit by amber gate displays, not anonymous dark mode.",
                        tone: .ivory
                    )
                    VintageTerminalChecklistItem(
                        title: "Search Flights stays the hero action",
                        detail: "The booking CTA keeps the most visual weight across feed, detail, saved routes, and booking itself.",
                        tone: .moss
                    )
                }
            }
        }
    }

    // MARK: - Airport Selection

    private var airportSelectionDeck: some View {
        VintageTerminalPanel(
            title: "Set your departure gate",
            subtitle: "Choose the airport that should anchor your first feed and every nearby-market suggestion that follows.",
            stamp: "Departure",
            tone: .amber
        ) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                selectedOriginSummary

                AirportPicker(
                    selectedCode: Binding(
                        get: { settings.departureCode },
                        set: updateDeparture(code:)
                    ),
                    dismissOnSelection: false
                )
                .frame(height: 430)
                .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.lg)
                        .strokeBorder(Color.sgBorder, lineWidth: 1)
                )
            }
        }
    }

    private var selectedOriginSummary: some View {
        VintageTerminalInsetPanel(tone: .amber) {
            HStack(alignment: .top, spacing: Spacing.md) {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("Selected departure")
                        .font(SGFont.bodyBold(size: 10))
                        .foregroundStyle(Color.sgMuted)
                        .tracking(1.4)

                    SplitFlapRow(
                        text: settings.departureCode,
                        maxLength: 3,
                        size: .md,
                        color: Color.sgYellow,
                        alignment: .leading,
                        animate: true,
                        staggerMs: 28
                    )

                    Text(settings.departureCity)
                        .font(SGFont.sectionHead)
                        .foregroundStyle(Color.sgWhite)
                }

                Spacer(minLength: 0)

                VintageTerminalStatusChip(
                    title: currentShowcase.code,
                    subtitle: "Current rotating sample",
                    tone: .ivory
                )
            }
        }
    }

    // MARK: - Notes

    private var firstTripNotes: some View {
        VintageTerminalPanel(
            title: "First trip notes",
            subtitle: "A few expectations before you leave onboarding and start tapping around the app.",
            stamp: "Guide",
            tone: .neutral
        ) {
            VStack(alignment: .leading, spacing: Spacing.md) {
                VintageTerminalInfoRow(
                    icon: "airplane.circle.fill",
                    title: "Explore tab",
                    value: "You can browse in swipe mode or terminal-board mode immediately after onboarding.",
                    detail: "That preference is adjustable in Settings at any time.",
                    tone: .amber
                )

                VintageTerminalInfoRow(
                    icon: "heart.circle.fill",
                    title: "Saved routes",
                    value: "Anything you heart becomes an archive card you can reopen and book from later.",
                    detail: "The saved tab now leans fully into the paper-ticket archive idea.",
                    tone: .ember
                )

                VintageTerminalInfoRow(
                    icon: "creditcard.circle.fill",
                    title: "Booking flow",
                    value: "Trip, passenger, seat, review, and boarding pass are now a single orchestrated journey.",
                    detail: "If live fares drift, the booking UI tells you instead of silently failing.",
                    tone: .moss
                )
            }
        }
    }

    // MARK: - CTA

    private var ctaCluster: some View {
        VintageTerminalActionCluster {
            VintageTerminalActionButton(
                title: "Begin Boarding",
                subtitle: "Finish onboarding and open SoGoJet",
                icon: "airplane.departure",
                tone: .amber,
                fillsWidth: true
            ) {
                HapticEngine.success()
                settings.hasOnboarded = true
            }
        } secondary: {
            VintageTerminalSecondaryButton(
                title: "Current departure gate",
                subtitle: "\(settings.departureCity) (\(settings.departureCode))",
                icon: "mappin.and.ellipse",
                tone: .neutral,
                fillsWidth: true
            ) {}
            .disabled(true)
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
    let note: String
    let vibe: String
}

// MARK: - Preview

#Preview("Onboarding") {
    OnboardingView()
        .environment(SettingsStore())
}
