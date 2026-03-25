import SwiftUI

// MARK: - Onboarding View

struct OnboardingView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var currentDestinationIndex = 0
    @State private var animateFlap = false
    @State private var cyclingTask: Task<Void, Never>?

    private let showcases: [OnboardingShowcase] = [
        .init(code: "BCN", city: "BARCELONA", country: "Spain", price: "$287", vibe: "Culture"),
        .init(code: "HND", city: "TOKYO", country: "Japan", price: "$412", vibe: "Nightlife"),
        .init(code: "DPS", city: "BALI", country: "Indonesia", price: "$389", vibe: "Beach"),
        .init(code: "CDG", city: "PARIS", country: "France", price: "$310", vibe: "Romance"),
        .init(code: "JTR", city: "SANTORINI", country: "Greece", price: "$345", vibe: "Island"),
    ]

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
                .padding(.bottom, 80) // space for sticky button
            }
            .scrollDismissesKeyboard(.interactively)

            // Sticky "Start Exploring" button — always visible
            getStartedButton
                .padding(.horizontal, Spacing.md)
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

            Text("Find cheap flights.\nSwipe, save, book.")
                .font(SGFont.body(size: 17))
                .foregroundStyle(Color.sgWhiteDim)
                .lineSpacing(4)
        }
        .padding(.top, Spacing.lg)
    }

    // MARK: - Deal Preview

    private var dealPreview: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("LIVE DEALS")
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

                    Text("from \(settings.departureCode)")
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
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("WHERE DO YOU FLY FROM?")
                .font(SGFont.bodyBold(size: 11))
                .foregroundStyle(Color.sgMuted)
                .tracking(1.4)

            HStack(spacing: Spacing.sm) {
                SplitFlapRow(
                    text: settings.departureCode,
                    maxLength: 3,
                    size: .md,
                    color: Color.sgWhite,
                    alignment: .leading,
                    animate: true,
                    staggerMs: 28
                )

                Text(settings.departureCity)
                    .font(SGFont.sectionHead)
                    .foregroundStyle(Color.sgWhite)
            }

            AirportPicker(
                selectedCode: Binding(
                    get: { settings.departureCode },
                    set: updateDeparture(code:)
                ),
                dismissOnSelection: false
            )
            .frame(height: 340)
            .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.lg)
                    .strokeBorder(Color.sgBorder, lineWidth: 1)
            )
        }
    }

    // MARK: - CTA

    private var getStartedButton: some View {
        Button {
            HapticEngine.success()
            settings.hasOnboarded = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "airplane.departure")
                Text("Start Exploring")
                    .font(SGFont.bodyBold(size: 17))
            }
            .foregroundStyle(Color.sgBg)
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background(Color.sgYellow)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Finish onboarding and start exploring deals")
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

// MARK: - Preview

#Preview("Onboarding") {
    OnboardingView()
        .environment(SettingsStore())
}
