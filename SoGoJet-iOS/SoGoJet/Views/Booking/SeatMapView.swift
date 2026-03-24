import SwiftUI

// MARK: - Seat Map View
// Interactive seat selection grid with visual indicators for seat types.

struct SeatMapView: View {
    @Environment(BookingStore.self) private var store

    // Standard narrow-body column layout: A B C | aisle | D E F
    private let leftColumns = ["A", "B", "C"]
    private let rightColumns = ["D", "E", "F"]

    private let seatSize: CGFloat = 32
    private let seatSpacing: CGFloat = 4

    var body: some View {
        ZStack {
            Color.sgBg.ignoresSafeArea()

            VStack(spacing: Spacing.lg) {
                header
                legend

                if let seatMap = store.seatMap {
                    seatGrid(seatMap)
                } else {
                    noSeatMapView
                }

                Spacer()
                actionButtons
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.lg)
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            SplitFlapRow(
                text: "SELECT SEAT",
                maxLength: 12,
                size: .md,
                color: Color.sgYellow,
                animate: true,
                staggerMs: 40
            )
            Spacer()
        }
        .padding(.top, Spacing.md)
    }

    // MARK: - Legend

    private var legend: some View {
        HStack(spacing: Spacing.md) {
            legendItem(color: Color.sgSurface, border: Color.sgBorder, label: "Available")
            legendItem(color: Color.sgYellow, border: Color.sgYellow, label: "Selected")
            legendItem(color: Color.sgSurface, border: Color.sgGreen, label: "Legroom")
            legendItem(color: Color.sgFaint, border: Color.sgFaint, label: "Occupied")
            legendItem(color: Color.sgSurface, border: Color.sgOrange, label: "Best Value", dot: true)
        }
        .padding(.vertical, Spacing.sm)
    }

    private func legendItem(color: Color, border: Color, label: String, dot: Bool = false) -> some View {
        VStack(spacing: 2) {
            ZStack {
                RoundedRectangle(cornerRadius: 4)
                    .fill(color)
                    .frame(width: 16, height: 16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 4)
                            .strokeBorder(border, lineWidth: 1.5)
                    )

                if dot {
                    Circle()
                        .fill(Color.sgOrange)
                        .frame(width: 4, height: 4)
                }
            }

            Text(label)
                .font(SGFont.caption)
                .foregroundStyle(Color.sgMuted)
        }
    }

    // MARK: - Seat Grid

    private func seatGrid(_ seatMap: SeatMap) -> some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: seatSpacing) {
                // Column headers
                columnHeaders

                ForEach(seatMap.rows, id: \.rowNumber) { row in
                    seatRow(row)
                }
            }
        }
    }

    private var columnHeaders: some View {
        HStack(spacing: seatSpacing) {
            // Row number placeholder
            Text("")
                .frame(width: 24)

            ForEach(leftColumns, id: \.self) { col in
                Text(col)
                    .font(SGFont.bodyBold(size: 10))
                    .foregroundStyle(Color.sgMuted)
                    .frame(width: seatSize, height: 20)
            }

            // Aisle gap
            Text("")
                .frame(width: Spacing.md)

            ForEach(rightColumns, id: \.self) { col in
                Text(col)
                    .font(SGFont.bodyBold(size: 10))
                    .foregroundStyle(Color.sgMuted)
                    .frame(width: seatSize, height: 20)
            }
        }
    }

    private func seatRow(_ row: SeatRow) -> some View {
        HStack(spacing: seatSpacing) {
            // Row number
            Text("\(row.rowNumber)")
                .font(SGFont.bodySmall)
                .foregroundStyle(Color.sgMuted)
                .frame(width: 24, alignment: .trailing)

            // Left seats
            ForEach(leftColumns, id: \.self) { col in
                if let seat = findSeat(row: row, column: col) {
                    seatButton(seat)
                } else {
                    Color.clear
                        .frame(width: seatSize, height: seatSize)
                }
            }

            // Aisle gap
            Color.clear
                .frame(width: Spacing.md, height: seatSize)

            // Right seats
            ForEach(rightColumns, id: \.self) { col in
                if let seat = findSeat(row: row, column: col) {
                    seatButton(seat)
                } else {
                    Color.clear
                        .frame(width: seatSize, height: seatSize)
                }
            }
        }
    }

    private func seatButton(_ seat: SeatInfo) -> some View {
        let isSelected = store.selectedSeatId == seat.id
        let isExtraLegroom = seat.type == .extra
        let isBestValue = isExtraLegroom && seat.available && isCheapestExtra(seat)

        return Button {
            guard seat.available else { return }
            store.selectSeat(seat.id)
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: 6)
                    .fill(seatFillColor(seat: seat, isSelected: isSelected))
                    .frame(width: seatSize, height: seatSize)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .strokeBorder(
                                seatBorderColor(seat: seat, isSelected: isSelected, isExtraLegroom: isExtraLegroom, isBestValue: isBestValue),
                                lineWidth: isSelected || isExtraLegroom || isBestValue ? 2 : 1
                            )
                    )

                if isBestValue && !isSelected {
                    Circle()
                        .fill(Color.sgOrange)
                        .frame(width: 5, height: 5)
                        .offset(y: -8)
                }

                Text(seat.label)
                    .font(SGFont.caption)
                    .foregroundStyle(
                        isSelected ? Color.sgBg :
                        seat.available ? Color.sgWhiteDim : Color.sgFaint
                    )
            }
        }
        .disabled(!seat.available)
    }

    // MARK: - Seat Styling

    private func seatFillColor(seat: SeatInfo, isSelected: Bool) -> Color {
        if isSelected { return Color.sgYellow }
        if !seat.available { return Color.sgFaint.opacity(0.3) }
        return Color.sgSurface
    }

    private func seatBorderColor(seat: SeatInfo, isSelected: Bool, isExtraLegroom: Bool, isBestValue: Bool) -> Color {
        if isSelected { return Color.sgYellow }
        if isBestValue { return Color.sgOrange }
        if isExtraLegroom && seat.available { return Color.sgGreen }
        if !seat.available { return Color.sgFaint }
        return Color.sgBorder
    }

    // MARK: - No Seat Map

    private var noSeatMapView: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "airplane.circle")
                .font(.system(size: 48))
                .foregroundStyle(Color.sgMuted)

            Text("Seat selection not available")
                .font(SGFont.bodyDefault)
                .foregroundStyle(Color.sgMuted)

            Text("Your seat will be assigned at check-in")
                .font(SGFont.bodySmall)
                .foregroundStyle(Color.sgFaint)
        }
        .frame(maxHeight: .infinity)
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: Spacing.md) {
            // Skip
            Button {
                store.selectedSeatId = nil
                store.proceedToReview()
            } label: {
                Text("Skip")
                    .font(SGFont.bodyBold(size: 15))
                    .foregroundStyle(Color.sgWhiteDim)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.md)
                    .background(Color.sgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md)
                            .strokeBorder(Color.sgBorder, lineWidth: 1)
                    )
            }

            // Continue
            Button {
                store.proceedToReview()
            } label: {
                HStack(spacing: Spacing.sm) {
                    Text("Continue")
                        .font(SGFont.bodyBold(size: 15))

                    if let seatId = store.selectedSeatId,
                       let seat = findSeatById(seatId),
                       let price = seat.price {
                        Text("+$\(Int(price))")
                            .font(SGFont.bodySmall)
                    }
                }
                .foregroundStyle(Color.sgBg)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(store.selectedSeatId != nil ? Color.sgYellow : Color.sgMuted)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            }
            .disabled(store.selectedSeatId == nil)
        }
    }

    // MARK: - Helpers

    private func findSeat(row: SeatRow, column: String) -> SeatInfo? {
        row.seats.first { $0.label.hasSuffix(column) }
    }

    private func findSeatById(_ id: String) -> SeatInfo? {
        store.seatMap?.rows.flatMap(\.seats).first { $0.id == id }
    }

    private func isCheapestExtra(_ seat: SeatInfo) -> Bool {
        guard let allSeats = store.seatMap?.rows.flatMap(\.seats) else { return false }
        let extraSeats = allSeats.filter { $0.type == .extra && $0.available && $0.price != nil }
        guard let minPrice = extraSeats.compactMap(\.price).min() else { return false }
        return seat.price == minPrice
    }
}

// MARK: - Preview

#Preview("Seat Map") {
    let store = BookingStore()
    SeatMapView()
        .environment(store)
}
