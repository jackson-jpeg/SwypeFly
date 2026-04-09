import SwiftUI
import MapKit

// MARK: - Explore Map View
// Shows all feed deals as pins on a world map.
// Tapping a pin opens the deal detail.

struct ExploreMapView: View {
    let deals: [Deal]
    let onSelect: (Deal) -> Void

    @State private var camera: MapCameraPosition = .automatic

    private var mappableDeals: [Deal] {
        deals.filter { $0.latitude != nil && $0.longitude != nil }
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            Map(position: $camera) {
                ForEach(mappableDeals) { deal in
                    Annotation(deal.city, coordinate: CLLocationCoordinate2D(
                        latitude: deal.latitude ?? 0,
                        longitude: deal.longitude ?? 0
                    )) {
                        mapPin(for: deal)
                    }
                }
            }
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .ignoresSafeArea()

            // Close button
            Button {
                // Dismissed by the presenting view
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.sgWhite)
                    .frame(width: 36, height: 36)
                    .background(Color.sgBg.opacity(0.8))
                    .clipShape(Circle())
            }
            .accessibilityLabel(String(localized: "common.close"))
            .padding(.top, 60)
            .padding(.leading, 16)

            // Deal count
            VStack {
                Spacer()
                HStack {
                    Text("\(mappableDeals.count) destinations")
                        .font(SGFont.bodyBold(size: 13))
                        .foregroundStyle(Color.sgWhite)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Color.sgBg.opacity(0.85))
                        .clipShape(Capsule())
                        .accessibilityLabel("\(mappableDeals.count) destinations on map")
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 100)
            }
        }
    }

    private func mapPin(for deal: Deal) -> some View {
        Button {
            onSelect(deal)
        } label: {
            VStack(spacing: 2) {
                // Price bubble
                VStack(spacing: 0) {
                    if deal.isEstimatedPrice {
                        Text("from")
                            .font(.system(size: 7, weight: .medium))
                            .foregroundStyle(Color.sgBg.opacity(0.7))
                    }
                    Text(deal.priceFormatted)
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color.sgBg)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(deal.tierColor)
                .clipShape(Capsule())

                // Pin point
                Image(systemName: "arrowtriangle.down.fill")
                    .font(.system(size: 8))
                    .foregroundStyle(deal.tierColor)
                    .offset(y: -3)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(deal.city), \(deal.priceFormatted)")
        .accessibilityHint(String(localized: "map.pin.hint"))
    }
}
