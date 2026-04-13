import SwiftUI

// MARK: - Hotels Section
// Thin wrapper — triggers hotel search sheet and shows price teaser if available.
// Actual search lives in HotelSearchView.

struct DetailHotelsSection: View {
    let deal: Deal
    @Binding var showHotelSearch: Bool

    @State private var appeared = false

    var body: some View {
        let hotelPrice = deal.hotelPricePerNight ?? deal.liveHotelPrice
        let hasHotelData = deal.latitude != nil && deal.longitude != nil

        if hasHotelData {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    SplitFlapText(
                        text: "HOTELS",
                        style: .ticker,
                        maxLength: 8,
                        animate: appeared,
                        animationID: appeared ? 1 : 0
                    )
                    .accessibilityAddTraits(.isHeader)
                    Spacer()
                    if let hp = hotelPrice, hp > 0 {
                        Text("from $\(Int(hp))/night")
                            .font(SGFont.body(size: 12))
                            .foregroundStyle(Color.sgYellow)
                    }
                }

                Button {
                    HapticEngine.light()
                    showHotelSearch = true
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "building.2.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(Color.sgYellow)
                            .frame(width: 36, height: 36)
                            .background(Color.sgYellow.opacity(0.12))
                            .clipShape(Circle())

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Search Hotels in \(deal.city)")
                                .font(SGFont.bodyBold(size: 14))
                                .foregroundStyle(Color.sgWhite)
                            if let hp = hotelPrice, hp > 0 {
                                Text("Avg $\(Int(hp)) per night · live prices")
                                    .font(SGFont.body(size: 12))
                                    .foregroundStyle(Color.sgMuted)
                            } else {
                                Text("Find rooms for your travel dates")
                                    .font(SGFont.body(size: 12))
                                    .foregroundStyle(Color.sgMuted)
                            }
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.sgMuted)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Search hotels in \(deal.city)")
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.sgSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 16)
            .onAppear {
                withAnimation(SGCurve.heroEntrance.respectingReduceMotion().delay(0.10)) {
                    appeared = true
                }
            }
        }
    }
}
