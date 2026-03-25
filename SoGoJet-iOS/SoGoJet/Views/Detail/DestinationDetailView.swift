import SwiftUI
import UIKit

struct DestinationDetailView: View {
    let deal: Deal
    let allDeals: [Deal]

    @Environment(SavedStore.self) private var savedStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(Router.self) private var router

    @State private var shareItem: DetailShareItem?

    private var isSaved: Bool {
        savedStore.isSaved(id: deal.id)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    heroSection
                    flightInfoSection
                    travelGuideSection
                    similarDealsSection
                }
                .padding(.bottom, 100)
            }
            .background(Color.sgBg)

            stickyBottomBar
        }
        .sheet(item: $shareItem) { item in
            DetailShareSheet(activityItems: [item.url])
        }
    }

    // MARK: - Hero Section
    private var heroSection: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottomLeading) {
                CachedAsyncImage(url: deal.imageUrl) {
                    Rectangle().fill(Color.sgSurface)
                }
                .frame(width: geo.size.width, height: geo.size.height)
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
                    Text(deal.priceFormatted)
                        .font(SGFont.bodyBold(size: 24))
                        .foregroundStyle(Color.sgWhite)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(deal.tierColor)
                        .clipShape(Capsule())
                }
                .padding(16)
            }
        }
        .frame(height: UIScreen.main.bounds.height * 0.4)
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
            parts.append("\(dep) \u{2013} \(ret)")
        } else if let dep = deal.bestDepartureDate {
            parts.append(dep)
        }
        if deal.tripDays > 0 { parts.append("\(deal.tripDays) days") }
        return parts.joined(separator: " \u{00B7} ")
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
            Text(otherDeal.priceFormatted)
                .font(SGFont.bodyBold(size: 13))
                .foregroundStyle(Color.sgYellow)
        }
        .frame(width: 140)
        .contentShape(Rectangle())
        .onTapGesture { router.showDeal(otherDeal) }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(otherDeal.city), \(otherDeal.priceFormatted)")
        .accessibilityHint("View deal details")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Sticky Bottom Bar
    private var stickyBottomBar: some View {
        HStack(spacing: 12) {
            Button {
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
                if let url = deal.shareURL {
                    shareItem = DetailShareItem(url: url)
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
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            Color.sgBg.opacity(0.95)
                .background(.ultraThinMaterial)
        )
    }
}

// MARK: - Share Helpers

private struct DetailShareItem: Identifiable {
    let id = UUID()
    let url: URL
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
}
