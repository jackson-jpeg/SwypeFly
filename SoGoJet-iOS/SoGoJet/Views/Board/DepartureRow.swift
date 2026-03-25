import SwiftUI

// MARK: - Departure Board Slot
// Stable board slots let the terminal blank and refill rows without rebuilding views.

struct DepartureBoardSlot: Identifiable, Equatable {
    let id: Int
    let deal: Deal?
    let code: String
    let destination: String
    let price: String
    let airlineName: String
    let country: String

    var isBlank: Bool {
        deal == nil
    }

    static func blank(slot: Int) -> DepartureBoardSlot {
        DepartureBoardSlot(
            id: slot,
            deal: nil,
            code: "   ",
            destination: "            ",
            price: "      ",
            airlineName: "",
            country: ""
        )
    }

    static func fromDeal(_ deal: Deal, slot: Int) -> DepartureBoardSlot {
        DepartureBoardSlot(
            id: slot,
            deal: deal,
            code: deal.iataCode.uppercased(),
            destination: deal.city.uppercased(),
            price: deal.priceFormatted,
            airlineName: deal.airlineName,
            country: deal.country
        )
    }

    var accessibilityText: String {
        guard let deal else {
            return "Empty departure board row"
        }
        var parts = [deal.city, deal.country, deal.priceFormatted]
        if deal.airlineName != "—" {
            parts.append(deal.airlineName)
        }
        if let dur = deal.flightDuration, !dur.isEmpty {
            parts.append(dur)
        }
        let stops = deal.stopsLabel
        if !stops.isEmpty {
            parts.append(stops)
        }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Departure Row

struct DepartureRow: View {
    let slot: DepartureBoardSlot
    var isActive: Bool = false
    var animate: Bool = false
    var animationID: Int = 0

    private var priceColor: Color {
        if slot.isBlank {
            return Color.sgFaint.opacity(0.45)
        }
        return slot.deal?.displayPrice != nil ? Color.sgYellow : Color.sgFaint
    }

    private var destinationColor: Color {
        if slot.isBlank {
            return Color.sgFaint.opacity(0.45)
        }
        return isActive ? Color.sgWhite : Color.sgWhiteDim
    }

    private var accessibilityTraits: AccessibilityTraits {
        if slot.isBlank {
            return .isStaticText
        }
        return isActive ? [.isSelected, .isButton] : .isButton
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: Spacing.sm) {
                SplitFlapRow(
                    text: slot.code,
                    maxLength: 3,
                    size: .sm,
                    color: slot.isBlank ? Color.sgFaint.opacity(0.5) : Color.sgYellow,
                    alignment: .leading,
                    animate: animate,
                    startDelay: 0,
                    staggerMs: 40,
                    animationID: animationID
                )
                .frame(width: 64, alignment: .leading)

                SplitFlapRow(
                    text: slot.destination,
                    maxLength: 12,
                    size: .md,
                    color: destinationColor,
                    alignment: .leading,
                    animate: animate,
                    startDelay: 0.05,
                    staggerMs: 40,
                    animationID: animationID
                )
                .frame(maxWidth: .infinity, alignment: .leading)

                SplitFlapRow(
                    text: slot.price,
                    maxLength: 6,
                    size: .sm,
                    color: priceColor,
                    alignment: .trailing,
                    animate: animate,
                    startDelay: 0.10,
                    staggerMs: 40,
                    animationID: animationID
                )
                .frame(width: 110, alignment: .trailing)
            }

            // Country + flight info subtitle
            if !slot.isBlank, let deal = slot.deal {
                HStack(spacing: 4) {
                    Text(slot.country)
                    if let dur = deal.flightDuration, !dur.isEmpty {
                        Text("·").foregroundStyle(Color.sgFaint)
                        Text(dur)
                    }
                    let stops = deal.stopsLabel
                    if !stops.isEmpty {
                        Text("·").foregroundStyle(Color.sgFaint)
                        Text(stops.lowercased())
                    }
                }
                .font(SGFont.caption)
                .foregroundStyle(Color.sgMuted)
                .padding(.leading, 64 + Spacing.sm)
            }
        }
        .padding(.vertical, Spacing.xs)
        .padding(.horizontal, Spacing.sm)
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 1.5)
                .fill(isActive && !slot.isBlank ? Color.sgYellow : Color.clear)
                .frame(width: 3)
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge) // Cap scaling — fixed-width split-flap columns
        .opacity(slot.isBlank ? 0.35 : (isActive ? 1.0 : 0.6))
        .animation(.easeInOut(duration: 0.25), value: isActive)
        .allowsHitTesting(!slot.isBlank)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(slot.accessibilityText)
        .accessibilityAddTraits(accessibilityTraits)
    }
}

// MARK: - Preview

#Preview("Departure Row") {
    VStack(spacing: 2) {
        DepartureRow(
            slot: .fromDeal(.preview, slot: 0),
            isActive: true,
            animate: true
        )
        DepartureRow(
            slot: .fromDeal(.preview, slot: 1),
            isActive: false,
            animate: true
        )
        DepartureRow(
            slot: .blank(slot: 2),
            isActive: false,
            animate: true
        )
    }
    .padding(Spacing.md)
    .background(Color.sgBg)
}
