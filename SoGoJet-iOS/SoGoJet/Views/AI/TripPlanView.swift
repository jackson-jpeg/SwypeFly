import SwiftUI

// MARK: - Trip Plan View
// AI-powered itinerary generator using Claude via the /api/ai/trip-plan endpoint.

struct TripPlanView: View {
    let city: String
    let country: String?
    let destinationId: String?

    @Environment(TripPlanStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var duration: Int = 5
    @State private var style: TripPlanRequest.TripStyle = .comfort
    @State private var interests: String = ""
    @State private var hasGenerated = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.sgBg.ignoresSafeArea()

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: Spacing.lg) {
                        headerSection
                        if !hasGenerated {
                            configSection
                        }
                        if store.isLoading || !store.planText.isEmpty {
                            resultSection
                        }
                        if let error = store.error {
                            errorSection(error)
                        }
                    }
                    .padding(.horizontal, Spacing.lg)
                    .padding(.bottom, 40)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        store.cancel()
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .foregroundStyle(Color.sgWhite)
                    }
                    .accessibilityLabel("Close trip planner")
                }
                ToolbarItem(placement: .principal) {
                    Text("Trip Planner")
                        .font(SGFont.bodyBold(size: 16))
                        .foregroundStyle(Color.sgWhite)
                }
                if hasGenerated {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            store.reset()
                            hasGenerated = false
                        } label: {
                            Image(systemName: "arrow.counterclockwise")
                                .foregroundStyle(Color.sgYellow)
                        }
                        .accessibilityLabel("Start over")
                    }
                }
            }
        }
        .onDisappear {
            store.cancel()
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: Spacing.sm) {
            Image(systemName: "sparkles")
                .font(.system(size: 28))
                .foregroundStyle(Color.sgYellow)
                .padding(.top, Spacing.lg)

            Text("Plan your trip to \(city)")
                .font(SGFont.display(size: 22))
                .foregroundStyle(Color.sgWhite)
                .multilineTextAlignment(.center)

            if !hasGenerated {
                Text("AI-powered itinerary with restaurants, tips, and activities")
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgMuted)
                    .multilineTextAlignment(.center)
            }
        }
    }

    // MARK: - Config

    private var configSection: some View {
        VStack(spacing: Spacing.lg) {
            // Duration
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("DURATION")
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.2)

                HStack(spacing: Spacing.sm) {
                    ForEach([3, 5, 7, 10, 14], id: \.self) { days in
                        Button {
                            HapticEngine.light()
                            duration = days
                        } label: {
                            Text("\(days)d")
                                .font(SGFont.bodyBold(size: 14))
                                .foregroundStyle(duration == days ? Color.sgBg : Color.sgWhite)
                                .frame(maxWidth: .infinity)
                                .frame(height: 40)
                                .background(duration == days ? Color.sgYellow : Color.sgSurface)
                                .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(days) days")
                        .accessibilityAddTraits(duration == days ? .isSelected : [])
                    }
                }
            }

            // Style
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("TRAVEL STYLE")
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.2)

                HStack(spacing: Spacing.sm) {
                    ForEach(TripPlanRequest.TripStyle.allCases, id: \.self) { option in
                        Button {
                            HapticEngine.light()
                            style = option
                        } label: {
                            VStack(spacing: 4) {
                                Image(systemName: option.icon)
                                    .font(.system(size: 18))
                                Text(option.label)
                                    .font(SGFont.bodyBold(size: 12))
                            }
                            .foregroundStyle(style == option ? Color.sgBg : Color.sgWhite)
                            .frame(maxWidth: .infinity)
                            .frame(height: 60)
                            .background(style == option ? Color.sgYellow : Color.sgSurface)
                            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(option.label) style")
                        .accessibilityAddTraits(style == option ? .isSelected : [])
                    }
                }
            }

            // Interests
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("INTERESTS (OPTIONAL)")
                    .font(SGFont.caption)
                    .foregroundStyle(Color.sgMuted)
                    .tracking(1.2)

                TextField("e.g. food tours, art museums, hiking", text: $interests)
                    .font(SGFont.body(size: 14))
                    .foregroundStyle(Color.sgWhite)
                    .padding(Spacing.md)
                    .background(Color.sgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md)
                            .stroke(Color.sgBorder.opacity(0.4), lineWidth: 1)
                    )
            }

            // Generate button
            Button {
                HapticEngine.medium()
                hasGenerated = true
                let request = TripPlanRequest(
                    city: city,
                    country: country,
                    duration: duration,
                    style: style,
                    interests: interests.isEmpty ? nil : interests,
                    destinationId: destinationId
                )
                store.generate(request: request)
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles")
                    Text("Generate Itinerary")
                        .font(SGFont.bodyBold(size: 16))
                }
                .foregroundStyle(Color.sgBg)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(Color.sgYellow)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .disabled(store.isLoading)
            .accessibilityLabel("Generate itinerary")
        }
        .padding(Spacing.lg)
        .background(Color.sgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .stroke(Color.sgBorder.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Result

    private var resultSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack {
                Text("\(duration)-Day \(style.label) Itinerary")
                    .font(SGFont.sectionHead)
                    .foregroundStyle(Color.sgWhite)

                Spacer()

                if store.isLoading {
                    ProgressView()
                        .tint(Color.sgYellow)
                }
            }

            Text(store.planText)
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgWhiteDim)
                .textSelection(.enabled)
                .animation(.easeIn(duration: 0.1), value: store.planText.count)

            if !store.isLoading && !store.planText.isEmpty {
                shareButton
            }
        }
        .padding(Spacing.lg)
        .background(Color.sgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg)
                .stroke(Color.sgBorder.opacity(0.3), lineWidth: 1)
        )
    }

    private var shareButton: some View {
        ShareLink(
            item: "Trip Plan for \(city)\n\n\(store.planText)",
            subject: Text("\(city) Trip Plan"),
            message: Text("Check out this \(duration)-day itinerary for \(city)!")
        ) {
            HStack(spacing: 6) {
                Image(systemName: "square.and.arrow.up")
                Text("Share Plan")
                    .font(SGFont.bodyBold(size: 14))
            }
            .foregroundStyle(Color.sgYellow)
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(Color.sgYellow.opacity(0.12))
            .clipShape(Capsule())
        }
        .accessibilityLabel("Share trip plan")
    }

    // MARK: - Error

    private func errorSection(_ message: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 24))
                .foregroundStyle(Color.sgOrange)

            Text(message)
                .font(SGFont.body(size: 14))
                .foregroundStyle(Color.sgWhiteDim)
                .multilineTextAlignment(.center)

            Button {
                hasGenerated = false
                store.reset()
            } label: {
                Text("Try Again")
                    .font(SGFont.bodyBold(size: 14))
                    .foregroundStyle(Color.sgYellow)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.sgYellow.opacity(0.12))
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Try again")
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity)
        .background(Color.sgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
    }
}
