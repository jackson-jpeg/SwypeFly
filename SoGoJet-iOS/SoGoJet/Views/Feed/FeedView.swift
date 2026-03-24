import SwiftUI

// MARK: - Feed View
// Full-screen vertical paging feed of flight deal cards.
// Uses iOS 17+ scrollTargetBehavior(.paging) for TikTok-style snapping.

struct FeedView: View {
    @Environment(FeedStore.self) private var feedStore
    @Environment(SavedStore.self) private var savedStore
    @Environment(SettingsStore.self) private var settingsStore

    @State private var currentIndex: Int? = 0
    @State private var swipeCount: Int = 0
    @State private var headerVisible: Bool = true
    @State private var showShareSheet: Bool = false
    @State private var shareURL: URL?

    var body: some View {
        ZStack(alignment: .top) {
            if feedStore.isLoading && feedStore.deals.isEmpty {
                loadingState
            } else if feedStore.isEmpty {
                emptyState
            } else {
                feedContent
            }

            // Header overlay (fades after 2+ swipes)
            if headerVisible {
                headerOverlay
                    .transition(.opacity)
                    .accessibilityHidden(false)
            }
        }
        .background(Color.sgBg)
        .ignoresSafeArea()
        .task {
            if feedStore.deals.isEmpty {
                await feedStore.fetchDeals(origin: settingsStore.departureCode)
            }
        }
        .onChange(of: currentIndex) { oldValue, newValue in
            guard let newIdx = newValue, oldValue != newValue else { return }
            let oldIdx = oldValue ?? 0
            swipeCount += 1
            HapticEngine.light()

            // Fade header after 2+ swipes
            if swipeCount >= 2 && headerVisible {
                withAnimation(.easeOut(duration: 0.4)) {
                    headerVisible = false
                }
            }

            // Record swipe for personalization
            if oldIdx < feedStore.deals.count {
                let skippedDeal = feedStore.deals[oldIdx]
                if !savedStore.isSaved(id: skippedDeal.id) {
                    feedStore.recordSwipe(dealId: skippedDeal.id, action: "skipped")
                }
            }

            // Prefetch more deals when nearing the end
            if newIdx >= feedStore.deals.count - 2 {
                Task { await feedStore.fetchMore() }
            }
        }
        .sheet(isPresented: $showShareSheet) {
            if let url = shareURL {
                ShareSheet(activityItems: [url])
            }
        }
    }

    // MARK: - Feed Content

    private var feedContent: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(spacing: 0) {
                ForEach(Array(feedStore.deals.enumerated()), id: \.element.id) { index, deal in
                    DealCard(
                        deal: deal,
                        isSaved: savedStore.isSaved(id: deal.id),
                        isFirst: index == 0,
                        animate: abs((currentIndex ?? 0) - index) <= 1,
                        onSave: { saveDeal(deal) },
                        onShare: { shareDeal(deal) },
                        onBook: { bookDeal(deal) },
                        onTap: { restoreHeader() }
                    )
                    .containerRelativeFrame([.horizontal, .vertical])
                    .id(index)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $currentIndex)
        .accessibilityHint("Swipe up or down to browse flight deals")
    }

    // MARK: - Header Overlay

    private var headerOverlay: some View {
        VStack(spacing: Spacing.xs) {
            HStack {
                // Logo
                HStack(spacing: Spacing.xs) {
                    Text("\u{2708}")
                        .font(.system(size: 18))
                    Text("SOGOJET")
                        .font(SGFont.display(size: 22))
                        .foregroundStyle(Color.sgYellow)
                        .tracking(2)
                }

                Spacer()

                // Airport badge
                Text(settingsStore.departureCode)
                    .font(SGFont.bodyBold(size: 13))
                    .foregroundStyle(Color.sgYellow)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.xs)
                    .background(
                        Capsule()
                            .strokeBorder(Color.sgYellow.opacity(0.3), lineWidth: 1)
                    )
            }

            // Deal counter subtitle
            if !feedStore.deals.isEmpty {
                let avgSavings = averageSavingsPercent
                Text("\(feedStore.deals.count) deals\(avgSavings > 0 ? " \u{00B7} avg \(avgSavings)% off" : "")")
                    .font(SGFont.body(size: 12))
                    .foregroundStyle(Color.sgMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.top, 54) // below status bar
        .padding(.bottom, Spacing.sm)
        .background(
            LinearGradient(
                colors: [Color.sgBg.opacity(0.9), Color.sgBg.opacity(0.5), Color.clear],
                startPoint: .top,
                endPoint: .bottom
            )
            .accessibilityHidden(true)
        )
    }

    // MARK: - Loading State

    private var loadingState: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()
            ProgressView()
                .tint(Color.sgYellow)
                .scaleEffect(1.2)
            Text("Finding deals...")
                .font(SGFont.bodyBold(size: 15))
                .foregroundStyle(Color.sgMuted)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()

            SplitFlapRow(
                text: "NO FLIGHTS",
                maxLength: 12,
                size: .lg,
                color: Color.sgMuted,
                alignment: .center,
                animate: true
            )

            if let error = feedStore.error {
                Text(error)
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgRed)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.xl)
            }

            Text("No deals found from \(settingsStore.departureCode)")
                .font(SGFont.body(size: 15))
                .foregroundStyle(Color.sgMuted)

            // Nearby airport suggestions
            VStack(spacing: Spacing.sm) {
                Text("Try a nearby airport:")
                    .font(SGFont.body(size: 13))
                    .foregroundStyle(Color.sgFaint)

                HStack(spacing: Spacing.sm) {
                    ForEach(nearbyAirports, id: \.self) { code in
                        Button {
                            Task {
                                settingsStore.departureCode = code
                                await feedStore.fetchDeals(origin: code)
                            }
                        } label: {
                            Text(code)
                                .font(SGFont.bodyBold(size: 14))
                                .foregroundStyle(Color.sgYellow)
                                .padding(.horizontal, Spacing.md)
                                .padding(.vertical, Spacing.sm)
                                .background(
                                    Capsule()
                                        .strokeBorder(Color.sgYellow.opacity(0.4), lineWidth: 1)
                                )
                        }
                        .accessibilityLabel("Try \(code) airport")
                    }
                }
            }

            Button {
                Task { await feedStore.fetchDeals(origin: settingsStore.departureCode) }
            } label: {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "arrow.clockwise")
                    Text("Retry")
                }
                .font(SGFont.bodyBold(size: 15))
                .foregroundStyle(Color.sgBg)
                .padding(.horizontal, Spacing.lg)
                .padding(.vertical, Spacing.sm + Spacing.xs)
                .background(Color.sgYellow)
                .clipShape(Capsule())
            }
            .accessibilityLabel("Retry loading deals")

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Actions

    private func saveDeal(_ deal: Deal) {
        HapticEngine.medium()
        let nowSaved = savedStore.toggle(deal: deal)
        feedStore.recordSwipe(dealId: deal.id, action: nowSaved ? "saved" : "unsaved")
    }

    private func shareDeal(_ deal: Deal) {
        HapticEngine.light()
        shareURL = URL(string: "https://sogojet.com/destination/\(deal.id)")
        showShareSheet = true
    }

    private func bookDeal(_ deal: Deal) {
        HapticEngine.medium()
        feedStore.recordSwipe(dealId: deal.id, action: "viewed")
        // TODO: Navigate to booking flow
    }

    private func restoreHeader() {
        if !headerVisible {
            withAnimation(.easeIn(duration: 0.3)) {
                headerVisible = true
            }
            // Auto-hide again after 3 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                if swipeCount >= 2 {
                    withAnimation(.easeOut(duration: 0.4)) {
                        headerVisible = false
                    }
                }
            }
        }
    }

    // MARK: - Helpers

    private var averageSavingsPercent: Int {
        let percents = feedStore.deals.compactMap(\.savingsPercent)
        guard !percents.isEmpty else { return 0 }
        return Int(percents.reduce(0, +) / Double(percents.count))
    }

    /// Nearby airport codes based on current departure.
    private var nearbyAirports: [String] {
        let nearby: [String: [String]] = [
            "JFK": ["EWR", "LGA", "PHL"],
            "EWR": ["JFK", "LGA", "PHL"],
            "LGA": ["JFK", "EWR", "PHL"],
            "LAX": ["SNA", "BUR", "LGB"],
            "SFO": ["OAK", "SJC"],
            "ORD": ["MDW"],
            "MDW": ["ORD"],
            "MIA": ["FLL", "PBI"],
            "FLL": ["MIA", "PBI"],
            "ATL": ["CLT"],
            "DFW": ["DAL", "IAH"],
            "SEA": ["PDX"],
            "BOS": ["PVD", "BDL"],
        ]
        return nearby[settingsStore.departureCode] ?? ["JFK", "LAX", "ORD"]
    }
}

// MARK: - Share Sheet (UIKit bridge)

private struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Preview

#Preview("Feed View") {
    FeedView()
        .environment(FeedStore())
        .environment(SavedStore())
        .environment(SettingsStore())
}
