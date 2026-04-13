import SwiftUI

// MARK: - Itinerary Section
// Day-by-day breakdown. Activities are tappable to open in Apple Maps.
// Section head uses SplitFlapText + Playfair accent subtitle.

struct DetailItinerarySection: View {
    let deal: Deal

    @State private var appeared = false

    private var matchedItinerary: [ItineraryDay] {
        guard let itinerary = deal.itinerary, !itinerary.isEmpty else { return [] }
        let tripLength = deal.tripDays
        return tripLength > 0 ? Array(itinerary.prefix(tripLength)) : itinerary
    }

    var body: some View {
        if !matchedItinerary.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    SplitFlapText(
                        text: deal.tripDays > 0 ? "\(deal.tripDays)-DAY PLAN" : "ITINERARY",
                        style: .ticker,
                        maxLength: 12,
                        animate: appeared,
                        animationID: appeared ? 1 : 0
                    )
                    .accessibilityAddTraits(.isHeader)
                    Spacer()
                    if deal.tripDays > 0 {
                        Text("\(deal.tripDays) days")
                            .font(SGFont.body(size: 12))
                            .foregroundStyle(Color.sgYellow)
                    }
                }

                VStack(alignment: .leading, spacing: 16) {
                    ForEach(Array(matchedItinerary.enumerated()), id: \.offset) { index, day in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 8) {
                                Text("Day \(day.day)")
                                    .font(SGFont.bodyBold(size: 14))
                                    .foregroundStyle(Color.sgYellow)
                                    .frame(width: 48, alignment: .leading)
                                Rectangle().fill(Color.sgBorder).frame(height: 1)
                            }
                            ForEach(day.activities, id: \.self) { activity in
                                Button {
                                    openInMaps(activity, city: deal.city)
                                } label: {
                                    HStack(alignment: .top, spacing: 8) {
                                        Image(systemName: "mappin.circle.fill")
                                            .font(.system(size: 14))
                                            .foregroundStyle(Color.sgGreen)
                                            .frame(width: 20)
                                        Text(activity)
                                            .font(SGFont.body(size: 14))
                                            .foregroundStyle(Color.sgWhiteDim)
                                            .lineSpacing(2)
                                            .multilineTextAlignment(.leading)
                                        Spacer(minLength: 0)
                                        Image(systemName: "arrow.up.right.square")
                                            .font(.system(size: 11))
                                            .foregroundStyle(Color.sgMuted)
                                    }
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Open \(activity) in Maps")
                            }
                        }
                        .opacity(appeared ? 1 : 0)
                        .offset(y: appeared ? 0 : 12)
                        .animation(
                            SGCurve.heroEntrance
                                .respectingReduceMotion()
                                .delay(0.05 + SGSpring.cascadeDelay(index: index, staggerMs: 60)),
                            value: appeared
                        )
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .onAppear {
                appeared = true
            }
        }
    }

    private func openInMaps(_ place: String, city: String) {
        let query = "\(place), \(city)".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? place
        if let url = URL(string: "maps://?q=\(query)") {
            UIApplication.shared.open(url)
        }
    }
}
