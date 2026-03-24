import SwiftUI

// MARK: - Onboarding View
// First-run experience with split-flap teaser, value props, and airport picker.

struct OnboardingView: View {
    @Environment(SettingsStore.self) private var settings
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var currentDestinationIndex: Int = 0
    @State private var animateFlap: Bool = false
    @State private var timer: Timer?

    private let destinations: [(city: String, price: String)] = [
        ("BARCELONA", "$287"),
        ("TOKYO", "$412"),
        ("BALI", "$389"),
        ("PARIS", "$310"),
        ("SANTORINI", "$345"),
    ]

    private var currentCity: String {
        destinations[currentDestinationIndex].city
    }

    private var currentPrice: String {
        destinations[currentDestinationIndex].price
    }

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: Spacing.lg) {
                    // MARK: Logo Area
                    logoSection
                        .padding(.top, Spacing.xl + Spacing.lg)

                    // MARK: Split-Flap Teaser
                    splitFlapTeaser

                    // MARK: Value Props
                    valueProps

                    // MARK: Airport Picker
                    airportSection

                    // MARK: CTA
                    letsGoButton
                        .padding(.bottom, Spacing.xl)
                }
                .padding(.horizontal, Spacing.md)
            }
        }
        .onAppear {
            startCycling()
        }
        .onDisappear {
            timer?.invalidate()
            timer = nil
        }
    }

    // MARK: - Logo Section

    private var logoSection: some View {
        VStack(spacing: Spacing.sm) {
            Text("\u{2708}\u{FE0F}")
                .font(.system(size: 72))
                .accessibilityHidden(true)

            Text("SOGOJET")
                .font(SGFont.display(size: 48))
                .foregroundStyle(Color.sgYellow)
                .tracking(4)
                .accessibilityAddTraits(.isHeader)

            Text("Swipe. Save. Fly.")
                .font(SGFont.accent(size: 18))
                .foregroundStyle(Color.sgWhiteDim)
        }
    }

    // MARK: - Split-Flap Teaser

    private var splitFlapTeaser: some View {
        VStack(spacing: Spacing.sm) {
            SplitFlapRow(
                text: currentCity,
                maxLength: 12,
                size: .lg,
                color: Color.sgWhite,
                alignment: .center,
                animate: animateFlap,
                staggerMs: 35
            )

            SplitFlapRow(
                text: currentPrice,
                maxLength: 6,
                size: .md,
                color: Color.sgGreen,
                alignment: .center,
                animate: animateFlap,
                startDelay: 0.2,
                staggerMs: 50
            )
        }
        .padding(.vertical, Spacing.md)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Flight deals cycling through destinations. Currently \(currentCity) for \(currentPrice)")
    }

    // MARK: - Value Props

    private var valueProps: some View {
        VStack(spacing: Spacing.md) {
            valuePropRow(icon: "tag.fill", text: "Cheapest Prices")
            valuePropRow(icon: "airplane.departure", text: "Book in Seconds")
            valuePropRow(icon: "heart.fill", text: "Save Favorites")
        }
        .padding(.vertical, Spacing.sm)
    }

    private func valuePropRow(icon: String, text: String) -> some View {
        HStack(spacing: Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(Color.sgYellow)
                .frame(width: 36, height: 36)
                .background(Color.sgYellow.opacity(0.12))
                .clipShape(Circle())
                .accessibilityHidden(true)

            Text(text)
                .font(SGFont.bodyBold(size: 17))
                .foregroundStyle(Color.sgWhite)

            Spacer()
        }
        .padding(.horizontal, Spacing.md)
    }

    // MARK: - Airport Section

    private var airportSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Where are you flying from?")
                .font(SGFont.sectionHead)
                .foregroundStyle(Color.sgWhite)
                .padding(.horizontal, Spacing.xs)

            AirportPicker(selectedCode: Binding(
                get: { settings.departureCode },
                set: { newCode in
                    if let airport = AirportPicker.airports.first(where: { $0.code == newCode }) {
                        settings.setDeparture(code: newCode, city: airport.city)
                    } else {
                        settings.departureCode = newCode
                    }
                }
            ))
            .frame(height: 280)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        }
    }

    // MARK: - Let's Go Button

    private var letsGoButton: some View {
        Button {
            HapticEngine.success()
            settings.hasOnboarded = true
        } label: {
            HStack(spacing: Spacing.sm) {
                Image(systemName: "airplane.departure")
                    .font(.system(size: 16, weight: .semibold))
                Text("Let's Go")
                    .font(SGFont.bodyBold(size: 18))
            }
            .foregroundStyle(Color.sgBg)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.md)
            .background(Color.sgYellow, in: RoundedRectangle(cornerRadius: Radius.md))
        }
        .accessibilityLabel("Let's Go")
        .accessibilityHint("Complete onboarding and start exploring deals")
        .padding(.horizontal, Spacing.md)
    }

    // MARK: - Timer

    private func startCycling() {
        // Initial animation
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            animateFlap = true
        }

        guard !reduceMotion else { return }

        timer = Timer.scheduledTimer(withTimeInterval: 2.5, repeats: true) { _ in
            animateFlap = false
            let nextIndex = (currentDestinationIndex + 1) % destinations.count
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                currentDestinationIndex = nextIndex
                animateFlap = true
            }
        }
    }
}

// MARK: - Preview

#Preview("Onboarding") {
    OnboardingView()
        .environment(SettingsStore())
}
